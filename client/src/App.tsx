import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Process } from "./api/types";
import { apiFetch } from "./api/client";
import { ProcessList } from "./components/ProcessList";
import { LogViewer } from "./components/LogViewer";
import { ProcessForm } from "./components/ProcessForm";

export function App() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editProcess, setEditProcess] = useState<Process | null>(null);

  const { data: processes = [] } = useQuery<Process[]>({
    queryKey: ["processes"],
    queryFn: () => apiFetch("/processes"),
    refetchInterval: 3000,
  });

  // WebSocket for real-time updates
  useState(() => {
    const ws = new WebSocket(`ws://${window.location.host}/ws`);
    ws.onmessage = (e) => {
      const { event } = JSON.parse(e.data);
      if (event === "log:line" || event === "process:status" || event === "process:created" || event === "process:deleted" || event === "process:updated") {
        queryClient.invalidateQueries({ queryKey: ["processes"] });
      }
    };
    return () => ws.close();
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/processes/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["processes"] }),
  });

  const handleEdit = (p: Process) => { setEditProcess(p); setShowForm(true); };
  const handleDelete = (id: string) => { if (confirm("Delete this process?")) deleteMutation.mutate(id); };
  const handleFormClose = () => { setShowForm(false); setEditProcess(null); };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-3 flex items-center gap-4 shrink-0">
        <h1 className="text-lg font-bold font-mono text-slate-100">runboard</h1>
        <span className="text-slate-600 text-sm font-mono">local process manager</span>
        <div className="ml-auto">
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
