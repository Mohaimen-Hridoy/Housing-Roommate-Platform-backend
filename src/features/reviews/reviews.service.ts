import { Prisma, Role, ReviewSubject, BookingStatus } from "@prisma/client";
import { prisma } from "../../utils/prisma";
import { NotFoundError, ForbiddenError, BadRequestError, ConflictError } from "../../common/errors";
import { writeAuditLog } from "../../common/audit";
import { buildMeta } from "../../utils/pagination";

type Actor = { id: string; role: Role };

const reviewSelect = {
  id: true,
  subject: true,
  reviewableId: true,
  authorId: true,
  bookingId: true,
  rating: true,
  comment: true,
  createdAt: true,
  updatedAt: true,
};

export interface ReviewCreateInput {
  subject: ReviewSubject;
  reviewableId: string;
  bookingId: string;
  rating: number;
  comment?: string;
}

export interface ListReviewsInput {
  subject?: ReviewSubject;
  reviewableId?: string;
  authorId?: string;
  minRating?: number;
  maxRating?: number;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export async function listReviews(input: ListReviewsInput) {
  const allowedSort = ["createdAt", "rating"];
  const sortField = allowedSort.includes(input.sortBy || "") ? (input.sortBy as string) : "createdAt";
  const sortOrder = input.sortOrder === "asc" ? "asc" : "desc";
  const take = Math.min(Math.max(Number(input.pageSize) || 20, 1), 100);
  const page = Math.max(Number(input.page) || 1, 1);
  const skip = (page - 1) * take;

  const where: Prisma.ReviewWhereInput = {
    ...(input.subject ? { subject: input.subject } : {}),
    ...(input.reviewableId ? { reviewableId: input.reviewableId } : {}),
    ...(input.authorId ? { authorId: input.authorId } : {}),
    rating: { gte: input.minRating ?? undefined, lte: input.maxRating ?? undefined },
  };
  const [totalItems, rows] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({ where, orderBy: { [sortField]: sortOrder }, skip, take, select: { ...reviewSelect, author: { select: { id: true, name: true } } } }),
  ]);
  return { rows, meta: { pagination: buildMeta({ skip, take, page, pageSize: take, orderBy: { [sortField]: sortOrder } }, totalItems) } };
}

export async function getReview(id: string) {
  const review = await prisma.review.findUnique({
    where: { id },
    select: {
      ...reviewSelect,
      author: { select: { id: true, name: true } },
    },
  });
  if (!review) throw new NotFoundError("Review not found");
  return review;
}

export async function createReview(input: ReviewCreateInput, author: Actor) {
  const booking = await prisma.booking.findFirst({
    where: { id: input.bookingId, deletedAt: null },
    select: { id: true, tenantId: true, roomId: true, propertyId: true, status: true, property: { select: { ownerId: true } } },
  });
  if (!booking) throw new NotFoundError("Booking not found");
  const isTenant = booking.tenantId === author.id;
  const isOwner = booking.property.ownerId === author.id;
  if (!isTenant && !isOwner) throw new ForbiddenError("You are not a participant in this booking");
  if (booking.status !== BookingStatus.APPROVED) throw new BadRequestError("Booking must be approved before reviewing");

  if (input.subject === ReviewSubject.ROOM) {
    if (input.reviewableId !== booking.roomId) throw new BadRequestError("Reviewable room does not match the booking");
  } else {
    if (input.reviewableId !== booking.propertyId) throw new BadRequestError("Reviewable property does not match the booking");
  }

  const existing = await prisma.review.findFirst({ where: { bookingId: input.bookingId, subject: input.subject, reviewableId: input.reviewableId, authorId: author.id } });
  if (existing) throw new ConflictError("You have already reviewed this");

  const review = await prisma.review.create({
    data: {
      subject: input.subject,
      reviewableId: input.reviewableId,
      author: { connect: { id: author.id } },
      booking: { connect: { id: input.bookingId } },
      rating: input.rating,
      comment: input.comment,
    },
    select: reviewSelect,
  });
  await writeAuditLog({ action: "REVIEW_CREATED", actor: author, entityId: review.id, entityType: "review", after: review });
  return review;
}

export async function deleteReview(id: string, actor: Actor) {
  const review = await prisma.review.findUnique({ where: { id }, select: { id: true, authorId: true } });
  if (!review) throw new NotFoundError("Review not found");
  if (actor.role !== Role.ADMIN && review.authorId !== actor.id) throw new ForbiddenError("You can only delete your own review");
  await prisma.review.delete({ where: { id } });
  await writeAuditLog({ action: "REVIEW_DELETED", actor, entityId: id, entityType: "review", before: review });
  return { id, deleted: true };
}
