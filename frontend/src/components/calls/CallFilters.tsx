import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchLeads, type Lead } from "../../api/leads";

export interface CallFiltersValue {
  status: string;
  leadId: string;
  dateFrom: string;
  dateTo: string;
  q: string;
}

interface CallFiltersProps {
  value: CallFiltersValue;
  onChange: (value: CallFiltersValue) => void;
}

const STATUS_VALUES = ["dialing", "in_progress", "ended", "failed", "invalid_number", "no_answer", "not_interested"];

export function CallFilters({ value, onChange }: CallFiltersProps) {
  const { t } = useTranslation();
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    fetchLeads({ pageSize: 100 })
      .then((data) => setLeads(data.items))
      .catch(() => setLeads([]));
  }, []);

  const statusOptions = [
    { value: "", label: t("calls.filters.statusAll") },
    ...STATUS_VALUES.map((s) => ({ value: s, label: t(`calls.filters.status.${s}`) })),
  ];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex flex-1 min-w-50 flex-col gap-1 text-sm text-slate-700">
        {t("calls.filters.searchLabel")}
        <input
          value={value.q}
          onChange={(e) => onChange({ ...value, q: e.target.value })}
          placeholder={t("calls.filters.searchPlaceholder")}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        {t("calls.filters.statusLabel")}
        <select
          value={value.status}
          onChange={(e) => onChange({ ...value, status: e.target.value })}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        {t("calls.filters.leadLabel")}
        <select
          value={value.leadId}
          onChange={(e) => onChange({ ...value, leadId: e.target.value })}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">{t("calls.filters.leadAll")}</option>
          {leads.map((lead) => (
            <option key={lead.id} value={lead.id}>
              {lead.name} ({lead.phone})
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        {t("calls.filters.dateFromLabel")}
        <input
          type="date"
          value={value.dateFrom}
          onChange={(e) => onChange({ ...value, dateFrom: e.target.value })}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        {t("calls.filters.dateToLabel")}
        <input
          type="date"
          value={value.dateTo}
          onChange={(e) => onChange({ ...value, dateTo: e.target.value })}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </label>
    </div>
  );
}
