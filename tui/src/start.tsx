import React from "react";
import { render } from "ink";
import { spawn } from "child_process";
import { resolve } from "path";
import { App } from "./App.js";

const SERVER_URL = (process.env.RUNBOARD_URL ?? "http://localhost:3737").replace(/\/$/, "");
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

// If server is already up, skip spawning (e.g. running in dev with server separate)
let serverProc: ReturnType<typeof spawn> | null = null;

if (!(await isServerRunning())) {
  // Resolve server dir relative to this file's real location
  const serverDir = resolve(new URL("../../server", import.meta.url).pathname);
  serverProc = spawn("bun", ["run", "src/index.ts"], {
    cwd: serverDir,
    stdio: "ignore",
  });

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
    serverProc.kill();
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
