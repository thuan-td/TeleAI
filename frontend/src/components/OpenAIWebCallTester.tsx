import { useCallback, useEffect, useRef, useState } from "react";
import { startOpenAIWebCall } from "../api/calls";

type CallState = "idle" | "connecting" | "active" | "ended" | "error";

const OPENAI_REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

export function OpenAIWebCallTester() {
  const [callState, setCallState] = useState<CallState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    dcRef.current?.close();
    dcRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const handleStart = useCallback(async () => {
    setErrorMessage(null);
    setCallState("connecting");
    try {
      // 1. Backend mints a short-lived ephemeral secret (real OPENAI_API_KEY stays server-side).
      const { client_secret: ephemeralKey } = await startOpenAIWebCall();

      // 2. Native WebRTC: data channel for events + local mic track + remote audio playback.
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.addEventListener("close", () => setCallState((prev) => (prev === "error" ? prev : "ended")));

      pc.ontrack = (event) => {
        if (audioElRef.current) {
          audioElRef.current.srcObject = event.streams[0];
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // 3. Create SDP offer, send to OpenAI Realtime, apply SDP answer.
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch(OPENAI_REALTIME_CALLS_URL, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          "Content-Type": "application/sdp",
        },
      });
      if (!sdpResponse.ok) {
        throw new Error(`OpenAI Realtime từ chối kết nối WebRTC: ${sdpResponse.status}`);
      }
      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      setCallState("active");
    } catch (err) {
      setErrorMessage((err as Error).message);
      setCallState("error");
      cleanup();
    }
  }, [cleanup]);

  const handleStop = useCallback(() => {
    cleanup();
    setCallState("ended");
  }, [cleanup]);

  const statusLabel: Record<CallState, string> = {
    idle: "Chưa bắt đầu",
    connecting: "Đang kết nối…",
    active: "Đang nói chuyện",
    ended: "Đã kết thúc",
    error: "Lỗi",
  };

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-950">
        ⚠️ Dev/Test only — OpenAI Realtime Web Call (không dùng cho production)
      </span>
      <p className="text-sm text-slate-600">
        Test khả năng đối đáp giọng nói speech-to-speech của model <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">gpt-realtime</code> ngay
        trong trình duyệt qua WebRTC thuần (không phone/SIP). Yêu cầu quyền micro.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleStart}
          disabled={callState === "connecting" || callState === "active"}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Bắt đầu nói chuyện
        </button>
        <button
          type="button"
          onClick={handleStop}
          disabled={callState !== "active" && callState !== "connecting"}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Kết thúc
        </button>
      </div>
      <p className="text-sm text-slate-600">
        Trạng thái: <span className="font-medium text-slate-900">{statusLabel[callState]}</span>
      </p>
      {errorMessage && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          Lỗi: {errorMessage}
        </p>
      )}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioElRef} autoPlay className="w-full" />
    </div>
  );
}
