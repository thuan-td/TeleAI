import { useState } from "react";
import { useTranslation } from "react-i18next";
import { dialCall } from "../../api/calls";
import { deleteLead, type Lead } from "../../api/leads";

interface LeadTableProps {
  leads: Lead[];
  isLoading: boolean;
  onEdit: (lead: Lead) => void;
  onChanged: () => void;
}

const STATUS_BADGE: Record<string, string> = {
  new: "bg-info-surface text-info-fg border border-info-border",
  invalid_number: "bg-danger-surface text-danger-fg border border-danger-border",
  no_answer: "bg-warning-surface text-warning-fg border border-warning-border",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE[status] ?? "bg-surface-sunken text-fg-muted border border-border";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

export function LeadTable({ leads, isLoading, onEdit, onChanged }: LeadTableProps) {
  const { t } = useTranslation();
  const [dialingId, setDialingId] = useState<string | null>(null);
  const [dialMessage, setDialMessage] = useState<string | null>(null);

  const handleDial = async (lead: Lead) => {
    setDialingId(lead.id);
    setDialMessage(null);
    try {
      await dialCall(lead.id);
      setDialMessage(t("leads.table.dialedMessage", { name: lead.name }));
      onChanged();
    } catch (err) {
      const message = (err as Error).message;
      setDialMessage(
        message.includes("403") || message.toLowerCase().includes("whitelist")
          ? t("leads.table.dialNotWhitelisted")
          : t("leads.table.dialError", { message }),
      );
    } finally {
      setDialingId(null);
    }
  };

  const handleDelete = async (lead: Lead) => {
    if (!window.confirm(t("leads.table.deleteConfirm", { name: lead.name }))) return;
    try {
      await deleteLead(lead.id);
      onChanged();
    } catch (err) {
      window.alert(t("leads.table.deleteError", { message: (err as Error).message }));
    }
  };

  if (isLoading) {
    return <p className="text-sm text-fg-subtle">{t("leads.table.loading")}</p>;
  }
  if (leads.length === 0) {
    return <p className="text-sm text-fg-subtle">{t("leads.table.empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {dialMessage && <p className="text-sm text-fg-muted">{dialMessage}</p>}
      <div className="overflow-x-auto rounded-lg border border-border bg-surface-raised">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-sunken text-xs uppercase tracking-wide text-fg-subtle">
            <tr>
              <th className="px-4 py-2.5">{t("leads.table.colName")}</th>
              <th className="px-4 py-2.5">{t("leads.table.colPhone")}</th>
              <th className="px-4 py-2.5">{t("leads.table.colLang")}</th>
              <th className="px-4 py-2.5">{t("leads.table.colStatus")}</th>
              <th className="px-4 py-2.5">{t("leads.table.colCreatedAt")}</th>
              <th className="px-4 py-2.5">{t("leads.table.colAction")}</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-b border-border last:border-0 hover:bg-surface-sunken/60">
                <td className="px-4 py-2.5 font-medium text-fg">{lead.name}</td>
                <td className="px-4 py-2.5 text-fg-muted">{lead.phone}</td>
                <td className="px-4 py-2.5 text-fg-muted">{lead.lang}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="px-4 py-2.5 text-fg-muted">
                  {new Date(lead.created_at).toLocaleString("vi-VN")}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(lead)}
                      className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-fg-muted hover:bg-surface-sunken"
                    >
                      {t("common.edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(lead)}
                      className="rounded-md border border-danger-border px-2.5 py-1 text-xs font-medium text-danger-fg hover:bg-danger-surface"
                    >
                      {t("common.delete")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDial(lead)}
                      disabled={dialingId === lead.id}
                      className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-fg hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {dialingId === lead.id ? t("leads.table.dialing") : t("leads.table.dialButton")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
