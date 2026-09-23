import type { CallSummary } from "../api/calls";

interface CallListProps {
  calls: CallSummary[];
  selectedCallId: string | null;
  onSelect: (callId: string) => void;
  isLoading: boolean;
}

export function CallList({ calls, selectedCallId, onSelect, isLoading }: CallListProps) {
  if (isLoading) {
    return <p className="text-sm text-slate-500">Đang tải danh sách cuộc gọi…</p>;
  }
  if (calls.length === 0) {
    return <p className="text-sm text-slate-500">Chưa có cuộc gọi nào.</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-white p-2">
      {calls.map((call) => (
        <li key={call.call_id}>
          <button
            type="button"
            className={
              call.call_id === selectedCallId
                ? "w-full rounded-md bg-indigo-600 px-3 py-2 text-left text-sm font-medium text-white"
                : "w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
            }
            onClick={() => onSelect(call.call_id)}
          >
            {call.call_id} — {call.status}
          </button>
        </li>
      ))}
    </ul>
  );
}
