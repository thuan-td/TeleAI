import { useCallback, useEffect, useState } from "react";
import "./App.css";
import { fetchCalls, type CallSummary } from "./api/calls";
import { CallDetail } from "./components/CallDetail";
import { CallList } from "./components/CallList";
import { DevTestPanel } from "./components/DevTestPanel";

function App() {
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
    <div className="app">
      <h1>TeleApo Clone — Call Monitor</h1>
      {error && <p className="error">Lỗi tải danh sách cuộc gọi: {error}</p>}
      <div className="app-layout">
        <CallList calls={calls} selectedCallId={selectedCallId} onSelect={setSelectedCallId} isLoading={isLoading} />
        <CallDetail call={selectedCall} />
      </div>
      <DevTestPanel onCallCreated={loadCalls} />
    </div>
  );
}

export default App;
