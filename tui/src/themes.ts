import React, { createContext, useContext } from "react";

export interface Theme {
  name: string;
  border: string;
  headerBg: string;
  headerFg: string;
  accent: string;
  selectedBg: string;
  panelTitle: string;
  normalFg: string;
  dimFg: string;
  mutedFg: string;
  running: string;
  stopped: string;
  errored: string;
  healthy: string;
  unhealthy: string;
  logTimestamp: string;
  logStdout: string;
  logStderr: string;
  logSystem: string;
  warning: string;
  success: string;
  error: string;
  statusBarFg: string;
  statusBarBg: string;
}

export const themes: Theme[] = [
  {
    name: "Dark",
    border: "#4a5568",
    headerBg: "#1a202c",
    headerFg: "#e2e8f0",
    accent: "#63b3ed",
    selectedBg: "#2d3748",
    panelTitle: "#90cdf4",
    normalFg: "#e2e8f0",
    dimFg: "#a0aec0",
    mutedFg: "#718096",
    running: "#68d391",
    stopped: "#718096",
    errored: "#fc8181",
    healthy: "#68d391",
    unhealthy: "#fc8181",
    logTimestamp: "#667eea",
    logStdout: "#e2e8f0",
    logStderr: "#fc8181",
    logSystem: "#a0aec0",
    warning: "#f6e05e",
    success: "#68d391",
    error: "#fc8181",
    statusBarFg: "#e2e8f0",
    statusBarBg: "#2d3748",
  },
  {
    name: "Light",
    border: "#cbd5e0",
    headerBg: "#edf2f7",
    headerFg: "#1a202c",
    accent: "#3182ce",
    selectedBg: "#bee3f8",
    panelTitle: "#2b6cb0",
    normalFg: "#1a202c",
    dimFg: "#4a5568",
    mutedFg: "#718096",
    running: "#276749",
    stopped: "#718096",
    errored: "#c53030",
    healthy: "#276749",
    unhealthy: "#c53030",
    logTimestamp: "#553c9a",
    logStdout: "#1a202c",
    logStderr: "#c53030",
    logSystem: "#4a5568",
    warning: "#b7791f",
    success: "#276749",
    error: "#c53030",
    statusBarFg: "#1a202c",
    statusBarBg: "#e2e8f0",
  },
  {
    name: "Nord",
    border: "#4c566a",
    headerBg: "#2e3440",
    headerFg: "#eceff4",
    accent: "#88c0d0",
    selectedBg: "#3b4252",
    panelTitle: "#81a1c1",
    normalFg: "#eceff4",
    dimFg: "#d8dee9",
    mutedFg: "#4c566a",
    running: "#a3be8c",
    stopped: "#4c566a",
    errored: "#bf616a",
    healthy: "#a3be8c",
    unhealthy: "#bf616a",
    logTimestamp: "#b48ead",
    logStdout: "#d8dee9",
    logStderr: "#bf616a",
    logSystem: "#4c566a",
    warning: "#ebcb8b",
    success: "#a3be8c",
    error: "#bf616a",
    statusBarFg: "#eceff4",
    statusBarBg: "#3b4252",
  },
  {
    name: "Dracula",
    border: "#6272a4",
    headerBg: "#282a36",
    headerFg: "#f8f8f2",
    accent: "#bd93f9",
    selectedBg: "#44475a",
    panelTitle: "#8be9fd",
    normalFg: "#f8f8f2",
    dimFg: "#6272a4",
    mutedFg: "#44475a",
    running: "#50fa7b",
    stopped: "#6272a4",
    errored: "#ff5555",
    healthy: "#50fa7b",
    unhealthy: "#ff5555",
    logTimestamp: "#ff79c6",
    logStdout: "#f8f8f2",
    logStderr: "#ff5555",
    logSystem: "#6272a4",
    warning: "#f1fa8c",
    success: "#50fa7b",
    error: "#ff5555",
    statusBarFg: "#f8f8f2",
    statusBarBg: "#44475a",
  },
  {
    name: "Gruvbox",
    border: "#665c54",
    headerBg: "#1d2021",
    headerFg: "#ebdbb2",
    accent: "#fabd2f",
    selectedBg: "#3c3836",
    panelTitle: "#83a598",
    normalFg: "#ebdbb2",
    dimFg: "#a89984",
    mutedFg: "#665c54",
    running: "#b8bb26",
    stopped: "#665c54",
    errored: "#fb4934",
    healthy: "#b8bb26",
    unhealthy: "#fb4934",
    logTimestamp: "#d3869b",
    logStdout: "#ebdbb2",
    logStderr: "#fb4934",
    logSystem: "#a89984",
    warning: "#fabd2f",
    success: "#b8bb26",
    error: "#fb4934",
    statusBarFg: "#ebdbb2",
    statusBarBg: "#3c3836",
  },
];

export const ThemeContext = createContext<Theme>(themes[0]);

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
