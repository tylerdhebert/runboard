import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { ThemeContext, themes } from "./themes.js";
import { useTerminalSize } from "./useTerminalSize.js";
import {
  RunboardWS,
  getProcesses,
  startProcess,
  stopProcess,
  restartProcess,
  deleteProcess,
  pinProcess,
  createProcess,
  updateProcess,
  getProcessLogs,
  clearProcessLogs,
  startAll,
  stopAll,
} from "./api.js";
import type { Process, ProcessCreateBody } from "./api.js";
import { Header } from "./components/Header.js";
import { ProcessPanel } from "./components/ProcessPanel.js";
import { LogPanel } from "./components/LogPanel.js";
import { StatusBar } from "./components/StatusBar.js";
import { HelpOverlay } from "./components/HelpOverlay.js";
import { ProcessForm } from "./components/ProcessForm.js";

type Focus = "list" | "logs";
type FormMode = "create" | "edit" | null;

function sortProcesses(procs: Process[]): Process[] {
  return [...procs].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return a.name.localeCompare(b.name);
  });
}

export function App() {
  const { exit } = useApp();
  const { columns, rows } = useTerminalSize();

  const [themeIdx, setThemeIdx] = useState(0);
  const theme = themes[themeIdx];

  const [processes, setProcesses] = useState<Process[]>([]);
  const [connected, setConnected] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [focus, setFocus] = useState<Focus>("list");
  const [logs, setLogs] = useState<string[]>([]);
  const [logScrollOffset, setLogScrollOffset] = useState(0);
  const [filterMode, setFilterMode] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Keep a ref to selected process id to reload logs when selection changes
  const selectedIdRef = useRef<string | null>(null);

  const selectedProcess = processes[selectedIdx] ?? null;

  // Load logs + reset per-process UI state when selected process changes
  useEffect(() => {
    const id = selectedProcess?.id ?? null;
    if (id === selectedIdRef.current) return;
    selectedIdRef.current = id;
    setLogs([]);
    setLogScrollOffset(0);
    setFilterMode(false);
    setFilterText("");
    setDeleteConfirm(false);
    if (id) {
      getProcessLogs(id, 500).then(setLogs).catch(() => {});
    }
  }, [selectedProcess?.id]);

  // Fetch process list on mount and every 3s
  useEffect(() => {
    const load = () => {
      getProcesses()
        .then((procs) => {
          setProcesses((prev) => {
            const sorted = sortProcesses(procs);
            // Keep selected index clamped
            setSelectedIdx((idx) => Math.min(idx, Math.max(0, sorted.length - 1)));
            return sorted;
          });
        })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, []);

  // WebSocket
  useEffect(() => {
    const ws = new RunboardWS((event, data) => {
      if (event === "__connected") {
        setConnected(true);
        return;
      }
      if (event === "__disconnected") {
        setConnected(false);
        return;
      }

      const d = data as Record<string, unknown>;

      if (event === "process:status" || event === "process:ports" || event === "process:health") {
        const pid = d.processId as string;
        setProcesses((prev) =>
          sortProcesses(
            prev.map((p) => {
              if (p.id !== pid) return p;
              if (event === "process:status") {
                const newStatus = d.status as Process["status"];
                return {
                  ...p,
                  status: newStatus,
                  pid: newStatus === "running" ? ((d.pid as number | null) ?? p.pid) : null,
                  startedAt: newStatus === "running" ? (p.startedAt ?? new Date().toISOString()) : p.startedAt,
                  restartCount: (d.restartCount as number | undefined) ?? p.restartCount,
                };
              }
              if (event === "process:ports") {
                return { ...p, detectedPorts: d.ports as number[] };
              }
              if (event === "process:health") {
                return { ...p, healthStatus: d.healthStatus as Process["healthStatus"] };
              }
              return p;
            })
          )
        );
      }

      if (event === "process:created") {
        const proc = d as unknown as Process;
        setProcesses((prev) => sortProcesses([...prev, proc]));
      }

      if (event === "process:deleted") {
        const deletedId = d.id as string;
        setProcesses((prev) => {
          const next = sortProcesses(prev.filter((p) => p.id !== deletedId));
          setSelectedIdx((idx) => Math.min(idx, Math.max(0, next.length - 1)));
          return next;
        });
      }

      if (event === "process:updated") {
        const proc = d as unknown as Process;
        setProcesses((prev) =>
          sortProcesses(prev.map((p) => (p.id === proc.id ? { ...p, ...proc } : p)))
        );
      }

      if (event === "log:line") {
        const pid = d.processId as string;
        if (pid === selectedIdRef.current) {
          setLogs((prev) => [...prev.slice(-2000), d.line as string]);
        }
      }

      if (event === "log:cleared") {
        const pid = d.processId as string;
        if (pid === selectedIdRef.current) {
          setLogs([]);
          setLogScrollOffset(0);
        }
      }
    });

    ws.connect();
    return () => ws.disconnect();
  }, []);

  // Compute layout
  const listW = Math.max(28, Math.floor(columns * 0.32));
  const logW = Math.max(20, columns - listW);
  const panelH = Math.max(4, rows - 2); // header(1) + statusbar(1)

  // Key handler
  const isOverlay = showHelp || formMode !== null;

  useInput(
    (input, key) => {
      // Global shortcuts (always active unless form open)
      if (formMode) return; // form handles its own input

      if (input === "?" || input === "h") {
        setShowHelp((v) => !v);
        return;
      }
      if (key.escape && showHelp) {
        setShowHelp(false);
        return;
      }
      if (input === "q") {
        exit();
        return;
      }
      if (input === "t") {
        setThemeIdx((i) => (i + 1) % themes.length);
        return;
      }

      if (showHelp) return; // swallow all other keys when help open

      if (key.escape) {
        if (deleteConfirm) {
          setDeleteConfirm(false);
          return;
        }
        if (focus === "logs") {
          if (filterMode && filterText) {
            setFilterText("");
            return;
          }
          if (filterMode) {
            setFilterMode(false);
            return;
          }
          setFocus("list");
          return;
        }
      }

      if (key.tab) {
        setFocus((f) => (f === "list" ? "logs" : "list"));
        setDeleteConfirm(false);
        return;
      }

      if (focus === "list") {
        if (key.upArrow) {
          setSelectedIdx((i) => Math.max(0, i - 1));
          setDeleteConfirm(false);
          return;
        }
        if (key.downArrow) {
          setSelectedIdx((i) => Math.min(processes.length - 1, i + 1));
          setDeleteConfirm(false);
          return;
        }

        // These actions don't require a selected process
        if (input === "n") { setFormMode("create"); setDeleteConfirm(false); return; }
        if (input === "a") { startAll().catch(() => {}); return; }
        if (input === "z") { stopAll().catch(() => {}); return; }

        const proc = selectedProcess;
        if (!proc) return;

        if (input === "s") {
          startProcess(proc.id).catch(() => {});
          setDeleteConfirm(false);
          return;
        }
        if (input === "x") {
          stopProcess(proc.id).catch(() => {});
          setDeleteConfirm(false);
          return;
        }
        if (input === "r") {
          restartProcess(proc.id).catch(() => {});
          setDeleteConfirm(false);
          return;
        }
        if (input === "p") {
          pinProcess(proc.id).catch(() => {});
          setDeleteConfirm(false);
          return;
        }
        if (input === "e") {
          setFormMode("edit");
          setDeleteConfirm(false);
          return;
        }
        if (input === "d") {
          if (deleteConfirm) {
            deleteProcess(proc.id).catch(() => {});
            setDeleteConfirm(false);
          } else {
            setDeleteConfirm(true);
          }
          return;
        }
      }

      if (focus === "logs") {
        // Don't intercept when filter text input is active
        if (filterMode) {
          // TextInput in LogPanel handles typing; we only catch special keys
          if (key.escape) {
            if (filterText) {
              setFilterText("");
            } else {
              setFilterMode(false);
            }
            return;
          }
          return; // let TextInput handle the rest
        }

        if (key.upArrow) {
          setLogScrollOffset((o) => o + 1);
          return;
        }
        if (key.downArrow) {
          setLogScrollOffset((o) => Math.max(0, o - 1));
          return;
        }
        if (key.pageUp) {
          setLogScrollOffset((o) => o + 10);
          return;
        }
        if (key.pageDown) {
          setLogScrollOffset((o) => Math.max(0, o - 10));
          return;
        }
        if (input === "g") {
          // top
          setLogScrollOffset(logs.length);
          return;
        }
        if (input === "G") {
          // bottom / auto-scroll
          setLogScrollOffset(0);
          return;
        }
        if (input === "f") {
          setFilterMode((v) => !v);
          if (filterMode) setFilterText("");
          return;
        }
        if (input === "c" && selectedProcess) {
          clearProcessLogs(selectedProcess.id).catch(() => {});
          return;
        }
      }
    },
    { isActive: !formMode }
  );

  const handleFormSave = useCallback(
    async (body: ProcessCreateBody) => {
      if (formMode === "create") {
        await createProcess(body);
      } else if (formMode === "edit" && selectedProcess) {
        await updateProcess(selectedProcess.id, body);
      }
      // Refresh processes
      const procs = await getProcesses();
      setProcesses(sortProcesses(procs));
      setFormMode(null);
    },
    [formMode, selectedProcess]
  );

  return (
    <ThemeContext.Provider value={theme}>
      <Box flexDirection="column" width={columns} height={rows}>
        {/* Header */}
        <Header
          processes={processes}
          connected={connected}
          themeName={theme.name}
          width={columns}
        />

        {/* Main content: panels OR overlay — never both, so no transparency bleed */}
        {showHelp ? (
          <HelpOverlay width={columns} height={panelH} />
        ) : formMode ? (
          <ProcessForm
            process={formMode === "edit" ? selectedProcess : null}
            width={columns}
            height={panelH}
            onSave={handleFormSave}
            onCancel={() => setFormMode(null)}
          />
        ) : (
          <Box flexDirection="row" height={panelH} width={columns}>
            <ProcessPanel
              processes={processes}
              selectedIdx={selectedIdx}
              focused={focus === "list"}
              width={listW}
              height={panelH}
              deleteConfirm={deleteConfirm}
            />
            <LogPanel
              process={selectedProcess}
              logs={logs}
              focused={focus === "logs"}
              filterMode={filterMode}
              filterText={filterText}
              onFilterChange={setFilterText}
              scrollOffset={logScrollOffset}
              width={logW}
              height={panelH}
            />
          </Box>
        )}

        {/* Status bar */}
        <StatusBar
          focus={focus}
          formMode={formMode}
          showHelp={showHelp}
          filterMode={filterMode}
          deleteConfirm={deleteConfirm}
          width={columns}
        />
      </Box>
    </ThemeContext.Provider>
  );
}
