export interface CallSummary {
  call_id: string;
  status: string;
  recording_url: string | null;
  transcript_status: string;
}

export interface CallListItem {
  call_id: string;
  lead_id: string;
  lead_name: string;
  lead_phone: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  transfer_result: string | null;
  intent_confidence: number | null;
  recording_url: string | null;
  transcript_status: string;
}

export interface CallDetail extends CallListItem {
  retry_count: number;
  context_sent_at: string | null;
  audio_bridge_started_at: string | null;
  transcript: string | null;
}

export interface PaginatedCalls {
  items: CallListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface FetchCallsParams {
  page?: number;
  pageSize?: number;
  status?: string;
  leadId?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
}

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

function buildCallsSearchParams(params: FetchCallsParams): URLSearchParams {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.leadId) search.set("lead_id", params.leadId);
  if (params.dateFrom) search.set("date_from", params.dateFrom);
  if (params.dateTo) search.set("date_to", params.dateTo);
  if (params.q) search.set("q", params.q);
  return search;
}

export async function fetchCalls(params: FetchCallsParams = {}): Promise<PaginatedCalls> {
  const search = buildCallsSearchParams(params);
  search.set("page", String(params.page ?? 1));
  search.set("page_size", String(params.pageSize ?? 20));

  const response = await fetch(`${API_BASE}/calls?${search.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch calls: ${response.status}`);
  }
  return response.json();
}

export async function fetchCallDetail(callId: string): Promise<CallDetail> {
  const response = await fetch(`${API_BASE}/calls/${encodeURIComponent(callId)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch call detail: ${response.status}`);
  }
  return response.json();
}

export function buildExportUrl(params: FetchCallsParams = {}): string {
  const search = buildCallsSearchParams(params);
  return `${API_BASE}/calls/export?${search.toString()}`;
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
