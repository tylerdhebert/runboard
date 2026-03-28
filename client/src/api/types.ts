export interface Process {
  // Persisted fields
  id: string;
  name: string;
  command: string;
  cwd: string;
  env: string; // JSON string of key=value pairs
  autoRestart: boolean;
  autoStart: boolean;
  pinned: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  healthUrl: string | null;
  // Runtime state (merged in from processManager, always present after first GET)
  status: "running" | "stopped" | "errored";
  pid: number | null;
  startedAt: string | null;
  restartCount: number;
  detectedPorts: number[];
  healthStatus: "healthy" | "unhealthy" | null;
  logBuffer?: string[]; // not sent over the wire
}
