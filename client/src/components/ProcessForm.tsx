import { useState } from "react";
import type { Process } from "../api/types";
import { apiFetch } from "../api/client";

interface Props {
  process: Process | null; // null = create, non-null = edit
  onClose: () => void;
  onSaved: () => void;
}

interface Template {
  name: string;
  command: string;
  cwd?: string;
}

const TEMPLATES: Template[] = [
  { name: "Vite (React/Vue)", command: "bun run dev" },
  { name: "Next.js", command: "bun run dev" },
  { name: "Bun server", command: "bun run --hot src/index.ts" },
  { name: "Node server", command: "node src/index.js" },
  { name: "ts-node", command: "npx ts-node src/index.ts" },
  { name: "Python (Flask/FastAPI)", command: "python -m flask run" },
  { name: "Python uvicorn", command: "uvicorn main:app --reload" },
  { name: "npm run dev", command: "npm run dev" },
  { name: "pnpm dev", command: "pnpm dev" },
  { name: "Rails server", command: "rails server" },
  { name: "Django", command: "python manage.py runserver" },
  { name: "Go run", command: "go run ." },
];

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
  const [autoStart, setAutoStart] = useState(process?.autoStart ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyTemplate = (t: Template) => {
    if (!name) setName(t.name.split(" ")[0].toLowerCase());
    setCommand(t.command);
    if (t.cwd) setCwd(t.cwd);
  };

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
      const body = { name, command, cwd, env: parseEnv(), autoRestart, autoStart };
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

        {/* Templates — only shown when creating */}
        {!process && (
          <div className="mb-4">
            <label className="text-xs font-mono text-slate-400 block mb-1">Quick-fill from template</label>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map(t => (
                <button
                  key={t.name}
                  onClick={() => applyTemplate(t)}
                  className="px-2 py-0.5 text-[11px] font-mono bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 text-slate-300 rounded transition-colors"
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

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
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm font-mono text-slate-300 cursor-pointer">
              <input type="checkbox" checked={autoRestart} onChange={e => setAutoRestart(e.target.checked)} />
              Auto-restart on crash
            </label>
            <label className="flex items-center gap-2 text-sm font-mono text-slate-300 cursor-pointer">
              <input type="checkbox" checked={autoStart} onChange={e => setAutoStart(e.target.checked)} />
              Auto-start when runboard launches
            </label>
          </div>
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
