export interface CallSummary {
  call_id: string;
  status: string;
  recording_url: string | null;
  transcript_status: string;
}

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export async function fetchCalls(): Promise<CallSummary[]> {
  const response = await fetch(`${API_BASE}/calls`);
  if (!response.ok) {
    throw new Error(`Failed to fetch calls: ${response.status}`);
  }
  return response.json();
}

export async function startWebCall(): Promise<{ access_token: string }> {
  const response = await fetch(`${API_BASE}/calls/web`, { method: "POST" });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? `Failed to start web call: ${response.status}`);
  }
  return response.json();
}

export interface OpenAIWebCallSecret {
  client_secret: string;
  expires_at: number;
  model: string;
}

export async function startOpenAIWebCall(): Promise<OpenAIWebCallSecret> {
  const response = await fetch(`${API_BASE}/calls/web/openai`, { method: "POST" });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? `Failed to start OpenAI web call: ${response.status}`);
  }
  return response.json();
}

export async function dialCall(leadId: string): Promise<CallSummary> {
  const response = await fetch(`${API_BASE}/calls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lead_id: leadId }),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? `Failed to dial call: ${response.status}`);
  }
  return response.json();
}
