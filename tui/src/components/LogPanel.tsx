import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { useTheme } from "../themes.js";
import type { Process } from "../api.js";

interface LogPanelProps {
  process: Process | null;
  logs: string[];
  focused: boolean;
  filterMode: boolean;
  filterText: string;
  onFilterChange: (text: string) => void;
  scrollOffset: number; // lines from bottom; 0 = auto-scroll
  width: number;
  height: number;
}

const ANSI_RE = /\x1b\[[0-9;]*[mGKHF]/g;
function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "");
}

interface ParsedLine {
  timestamp: string;
  stream: "stdout" | "stderr" | "system" | "unknown";
  content: string;
}

function parseLine(line: string): ParsedLine {
  const m = line.match(/^\[(\d{2}:\d{2}:\d{2}\.\d{3})\] \[(stdout|stderr)\] (.*)$/s);
  if (m) {
    const content = m[3];
    return {
      timestamp: m[1],
      stream: content.startsWith("[runboard]") ? "system" : (m[2] as "stdout" | "stderr"),
      content: stripAnsi(content),
    };
  }
  return { timestamp: "", stream: "unknown", content: stripAnsi(line) };
}

export function LogPanel({
  process,
  logs,
  focused,
  filterMode,
  filterText,
  onFilterChange,
  scrollOffset,
  width,
  height,
}: LogPanelProps) {
  const theme = useTheme();

  const filteredLogs =
    filterMode && filterText
      ? logs.filter((l) => stripAnsi(l).toLowerCase().includes(filterText.toLowerCase()))
      : logs;

  // Available height for log lines: height - borders(2) - header(1) - divider(1) - optional filter row
  const filterRowH = filterMode ? 1 : 0;
  const linesH = Math.max(1, height - 4 - filterRowH);

  let visibleLines: string[];
  if (scrollOffset === 0) {
    visibleLines = filteredLogs.slice(-linesH);
  } else {
    const fromBottom = Math.min(scrollOffset, Math.max(0, filteredLogs.length - linesH));
    const end = filteredLogs.length - fromBottom;
    const start = Math.max(0, end - linesH);
    visibleLines = filteredLogs.slice(start, end);
  }

  // Pad to stable height
  while (visibleLines.length < linesH) {
    visibleLines = [...visibleLines, ""];
  }

  const innerW = width - 2;
  const processName = process?.name ?? "—";
  const scrollIndicator =
    scrollOffset > 0 ? ` ↑${scrollOffset}` : filteredLogs.length > linesH ? " ↓" : "";

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={focused ? theme.accent : theme.border}
      width={width}
    >
      {/* Panel header */}
      <Box paddingX={1} width={innerW + 2}>
        <Text color={theme.panelTitle} bold>
          {"LOGS "}
        </Text>
        <Text color={theme.mutedFg}>{processName}</Text>
        <Box flexGrow={1} />
        {filterMode && filterText && (
          <Text color={theme.mutedFg}>
            {filteredLogs.length}/{logs.length}
            {"  "}
          </Text>
        )}
        {filterMode ? (
          <Text color={theme.accent}>{"[f] filtering"}</Text>
        ) : focused ? (
          <Text color={theme.mutedFg}>{"[f] filter"}</Text>
        ) : null}
        {scrollIndicator ? <Text color={theme.mutedFg}>{scrollIndicator}</Text> : null}
      </Box>

      {/* Divider */}
      <Text color={theme.border}>{"─".repeat(innerW)}</Text>

      {/* Filter input */}
      {filterMode && (
        <Box paddingX={1}>
          <Text color={theme.accent}>{"/ "}</Text>
          <TextInput
            value={filterText}
            onChange={onFilterChange}
            placeholder={"filter logs…"}
            focus={filterMode && focused}
          />
        </Box>
      )}

      {/* No process selected */}
      {process === null && (
        <Box paddingX={1}>
          <Text color={theme.mutedFg}>{"Select a process to view logs."}</Text>
        </Box>
      )}

      {/* Log lines */}
      {process !== null &&
        visibleLines.map((line, i) => {
          if (!line) {
            return (
              <Box key={i} height={1} paddingX={1}>
                <Text>{" "}</Text>
              </Box>
            );
          }

          const parsed = parseLine(line);
          let contentColor = theme.logStdout;
          if (parsed.stream === "stderr") contentColor = theme.logStderr;
          if (parsed.stream === "system") contentColor = theme.logSystem;

          const tsW = parsed.timestamp ? parsed.timestamp.length + 3 : 0;
          const streamW =
            parsed.stream !== "unknown" && parsed.stream !== "system"
              ? parsed.stream.length + 3
              : 0;
          const contentW = Math.max(1, innerW - tsW - streamW - 1);

          return (
            <Box key={i} paddingX={1} width={innerW + 2}>
              {parsed.timestamp ? (
                <Text color={theme.logTimestamp}>{"[" + parsed.timestamp + "] "}</Text>
              ) : null}
              {parsed.stream !== "unknown" && parsed.stream !== "system" ? (
                <Text color={parsed.stream === "stderr" ? theme.logStderr : theme.dimFg}>
                  {"[" + parsed.stream + "] "}
                </Text>
              ) : null}
              <Text color={contentColor} wrap="truncate">
                {parsed.content.slice(0, contentW)}
              </Text>
            </Box>
          );
        })}
    </Box>
  );
}
