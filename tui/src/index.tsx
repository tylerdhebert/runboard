import React from "react";
import { render } from "ink";
import { App } from "./App.js";

// Graceful cleanup on exit
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

const { unmount, waitUntilExit } = render(<App />, {
  exitOnCtrlC: true,
  // Use alternate screen buffer so terminal is restored on exit
  patchConsole: false,
});

waitUntilExit().then(() => {
  process.exit(0);
});
