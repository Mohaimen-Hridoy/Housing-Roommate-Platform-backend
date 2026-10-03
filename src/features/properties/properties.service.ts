import { Prisma, Role, PropertyStatus } from "@prisma/client";
import { prisma } from "../../utils/prisma";
import { buildMeta } from "../../utils/pagination";
import { NotFoundError, ForbiddenError, BadRequestError } from "../../common/errors";
import { writeAuditLog } from "../../common/audit";

type Actor = { id: string; role: Role };

const propertySelect = {
  id: true,
  ownerId: true,
  title: true,
  description: true,
  address: true,
  city: true,
  state: true,
  postalCode: true,
  country: true,
  lat: true,
  lng: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
};

const imageSelect = {
  id: true,
  url: true,
  publicId: true,
  storage: true,
  width: true,
  height: true,
  bytes: true,
  position: true,
  isPrimary: true,
} as const;

export interface ListPropertiesInput {
  status?: PropertyStatus;
  city?: string;
  state?: string;
  country?: string;
  ownerId?: string;
  search?: string;
  published?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PropertyCreateInput {
  title: string;
  description?: string;
  address: string;
  city: string;
  state?: string;
  postalCode?: string;
  country?: string;
  lat?: number;
  lng?: number;
  status?: PropertyStatus;
  amenities?: string[];
}

export async function listProperties(input: ListPropertiesInput & { includeDeleted?: boolean }) {
  const allowedSort = ["createdAt", "title", "publishedAt", "city"];
  const sortField = allowedSort.includes(input.sortBy || "") ? (input.sortBy as string) : "createdAt";
  const sortOrder = input.sortOrder === "asc" ? "asc" : "desc";
  const take = Math.min(Math.max(Number(input.pageSize) || 20, 1), 100);
  const page = Math.max(Number(input.page) || 1, 1);
  const skip = (page - 1) * take;

  const where: Prisma.PropertyWhereInput = {
    deletedAt: input.includeDeleted ? undefined : null,
    ...(input.status ? { status: input.status } : {}),
    ...(input.city ? { city: { equals: input.city } } : {}),
    ...(input.state ? { state: { equals: input.state } } : {}),
    ...(input.country ? { country: { equals: input.country } } : {}),
    ...(input.ownerId ? { ownerId: input.ownerId } : {}),
    ...(input.published === true ? { status: PropertyStatus.PUBLISHED, publishedAt: { not: null } } : {}),
    ...(input.search
      ? { OR: [{ title: { contains: input.search } }, { description: { contains: input.search } }, { city: { contains: input.search } }] }
      : {}),
  };

  const [totalItems, rows] = await Promise.all([
    prisma.property.count({ where }),
    prisma.property.findMany({ where, orderBy: { [sortField]: sortOrder }, skip, take, select: { ...propertySelect, amenities: { select: { amenity: { select: { id: true, name: true, icon: true } } } } } }),
  ]);

  return {
    rows: rows.map((p) => ({
      ...p,
      amenities: p.amenities.map((a) => a.amenity),
    })),
    meta: { pagination: buildMeta({ skip, take, page, pageSize: take, orderBy: { [sortField]: sortOrder } }, totalItems) },
  };
}

export async function getProperty(id: string) {
  const property = await prisma.property.findFirst({
    where: { id, deletedAt: null },
    select: {
      ...propertySelect,
      amenities: { select: { amenity: { select: { id: true, name: true, icon: true } } } },
      rooms: {
        where: { deletedAt: null, status: "AVAILABLE" },
        select: {
          id: true,
          title: true,
          rent: true,
          currency: true,
          area: true,
          bedrooms: true,
          bathrooms: true,
          images: { select: imageSelect, orderBy: [{ isPrimary: "desc" }, { position: "asc" }] },
        },
      },
      images: { select: imageSelect, orderBy: [{ isPrimary: "desc" }, { position: "asc" }] },
    },
  });
  if (!property) throw new NotFoundError("Property not found");
  return { ...property, amenities: property.amenities.map((a: { amenity: unknown }) => a.amenity) };
}

export async function createProperty(input: PropertyCreateInput, owner: Actor) {
  if (owner.role !== Role.OWNER && owner.role !== Role.ADMIN) {
    throw new BadRequestError("Only owners can create properties");
  }
  const data: Prisma.PropertyCreateInput = {
    title: input.title,
    description: input.description,
    address: input.address,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
    country: input.country ?? "US",
    lat: input.lat,
    lng: input.lng,
    status: input.status ?? PropertyStatus.DRAFT,
    owner: { connect: { id: owner.id } },
  };

  await checkAmenities(input.amenities);

  const property = await prisma.property.create({ data, select: propertySelect });

  if (input.amenities && input.amenities.length) {
    await prisma.propertyAmenity.createMany({
      data: input.amenities.map((a) => ({ propertyId: property.id, amenityId: a })),
    });
  }

  await writeAuditLog({ action: "PROPERTY_CREATED", actor: owner, entityId: property.id, entityType: "property", after: property });
  return property;
}

async function checkAmenities(amenityIds?: string[]) {
  if (!amenityIds?.length) return;
  const existing = await prisma.amenity.findMany({ where: { id: { in: amenityIds } }, select: { id: true } });
  if (existing.length !== amenityIds.length) throw new BadRequestError("One or more amenities do not exist");
}

async function canModifyProperty(propertyId: string, actor: Actor) {
  const property = await prisma.property.findFirst({ where: { id: propertyId, deletedAt: null }, select: { ownerId: true } });
  if (!property) throw new NotFoundError("Property not found");
  if (actor.role !== Role.ADMIN && property.ownerId !== actor.id) {
    throw new ForbiddenError("You do not own this property");
  }
  return property;
}

export async function updateProperty(id: string, input: Partial<PropertyCreateInput>, actor: Actor) {
  await canModifyProperty(id, actor);
  const updated = await prisma.property.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description,
      address: input.address,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      country: input.country,
      lat: input.lat,
      lng: input.lng,
      status: input.status,
      publishedAt: input.status === PropertyStatus.PUBLISHED ? new Date() : undefined,
      amenities: input.amenities
        ? { deleteMany: { propertyId: id }, create: input.amenities.map((a) => ({ amenity: { connect: { id: a } } })) }
        : undefined,
    },
    select: propertySelect,
  });
  await writeAuditLog({ action: "PROPERTY_UPDATED", actor, entityId: id, entityType: "property", after: updated });
  return updated;
}

export async function deleteProperty(id: string, actor: Actor) {
  const property = await canModifyProperty(id, actor);
  await prisma.property.update({ where: { id }, data: { deletedAt: new Date() } });
  await writeAuditLog({ action: "PROPERTY_DELETED", actor, entityId: id, entityType: "property", before: property });
  return { id, deleted: true };
}

export async function addAmenityToProperty(propertyId: string, amenityId: string, actor: Actor) {
  await canModifyProperty(propertyId, actor);
  const amenity = await prisma.amenity.findUnique({ where: { id: amenityId } });
  if (!amenity) throw new NotFoundError("Amenity not found");
  try {
    await prisma.propertyAmenity.create({ data: { propertyId, amenityId } });
  } catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw error;
  }
  return { propertyId, amenityId };
}

export async function removeAmenityFromProperty(propertyId: string, amenityId: string, actor: Actor) {
  await canModifyProperty(propertyId, actor);
  await prisma.propertyAmenity.deleteMany({ where: { propertyId, amenityId } });
  return { propertyId, amenityId };
}
