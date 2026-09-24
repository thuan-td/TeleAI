import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { startOpenAIWebCall } from "../api/calls";
import { queryKnowledgeBase } from "../api/kb";
import { CallTesterShell, type CallState } from "./call-tester-shell";

const OPENAI_REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

// Must match KNOWLEDGE_BASE_TOOL_NAME in backend/app/routers/agent_config.py —
// same tool name/semantics on both providers so logs/transcripts read the same way.
const KNOWLEDGE_BASE_TOOL_NAME = "query_knowledge_base";

const KNOWLEDGE_BASE_TOOL_DEFINITION = {
  type: "function",
  name: KNOWLEDGE_BASE_TOOL_NAME,
  description:
    "Search the company knowledge base for information needed to answer the caller's question accurately. Call this whenever the caller asks something that isn't already covered by your instructions.",
  parameters: {
    type: "object",
    properties: { query: { type: "string", description: "What to search for" } },
    required: ["query"],
  },
};

async function handleKnowledgeBaseToolCall(dc: RTCDataChannel, callId: string, argsJson: string): Promise<void> {
  let query = "";
  try {
    query = JSON.parse(argsJson).query ?? "";
  } catch {
    // malformed arguments — fall through with empty query, KB returns no results
  }

  let output: string;
  try {
    const results = await queryKnowledgeBase(query);
    output = JSON.stringify({ results });
  } catch (err) {
    output = JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
  }

  // Round-trip per developers.openai.com/api/docs/guides/realtime-conversations:
  // send the tool result as a conversation item, then response.create so the
  // model actually uses it (it stays idle otherwise).
  dc.send(
    JSON.stringify({
      type: "conversation.item.create",
      item: { type: "function_call_output", call_id: callId, output },
    }),
  );
  dc.send(JSON.stringify({ type: "response.create" }));
}

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
      dc.addEventListener("open", () => {
        // Declare the shared-KB tool for this session (mirrors Retell's
        // query_knowledge_base custom function — same name, same /kb/query
        // source — see backend/app/routers/agent_config.py). Session-level
        // `tools` per developers.openai.com/api/docs/guides/realtime-conversations.
        dc.send(
          JSON.stringify({ type: "session.update", session: { tools: [KNOWLEDGE_BASE_TOOL_DEFINITION] } }),
        );
        // OpenAI Realtime has no Retell-style auto-greeting (begin_message) —
        // the model waits for user audio by default. Sending an empty
        // response.create right when the data channel opens triggers an
        // initial response from the session's `instructions` alone (confirmed
        // via docs research 2026-09-24: response.input accepts an empty array,
        // no preceding conversation.item.create is required).
        dc.send(JSON.stringify({ type: "response.create" }));
      });
      dc.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (message.type !== "response.function_call_arguments.done") return;
        if (message.name !== KNOWLEDGE_BASE_TOOL_NAME) return;
        handleKnowledgeBaseToolCall(dc, message.call_id, message.arguments);
      });

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
