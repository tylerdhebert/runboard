import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { mkdirSync } from "fs";
import * as schema from "./schema";

mkdirSync("./data", { recursive: true });
const sqlite = new Database("./data/runboard.db");
export const db = drizzle(sqlite, { schema });

export function initDb() {
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS processes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      command TEXT NOT NULL,
      cwd TEXT NOT NULL DEFAULT '.',
      env TEXT NOT NULL DEFAULT '{}',
      auto_restart INTEGER NOT NULL DEFAULT 0,
      auto_start INTEGER NOT NULL DEFAULT 0,
      saved_logs TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  // Safe migrations for existing databases
  for (const sql of [
    "ALTER TABLE processes ADD COLUMN auto_start INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE processes ADD COLUMN saved_logs TEXT",
  ]) {
    try { sqlite.run(sql); } catch {}
  }
}
