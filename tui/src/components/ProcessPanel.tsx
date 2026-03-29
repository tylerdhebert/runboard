import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../themes.js";
import type { Process } from "../api.js";

interface ProcessPanelProps {
  processes: Process[];
  selectedIdx: number;
  focused: boolean;
  width: number;
  height: number;
  deleteConfirm: boolean;
}

function formatUptime(startedAt: string): string {
  const secs = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function UptimeTick({ startedAt }: { startedAt: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return <>{formatUptime(startedAt)}</>;
}

export function ProcessPanel({
  processes,
  selectedIdx,
  focused,
  width,
  height,
  deleteConfirm,
}: ProcessPanelProps) {
  const theme = useTheme();

  // 2 rows per process; keep selected visible
  const rowsPerProc = 2;
  // Reserve rows for: top border(1) + header(1) + divider(1) + bottom border(1) + optional delete(1)
  const reserved = 4 + (deleteConfirm ? 1 : 0);
  const visibleCount = Math.max(1, Math.floor((height - reserved) / rowsPerProc));
  const scrollTop = Math.max(
    0,
    Math.min(selectedIdx - Math.floor(visibleCount / 2), processes.length - visibleCount)
  );
  const visible = processes.slice(scrollTop, scrollTop + visibleCount);

  // innerW: box width minus borders (1 each side)
  const innerW = width - 2;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={focused ? theme.accent : theme.border}
      width={width}
    >
      {/* Panel header */}
      <Box paddingX={1}>
        <Text color={theme.panelTitle} bold>
          {"PROCESSES "}
        </Text>
        <Text color={theme.mutedFg}>{"(" + processes.length + ")"}</Text>
        {processes.length > visibleCount && (
          <Text color={theme.mutedFg}>
            {"  "}
            {scrollTop > 0 ? "↑" : " "}
            {scrollTop + visibleCount < processes.length ? "↓" : " "}
          </Text>
        )}
      </Box>

      {/* Divider */}
      <Text color={theme.border}>{"─".repeat(innerW)}</Text>

      {processes.length === 0 && (
        <Box paddingX={1}>
          <Text color={theme.mutedFg}>{"No processes yet. Press [n] to add."}</Text>
        </Box>
      )}

      {visible.map((p, visIdx) => {
        const realIdx = scrollTop + visIdx;
        const isSelected = realIdx === selectedIdx;

        // Status
        let statusChar = "○";
        let statusColor = theme.stopped;
        if (p.status === "running") { statusChar = "●"; statusColor = theme.running; }
        else if (p.status === "errored") { statusChar = "✕"; statusColor = theme.errored; }

        const cursor = isSelected && focused ? "▶ " : "  ";
        const cursorColor = isSelected ? theme.accent : theme.mutedFg;

        // Name truncation: innerW - cursor(2) - status(2) - uptime(~8) - pin(2)
        const uptimeReserve = p.status === "running" ? 8 : 0;
        const pinReserve = p.pinned ? 2 : 0;
        const nameW = Math.max(4, innerW - 2 - 2 - uptimeReserve - pinReserve);
        const name = p.name.length > nameW ? p.name.slice(0, nameW - 1) + "…" : p.name;

        // Detail row
        const ports = (p.detectedPorts ?? []).map((port) => `:${port}`).join(" ");
        const healthLabel =
          p.healthStatus === "healthy" ? "✓ok" : p.healthStatus === "unhealthy" ? "✗down" : "";
        const restartLabel = p.restartCount ? `↺${p.restartCount}` : "";

        return (
          <React.Fragment key={p.id}>
            {/* Name row */}
            <Box paddingX={1} width={innerW + 2}>
              <Text color={cursorColor}>{cursor}</Text>
              <Text color={statusColor}>{statusChar + " "}</Text>
              <Text
                color={isSelected ? theme.accent : theme.normalFg}
                bold={isSelected}
              >
                {name}
              </Text>
              {p.pinned && <Text color={theme.warning}>{" 📌"}</Text>}
              <Box flexGrow={1} />
              {p.status === "running" && p.startedAt && (
                <Text color={theme.mutedFg}>
                  <UptimeTick startedAt={p.startedAt} />
                </Text>
              )}
            </Box>

            {/* Detail row */}
            <Box paddingX={1} width={innerW + 2}>
              <Text>{"    "}</Text>
              {ports ? <Text color={theme.accent}>{ports + " "}</Text> : null}
              {p.healthStatus === "healthy" ? (
                <Text color={theme.healthy}>{healthLabel + " "}</Text>
              ) : p.healthStatus === "unhealthy" ? (
                <Text color={theme.unhealthy}>{healthLabel + " "}</Text>
              ) : null}
              {p.restartCount ? (
                <Text color={theme.warning}>{restartLabel + " "}</Text>
              ) : null}
              {p.notes && !ports && !p.healthStatus && !p.restartCount ? (
                <Text color={theme.mutedFg} italic>
                  {`"${p.notes}"`.slice(0, innerW - 5)}
                </Text>
              ) : null}
            </Box>
          </React.Fragment>
        );
      })}

      {deleteConfirm && (
        <Box paddingX={1}>
          <Text color={theme.error} bold>
            {"⚠ Delete? [d] confirm  [esc] cancel"}
          </Text>
        </Box>
      )}
    </Box>
  );
}
