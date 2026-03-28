import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { initDb } from "./db";
import { wsManager } from "./wsManager";

initDb();

export const app = new Elysia()
  .use(cors())
  .use(swagger({ path: "/docs" }))
  .ws("/ws", {
    open(ws) { wsManager.add(ws); },
    close(ws) { wsManager.remove(ws); },
    message() {},
  })
  .get("/api/health", () => ({ status: "ok" }));
