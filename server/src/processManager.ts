import { spawn } from "child_process";
import { wsManager } from "./wsManager";

// Pluggable persistence hooks — set by routes at startup to avoid circular imports
export const logPersistence = {
  save: (_id: string, _lines: string[]): void => {},
  load: (_id: string): string[] => [],
  savePid: (_id: string, _pid: number | null): void => {},
  loadPid: (_id: string): number | null => null,
};

export type ProcessStatus = "running" | "stopped" | "errored";
export type HealthStatus = "healthy" | "unhealthy" | null;

export interface ProcessState {
  id: string;
  pid: number | null;
  status: ProcessStatus;
  startedAt: string | null;
  restartCount: number;
  autoRestart: boolean;
  logBuffer: string[]; // circular, max 500 lines
  detectedPorts: number[]; // ports parsed from log output
  healthUrl: string | null;
  healthStatus: HealthStatus;
}

const MAX_LOG_LINES = 500;
const registry = new Map<string, ProcessState>();
const childProcs = new Map<string, ReturnType<typeof spawn>>();

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function pidFromPort(port: number): Promise<number | null> {
  try {
    const { execSync } = await import("child_process");
    if (process.platform === "win32") {
      // netstat -ano output: "  TCP    0.0.0.0:5173    0.0.0.0:0    LISTENING    12345"
      const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: "utf8", timeout: 3000 });
      const match = out.match(/LISTENING\s+(\d+)/);
      return match ? parseInt(match[1], 10) : null;
    } else {
      const out = execSync(`lsof -ti :${port}`, { encoding: "utf8", timeout: 3000 }).trim();
      const pid = parseInt(out.split("\n")[0], 10);
      return isNaN(pid) ? null : pid;
    }
  } catch {
    return null;
  }
}

function portFromUrl(url: string): number | null {
  try {
    const u = new URL(url);
    if (u.port) return parseInt(u.port, 10);
    return u.protocol === "https:" ? 443 : 80;
  } catch {
    return null;
  }
}

// Health check polling — runs every 30s for all running processes with a healthUrl
async function pollHealth(id: string) {
  const state = registry.get(id);
  if (!state || state.status !== "running" || !state.healthUrl) return;
  try {
    const res = await fetch(state.healthUrl, { signal: AbortSignal.timeout(5000) });
    const next: HealthStatus = res.ok ? "healthy" : "unhealthy";
    if (state.healthStatus !== next) {
      state.healthStatus = next;
      wsManager.broadcast("process:health", { processId: id, healthStatus: next });
    }
  } catch {
    if (state.healthStatus !== "unhealthy") {
      state.healthStatus = "unhealthy";
      wsManager.broadcast("process:health", { processId: id, healthStatus: "unhealthy" });
    }
  }
}

setInterval(() => {
  for (const id of registry.keys()) pollHealth(id);
}, 30_000);

