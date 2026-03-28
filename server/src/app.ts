import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { initDb } from "./db";
import { wsManager } from "./wsManager";
import { processRoutes } from "./routes/processes";

initDb();

export const app = new Elysia()
  .use(cors())
  .use(swagger({ path: "/docs" }))
  .ws("/ws", {
    open(ws) { wsManager.add(ws); },
    close(ws) { wsManager.remove(ws); },
    message(ws, msg) {
      // Support per-process subscription messages: { subscribe: processId }
      // The broadcast already sends to all clients; clients filter by processId.
      // This hook is reserved for future scoped subscriptions.
      try {
        const parsed = typeof msg === "string" ? JSON.parse(msg) : msg;
        if (parsed && typeof parsed === "object" && "subscribe" in parsed) {
          // Acknowledged — client will filter log:line events by processId
          ws.send(JSON.stringify({ event: "subscribed", data: { processId: parsed.subscribe } }));
        }
      } catch {
        // Ignore malformed messages
      }
    },
  })
  .get("/api/health", () => ({ status: "ok" }))
  .group("/api", app => app.use(processRoutes));
