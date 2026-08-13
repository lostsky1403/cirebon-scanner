import type { FastifyPluginAsync } from "fastify";
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { loginSchema } from "@cpj/contracts";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { requireAuth } from "../lib/auth.js";
import { auditLogs, sessions, users } from "../db/schema.js";
import { createToken, hashToken } from "../lib/security.js";

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/login", { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } }, async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const [user] = await db.select().from(users).where(eq(users.username, input.username.toLowerCase())).limit(1);
    if (!user?.isActive || !await argon2.verify(user.passwordHash, input.password)) return reply.unauthorized("Username atau password salah");
    const token = createToken();
    const expiresAt = new Date(Date.now() + config.SESSION_TTL_HOURS * 3_600_000);
    await db.transaction(async (tx) => {
      await tx.insert(sessions).values({ userId: user.id, tokenHash: hashToken(token), expiresAt, userAgent: request.headers["user-agent"]?.slice(0, 240) });
      await tx.insert(auditLogs).values({ actorId: user.id, action: "auth.login", targetType: "user", targetId: user.id });
    });
    reply.setCookie("cpj_session", token, { path: "/", httpOnly: true, secure: config.COOKIE_SECURE, sameSite: "lax", expires: expiresAt });
    return { user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role } };
  });
  app.post("/logout", async (request, reply) => {
    const token = request.cookies.cpj_session;
    if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
    reply.clearCookie("cpj_session", { path: "/" });
    return { ok: true };
  });
  app.post("/reset-admin", async (request, reply) => {
    const { secret } = request.body as { secret: string };
    if (secret !== config.SESSION_SECRET) return reply.forbidden("Invalid secret");
    const passwordHash = await argon2.hash(config.ADMIN_PASSWORD, { type: argon2.argon2id });
    await db.update(users).set({ passwordHash, passwordChangedAt: new Date() }).where(eq(users.username, config.ADMIN_USERNAME.toLowerCase()));
    return { ok: true };
  });
  app.get("/me", { preHandler: requireAuth }, async (request) => ({ user: request.authUser }));
};
