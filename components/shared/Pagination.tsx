// components/shared/Pagination.tsx
'use client';

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

/*
Shared prev/next pagination control. Page numbers are derived from
`total`/`limit`; `hasMore` guards the next button for APIs that
report it. Keeps the existing minimal UI style.
*/
export default function Pagination({
  page,
  limit,
  total,
  hasMore,
  onPageChange,
  loading = false,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
      <span>
        Page {page} of {totalPages} · {total} total
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => onPageChange(page - 1)}
          className="rounded border px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={!hasMore || loading}
          onClick={() => onPageChange(page + 1)}
          className="rounded border px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Next'}
        </button>
      </div>
    </div>
  );
}
