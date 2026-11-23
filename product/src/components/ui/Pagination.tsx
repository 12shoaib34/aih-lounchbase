import type { ReactNode } from "react";
import { Button } from "./Button";

export function PaginationControls({
  label,
  indicator,
  previousLabel = "Previous",
  nextLabel = "Next",
  previousDisabled,
  nextDisabled,
  onPrevious,
  onNext,
}: {
  label: string;
  indicator: ReactNode;
  previousLabel?: string;
  nextLabel?: string;
  previousDisabled: boolean;
  nextDisabled: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  return (
    <nav className="pagination" aria-label={label}>
      <Button
        variant="secondary"
        disabled={previousDisabled}
        onClick={onPrevious}
      >
        {previousLabel}
      </Button>
      <span className="pagination-label">{indicator}</span>
      <Button variant="secondary" disabled={nextDisabled} onClick={onNext}>
        {nextLabel}
      </Button>
    </nav>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  disabled = false,
  loading = false,
  label = "Record pages",
  maxPage = Infinity,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  maxPage?: number;
  onPageChange?: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <PaginationControls
      label={label}
      indicator={
        loading ? (
          <>
            <span className="sr-only">Loading pages…</span>
            <span
              className="invoice-skeleton invoice-pages-skeleton"
              aria-hidden="true"
            />
          </>
        ) : (
          <>
            Page {page}
            {page <= pages ? ` of ${pages}` : ""}
          </>
        )
      }
      previousDisabled={disabled || loading || page <= 1}
      nextDisabled={disabled || loading || page >= pages || page >= maxPage}
      onPrevious={() => onPageChange?.(page - 1)}
      onNext={() => onPageChange?.(page + 1)}
    />
  );
}
