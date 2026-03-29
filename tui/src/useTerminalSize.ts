import { useState, useEffect } from "react";

export interface TerminalSize {
  columns: number;
  rows: number;
}

export function useTerminalSize(): TerminalSize {
  const [size, setSize] = useState<TerminalSize>({
    columns: process.stdout.columns ?? 80,
    rows: process.stdout.rows ?? 24,
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handler = () => {
      // Debounce: skip intermediate sizes while the user is still dragging,
      // only re-render once resizing pauses for 50ms.
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setSize({
          columns: process.stdout.columns ?? 80,
          rows: process.stdout.rows ?? 24,
        });
      }, 50);
    };

    process.stdout.on("resize", handler);
    return () => {
      process.stdout.off("resize", handler);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return size;
}
