# Runboard Features

A summary of all features added during the autonomous development session.

---

## Process Management

### Auto-restart on crash
Processes with **Auto-restart on crash** enabled will automatically restart after a 1-second delay when they exit with a non-zero code. A restart counter is tracked and displayed in the UI. Manual stops (`Stop` button) are distinguished from crashes — only crashes trigger the auto-restart.

### Auto-start on launch
Processes with **Auto-start when runboard launches** enabled are started automatically when the server boots. Useful for services you always need running.

### Pin to top
Any process can be pinned (📌) to always appear at the top of the list, regardless of creation order. Toggle with the 📌 button on each process card or via `POST /processes/:id/pin`.

### Duplicate process
The ⎘ button duplicates a process definition (copies config, not state). The copy is named `<name> copy`, `<name> copy 2`, etc. to avoid conflicts.

### Notes
Each process can have optional freeform notes displayed under the command in the list. Useful for "what does this do?" or run instructions.

---

## Log Management

### Persistent logs
Log output is saved to the database on process exit and reloaded when runboard restarts. The last 2000 lines are persisted. This means you can restart runboard and still see what happened last time a process ran.

### Timestamped log lines
Every log line is prefixed with `[HH:MM:SS.mmm]` and the stream (`[stdout]`/`[stderr]`) for easy timing analysis.

### ANSI color rendering
Terminal color codes (ANSI escape sequences) in log output are rendered as colored HTML spans rather than displayed as raw escape codes. XSS-safe via `ansi-to-html` with `escapeXML: true`.

### Log filtering
The log viewer has a filter input that case-insensitively filters visible lines. The matched/total count is shown (e.g., `12 / 847`).

### Clear logs
The **Clear** button wipes the in-memory log buffer and clears the persisted logs for a process. Broadcasts a `log:cleared` WebSocket event so all connected clients clear simultaneously.

### Download logs
The **↓** button downloads the current log buffer as a `.log` text file named `<process-name>.log`.

---

## Real-time Features

### WebSocket live updates
All state changes (process status, log lines, port detection, health checks) are pushed over WebSocket in real time. The client uses a shared singleton connection that auto-reconnects after 2 seconds if the server drops.

### Live uptime display
Running processes show a live-updating uptime counter (e.g., `2h 15m`, `45s`) that ticks every second.

### Port detection
When a process logs something like `Listening on port 3000` or `:8080`, runboard detects the port and shows a clickable `:3000` badge. Clicking opens `http://localhost:<port>` in a new tab.

### Crash notifications
Browser notifications fire when a process crashes (transitions to `errored` state). Permission is requested on the first crash. Requires the browser tab to be open but not focused.

---

## Health Checks

### Health check URL polling
Each process can have an optional **Health Check URL** (e.g., `http://localhost:3000/health`). The server polls this URL every 30 seconds for running processes and after a 5-second startup delay. The result is shown as a **healthy** (green) or **unhealthy** (red) badge next to the process name.

- HTTP 2xx response → `healthy`
- Non-2xx or network error / timeout → `unhealthy`
- Hovering the badge shows the URL being polled

---

## Bulk Operations

### Start all / Stop all
Header buttons to start all stopped processes or stop all running processes at once.

### Export / Import
**Export** downloads all process definitions (not runtime state, not logs) as a JSON file. **Import** reads a JSON file and adds any processes whose names don't already exist (duplicates are skipped). Useful for sharing a process config across machines or backing up your setup.

---

## Keyboard Shortcuts

From the main process list (when no input is focused):

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate process list |
| `s` | Start selected process |
| `x` | Stop selected process |
| `r` | Restart selected process |

---

## UX Polish

### Live page title
The browser tab title shows the count of running processes: `runboard (3 running)`. Falls back to just `runboard` when nothing is running.

### Process form templates
When creating a process, quick-fill templates are available for common stacks: Vite, Next.js, Bun, Node, ts-node, Flask, FastAPI/uvicorn, npm/pnpm dev, Rails, Django, and Go.

### Restart count badge
If a process has restarted (either manually or via auto-restart), an amber `↺N` badge appears on the process card showing how many times it has restarted.

---

## API Endpoints Added

| Method | Path | Description |
|--------|------|-------------|
| POST | `/processes/:id/pin` | Toggle pinned state |
| POST | `/processes/:id/duplicate` | Duplicate process definition |
| DELETE | `/processes/:id/logs` | Clear log buffer |
| POST | `/processes/start-all` | Start all stopped processes |
| POST | `/processes/stop-all` | Stop all running processes |
| GET | `/processes/export` | Export all definitions as JSON |
| POST | `/processes/import` | Import definitions from JSON |

---

## Database Schema Additions

New columns added via safe `ALTER TABLE` migrations (non-destructive, existing DBs work automatically):

- `auto_start` — boolean, default false
- `saved_logs` — TEXT (JSON array of last 2000 log lines)
- `notes` — TEXT, optional
- `pinned` — boolean, default false
- `health_url` — TEXT, optional
