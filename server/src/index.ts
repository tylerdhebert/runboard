import { app } from "./app";
import { processManager } from "./processManager";

app.listen({ port: 3737, hostname: "127.0.0.1" }, () => {
  console.log("runboard server running on http://127.0.0.1:3737");
});

process.on("SIGINT", () => {
  processManager.stopAll();
  process.exit(0);
});
