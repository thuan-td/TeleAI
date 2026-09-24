import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { startOpenAIWebCall } from "../api/calls";
import { CallTesterShell, type CallState } from "./call-tester-shell";

const OPENAI_REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

export function OpenAIWebCallTester() {
  const { t } = useTranslation();
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
        throw new Error(t("openaiWebCallTester.sdpRejected", { status: sdpResponse.status }));
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

  return (
    <CallTesterShell
      badgeLabel={t("openaiWebCallTester.badgeLabel")}
      description={
        <>
          {t("openaiWebCallTester.descriptionPrefix")}{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">gpt-realtime</code>{" "}
          {t("openaiWebCallTester.descriptionSuffix")}
        </>
      }
      callState={callState}
      errorMessage={errorMessage}
      onStart={handleStart}
      onStop={handleStop}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioElRef} autoPlay className="w-full" />
    </CallTesterShell>
  );
}
