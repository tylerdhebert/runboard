import React from "react";
import { render } from "ink";
import { spawn, execSync } from "child_process";
import { resolve } from "path";
import { App } from "./App.js";
import { fileURLToPath } from "url";

const SERVER_URL = (process.env.RUNBOARD_URL ?? "http://127.0.0.1:3737").replace(/\/$/, "");
const HEALTH_URL = `${SERVER_URL}/api/health`;

async function isServerRunning(): Promise<boolean> {
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForServer(maxMs = 10_000): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (await isServerRunning()) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

// On Windows, kill any zombie processes lingering on the server port before starting
function clearPortWindows(port: number): void {
  try {
    const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: "utf8", timeout: 3000 });
    const pids = new Set<string>();
    for (const line of out.split("\n")) {
      const match = line.match(/LISTENING\s+(\d+)/);
      if (match && match[1] !== "0") pids.add(match[1]);
    }
    for (const pid of pids) {
      try { execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" }); } catch {}
    }
  } catch {}
}

// If server is already up, skip spawning (e.g. running in dev with server separate)
let serverProc: ReturnType<typeof spawn> | null = null;

if (!(await isServerRunning())) {
  // Clear any zombie processes on Windows that might block the port
  if (process.platform === "win32") clearPortWindows(3737);

  // Resolve server dir relative to this file's real location
  const serverDir = resolve(fileURLToPath(new URL("../../server", import.meta.url)));
  const isWindows = process.platform === "win32";
  serverProc = isWindows
    ? spawn("cmd.exe", ["/c", "bun run src/index.ts"], { cwd: serverDir, stdio: "inherit" })
    : spawn("bun", ["run", "src/index.ts"], { cwd: serverDir, stdio: "inherit" });

  process.stdout.write("Starting runboard server...\r");

  const ready = await waitForServer();
  process.stdout.write("                            \r"); // clear the line

  if (!ready) {
    process.stderr.write("Warning: server did not respond — TUI may not connect.\n");
  }
}

// Kill the server we spawned (not one that was already running) on exit
function cleanup() {
  if (serverProc) {
    if (process.platform === "win32" && serverProc.pid) {
      try { execSync(`taskkill /F /T /PID ${serverProc.pid}`, { stdio: "ignore" }); } catch {}
    } else {
      serverProc.kill();
    }
    serverProc = null;
  }
}
process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(0); });
process.on("SIGTERM", () => { cleanup(); process.exit(0); });

const { waitUntilExit } = render(<App />, { exitOnCtrlC: true, patchConsole: false });
await waitUntilExit();
cleanup();
process.exit(0);
