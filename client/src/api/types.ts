export interface Process {
  id: string;
  name: string;
  command: string;
  cwd: string;
  env: string; // JSON string
  autoRestart: boolean;
  createdAt: string;
  updatedAt: string;
  // runtime state (may be absent if process not yet initialized)
  status?: "running" | "stopped" | "errored";
  pid?: number | null;
  startedAt?: string | null;
  restartCount?: number;
}
