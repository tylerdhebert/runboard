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
  // Runtime state (merged in from processManager, always present after first GET)
  status: "running" | "stopped" | "errored";
  pid: number | null;
  startedAt: string | null;
  restartCount: number;
  detectedPorts: number[];
  logBuffer?: string[]; // not sent over the wire
}
