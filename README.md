# runboard

A process manager with a web UI and terminal UI (TUI). Define, start, stop, and monitor processes — with live log streaming, health checks, port detection, and auto-restart.

## Structure

```
runboard/
  server/   — Elysia API server (port 3737)
  client/   — React web UI (port 5173)
  tui/      — Ink-based terminal UI
```

## Prerequisites

- [Bun](https://bun.sh) >= 1.0

## Running in development

```bash
# Start server + web client together
bun run dev

# TUI only (assumes server is already running)
cd tui && bun run dev
```

## Installing the `runboard` CLI globally

The TUI package includes a `runboard` binary that starts the server automatically if it isn't already running, then launches the TUI.

**One-time setup:**

```bash
cd tui
bun link
```

`bun link` registers the package globally so the `runboard` command is available anywhere in your terminal.

**Usage:**

```bash
runboard
```

That's it. If the server is already running it connects to it; if not, it starts it first.

**To unlink:**

```bash
cd tui
bun unlink
```

## TUI keyboard shortcuts

| Key | Action |
|-----|--------|
| `↑ / ↓` | Navigate processes |
| `s` | Start selected |
| `x` | Stop selected |
| `r` | Restart selected |
| `e` | Edit selected process |
| `n` | New process |
| `d` `d` | Delete (confirm) |
| `p` | Pin to top |
| `a` | Start all |
| `z` | Stop all |
| `tab` | Switch focus between panels |
| `t` | Cycle color theme |
| `?` / `h` | Toggle help |
| `q` / `ctrl+c` | Quit |
