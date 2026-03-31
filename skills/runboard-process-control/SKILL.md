---
name: runboard-process-control
description: This skill should be used when the user asks to "kill a process", "restart a process", "stop a process", "start a process", "kill and restart", "bounce a process", or "restart the API". Also apply this skill proactively — without being asked — after making C# or .NET code changes, running dotnet build, modifying project files, when you need to regenerate GraphQL types, or before running codegen, as the affected process will need to be restarted to pick up those changes.
version: 1.0.0
---

# Runboard Process Control

Runboard manages processes defined in SQLite. Use the REST API at `http://127.0.0.1:3737/api` — no request body is required for any lifecycle call.

## When to act without being asked

Restart the relevant process automatically — without waiting for instruction — after any of the following:

- Making or applying C# / .NET code changes
- Running `dotnet build` or modifying `.csproj` / `.sln` files
- Regenerating GraphQL types or running codegen (e.g. `graphql-codegen`, `dotnet-graphql`)
- Any change that requires a server process to reload to take effect

Identify the affected process by name from `GET /api/processes`, restart it, verify it is running, and report what was done.

## Process Model

Each process has two layers of state:

- **SQLite (persisted):** `id` (UUID), `name`, `command`, `auto_restart` (bool — if true, the server re-launches the process automatically when it exits)
- **In-memory (runtime):** `status` (`"running"` | `"stopped"` | `"errored"`), `pid` (null when stopped)

`GET /api/processes` returns both layers merged.

## Step 1 — Find the Process ID

```
GET http://127.0.0.1:3737/api/processes
```

Each entry includes `id`, `name`, `status`, `pid`, and `auto_restart`. Filter by `name` to get the target `id`.

## Step 2 — Kill, Start, or Restart

### Stop a process
```
POST http://127.0.0.1:3737/api/processes/<id>/stop
```
Sends SIGTERM (Unix) or `taskkill /F /T /PID` (Windows). Sets `status → "stopped"`, `pid → null`.

**If `auto_restart` is true**, the process will immediately re-launch after being killed. To keep it stopped, disable it first:
```
PATCH http://127.0.0.1:3737/api/processes/<id>
{ "auto_restart": false }
```

### Start a stopped process
```
POST http://127.0.0.1:3737/api/processes/<id>/start
```
Only works when `status` is `"stopped"` or `"errored"`.

### Restart (preferred for kill + restart)
```
POST http://127.0.0.1:3737/api/processes/<id>/restart
```
Stop → 300ms delay → start, in a single server-side call.

## Step 3 — Verify

```
GET http://127.0.0.1:3737/api/processes/<id>
```

- After stop: `status === "stopped"`, `pid === null`
- After start/restart: `status === "running"`, `pid` is non-null

If `status === "errored"`, the process crashed on launch. Fetch logs to diagnose:
```
GET http://127.0.0.1:3737/api/processes/<id>/logs?last=50
```

## Bulk Operations

```
POST http://127.0.0.1:3737/api/processes/stop-all
POST http://127.0.0.1:3737/api/processes/start-all   # skips already-running processes
```
