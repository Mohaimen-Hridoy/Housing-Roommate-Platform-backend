export interface PaginationInput {
  page?: string | number;
  pageSize?: string | number;
  sortBy?: string;
  sortOrder?: string;
}

export interface PaginationOutput {
  skip: number;
  take: number;
  page: number;
  pageSize: number;
  orderBy: Record<string, "asc" | "desc">;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function parsePagination(input: PaginationInput): PaginationOutput {
  const page = Math.max(Number(input.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(input.pageSize) || 20, 1), 100);
  const skip = (page - 1) * pageSize;
  const sortField = input.sortBy || "createdAt";
  const sortOrder = input.sortOrder === "asc" ? "asc" : "desc";

  return {
    skip,
    take: pageSize,
    page,
    pageSize,
    orderBy: { [sortField]: sortOrder },
  };
}

export function buildMeta(pagination: PaginationOutput, totalItems: number): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(totalItems / pagination.pageSize));
  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalItems,
    totalPages,
    hasNextPage: pagination.page < totalPages,
    hasPrevPage: pagination.page > 1,
  };
}

export interface CountDelegate {
  count: (args?: any) => Promise<number>;
}

export interface PaginatedResult {
  skip: number;
  take: number;
  orderBy: Record<string, "asc" | "desc">;
  page: number;
  pageSize: number;
  totalItems: number;
}

export async function paginateQuery(
  delegate: CountDelegate,
  where: Record<string, unknown>,
  pagination: PaginationInput
): Promise<PaginatedResult> {
  const p = parsePagination(pagination);
  const totalItems = await delegate.count({ where });
  return {
    skip: p.skip,
    take: p.take,
    orderBy: p.orderBy,
    page: p.page,
    pageSize: p.pageSize,
    totalItems,
  };
}
