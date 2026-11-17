// lib/pagination.ts
//
// Shared offset-pagination param parsing for list endpoints.
// Offset (skip/limit) is used rather than cursor pagination because
// the hot queries are already index-backed and page sizes are small
// (<= 100); revisit with cursors if deep-page scans become a problem.

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export type PaginationResult = PaginationParams | { error: string };

export function parsePaginationParams(
  searchParams: URLSearchParams,
): PaginationResult {
  const pageRaw = searchParams.get('page');
  const limitRaw = searchParams.get('limit');

  const page = pageRaw === null ? 1 : Number(pageRaw);
  const limit = limitRaw === null ? DEFAULT_PAGE_SIZE : Number(limitRaw);

  if (!Number.isInteger(page) || page < 1) {
    return { error: 'Invalid page: must be a positive integer' };
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    return { error: `Invalid limit: must be an integer between 1 and ${MAX_PAGE_SIZE}` };
  }

  return { page, limit, skip: (page - 1) * limit };
}
