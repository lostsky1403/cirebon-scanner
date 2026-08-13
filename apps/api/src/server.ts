import { buildApp } from "./app.js";
import { config } from "./config.js";

const app = await buildApp();
const shutdown = async () => { await app.close(); process.exit(0); };
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
await app.listen({ port: config.PORT, host: "0.0.0.0" });
