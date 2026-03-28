import { spawn } from "child_process";
import { wsManager } from "./wsManager";

export type ProcessStatus = "running" | "stopped" | "errored";

export interface ProcessState {
  id: string;
  pid: number | null;
  status: ProcessStatus;
  startedAt: string | null;
  restartCount: number;
  autoRestart: boolean;
  logBuffer: string[]; // circular, max 500 lines
  detectedPorts: number[]; // ports parsed from log output
}

const MAX_LOG_LINES = 500;
const registry = new Map<string, ProcessState>();
const childProcs = new Map<string, ReturnType<typeof spawn>>();

// Patterns that commonly indicate a server is listening on a port.
// Matches: "port 3000", ":3000", "localhost:3000", "0.0.0.0:3000", "http://...:3000"
const PORT_PATTERN = /(?:port\s+|:)(\d{2,5})(?:[\/\s"'\n]|$)/gi;

function detectPorts(id: string, line: string) {
  const state = registry.get(id);
  if (!state) return;
  let match;
  PORT_PATTERN.lastIndex = 0;
  while ((match = PORT_PATTERN.exec(line)) !== null) {
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

export const processManager = {
  init(id: string, autoRestart = false) {
    if (!registry.has(id)) {
      registry.set(id, {
        id,
        pid: null,
        status: "stopped",
        startedAt: null,
        restartCount: 0,
        autoRestart,
        logBuffer: [],
        detectedPorts: [],
      });
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
    state.status = "running";
    state.startedAt = new Date().toISOString();
    state.detectedPorts = []; // reset on each start
    childProcs.set(id, child);

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
      if (s.status === "stopped") return;
      s.pid = null;
      s.status = code === 0 ? "stopped" : "errored";
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
    if (child && !child.killed) {
      // On Windows, child.kill() only kills the cmd.exe shell, not its spawned process.
      // taskkill /T kills the entire process tree.
      if (process.platform === "win32" && child.pid) {
        spawn("taskkill", ["/F", "/T", "/PID", String(child.pid)]);
      } else {
        child.kill();
      }
    }
    const state = registry.get(id);
    if (state) {
      state.status = "stopped";
      state.pid = null;
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
    wsManager.broadcast("log:cleared", { processId: id });
  },
};
