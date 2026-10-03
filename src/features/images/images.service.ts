import { Role } from "@prisma/client";
import { prisma } from "../../utils/prisma";
import { NotFoundError, ForbiddenError, BadRequestError } from "../../common/errors";
import { writeAuditLog } from "../../common/audit";
import { storeUploadedImage, destroyStoredFile } from "../../utils/storage";

type Actor = { id: string; role: Role };

export type ImageScope = "properties" | "rooms";

export type ImageOwner = { kind: "property"; id: string } | { kind: "room"; id: string };

const imageSelect = {
  id: true,
  url: true,
  publicId: true,
  storage: true,
  width: true,
  height: true,
  bytes: true,
  mimeType: true,
  position: true,
  isPrimary: true,
  createdAt: true,
} as const;

export async function resolveImageOwner(scope: ImageScope, id: string): Promise<ImageOwner> {
  if (scope === "properties") {
    const property = await prisma.property.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!property) throw new NotFoundError("Property not found");
    return { kind: "property", id };
  }
  if (scope === "rooms") {
    const room = await prisma.room.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!room) throw new NotFoundError("Room not found");
    return { kind: "room", id };
  }
  throw new BadRequestError(`Unsupported image scope "${scope}"`);
}

async function assertCanManage(owner: ImageOwner, actor: Actor): Promise<void> {
  if (actor.role === Role.ADMIN) return;

  if (owner.kind === "property") {
    const property = await prisma.property.findFirst({ where: { id: owner.id, deletedAt: null }, select: { ownerId: true } });
    if (!property) throw new NotFoundError("Property not found");
    if (property.ownerId !== actor.id) throw new ForbiddenError("You do not own this property");
    return;
  }

  const room = await prisma.room.findFirst({
    where: { id: owner.id, deletedAt: null },
    select: { property: { select: { ownerId: true } } },
  });
  if (!room) throw new NotFoundError("Room not found");
  if (room.property.ownerId !== actor.id) throw new ForbiddenError("You do not own the property this room belongs to");
}

const imageCreateData = (owner: ImageOwner, position: number) =>
  owner.kind === "property" ? { propertyId: owner.id, position } : { roomId: owner.id, position };

const scopeDir = (owner: ImageOwner): string => (owner.kind === "property" ? "properties" : "rooms");

export async function uploadImages(owner: ImageOwner, files: Express.Multer.File[], actor: Actor) {
  if (!files.length) throw new BadRequestError("No files were uploaded. Send one or more files in the \"images\" field.");
  await assertCanManage(owner, actor);

  const startCount =
    owner.kind === "property"
      ? await prisma.propertyImage.count({ where: { propertyId: owner.id } })
      : await prisma.roomImage.count({ where: { roomId: owner.id } });

  const stored = await Promise.all(
    files.map(async (file) => ({ file, result: await storeUploadedImage(file, scopeDir(owner)) })),
  );

  const created: unknown[] = [];
  try {
    for (const [index, entry] of stored.entries()) {
      const position = startCount + index;
      const data = {
        ...imageCreateData(owner, position),
        url: entry.result.url,
        publicId: entry.result.publicId,
        storage: entry.result.driver,
        width: entry.result.width ?? null,
        height: entry.result.height ?? null,
        bytes: entry.result.bytes,
        mimeType: entry.result.mimeType,
        isPrimary: startCount === 0 && index === 0,
      };

      const record =
        owner.kind === "property"
          ? await prisma.propertyImage.create({ data: data as never, select: imageSelect })
          : await prisma.roomImage.create({ data: data as never, select: imageSelect });
      created.push(record);
    }
  } catch (error) {
    await Promise.allSettled(
      stored.map((entry) => destroyStoredFile(entry.result.driver, entry.result.publicId)),
    );
    throw error;
  }

  await writeAuditLog({
    action: "IMAGE_UPLOADED",
    actor,
    entityId: owner.id,
    entityType: owner.kind,
    after: { count: created.length },
  }).catch(() => undefined);

  return created;
}

export async function listImages(owner: ImageOwner) {
  return owner.kind === "property"
    ? prisma.propertyImage.findMany({ where: { propertyId: owner.id }, select: imageSelect, orderBy: [{ isPrimary: "desc" }, { position: "asc" }] })
    : prisma.roomImage.findMany({ where: { roomId: owner.id }, select: imageSelect, orderBy: [{ isPrimary: "desc" }, { position: "asc" }] });
}

async function findImage(id: string) {
  const [asProperty, asRoom] = await Promise.all([
    prisma.propertyImage.findUnique({ where: { id } }),
    prisma.roomImage.findUnique({ where: { id } }),
  ]);
  if (asProperty) return { kind: "property" as const, id: asProperty.propertyId, record: asProperty };
  if (asRoom) return { kind: "room" as const, id: asRoom.roomId, record: asRoom };
  throw new NotFoundError("Image not found");
}

export async function setPrimaryImage(id: string, actor: Actor) {
  const found = await findImage(id);
  await assertCanManage({ kind: found.kind, id: found.id }, actor);

  if (found.kind === "property") {
    await prisma.propertyImage.updateMany({ where: { propertyId: found.id, isPrimary: true }, data: { isPrimary: false } });
    return prisma.propertyImage.update({ where: { id }, data: { isPrimary: true }, select: imageSelect });
  }

  await prisma.roomImage.updateMany({ where: { roomId: found.id, isPrimary: true }, data: { isPrimary: false } });
  return prisma.roomImage.update({ where: { id }, data: { isPrimary: true }, select: imageSelect });
}

export async function deleteImage(id: string, actor: Actor) {
  const found = await findImage(id);
  await assertCanManage({ kind: found.kind, id: found.id }, actor);

  await prisma.$transaction(async (tx) => {
    if (found.kind === "property") {
      await tx.propertyImage.delete({ where: { id } });
      if (found.record.isPrimary) {
        const next = await tx.propertyImage.findFirst({
          where: { propertyId: found.id },
          orderBy: { position: "asc" },
          select: { id: true },
        });
        if (next) await tx.propertyImage.update({ where: { id: next.id }, data: { isPrimary: true } });
      }
      return;
    }

    await tx.roomImage.delete({ where: { id } });
    if (found.record.isPrimary) {
      const next = await tx.roomImage.findFirst({
        where: { roomId: found.id },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      if (next) await tx.roomImage.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
  });

  await destroyStoredFile(found.record.storage as never, found.record.publicId);

  await writeAuditLog({
    action: "IMAGE_DELETED",
    actor,
    entityId: found.id,
    entityType: found.kind,
    before: { id, isPrimary: found.record.isPrimary },
  }).catch(() => undefined);

  return { id, deleted: true };
}