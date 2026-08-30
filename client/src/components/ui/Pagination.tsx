type PaginationProps = {
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
}

export function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: PaginationProps) {
  if (total === 0 || totalPages <= 1) {
    return null
  }

  const isFirst = page <= 1
  const isLast = page >= totalPages

  return (
    <nav
      className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6"
      aria-label="Pagination"
    >
      <p className="text-sm text-muted">
        Page {page} of {totalPages}
        <span className="sr-only">. {total} products in total.</span>
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => onPageChange(page - 1)}
          disabled={isFirst}
        >
          Previous
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => onPageChange(page + 1)}
          disabled={isLast}
        >
          Next
        </button>
      </div>
    </nav>
  )
}
