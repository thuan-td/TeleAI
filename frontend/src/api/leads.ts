import { API_BASE } from "./calls";

export interface Lead {
  id: string;
  phone: string;
  name: string;
  lang: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface LeadDetail extends Lead {
  call_count: number;
  last_call_at: string | null;
}

export interface PaginatedLeads {
  items: Lead[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreateLeadInput {
  phone: string;
  name: string;
  lang: string;
}

export interface UpdateLeadInput {
  phone?: string;
  name?: string;
  lang?: string;
  status?: string;
}

export interface FetchLeadsParams {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
  lang?: string;
}

async function parseErrorOrThrow(response: Response, fallback: string): Promise<never> {
  const detail = await response.json().catch(() => null);
  throw new Error(detail?.detail ?? fallback);
}

export async function fetchLeads(params: FetchLeadsParams = {}): Promise<PaginatedLeads> {
  const search = new URLSearchParams();
  search.set("page", String(params.page ?? 1));
  search.set("page_size", String(params.pageSize ?? 20));
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  if (params.lang) search.set("lang", params.lang);

  const response = await fetch(`${API_BASE}/leads?${search.toString()}`);
  if (!response.ok) {
    await parseErrorOrThrow(response, `Failed to fetch leads: ${response.status}`);
  }
  return response.json();
}

export async function fetchLead(id: string): Promise<LeadDetail> {
  const response = await fetch(`${API_BASE}/leads/${id}`);
  if (!response.ok) {
    await parseErrorOrThrow(response, `Failed to fetch lead: ${response.status}`);
  }
  return response.json();
}

export async function createLead(input: CreateLeadInput): Promise<Lead> {
  const response = await fetch(`${API_BASE}/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    await parseErrorOrThrow(response, `Failed to create lead: ${response.status}`);
  }
  return response.json();
}

export async function updateLead(id: string, patch: UpdateLeadInput): Promise<Lead> {
  const response = await fetch(`${API_BASE}/leads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    await parseErrorOrThrow(response, `Failed to update lead: ${response.status}`);
  }
  return response.json();
}

export async function deleteLead(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/leads/${id}`, { method: "DELETE" });
  if (!response.ok && response.status !== 204) {
    await parseErrorOrThrow(response, `Failed to delete lead: ${response.status}`);
  }
}
