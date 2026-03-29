const BASE = (process.env.RUNBOARD_URL ?? "http://localhost:3000").replace(/\/$/, "");

export interface Process {
  id: string;
  name: string;
  command: string;
  cwd: string;
  env: string;
  autoRestart: boolean;
  autoStart: boolean;
  pinned: boolean;
  notes: string | null;
  healthUrl: string | null;
  createdAt: string;
  updatedAt: string;
  status: "running" | "stopped" | "errored";
  pid: number | null;
  startedAt: string | null;
  restartCount: number;
  detectedPorts: number[];
  healthStatus: "healthy" | "unhealthy" | null;
}

export interface ProcessCreateBody {
  name: string;
  command: string;
  cwd?: string;
  env?: string;
  autoRestart?: boolean;
  autoStart?: boolean;
  notes?: string;
  healthUrl?: string;
}

async function apiFetch(path: string, options?: RequestInit): Promise<unknown> {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
}

export async function getProcesses(): Promise<Process[]> {
  return apiFetch("/processes") as Promise<Process[]>;
}

export async function startProcess(id: string): Promise<void> {
  await apiFetch(`/processes/${id}/start`, { method: "POST" });
}

export async function stopProcess(id: string): Promise<void> {
  await apiFetch(`/processes/${id}/stop`, { method: "POST" });
}

export async function restartProcess(id: string): Promise<void> {
  await apiFetch(`/processes/${id}/restart`, { method: "POST" });
}

export async function deleteProcess(id: string): Promise<void> {
  await apiFetch(`/processes/${id}`, { method: "DELETE" });
}

export async function pinProcess(id: string): Promise<void> {
  await apiFetch(`/processes/${id}/pin`, { method: "POST" });
}

export async function createProcess(body: ProcessCreateBody): Promise<Process> {
  return apiFetch("/processes", {
    method: "POST",
    body: JSON.stringify(body),
  }) as Promise<Process>;
}

export async function updateProcess(
  id: string,
  body: Partial<ProcessCreateBody>
): Promise<Process> {
  return apiFetch(`/processes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  }) as Promise<Process>;
}

export async function getProcessLogs(id: string, last = 500): Promise<string[]> {
  const result = await apiFetch(`/processes/${id}/logs?last=${last}`);
  return (result as { logs: string[] }).logs ?? [];
}

export async function clearProcessLogs(id: string): Promise<void> {
  await apiFetch(`/processes/${id}/logs`, { method: "DELETE" });
}

export async function startAll(): Promise<void> {
  await apiFetch("/processes/start-all", { method: "POST" });
}

export async function stopAll(): Promise<void> {
  await apiFetch("/processes/stop-all", { method: "POST" });
}

export class RunboardWS {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;
  private onEvent: (event: string, data: unknown) => void;
  private wsUrl: string;

  constructor(onEvent: (event: string, data: unknown) => void) {
    this.onEvent = onEvent;
    this.wsUrl = BASE.replace(/^http/, "ws") + "/ws";
  }

  connect(): void {
    if (this.ws) return;
    this._connect();
  }

  private _connect(): void {
    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        this.onEvent("__connected", null);
      };

      this.ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data as string) as { event: string; data: unknown };
          this.onEvent(msg.event, msg.data);
        } catch {
          // ignore malformed
        }
      };

      this.ws.onclose = () => {
        this.ws = null;
        this.onEvent("__disconnected", null);
        if (this.shouldReconnect) {
          this.reconnectTimer = setTimeout(() => this._connect(), 2000);
        }
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch {
      this.ws = null;
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this._connect(), 2000);
      }
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
