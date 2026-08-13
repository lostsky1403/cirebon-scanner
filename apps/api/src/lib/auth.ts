import type { FastifyReply, FastifyRequest } from "fastify";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../db/client.js";
import { sessions, users } from "../db/schema.js";
import { hashToken } from "./security.js";

export interface AuthUser { id: string; username: string; displayName: string; role: "admin" | "operator" }

declare module "fastify" { interface FastifyRequest { authUser: AuthUser } }

export const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  const token = request.cookies.cpj_session;
  if (!token) return reply.unauthorized("Sesi diperlukan");
  const [row] = await db.select({ id: users.id, username: users.username, displayName: users.displayName, role: users.role, active: users.isActive })
    .from(sessions).innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date()))).limit(1);
  if (!row?.active) return reply.unauthorized("Sesi tidak valid");
  request.authUser = { id: row.id, username: row.username, displayName: row.displayName, role: row.role };
};

export const requireAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
  await requireAuth(request, reply);
  if (!reply.sent && request.authUser.role !== "admin") return reply.forbidden("Akses admin diperlukan");
};
