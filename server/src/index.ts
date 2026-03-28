import { app } from "./app";
import { processManager } from "./processManager";

app.listen(3737, () => {
  console.log("runboard server running on http://localhost:3737");
});

process.on("SIGINT", () => {
  processManager.stopAll();
  process.exit(0);
});
