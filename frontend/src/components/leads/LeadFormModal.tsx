import { useState } from "react";
import { useTranslation } from "react-i18next";
import { createLead, updateLead, type Lead } from "../../api/leads";
import { Select } from "../ui/Select";
import { TextInput } from "../ui/TextInput";

interface LeadFormModalProps {
  lead: Lead | null;
  onClose: () => void;
  onSaved: () => void;
}

export function LeadFormModal({ lead, onClose, onSaved }: LeadFormModalProps) {
  const { t } = useTranslation();
  const mode = lead ? "edit" : "create";
  const [phone, setPhone] = useState(lead?.phone ?? "");
  const [name, setName] = useState(lead?.name ?? "");
  const [lang, setLang] = useState(lead?.lang ?? "ja");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!phone.trim() || !name.trim()) {
      setError(t("leads.form.validationError"));
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      if (mode === "edit" && lead) {
        await updateLead(lead.id, { phone, name, lang });
      } else {
        await createLead({ phone, name, lang });
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay px-4">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-border bg-surface-raised p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-fg">
          {mode === "edit" ? t("leads.form.editTitle") : t("leads.form.createTitle")}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-fg-muted">
            {t("leads.form.phoneLabel")}
            <TextInput
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("leads.form.phonePlaceholder")}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-fg-muted">
            {t("leads.form.nameLabel")}
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("leads.form.namePlaceholder")}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-fg-muted">
            {t("leads.form.langLabel")}
            <Select value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="ja">{t("leads.form.langJa")}</option>
              <option value="vi">{t("leads.form.langVi")}</option>
            </Select>
          </label>
          {error && (
            <p className="rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger-fg">
              {error}
            </p>
          )}
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-fg-muted hover:bg-surface-sunken"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
