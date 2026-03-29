import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../themes.js";

interface HelpOverlayProps {
  width: number;
  height: number;
}

const SECTIONS = [
  {
    title: "Process List (left panel)",
    keys: [
      ["↑ / ↓", "Navigate processes"],
      ["s", "Start selected"],
      ["x", "Stop selected"],
      ["r", "Restart selected"],
      ["e", "Edit selected process"],
      ["n", "New process"],
      ["d", "Delete (press d again to confirm)"],
      ["p", "Toggle pin to top"],
      ["a", "Start all processes"],
      ["z", "Stop all processes"],
      ["tab", "Switch focus to log panel"],
    ],
  },
  {
    title: "Log Panel (right panel)",
    keys: [
      ["↑ / ↓", "Scroll one line"],
      ["PgUp / PgDn", "Scroll 10 lines"],
      ["g", "Jump to top"],
      ["G", "Jump to bottom (auto-scroll)"],
      ["f", "Toggle filter mode"],
      ["c", "Clear log buffer"],
      ["tab", "Switch focus to process list"],
      ["esc", "Clear filter / switch to list"],
    ],
  },
  {
    title: "Global",
    keys: [
      ["t", "Cycle color theme"],
      ["? / h", "Toggle this help screen"],
      ["q / ctrl+c", "Quit"],
    ],
  },
  {
    title: "Form (create / edit process)",
    keys: [
      ["↑ / ↓ / tab", "Navigate fields"],
      ["space", "Toggle checkbox"],
      ["enter", "Save"],
      ["esc", "Cancel"],
    ],
  },
];

export function HelpOverlay({ width, height }: HelpOverlayProps) {
  const theme = useTheme();

  const boxW = Math.min(72, width - 4);
  const keyCol = 14;
  const descCol = boxW - keyCol - 6;

  const lines: React.ReactNode[] = [];

  SECTIONS.forEach((section, si) => {
    lines.push(
      <Text key={`h-${si}`} color={theme.accent} bold>
        {section.title}
      </Text>
    );
    section.keys.forEach(([shortcut, desc], ki) => {
      lines.push(
        <Box key={`k-${si}-${ki}`}>
          <Text color={theme.dimFg}>{"  "}</Text>
          <Text color={theme.accent} bold>
            {shortcut.padEnd(keyCol)}
          </Text>
          <Text color={theme.normalFg}>{desc.slice(0, descCol)}</Text>
        </Box>
      );
    });
    lines.push(<Text key={`sp-${si}`}>{" "}</Text>);
  });

  // Vertically center the modal box
  const innerH = lines.length + 4; // borders + title + footer
  const topPad = Math.max(0, Math.floor((height - innerH) / 2));

  // Backdrop covers only the modal box footprint
  const backdropH = innerH + 2; // +2 for paddingY
  const backdropLeft = Math.floor((width - boxW) / 2);
  const backdropRow = " ".repeat(boxW);

  return (
    <Box position="absolute" flexDirection="column" width={width} height={height}>
      {/* Backdrop: only the modal's footprint */}
      <Box flexDirection="column" marginTop={topPad} marginLeft={backdropLeft}>
        {Array.from({ length: backdropH }, (_, i) => (
          <Text key={i}>{backdropRow}</Text>
        ))}
      </Box>
      {/* Modal box — absolutely positioned on top */}
      <Box
        position="absolute"
        flexDirection="column"
        alignItems="center"
        width={width}
        height={height}
        paddingTop={topPad}
      >
        <Box
          borderStyle="round"
          borderColor={theme.accent}
          flexDirection="column"
          paddingX={2}
          paddingY={1}
          width={boxW}
        >
          <Box marginBottom={1} justifyContent="center">
            <Text color={theme.accent} bold>
              {" "}runboard — keyboard shortcuts{" "}
            </Text>
          </Box>
          {lines}
          <Box marginTop={1} justifyContent="center">
            <Text color={theme.mutedFg}>press [?] or [esc] to close</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
