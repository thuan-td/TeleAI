import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RetellWebClient } from "retell-client-js-sdk";
import { startWebCall } from "../api/calls";
import { CallTesterShell, type CallState } from "./call-tester-shell";

export function WebCallTester() {
  const { t } = useTranslation();
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

  return (
    <CallTesterShell
      badgeLabel={t("webCallTester.badgeLabel")}
      description={t("webCallTester.description")}
      callState={callState}
      errorMessage={errorMessage}
      onStart={handleStart}
      onStop={handleStop}
    />
  );
}
