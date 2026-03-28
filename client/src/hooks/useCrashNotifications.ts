import { useEffect, useRef } from "react";
import { subscribeWS } from "../api/ws";
import type { Process } from "../api/types";

/**
 * Watches for process:status "errored" events and fires a browser
 * Notification. Requests permission on first crash if not already granted.
 */
export function useCrashNotifications(processes: Process[]) {
  // Track previous statuses so we only notify on transitions to errored
  const prevStatuses = useRef<Record<string, string>>({});

  useEffect(() => {
    return subscribeWS((event, data: any) => {
      if (event !== "process:status" || data.status !== "errored") return;

      const id: string = data.processId;
      const prev = prevStatuses.current[id];
      prevStatuses.current[id] = "errored";

      // Only notify if this is a fresh crash (was running before)
      if (prev !== "errored") {
        const proc = processes.find(p => p.id === id);
        const name = proc?.name ?? id;
        fireNotification(`${name} crashed`, `Process exited with a non-zero code.`);
      }
    });
  }, [processes]);

  // Keep prevStatuses in sync with current known statuses
  useEffect(() => {
    for (const p of processes) {
      if (p.status !== "errored") {
        prevStatuses.current[p.id] = p.status;
      }
    }
  }, [processes]);
}

async function fireNotification(title: string, body: string) {
  if (!("Notification" in window)) return;

  if (Notification.permission === "default") {
    const result = await Notification.requestPermission();
    if (result !== "granted") return;
  }

  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico" });
  }
}
