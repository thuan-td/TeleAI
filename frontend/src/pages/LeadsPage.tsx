import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchLeads, type Lead, type PaginatedLeads } from "../api/leads";
import { LeadFilters, type LeadFiltersValue } from "../components/leads/LeadFilters";
import { LeadFormModal } from "../components/leads/LeadFormModal";
import { LeadTable } from "../components/leads/LeadTable";
import { Pagination } from "../components/Pagination";

const PAGE_SIZE = 20;
const EMPTY_FILTERS: LeadFiltersValue = { q: "", status: "", lang: "" };

export function LeadsPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<LeadFiltersValue>(EMPTY_FILTERS);
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedLeads | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(filters.q), 300);
    return () => clearTimeout(timer);
  }, [filters.q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, filters.status, filters.lang]);

  const loadLeads = useCallback(() => {
    setIsLoading(true);
    setError(null);
    fetchLeads({
      page,
      pageSize: PAGE_SIZE,
      q: debouncedQ || undefined,
      status: filters.status || undefined,
      lang: filters.lang || undefined,
    })
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [page, debouncedQ, filters.status, filters.lang]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const handleSaved = (closeModal: () => void) => {
    closeModal();
    loadLeads();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{t("leads.title")}</h1>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg shadow-sm hover:bg-accent-hover"
        >
          {t("leads.createButton")}
        </button>
      </div>

      <LeadFilters value={filters} onChange={setFilters} />

      {error && (
        <p className="rounded-md border border-danger-border bg-danger-surface px-4 py-2 text-sm text-danger-fg">
          {t("leads.loadError", { message: error })}
        </p>
      )}

      <LeadTable
        leads={data?.items ?? []}
        isLoading={isLoading}
        onEdit={setEditingLead}
        onChanged={loadLeads}
      />

      {data && data.total > 0 && (
        <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPageChange={setPage} />
      )}

      {showCreateModal && (
        <LeadFormModal
          lead={null}
          onClose={() => setShowCreateModal(false)}
          onSaved={() => handleSaved(() => setShowCreateModal(false))}
        />
      )}
      {editingLead && (
        <LeadFormModal
          lead={editingLead}
          onClose={() => setEditingLead(null)}
          onSaved={() => handleSaved(() => setEditingLead(null))}
        />
      )}
    </div>
  );
}
