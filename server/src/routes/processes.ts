import Elysia, { t } from "elysia";
import { db } from "../db";
import { processes } from "../db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { processManager, logPersistence } from "../processManager";
import { wsManager } from "../wsManager";

function nowIso() { return new Date().toISOString(); }

// Wire up log persistence so processManager can save/load without importing DB
logPersistence.save = (id, lines) => {
  try {
    db.update(processes)
      .set({ savedLogs: JSON.stringify(lines.slice(-2000)), updatedAt: nowIso() })
      .where(eq(processes.id, id))
      .run();
  } catch {}
};
logPersistence.load = (id) => {
  try {
    const row = db.select({ savedLogs: processes.savedLogs }).from(processes).where(eq(processes.id, id)).get();
    if (row?.savedLogs) return JSON.parse(row.savedLogs) as string[];
  } catch {}
  return [];
};

// Helper: sync DB row into processManager registry
function syncToRegistry(row: typeof processes.$inferSelect) {
  processManager.init(row.id, row.autoRestart);
}

export const processRoutes = new Elysia({ prefix: "/processes" })
  // List all processes with runtime state merged in
  .get("/", () => {
    const rows = db.select().from(processes).all();
    // Ensure all DB processes are in the registry
    rows.forEach(syncToRegistry);
    return rows.map(({ savedLogs: _savedLogs, ...row }) => {
      const { logBuffer: _logBuffer, ...runtime } = processManager.get(row.id) ?? {};
      return { ...row, ...runtime };
    });
  })

  // Create a process definition
  .post(
    "/",
    ({ body }) => {
      const id = randomUUID();
      const now = nowIso();
      const row = { id, ...body, createdAt: now, updatedAt: now };
      db.insert(processes).values(row).run();
      const created = db.select().from(processes).where(eq(processes.id, id)).get()!;
      syncToRegistry(created);
      wsManager.broadcast("process:created", created);
      return created;
    },
    {
      body: t.Object({
        name: t.String(),
        command: t.String(),
        cwd: t.Optional(t.String({ default: "." })),
        env: t.Optional(t.String({ default: "{}" })),
        autoRestart: t.Optional(t.Boolean({ default: false })),
        autoStart: t.Optional(t.Boolean({ default: false })),
        notes: t.Optional(t.String()),
      }),
    }
  )

  // Update a process definition
  .patch(
    "/:id",
    ({ params, body }) => {
      const now = nowIso();
      db.update(processes).set({ ...body, updatedAt: now }).where(eq(processes.id, params.id)).run();
      const updated = db.select().from(processes).where(eq(processes.id, params.id)).get();
      if (!updated) throw new Error("Not found");
      wsManager.broadcast("process:updated", updated);
      return updated;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Partial(t.Object({
        name: t.String(),
        command: t.String(),
        cwd: t.String(),
        env: t.String(),
        autoRestart: t.Boolean(),
        autoStart: t.Boolean(),
        notes: t.String(),
      })),
    }
  )

  // Delete a process definition (and stop it if running)
  .delete(
    "/:id",
    ({ params }) => {
      processManager.remove(params.id);
      db.delete(processes).where(eq(processes.id, params.id)).run();
      wsManager.broadcast("process:deleted", { id: params.id });
      return { success: true };
    },
    { params: t.Object({ id: t.String() }) }
  )

  // Start
  .post(
    "/:id/start",
    ({ params, set }) => {
      const row = db.select().from(processes).where(eq(processes.id, params.id)).get();
      if (!row) { set.status = 404; return { error: "Not found" }; }
      const env = JSON.parse(row.env ?? "{}") as Record<string, string>;
      processManager.start(row.id, row.command, row.cwd ?? ".", env, row.autoRestart);
      return { success: true };
    },
    { params: t.Object({ id: t.String() }) }
  )

  // Stop
  .post(
    "/:id/stop",
    ({ params }) => {
      processManager.stop(params.id);
      return { success: true };
    },
    { params: t.Object({ id: t.String() }) }
  )

  // Restart
  .post(
    "/:id/restart",
    ({ params, set }) => {
      const row = db.select().from(processes).where(eq(processes.id, params.id)).get();
      if (!row) { set.status = 404; return { error: "Not found" }; }
      const env = JSON.parse(row.env ?? "{}") as Record<string, string>;
      processManager.restart(row.id, row.command, row.cwd ?? ".", env, row.autoRestart);
      return { success: true };
    },
    { params: t.Object({ id: t.String() }) }
  )

  // Get last N log lines
  .get(
    "/:id/logs",
    ({ params, query }) => {
      const last = query.last ? parseInt(query.last) : 200;
      return { logs: processManager.getLogs(params.id, last) };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Optional(t.Object({ last: t.Optional(t.String()) })),
    }
  )

  // Clear log buffer
  .delete(
    "/:id/logs",
    ({ params }) => {
      processManager.clearLogs(params.id);
      return { success: true };
    },
    { params: t.Object({ id: t.String() }) }
  )

  // Start all stopped processes
  .post("/start-all", ({ }) => {
    const rows = db.select().from(processes).all();
    for (const row of rows) {
      const state = processManager.get(row.id);
      if (state?.status === "running") continue;
      processManager.init(row.id, row.autoRestart);
      const env = JSON.parse(row.env ?? "{}") as Record<string, string>;
      processManager.start(row.id, row.command, row.cwd ?? ".", env, row.autoRestart);
    }
    return { success: true };
  })

  // Stop all running processes
  .post("/stop-all", ({ }) => {
    processManager.stopAll();
    return { success: true };
  })

  // Export all process definitions as JSON
  .get("/export", () => {
    const rows = db.select().from(processes).all();
    return rows.map(({ id: _id, createdAt: _c, updatedAt: _u, ...def }) => def);
  })

  // Import process definitions (skips duplicates by name)
  .post(
    "/import",
    ({ body }) => {
      const now = nowIso();
      let imported = 0;
      const existing = db.select().from(processes).all();
      const existingNames = new Set(existing.map(p => p.name));
      for (const def of body.processes) {
        if (existingNames.has(def.name)) continue;
        const id = randomUUID();
        db.insert(processes).values({ id, ...def, createdAt: now, updatedAt: now }).run();
        const created = db.select().from(processes).where(eq(processes.id, id)).get()!;
        syncToRegistry(created);
        wsManager.broadcast("process:created", created);
        imported++;
      }
      return { imported, skipped: body.processes.length - imported };
    },
    {
      body: t.Object({
        processes: t.Array(t.Object({
          name: t.String(),
          command: t.String(),
          cwd: t.Optional(t.String()),
          env: t.Optional(t.String()),
          autoRestart: t.Optional(t.Boolean()),
        })),
      }),
    }
  );
