import { Prisma, Role } from "@prisma/client";
import { prisma } from "../../utils/prisma";
import { NotFoundError, ForbiddenError, BadRequestError } from "../../common/errors";
import { writeAuditLog } from "../../common/audit";
import { buildMeta } from "../../utils/pagination";

type Actor = { id: string; role: Role };

const messageSelect = {
  id: true,
  senderId: true,
  recipientId: true,
  subject: true,
  body: true,
  propertyId: true,
  readAt: true,
  createdAt: true,
};

export interface MessageCreateInput {
  recipientId: string;
  subject?: string;
  body: string;
  propertyId?: string;
}

export async function sendMessage(input: MessageCreateInput, sender: Actor) {
  if (sender.id === input.recipientId) throw new BadRequestError("Cannot send a message to yourself");
  const recipient = await prisma.user.findFirst({ where: { id: input.recipientId, deletedAt: null } });
  if (!recipient) throw new NotFoundError("Recipient not found");

  if (input.propertyId) {
    const property = await prisma.property.findFirst({ where: { id: input.propertyId, deletedAt: null }, select: { ownerId: true } });
    if (!property) throw new NotFoundError("Property not found");
  }

  const message = await prisma.message.create({
    data: {
      senderId: sender.id,
      recipientId: input.recipientId,
      subject: input.subject,
      body: input.body,
      propertyId: input.propertyId,
    },
      select: { ...messageSelect, sender: { select: { id: true, name: true } } },
  });
  await writeAuditLog({ action: "MESSAGE_SENT", actor: sender, entityId: message.id, entityType: "message", after: { recipientId: message.recipientId } });
  return message;
}

export async function listMessages(input: { folder?: "inbox" | "sent"; propertyId?: string; read?: boolean; page?: number; pageSize?: number; sortBy?: string; sortOrder?: "asc" | "desc" }, actor: Actor) {
  const folder = input.folder === "sent" ? "sent" : "inbox";
  const allowedSort = ["createdAt"];
  const sortField = allowedSort.includes(input.sortBy || "") ? (input.sortBy as string) : "createdAt";
  const sortOrder = input.sortOrder === "asc" ? "asc" : "desc";
  const take = Math.min(Math.max(Number(input.pageSize) || 20, 1), 100);
  const page = Math.max(Number(input.page) || 1, 1);
  const skip = (page - 1) * take;

  const where: Prisma.MessageWhereInput = {};
  if (input.propertyId) where.propertyId = input.propertyId;
  if (folder === "inbox") {
    where.recipientId = actor.id;
    if (input.read === true) where.readAt = { not: null };
    if (input.read === false) where.readAt = null;
  } else {
    where.senderId = actor.id;
  }

  const [totalItems, rows] = await Promise.all([
    prisma.message.count({ where }),
    prisma.message.findMany({ where, orderBy: { [sortField]: sortOrder }, skip, take, select: messageSelect }),
  ]);
  return { rows, meta: { pagination: buildMeta({ skip, take, page, pageSize: take, orderBy: { [sortField]: sortOrder } }, totalItems) } };
}

export async function getConversation(otherUserId: string, actor: Actor) {
  if (actor.id === otherUserId) throw new BadRequestError("Cannot start a conversation with yourself");
  const other = await prisma.user.findFirst({ where: { id: otherUserId, deletedAt: null } });
  if (!other) throw new NotFoundError("User not found");

  const where: Prisma.MessageWhereInput = {
    OR: [{ senderId: actor.id, recipientId: otherUserId }, { senderId: otherUserId, recipientId: actor.id }],
  };
  const messages = await prisma.message.findMany({ where, orderBy: { createdAt: "asc" }, select: messageSelect });
  return messages;
}

export async function getMessage(id: string, actor: Actor) {
  const message = await prisma.message.findUnique({ where: { id }, select: messageSelect });
  if (!message) throw new NotFoundError("Message not found");
  const authorized = actor.role === Role.ADMIN || message.recipientId === actor.id || message.senderId === actor.id;
  if (!authorized) throw new ForbiddenError("You cannot view this message");
  return message;
}

export async function markRead(id: string, actor: Actor) {
  const message = await prisma.message.findUnique({ where: { id }, select: { recipientId: true } });
  if (!message) throw new NotFoundError("Message not found");
  if (message.recipientId !== actor.id && actor.role !== Role.ADMIN) throw new ForbiddenError("You cannot modify this message");
  const updated = await prisma.message.update({ where: { id }, data: { readAt: new Date() }, select: messageSelect });
  return updated;
}

export async function deleteMessage(id: string, actor: Actor) {
  const message = await prisma.message.findUnique({ where: { id }, select: { senderId: true, recipientId: true } });
  if (!message) throw new NotFoundError("Message not found");
  if (actor.role !== Role.ADMIN && message.senderId !== actor.id && message.recipientId !== actor.id) throw new ForbiddenError("You cannot delete this message");
  await prisma.message.delete({ where: { id } });
  return { id, deleted: true };
}
