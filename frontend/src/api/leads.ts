import { API_BASE } from "./calls";

export interface Lead {
  id: string;
  phone: string;
  name: string;
  lang: string;
  status: string;
}

export interface CreateLeadInput {
  phone: string;
  name: string;
  lang: string;
}

export async function createLead(input: CreateLeadInput): Promise<Lead> {
  const response = await fetch(`${API_BASE}/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? `Failed to create lead: ${response.status}`);
  }
  return response.json();
}
