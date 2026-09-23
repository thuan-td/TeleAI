import type { CallSummary } from "../api/calls";
import { AudioPlayer } from "./AudioPlayer";

interface CallDetailProps {
  call: CallSummary | null;
}

export function CallDetail({ call }: CallDetailProps) {
  if (!call) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Chọn một cuộc gọi để xem chi tiết.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold text-slate-900">{call.call_id}</h2>
      <p className="text-sm text-slate-600">
        Trạng thái: <span className="font-medium text-slate-900">{call.status}</span>
      </p>
      <p className="text-sm text-slate-600">
        Transcript: <span className="font-medium text-slate-900">{call.transcript_status}</span>
      </p>
      <AudioPlayer recordingUrl={call.recording_url} />
    </div>
  );
}
