import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../themes.js";
import type { Process } from "../api.js";

interface HeaderProps {
  processes: Process[];
  connected: boolean;
  themeName: string;
  width: number;
}

export function Header({ processes, connected, themeName, width }: HeaderProps) {
  const theme = useTheme();
  const runningCount = processes.filter((p) => p.status === "running").length;

  const statusDot = connected ? "●" : "○";
  const statusText = connected ? ` ${runningCount} running` : " disconnected";
  const themeLabel = `[${themeName}]`;
  const rightContent = `[?] help  [q] quit  `;

  // Build header as a single padded line
  const left = `  runboard ${statusDot}${statusText}  ${themeLabel}`;
  const right = rightContent;
  const spaces = Math.max(1, width - left.length - right.length);

  return (
    <Box width={width}>
      <Text backgroundColor={theme.headerBg} color={theme.headerFg} bold>
        {"  runboard "}
      </Text>
      <Text
        backgroundColor={theme.headerBg}
        color={connected ? theme.running : theme.errored}
      >
        {statusDot}
      </Text>
      <Text backgroundColor={theme.headerBg} color={theme.dimFg}>
        {statusText}
        {"  "}
      </Text>
      <Text backgroundColor={theme.headerBg} color={theme.accent}>
        {themeLabel}
      </Text>
      <Text backgroundColor={theme.headerBg} color={theme.headerBg}>
        {" ".repeat(Math.max(1, spaces))}
      </Text>
      <Text backgroundColor={theme.headerBg} color={theme.dimFg}>
        {right}
      </Text>
    </Box>
  );
}
