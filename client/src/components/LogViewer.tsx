import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Process } from "../api/types";
import { apiFetch } from "../api/client";

interface Props {
  processId: string | null;
  processes: Process[];
}

export function LogViewer({ processId, processes }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [liveLines, setLiveLines] = useState<string[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);

  const process = processes.find(p => p.id === processId);

  // Fetch historical logs
  const { data: historical } = useQuery<{ logs: string[] }>({
    queryKey: ["logs", processId],
    queryFn: () => apiFetch(`/processes/${processId}/logs?last=200`),
    enabled: !!processId,
  });

  // WebSocket for live lines
  useEffect(() => {
    setLiveLines([]);
    if (!processId) return;
    const ws = new WebSocket(`ws://${window.location.host}/ws`);
    ws.onmessage = (e) => {
      const { event, data } = JSON.parse(e.data);
      if (event === "log:line" && data.processId === processId) {
        setLiveLines(prev => [...prev.slice(-499), data.line]);
      }
    };
    return () => ws.close();
  }, [processId]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveLines, autoScroll]);

  const allLines = [...(historical?.logs ?? []), ...liveLines];

  if (!processId) {
    return (
      <div className="h-full flex items-center justify-center text-slate-600 font-mono text-sm">
        Select a process to view logs
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-3 shrink-0">
        <span className="font-mono text-sm text-slate-300">{process?.name ?? processId}</span>
        <span className="text-slate-600 text-xs font-mono">{allLines.length} lines</span>
        <label className="ml-auto flex items-center gap-1.5 text-xs font-mono text-slate-500 cursor-pointer">
          <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} className="w-3 h-3" />
          auto-scroll
        </label>
      </div>
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs bg-slate-950">
        {allLines.length === 0 ? (
          <span className="text-slate-600">No logs yet. Start the process to see output.</span>
        ) : (
          allLines.map((line, i) => (
            <div key={i} className={`leading-5 whitespace-pre-wrap break-all ${line.startsWith("[stderr]") ? "text-red-400" : "text-slate-300"}`}>
              {line}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
