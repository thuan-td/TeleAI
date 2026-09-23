import { useCallback, useEffect, useState } from "react";
import { fetchCalls, type CallSummary } from "./api/calls";
import { AppLayout } from "./components/AppLayout";
import { CallDetail } from "./components/CallDetail";
import { CallList } from "./components/CallList";
import { DevTestPanel } from "./components/DevTestPanel";
import { OpenAIWebCallTester } from "./components/OpenAIWebCallTester";
import { WebCallTester } from "./components/WebCallTester";

function App() {
  if (window.location.pathname === "/web-call-test") {
    return (
      <AppLayout>
        <WebCallTester />
      </AppLayout>
    );
  }
  if (window.location.pathname === "/web-call-test-openai") {
    return (
      <AppLayout>
        <OpenAIWebCallTester />
      </AppLayout>
    );
  }
  return (
    <AppLayout>
      <CallMonitor />
    </AppLayout>
  );
}

function CallMonitor() {
  const [calls, setCalls] = useState<CallSummary[]>([]);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadCalls = useCallback(() => {
    setIsLoading(true);
    fetchCalls()
      .then(setCalls)
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    loadCalls();
  }, [loadCalls]);

  const selectedCall = calls.find((c) => c.call_id === selectedCallId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-slate-900">Call Monitor</h1>
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          Lỗi tải danh sách cuộc gọi: {error}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,320px)_1fr]">
        <CallList calls={calls} selectedCallId={selectedCallId} onSelect={setSelectedCallId} isLoading={isLoading} />
        <CallDetail call={selectedCall} />
      </div>
      <DevTestPanel onCallCreated={loadCalls} />
    </div>
  );
}

export default App;
