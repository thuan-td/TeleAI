import { useTranslation } from "react-i18next";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const { t } = useTranslation();
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const hasPrev = page > 1;
  const hasNext = to < total;

  return (
    <div className="flex items-center justify-between gap-3 text-sm text-fg-muted">
      <span>
        {from}–{to} / {total}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev}
          className="rounded-md border border-border px-3 py-1.5 font-medium text-fg-muted hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("pagination.prev")}
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
          className="rounded-md border border-border px-3 py-1.5 font-medium text-fg-muted hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("pagination.next")}
        </button>
      </div>
    </div>
  );
}
