export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function parseErrorDetail(response: Response, fallback: string): Promise<string> {
  const detail = await response.json().catch(() => null);
  return detail?.detail ?? fallback;
}

/** Single point of contact with the backend — every call goes through here so
 * cookie auth (`credentials: "include"`) and session-expiry handling (401)
 * apply automatically to any new endpoint without extra wiring. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${API_BASE}${path}`, { ...init, credentials: "include" });
  if (response.status === 401 && window.location.pathname !== "/login") {
    window.location.href = "/login";
    throw new ApiError(401, "Phiên đăng nhập đã hết hạn");
  }
  return response;
}

export interface CurrentUser {
  id: string;
  username: string;
  role: string;
}

export async function login(username: string, password: string): Promise<CurrentUser> {
  const response = await apiFetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorDetail(response, `Login failed: ${response.status}`));
  }
  return response.json();
}

export async function logout(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" });
}

export async function fetchMe(): Promise<CurrentUser> {
  const response = await apiFetch("/auth/me");
  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorDetail(response, `Failed to fetch current user: ${response.status}`));
  }
  return response.json();
}