// Patterns that commonly indicate a server is listening on a port.
// Matches: "port 3000", ":3000", "localhost:3000", "0.0.0.0:3000", "http://...:3000"
const PORT_PATTERN = /(?:port\s+|:)(\d{2,5})(?:[\/\s"'\n]|$)/gi;
const STRIP_ANSI = /\x1b\[[0-9;]*[mGKHF]/g;

function detectPorts(id: string, line: string) {
  const state = registry.get(id);
  if (!state) return;
  const cleanLine = line.replace(STRIP_ANSI, "");
  let match;
  PORT_PATTERN.lastIndex = 0;
  while ((match = PORT_PATTERN.exec(cleanLine)) !== null) {
    const port = parseInt(match[1], 10);
    if (port >= 80 && port <= 65535 && !state.detectedPorts.includes(port)) {
      state.detectedPorts.push(port);
      wsManager.broadcast("process:ports", { processId: id, ports: state.detectedPorts });
    }
  }
}

function pushLog(id: string, stream: "stdout" | "stderr", line: string) {
  const state = registry.get(id);
  if (!state) return;
  const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
  const entry = `[${ts}] [${stream}] ${line}`;
  state.logBuffer.push(entry);
  if (state.logBuffer.length > MAX_LOG_LINES) state.logBuffer.shift();
  wsManager.broadcast("log:line", { processId: id, line: entry });
  detectPorts(id, line);
}

function pushDetachedBanner(id: string) {
  const bannerLines = [
    "--------- RUNBOARD ---------",
    "",
    "        /\\   /\\",
    "       ( o . o )",
    "        > ^ <",
    "       /|   |\\",
    "      (_|   |_)",
    "",
    "  Process was already running.",
    "  Restart for live log streaming.",
    "",
    "--------- RUNBOARD ---------",
  ];
  for (const line of bannerLines) {
    pushLog(id, "stdout", line);
  }
}

export const processManager = {
  async init(id: string, autoRestart = false, healthUrl?: string | null) {
    if (!registry.has(id)) {
      const savedPid = logPersistence.loadPid(id);
      let alive = savedPid != null && isPidAlive(savedPid);
      let detectedPid: number | null = alive ? savedPid : null;

      if (!alive && healthUrl) {
        try {
          const res = await fetch(healthUrl, { signal: AbortSignal.timeout(3000) });
          if (res.ok) {
            const port = portFromUrl(healthUrl);
            if (port) {
              detectedPid = await pidFromPort(port);
              alive = true;
            }
          }
        } catch {}
      }

      registry.set(id, {
        id,
        pid: detectedPid,
        status: alive ? "running" : "stopped",
        startedAt: alive ? new Date().toISOString() : null,
        restartCount: 0,
        autoRestart,
        logBuffer: logPersistence.load(id),
        detectedPorts: [],
        healthUrl: healthUrl ?? null,
        healthStatus: alive ? "healthy" : null,
      });

      if (alive) {
        pushDetachedBanner(id);
        if (detectedPid) logPersistence.savePid(id, detectedPid);
        if (healthUrl) setTimeout(() => pollHealth(id), 2000);
      }
    } else {
      // Update healthUrl if it changed
      const state = registry.get(id)!;
      if (healthUrl !== undefined) state.healthUrl = healthUrl ?? null;
    }
  },

  get(id: string): ProcessState | undefined {
    return registry.get(id);
  },

  getAll(): ProcessState[] {
    return Array.from(registry.values());
  },

  start(id: string, command: string, cwd: string, env: Record<string, string>, autoRestart?: boolean): void {
    const existing = childProcs.get(id);
    if (existing && !existing.killed) existing.kill();

    const state = registry.get(id);
    if (!state) return;

    // Update autoRestart in state if explicitly provided
    if (autoRestart !== undefined) state.autoRestart = autoRestart;

    // Parse command into argv
    const [cmd, ...args] = command.split(/\s+/);
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...env },
      shell: true,
    });

    state.pid = child.pid ?? null;
    logPersistence.savePid(id, state.pid);
    state.status = "running";
    state.startedAt = new Date().toISOString();
    state.detectedPorts = []; // reset on each start
    state.healthStatus = null; // reset health on each start
    childProcs.set(id, child);
    // Initial health poll after 5s startup delay
    if (state.healthUrl) setTimeout(() => pollHealth(id), 5000);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");

    child.stdout?.on("data", (data: string) => {
      data.split("\n").filter(Boolean).forEach(line => pushLog(id, "stdout", line));
    });
    child.stderr?.on("data", (data: string) => {
      data.split("\n").filter(Boolean).forEach(line => pushLog(id, "stderr", line));
    });

    child.on("exit", (code) => {
      const s = registry.get(id);
      if (!s) return;
      // If stop() already set status to "stopped", the user intentionally stopped it — don't override or auto-restart
      if (s.status === "stopped") {
        logPersistence.save(id, s.logBuffer);
        return;
      }
      s.pid = null;
      logPersistence.savePid(id, null);
      s.status = code === 0 ? "stopped" : "errored";
      logPersistence.save(id, s.logBuffer);
      wsManager.broadcast("process:status", { processId: id, status: s.status, code });
      // Auto-restart on crash (non-zero or signal kill) if enabled and not manually stopped
      if (s.autoRestart && s.status === "errored") {
        s.restartCount++;
        pushLog(id, "stdout", `[runboard] auto-restarting in 1s (restart #${s.restartCount})...`);
        wsManager.broadcast("process:status", { processId: id, status: "errored", restartCount: s.restartCount });
        setTimeout(() => {
          const current = registry.get(id);
          // Bail if state was removed or manually started/stopped in the interim
          if (!current || current.status !== "errored") return;
          processManager.start(id, command, cwd, env);
        }, 1000);
      }
    });

    wsManager.broadcast("process:status", { processId: id, status: "running", pid: state.pid });
  },

  stopAll(): void {
    for (const id of registry.keys()) this.stop(id);
  },

  stop(id: string): void {
    const child = childProcs.get(id);
    const state = registry.get(id);
    if (child && !child.killed) {
      if (process.platform === "win32" && child.pid) {
        spawn("taskkill", ["/F", "/T", "/PID", String(child.pid)]);
      } else {
        child.kill();
      }
    } else if (state?.pid && isPidAlive(state.pid)) {
      // Detached process — no child reference, but we know the PID
      if (process.platform === "win32") {
        spawn("taskkill", ["/F", "/T", "/PID", String(state.pid)]);
      } else {
        process.kill(state.pid);
      }
    }
    if (state) {
      state.status = "stopped";
      state.pid = null;
      logPersistence.savePid(id, null);
      wsManager.broadcast("process:status", { processId: id, status: "stopped" });
    }
  },

  restart(id: string, command: string, cwd: string, env: Record<string, string>, autoRestart?: boolean): void {
    this.stop(id);
    const state = registry.get(id);
    if (state) {
      state.restartCount++;
      // Re-set status to stopped so the exit handler (from stop()) doesn't conflict
      state.status = "stopped";
    }
    setTimeout(() => this.start(id, command, cwd, env, autoRestart), 300);
  },

  remove(id: string): void {
    this.stop(id);
    registry.delete(id);
    childProcs.delete(id);
  },

  getLogs(id: string, last = 200): string[] {
    const state = registry.get(id);
    if (!state) return [];
    return state.logBuffer.slice(-last);
  },

  clearLogs(id: string): void {
    const state = registry.get(id);
    if (!state) return;
    state.logBuffer = [];
    logPersistence.save(id, []);
    wsManager.broadcast("log:cleared", { processId: id });
  },

  async autoStartAll(getProcessConfig: (id: string) => { command: string; cwd: string; env: Record<string, string>; autoRestart: boolean } | null) {
    for (const [id, state] of registry.entries()) {
      if (state.status === "running") continue; // already detected as running
      const config = getProcessConfig(id);
      if (!config) continue;
      this.start(id, config.command, config.cwd, config.env, config.autoRestart);
    }
  },
};
