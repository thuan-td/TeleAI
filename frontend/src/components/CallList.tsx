import type { CallSummary } from "../api/calls";

interface CallListProps {
  calls: CallSummary[];
  selectedCallId: string | null;
  onSelect: (callId: string) => void;
  isLoading: boolean;
}

export function CallList({ calls, selectedCallId, onSelect, isLoading }: CallListProps) {
  if (isLoading) {
    return <p>Đang tải danh sách cuộc gọi…</p>;
  }
  if (calls.length === 0) {
    return <p>Chưa có cuộc gọi nào.</p>;
  }
  return (
    <ul className="call-list">
      {calls.map((call) => (
        <li key={call.call_id}>
          <button
            type="button"
            className={call.call_id === selectedCallId ? "selected" : ""}
            onClick={() => onSelect(call.call_id)}
          >
            {call.call_id} — {call.status}
          </button>
        </li>
      ))}
    </ul>
  );
}
