import { useEffect } from "react";
import { apiFetch } from "../api/client";
import type { Process } from "../api/types";

/**
 * Global keyboard shortcuts for the selected process.
 *
 * s — start
 * x — stop
 * r — restart
 * ↑/↓ — navigate process list
 */
export function useKeyboardShortcuts(
  processes: Process[],
  selectedId: string | null,
  onSelect: (id: string) => void
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const selected = processes.find(p => p.id === selectedId);
      const idx = processes.findIndex(p => p.id === selectedId);

      switch (e.key) {
        case "s":
          if (selected && selected.status !== "running") {
            e.preventDefault();
            apiFetch(`/processes/${selected.id}/start`, { method: "POST" });
          }
          break;
        case "x":
          if (selected && selected.status === "running") {
            e.preventDefault();
            apiFetch(`/processes/${selected.id}/stop`, { method: "POST" });
          }
          break;
        case "r":
          if (selected) {
            e.preventDefault();
            apiFetch(`/processes/${selected.id}/restart`, { method: "POST" });
          }
          break;
        case "ArrowUp":
          if (processes.length > 0) {
            e.preventDefault();
            const prev = idx <= 0 ? processes[processes.length - 1] : processes[idx - 1];
            onSelect(prev.id);
          }
          break;
        case "ArrowDown":
          if (processes.length > 0) {
            e.preventDefault();
            const next = idx < 0 || idx >= processes.length - 1 ? processes[0] : processes[idx + 1];
            onSelect(next.id);
          }
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [processes, selectedId, onSelect]);
}
