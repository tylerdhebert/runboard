import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../themes.js";

type FocusMode = "list" | "logs";
type FormMode = "create" | "edit" | null;

interface StatusBarProps {
  focus: FocusMode;
  formMode: FormMode;
  showHelp: boolean;
  filterMode: boolean;
  deleteConfirm: boolean;
  width: number;
}

export function StatusBar({
  focus,
  formMode,
  showHelp,
  filterMode,
  deleteConfirm,
  width,
}: StatusBarProps) {
  const theme = useTheme();

  let text = "";

  if (showHelp) {
    text = "  [esc] or [?] close help";
  } else if (formMode) {
    text = "  [↑↓/tab] navigate  [space] toggle  [enter] save  [esc] cancel";
  } else if (focus === "list") {
    if (deleteConfirm) {
      text = "  [d] confirm delete  [esc] cancel";
    } else {
      text =
        "  [↑↓] nav  [tab] logs  [s] start  [x] stop  [r] restart  [e] edit  [n] new  [d] del  [p] pin  [a] start all  [z] stop all  [t] theme";
    }
  } else {
    if (filterMode) {
      text = "  [↑↓] scroll  [pgup/dn] page  [g/G] top/btm  [f] filter  [c] clear  [esc] clear filter  [tab] list";
    } else {
      text = "  [↑↓] scroll  [pgup/dn] page  [g/G] top/btm  [f] filter  [c] clear  [tab] list";
    }
  }

  // Pad to width
  const padded = text.padEnd(width);

  return (
    <Box width={width}>
      <Text backgroundColor={theme.statusBarBg} color={theme.statusBarFg}>
        {padded.slice(0, width)}
      </Text>
    </Box>
  );
}
