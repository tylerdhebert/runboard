import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Process } from "./api/types";
import { apiFetch } from "./api/client";
import { subscribeWS } from "./api/ws";
import { ProcessList } from "./components/ProcessList";
import { LogViewer } from "./components/LogViewer";
import { ProcessForm } from "./components/ProcessForm";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

export function App() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editProcess, setEditProcess] = useState<Process | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const { data: processes = [] } = useQuery<Process[]>({
    queryKey: ["processes"],
    queryFn: () => apiFetch("/processes"),
    refetchInterval: 3000,
  });

  // Subscribe to process-level WS events to keep the list fresh
  useEffect(() => {
    return subscribeWS((event) => {
      if (["process:status", "process:created", "process:deleted", "process:updated", "process:ports"].includes(event)) {
        queryClient.invalidateQueries({ queryKey: ["processes"] });
      }
    });
  }, [queryClient]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/processes/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["processes"] }),
  });

  const importMutation = useMutation({
    mutationFn: (procs: object[]) =>
      apiFetch<{ imported: number; skipped: number }>("/processes/import", {
        method: "POST",
        body: JSON.stringify({ processes: procs }),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["processes"] });
      alert(`Imported ${result.imported} process(es). Skipped ${result.skipped} duplicate name(s).`);
    },
  });

  const handleExport = async () => {
    const data = await apiFetch<object[]>("/processes/export");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "runboard-processes.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const procs = Array.isArray(json) ? json : json.processes;
        if (!Array.isArray(procs)) throw new Error("Expected array of processes");
        importMutation.mutate(procs);
      } catch (err) {
        alert(`Import failed: ${err instanceof Error ? err.message : "invalid JSON"}`);
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // reset so same file can be re-imported
  };

  const bulkMutation = useMutation({
    mutationFn: (action: "start-all" | "stop-all") =>
      apiFetch(`/processes/${action}`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["processes"] }),
  });

  const handleEdit = (p: Process) => { setEditProcess(p); setShowForm(true); };
  const handleDelete = (id: string) => { if (confirm("Delete this process?")) deleteMutation.mutate(id); };
  const handleFormClose = () => { setShowForm(false); setEditProcess(null); };

  useKeyboardShortcuts(processes, selectedId, setSelectedId);

  // Live page title: "runboard (3 running)"
  const runningCount = processes.filter(p => p.status === "running").length;
  useEffect(() => {
    document.title = runningCount > 0 ? `runboard (${runningCount} running)` : "runboard";
  }, [runningCount]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-3 flex items-center gap-4 shrink-0">
        <h1 className="text-lg font-bold font-mono text-slate-100">runboard</h1>
        <span className="text-slate-600 text-sm font-mono">local process manager</span>
        <span className="text-slate-700 text-xs font-mono hidden sm:block">↑↓ navigate · s start · x stop · r restart</span>
        <div className="ml-auto flex items-center gap-2">
          {processes.length > 0 && (
            <>
              <button
                onClick={() => bulkMutation.mutate("start-all")}
                disabled={bulkMutation.isPending || processes.every(p => p.status === "running")}
                className="px-3 py-1.5 text-sm font-mono text-slate-400 hover:text-green-400 disabled:opacity-30 transition-colors"
              >
                Start all
              </button>
              <button
                onClick={() => bulkMutation.mutate("stop-all")}
                disabled={bulkMutation.isPending || processes.every(p => p.status !== "running")}
                className="px-3 py-1.5 text-sm font-mono text-slate-400 hover:text-red-400 disabled:opacity-30 transition-colors"
              >
                Stop all
              </button>
              <span className="text-slate-800">|</span>
            </>
          )}
          <button
            onClick={handleExport}
            disabled={processes.length === 0}
            className="px-3 py-1.5 text-sm font-mono text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors"
          >
            Export
          </button>
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={importMutation.isPending}
            className="px-3 py-1.5 text-sm font-mono text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors"
          >
            {importMutation.isPending ? "Importing..." : "Import"}
          </button>
          <input ref={importInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
          <button
            onClick={() => { setEditProcess(null); setShowForm(true); }}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-mono rounded transition-colors"
          >
            + Add Process
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Process list - left panel */}
        <div className="w-96 shrink-0 border-r border-slate-800 overflow-y-auto">
          <ProcessList
            processes={processes}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>

        {/* Log viewer - right panel */}
        <div className="flex-1 overflow-hidden">
          <LogViewer processId={selectedId} processes={processes} />
        </div>
      </div>

      {/* Process form modal */}
      {showForm && (
        <ProcessForm
          process={editProcess}
          onClose={handleFormClose}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["processes"] });
            handleFormClose();
          }}
        />
      )}
    </div>
  );
}
