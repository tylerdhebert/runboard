import { spawn } from "child_process";
import { wsManager } from "./wsManager";

export type ProcessStatus = "running" | "stopped" | "errored";

export interface ProcessState {
  id: string;
  pid: number | null;
  status: ProcessStatus;
  startedAt: string | null;
  restartCount: number;
  logBuffer: string[]; // circular, max 500 lines
}

const MAX_LOG_LINES = 500;
const registry = new Map<string, ProcessState>();
const childProcs = new Map<string, ReturnType<typeof spawn>>();

function pushLog(id: string, stream: "stdout" | "stderr", line: string) {
  const state = registry.get(id);
  if (!state) return;
  const entry = `[${stream}] ${line}`;
  state.logBuffer.push(entry);
  if (state.logBuffer.length > MAX_LOG_LINES) state.logBuffer.shift();
  wsManager.broadcast("log:line", { processId: id, line: entry });
}

export const processManager = {
  init(id: string) {
    if (!registry.has(id)) {
      registry.set(id, {
        id,
        pid: null,
        status: "stopped",
        startedAt: null,
        restartCount: 0,
        logBuffer: [],
      });
    }
  },

  get(id: string): ProcessState | undefined {
    return registry.get(id);
  },

  getAll(): ProcessState[] {
    return Array.from(registry.values());
  },

  start(id: string, command: string, cwd: string, env: Record<string, string>): void {
    const existing = childProcs.get(id);
    if (existing && !existing.killed) existing.kill();

    const state = registry.get(id);
    if (!state) return;

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
      s.pid = null;
      s.status = code === 0 ? "stopped" : "errored";
      wsManager.broadcast("process:status", { processId: id, status: s.status });
    });

    wsManager.broadcast("process:status", { processId: id, status: "running", pid: state.pid });
  },

  stop(id: string): void {
    const child = childProcs.get(id);
    if (child && !child.killed) child.kill();
    const state = registry.get(id);
    if (state) {
      state.status = "stopped";
      state.pid = null;
      wsManager.broadcast("process:status", { processId: id, status: "stopped" });
    }
  },

  restart(id: string, command: string, cwd: string, env: Record<string, string>): void {
    this.stop(id);
    const state = registry.get(id);
    if (state) state.restartCount++;
    setTimeout(() => this.start(id, command, cwd, env), 300);
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
};
