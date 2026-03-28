import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Process } from "../api/types";
import { apiFetch } from "../api/client";
import { subscribeWS } from "../api/ws";

interface Props {
  processId: string | null;
  processes: Process[];
}

export function LogViewer({ processId, processes }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [liveLines, setLiveLines] = useState<string[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState("");
  const [clearing, setClearing] = useState(false);

  const process = processes.find(p => p.id === processId);

  // Fetch historical logs
  const { data: historical } = useQuery<{ logs: string[] }>({
    queryKey: ["logs", processId],
    queryFn: () => apiFetch(`/processes/${processId}/logs?last=200`),
    enabled: !!processId,
  });

  // Subscribe to log events via shared WS
  useEffect(() => {
    setLiveLines([]);
    if (!processId) return;
    return subscribeWS((event, data: any) => {
      if (event === "log:line" && data.processId === processId) {
        setLiveLines(prev => [...prev.slice(-499), data.line]);
      }
      if (event === "log:cleared" && data.processId === processId) {
        setLiveLines([]);
        queryClient.invalidateQueries({ queryKey: ["logs", processId] });
      }
    });
  }, [processId, queryClient]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveLines, autoScroll]);

  const allLines = [...(historical?.logs ?? []), ...liveLines];
  const displayLines = filter
    ? allLines.filter(l => l.toLowerCase().includes(filter.toLowerCase()))
    : allLines;

  const handleClear = async () => {
    if (!processId) return;
    setClearing(true);
    try {
      await apiFetch(`/processes/${processId}/logs`, { method: "DELETE" });
    } finally {
      setClearing(false);
    }
  };

  if (!processId) {
    return (
      <div className="h-full flex items-center justify-center text-slate-600 font-mono text-sm">
        Select a process to view logs
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-3 shrink-0 flex-wrap">
        <span className="font-mono text-sm text-slate-300">{process?.name ?? processId}</span>
        <span className="text-slate-600 text-xs font-mono">
          {filter ? `${displayLines.length}/${allLines.length}` : allLines.length} lines
        </span>
        {/* Filter input */}
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="filter..."
          className="bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-500 w-36"
        />
        {filter && (
          <button
            onClick={() => setFilter("")}
            className="text-slate-600 hover:text-slate-400 text-xs font-mono"
          >
            ✕
          </button>
        )}
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={handleClear}
            disabled={clearing || allLines.length === 0}
            className="text-xs font-mono text-slate-600 hover:text-slate-400 disabled:opacity-30 transition-colors"
          >
            {clearing ? "clearing..." : "clear"}
          </button>
          <label className="flex items-center gap-1.5 text-xs font-mono text-slate-500 cursor-pointer">
            <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} className="w-3 h-3" />
            auto-scroll
          </label>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs bg-slate-950">
        {displayLines.length === 0 ? (
          <span className="text-slate-600">
            {allLines.length === 0 ? "No logs yet. Start the process to see output." : "No lines match filter."}
          </span>
        ) : (
          displayLines.map((line, i) => {
            const isStderr = line.includes("[stderr]");
            const tsMatch = line.match(/^(\[\d{2}:\d{2}:\d{2}\.\d{3}\] )(\[\w+\] )(.*)/s);
            return (
              <div key={i} className={`leading-5 whitespace-pre-wrap break-all ${isStderr ? "text-red-400" : "text-slate-300"}`}>
                {tsMatch ? (
                  <>
                    <span className="text-slate-600">{tsMatch[1]}</span>
                    <span className={isStderr ? "text-red-700" : "text-slate-600"}>{tsMatch[2]}</span>
                    {tsMatch[3]}
                  </>
                ) : line}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
