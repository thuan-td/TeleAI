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
  new: "bg-slate-100 text-slate-700",
  invalid_number: "bg-red-100 text-red-700",
  no_answer: "bg-amber-100 text-amber-700",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE[status] ?? "bg-slate-100 text-slate-700";
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
    return <p className="text-sm text-slate-500">{t("leads.table.loading")}</p>;
  }
  if (leads.length === 0) {
    return <p className="text-sm text-slate-500">{t("leads.table.empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {dialMessage && <p className="text-sm text-slate-700">{dialMessage}</p>}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
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
              <tr key={lead.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5 text-slate-900">{lead.name}</td>
                <td className="px-4 py-2.5 text-slate-700">{lead.phone}</td>
                <td className="px-4 py-2.5 text-slate-700">{lead.lang}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="px-4 py-2.5 text-slate-700">
                  {new Date(lead.created_at).toLocaleString("vi-VN")}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(lead)}
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      {t("common.edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(lead)}
                      className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      {t("common.delete")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDial(lead)}
                      disabled={dialingId === lead.id}
                      className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
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
