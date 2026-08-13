import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { events, gates } from "../db/schema.js";
import { requireAuth } from "../lib/auth.js";

export const gateRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", { preHandler: requireAuth }, async () => db.select({ id: gates.id, name: gates.name, isActive: gates.isActive }).from(gates).innerJoin(events, eq(gates.eventId, events.id)).where(eq(events.isActive, true)));
};
