import { useCallback, useEffect, useRef, useState } from "react";
import { RetellWebClient } from "retell-client-js-sdk";
import { startWebCall } from "../api/calls";

type CallState = "idle" | "connecting" | "active" | "ended" | "error";

export function WebCallTester() {
  const [callState, setCallState] = useState<CallState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const clientRef = useRef<RetellWebClient | null>(null);

  useEffect(() => {
    const client = new RetellWebClient();
    clientRef.current = client;

    client.on("call_started", () => setCallState("active"));
    client.on("call_ended", () => setCallState("ended"));
    client.on("error", (err: unknown) => {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setCallState("error");
      client.stopCall();
    });

    return () => {
      client.stopCall();
    };
  }, []);

  const handleStart = useCallback(async () => {
    setErrorMessage(null);
    setCallState("connecting");
    try {
      const { access_token: accessToken } = await startWebCall();
      await clientRef.current?.startCall({ accessToken });
    } catch (err) {
      setErrorMessage((err as Error).message);
      setCallState("error");
    }
  }, []);

  const handleStop = useCallback(() => {
    clientRef.current?.stopCall();
    setCallState("ended");
  }, []);

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
        ⚠️ Dev/Test only — Web Call (không dùng cho production)
      </span>
      <p className="text-sm text-slate-600">
        Test khả năng đối đáp giọng nói của AI ngay trong trình duyệt, thay cho việc gọi điện thoại thật qua Twilio
        (đang chờ số điện thoại). Yêu cầu quyền micro.
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
    </div>
  );
}
