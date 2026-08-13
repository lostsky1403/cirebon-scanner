import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import { ZodError } from "zod";
import { config } from "./config.js";
import { pool } from "./db/client.js";
import { isAllowedMutationOrigin } from "./lib/security.js";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes } from "./routes/auth.js";
import { checkInRoutes } from "./routes/check-ins.js";
import { gateRoutes } from "./routes/gates.js";

export const buildApp = async () => {
  const app = Fastify({ logger: { redact: ["req.url", "req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie", "req.body.password", "req.body.code"] }, trustProxy: true, bodyLimit: config.MAX_CSV_BYTES });
  await app.register(sensible);
  await app.register(cookie, { secret: config.SESSION_SECRET });
  await app.register(cors, { origin: config.WEB_ORIGIN, credentials: true });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, { max: 240, timeWindow: "1 minute" });
  await app.register(multipart, { limits: { fileSize: config.MAX_CSV_BYTES, files: 1 } });
  app.addHook("onRequest", async (request, reply) => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method) || isAllowedMutationOrigin(request.headers.origin)) return;
    return reply.forbidden("Origin permintaan tidak diizinkan");
  });
  app.addHook("onSend", async (request, reply) => {
    if (request.url.startsWith("/api/")) reply.header("Cache-Control", "no-store");
  });
  app.get("/api/health/live", async () => ({ status: "ok" }));
  app.get("/api/health/ready", async (_request, reply) => {
    try { await pool.query("select 1"); return { status: "ready" }; } catch { return reply.serviceUnavailable("Database tidak siap"); }
  });
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(gateRoutes, { prefix: "/api/gates" });
  await app.register(checkInRoutes, { prefix: "/api/check-ins" });
  await app.register(adminRoutes, { prefix: "/api/admin" });
  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send({ message: "Data tidak valid", issues: error.issues });
    app.log.error(error);
    return reply.code(error.statusCode ?? 500).send({ message: error.statusCode ? error.message : "Terjadi gangguan layanan" });
  });
  app.addHook("onClose", async () => pool.end());
  return app;
};
