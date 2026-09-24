import { useState } from "react";
import { useTranslation } from "react-i18next";
import { createLead, updateLead, type Lead } from "../../api/leads";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-slate-900">
          {mode === "edit" ? t("leads.form.editTitle") : t("leads.form.createTitle")}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            {t("leads.form.phoneLabel")}
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("leads.form.phonePlaceholder")}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            {t("leads.form.nameLabel")}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("leads.form.namePlaceholder")}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            {t("leads.form.langLabel")}
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ja">{t("leads.form.langJa")}</option>
              <option value="vi">{t("leads.form.langVi")}</option>
            </select>
          </label>
          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
