import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Process } from "../api/types";
import { apiFetch } from "../api/client";

interface Props {
  processes: Process[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (p: Process) => void;
  onDelete: (id: string) => void;
}

function StatusDot({ status }: { status?: string }) {
  const color = status === "running" ? "bg-green-500" : status === "errored" ? "bg-red-500" : "bg-slate-600";
  return <span className={`inline-block w-2 h-2 rounded-full ${color} shrink-0`} />;
}

function formatUptime(startedAt: string) {
  const secs = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function Uptime({ startedAt }: { startedAt?: string | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return null;
  return <span className="text-slate-500 text-[10px] font-mono">{formatUptime(startedAt)}</span>;
}

export function ProcessList({ processes, selectedId, onSelect, onEdit, onDelete }: Props) {
  const queryClient = useQueryClient();

  const controlMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      apiFetch(`/processes/${id}/${action}`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["processes"] }),
  });

  if (processes.length === 0) {
    return (
      <div className="p-6 text-slate-500 text-sm font-mono">
        No processes yet. Add one to get started.
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-800">
      {processes.map(p => (
        <div
          key={p.id}
          onClick={() => onSelect(p.id)}
          className={`p-4 cursor-pointer hover:bg-slate-800/50 transition-colors ${selectedId === p.id ? "bg-slate-800" : ""}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <StatusDot status={p.status} />
            <span className="font-mono text-sm font-medium text-slate-100 truncate">{p.name}</span>
            <Uptime startedAt={p.startedAt} />
            {!!p.restartCount && (
              <span className="ml-auto shrink-0 text-[10px] font-mono text-amber-500 bg-amber-950/50 px-1.5 py-0.5 rounded">
                ↺{p.restartCount}
              </span>
            )}
          </div>
          <div className="text-slate-500 text-xs font-mono truncate mb-1.5">{p.command}</div>
          {p.detectedPorts?.length > 0 && (
            <div className="flex gap-1 flex-wrap mb-1.5">
              {p.detectedPorts.map(port => (
                <a
                  key={port}
                  href={`http://localhost:${port}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="text-[10px] font-mono text-sky-400 bg-sky-950/50 border border-sky-900/50 px-1.5 py-0.5 rounded hover:border-sky-500 transition-colors"
                >
                  :{port}
                </a>
              ))}
            </div>
          )}
          <div className="flex gap-1.5">
            {p.status === "running" ? (
              <>
                <button onClick={e => { e.stopPropagation(); controlMutation.mutate({ id: p.id, action: "stop" }); }}
                  className="px-2 py-0.5 text-[10px] font-mono bg-slate-700 hover:bg-red-900 text-slate-300 rounded transition-colors">
                  Stop
                </button>
                <button onClick={e => { e.stopPropagation(); controlMutation.mutate({ id: p.id, action: "restart" }); }}
                  className="px-2 py-0.5 text-[10px] font-mono bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors">
                  Restart
                </button>
              </>
            ) : (
              <button onClick={e => { e.stopPropagation(); controlMutation.mutate({ id: p.id, action: "start" }); }}
                className="px-2 py-0.5 text-[10px] font-mono bg-slate-700 hover:bg-green-900 text-slate-300 rounded transition-colors">
                Start
              </button>
            )}
            <button onClick={e => { e.stopPropagation(); onEdit(p); }}
              className="px-2 py-0.5 text-[10px] font-mono bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors ml-auto">
              Edit
            </button>
            <button onClick={e => { e.stopPropagation(); onDelete(p.id); }}
              className="px-2 py-0.5 text-[10px] font-mono bg-slate-700 hover:bg-red-900 text-red-400 rounded transition-colors">
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
