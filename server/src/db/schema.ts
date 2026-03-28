import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const processes = sqliteTable("processes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  command: text("command").notNull(),
  cwd: text("cwd").notNull().default("."),
  env: text("env").notNull().default("{}"),      // JSON string of key-value env vars
  autoRestart: integer("auto_restart", { mode: "boolean" }).notNull().default(false),
  autoStart: integer("auto_start", { mode: "boolean" }).notNull().default(false),
  savedLogs: text("saved_logs"),                 // JSON array — last run's log buffer
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
