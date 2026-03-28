export const API_BASE = "/api";
export const WS_URL = `ws://${window.location.host}/ws`;

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}
