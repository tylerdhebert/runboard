import { useState } from "react";
import type { Process } from "../api/types";
import { apiFetch } from "../api/client";

interface Props {
  process: Process | null; // null = create, non-null = edit
  onClose: () => void;
  onSaved: () => void;
}

export function ProcessForm({ process, onClose, onSaved }: Props) {
  const [name, setName] = useState(process?.name ?? "");
  const [command, setCommand] = useState(process?.command ?? "");
  const [cwd, setCwd] = useState(process?.cwd ?? ".");
  const [envText, setEnvText] = useState(() => {
    if (!process?.env || process.env === "{}") return "";
    try {
      const obj = JSON.parse(process.env);
      return Object.entries(obj).map(([k, v]) => `${k}=${v}`).join("\n");
    } catch { return ""; }
  });
  const [autoRestart, setAutoRestart] = useState(process?.autoRestart ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseEnv = () => {
    const obj: Record<string, string> = {};
    envText.split("\n").forEach(line => {
      const idx = line.indexOf("=");
      if (idx > 0) obj[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    });
    return JSON.stringify(obj);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !command.trim()) { setError("Name and command are required"); return; }
    setSaving(true);
    setError(null);
    try {
      const body = { name, command, cwd, env: parseEnv(), autoRestart };
      if (process) {
        await apiFetch(`/processes/${process.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiFetch("/processes", { method: "POST", body: JSON.stringify(body) });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <h2 className="font-mono font-bold text-slate-100 mb-4">{process ? "Edit Process" : "Add Process"}</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-mono text-slate-400 block mb-1">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="my-server"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm font-mono text-slate-100 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs font-mono text-slate-400 block mb-1">Command</label>
            <input value={command} onChange={e => setCommand(e.target.value)} placeholder="bun run dev"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm font-mono text-slate-100 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs font-mono text-slate-400 block mb-1">Working Directory</label>
            <input value={cwd} onChange={e => setCwd(e.target.value)} placeholder="."
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm font-mono text-slate-100 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs font-mono text-slate-400 block mb-1">Environment Variables <span className="text-slate-600">(KEY=value, one per line)</span></label>
            <textarea value={envText} onChange={e => setEnvText(e.target.value)} rows={3} placeholder={"PORT=8080\nNODE_ENV=development"}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm font-mono text-slate-100 focus:outline-none focus:border-blue-500 resize-none" />
          </div>
          <label className="flex items-center gap-2 text-sm font-mono text-slate-300 cursor-pointer">
            <input type="checkbox" checked={autoRestart} onChange={e => setAutoRestart(e.target.checked)} />
            Auto-restart on exit
          </label>
        </div>
        {error && <p className="text-red-400 text-xs font-mono mt-3">{error}</p>}
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-sm font-mono text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-mono rounded transition-colors">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
