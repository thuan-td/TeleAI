import type { CallSummary } from "../api/calls";
import { AudioPlayer } from "./AudioPlayer";

interface CallDetailProps {
  call: CallSummary | null;
}

export function CallDetail({ call }: CallDetailProps) {
  if (!call) {
    return <p>Chọn một cuộc gọi để xem chi tiết.</p>;
  }
  return (
    <div className="call-detail">
      <h2>{call.call_id}</h2>
      <p>Trạng thái: {call.status}</p>
      <p>Transcript: {call.transcript_status}</p>
      <AudioPlayer recordingUrl={call.recording_url} />
    </div>
  );
}
