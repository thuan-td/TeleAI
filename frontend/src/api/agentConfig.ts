import { API_BASE } from "./calls";

export interface AgentConfigResponse {
  agent_id: string;
  agent_name: string | null;
  llm_id: string | null;
  version: number;
  is_published: boolean;
  general_prompt: string | null;
  begin_message: string | null;
  voice_id: string;
  language: string;
  responsiveness: number | null;
  interruption_sensitivity: number | null;
  intent_confidence_threshold: number;
  openai_realtime_language: string;
}

export interface AgentConfigUpdate {
  general_prompt?: string;
  begin_message?: string;
  voice_id?: string;
  language?: string;
  responsiveness?: number;
  interruption_sensitivity?: number;
  intent_confidence_threshold?: number;
  openai_realtime_language?: string;
  publish: boolean;
}

export interface AgentConfigSaveResult {
  updated_agent: boolean;
  updated_llm: boolean;
  updated_local: boolean;
  published: boolean;
  publish_error?: string | null;
}

export interface VoiceOption {
  voice_id: string;
  voice_name: string;
  provider: string;
  gender?: string | null;
  accent?: string | null;
  preview_audio_url?: string | null;
}

export class AgentConfigUnavailableError extends Error {}

async function parseErrorDetail(response: Response, fallback: string): Promise<string> {
  const detail = await response.json().catch(() => null);
  return detail?.detail ?? fallback;
}

export async function fetchAgentConfig(): Promise<AgentConfigResponse> {
  const response = await fetch(`${API_BASE}/agent/config`);
  if (response.status === 503) {
    throw new AgentConfigUnavailableError(
      await parseErrorDetail(response, "Chưa cấu hình Retell API key trên server."),
    );
  }
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response, `Failed to fetch agent config: ${response.status}`));
  }
  return response.json();
}

export async function updateAgentConfig(patch: AgentConfigUpdate): Promise<AgentConfigSaveResult> {
  const response = await fetch(`${API_BASE}/agent/config`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response, `Failed to update agent config: ${response.status}`));
  }
  return response.json();
}

export async function fetchVoices(): Promise<VoiceOption[]> {
  const response = await fetch(`${API_BASE}/agent/voices`);
  if (response.status === 503) {
    throw new AgentConfigUnavailableError(
      await parseErrorDetail(response, "Chưa cấu hình Retell API key trên server."),
    );
  }
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response, `Failed to fetch voices: ${response.status}`));
  }
  return response.json();
}
