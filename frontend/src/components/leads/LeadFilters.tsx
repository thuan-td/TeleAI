import { useTranslation } from "react-i18next";
import { Select } from "../ui/Select";
import { TextInput } from "../ui/TextInput";

export interface LeadFiltersValue {
  q: string;
  status: string;
  lang: string;
}

interface LeadFiltersProps {
  value: LeadFiltersValue;
  onChange: (value: LeadFiltersValue) => void;
}

export function LeadFilters({ value, onChange }: LeadFiltersProps) {
  const { t } = useTranslation();

  const statusOptions = [
    { value: "", label: t("leads.filters.statusAll") },
    { value: "new", label: t("leads.filters.statusNew") },
    { value: "invalid_number", label: t("leads.filters.statusInvalidNumber") },
    { value: "no_answer", label: t("leads.filters.statusNoAnswer") },
  ];

  const langOptions = [
    { value: "", label: t("leads.filters.langAll") },
    { value: "ja", label: t("leads.filters.langJa") },
    { value: "vi", label: t("leads.filters.langVi") },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex flex-1 min-w-50 flex-col gap-1 text-sm text-fg-muted">
        {t("leads.filters.searchLabel")}
        <TextInput
          value={value.q}
          onChange={(e) => onChange({ ...value, q: e.target.value })}
          placeholder={t("leads.filters.searchPlaceholder")}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-fg-muted">
        {t("leads.filters.statusLabel")}
        <Select value={value.status} onChange={(e) => onChange({ ...value, status: e.target.value })}>
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-fg-muted">
        {t("leads.filters.langLabel")}
        <Select value={value.lang} onChange={(e) => onChange({ ...value, lang: e.target.value })}>
          {langOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}
