import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchLeads, type Lead } from "../../api/leads";
import { Select } from "../ui/Select";
import { TextInput } from "../ui/TextInput";

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
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex flex-1 min-w-50 flex-col gap-1 text-sm text-fg-muted">
        {t("calls.filters.searchLabel")}
        <TextInput
          value={value.q}
          onChange={(e) => onChange({ ...value, q: e.target.value })}
          placeholder={t("calls.filters.searchPlaceholder")}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-fg-muted">
        {t("calls.filters.statusLabel")}
        <Select value={value.status} onChange={(e) => onChange({ ...value, status: e.target.value })}>
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-fg-muted">
        {t("calls.filters.leadLabel")}
        <Select value={value.leadId} onChange={(e) => onChange({ ...value, leadId: e.target.value })}>
          <option value="">{t("calls.filters.leadAll")}</option>
          {leads.map((lead) => (
            <option key={lead.id} value={lead.id}>
              {lead.name} ({lead.phone})
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-fg-muted">
        {t("calls.filters.dateFromLabel")}
        <TextInput
          type="date"
          value={value.dateFrom}
          onChange={(e) => onChange({ ...value, dateFrom: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-fg-muted">
        {t("calls.filters.dateToLabel")}
        <TextInput
          type="date"
          value={value.dateTo}
          onChange={(e) => onChange({ ...value, dateTo: e.target.value })}
        />
      </label>
    </div>
  );
}
