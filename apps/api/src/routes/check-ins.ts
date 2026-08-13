import type { FastifyPluginAsync } from "fastify";
import { and, desc, eq, isNull } from "drizzle-orm";
import { checkInSchema, voidCheckInSchema, type ScanResult } from "@cpj/contracts";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { auditLogs, checkIns, events, gates, tickets, users } from "../db/schema.js";
import { requireAuth } from "../lib/auth.js";
import { maskEmail, maskWhatsapp, normalizeCode, ticketHmac } from "../lib/security.js";

type ExistingCheckIn = { id: string; participantName: string; code: string; checkedInAt: Date; gateName: string };
type ActiveCheckIn = { id: string; checkedInAt: Date; gateName: string; operatorName: string };

export const resolveCheckInConflict = (retry: ExistingCheckIn | undefined, active: ActiveCheckIn | undefined, participantName: string, code: string): ScanResult | undefined => {
  if (retry) return { status: "CHECKED_IN", checkInId: retry.id, participantName: retry.participantName, code: retry.code, checkedInAt: retry.checkedInAt.toISOString(), gateName: retry.gateName };
  if (active) return { status: "ALREADY_CHECKED_IN", checkInId: active.id, participantName, code, checkedInAt: active.checkedInAt.toISOString(), gateName: active.gateName, operatorName: active.operatorName };
  return undefined;
};

const alreadyCheckedIn = async (tx: Parameters<Parameters<typeof db.transaction>[0]>[0], ticketId: string, participantName: string, code: string): Promise<ScanResult | undefined> => {
  const [active] = await tx.select({ id: checkIns.id, checkedInAt: checkIns.checkedInAt, gateName: gates.name, operatorName: users.displayName })
    .from(checkIns).innerJoin(gates, eq(checkIns.gateId, gates.id)).innerJoin(users, eq(checkIns.operatorId, users.id)).where(and(eq(checkIns.ticketId, ticketId), isNull(checkIns.voidedAt))).limit(1);
  if (!active) return undefined;
  return resolveCheckInConflict(undefined, active, participantName, code);
};

export const checkInRoutes: FastifyPluginAsync = async (app) => {
  app.post("/", { preHandler: requireAuth }, async (request): Promise<ScanResult> => {
    const input = checkInSchema.parse(request.body);
    const result = await db.transaction(async (tx) => {
      const findRetry = async () => {
        const [retry] = await tx.select({ id: checkIns.id, checkedInAt: checkIns.checkedInAt, participantName: tickets.participantName, code: tickets.ticketCode, gateName: gates.name })
          .from(checkIns).innerJoin(tickets, eq(checkIns.ticketId, tickets.id)).innerJoin(gates, eq(checkIns.gateId, gates.id)).where(and(eq(checkIns.requestId, input.requestId), eq(checkIns.operatorId, request.authUser.id), eq(checkIns.deviceId, input.deviceId))).limit(1);
        return retry;
      };
      const retry = await findRetry();
      if (retry) return { status: "CHECKED_IN" as const, checkInId: retry.id, participantName: retry.participantName, code: retry.code, checkedInAt: retry.checkedInAt.toISOString(), gateName: retry.gateName };
      const [gate] = await tx.select({ id: gates.id, eventId: gates.eventId, name: gates.name }).from(gates).innerJoin(events, eq(gates.eventId, events.id)).where(and(eq(gates.id, input.gateId), eq(gates.isActive, true), eq(events.isActive, true))).limit(1);
      if (!gate) return { status: "GATE_INACTIVE" as const };
      const [ticket] = await tx.select().from(tickets).where(and(eq(tickets.ticketCodeHmac, ticketHmac(input.code)), eq(tickets.eventId, gate.eventId))).limit(1);
      if (!ticket) return { status: "INVALID_TICKET" as const };
      if (!ticket.isPresentInLatestImport) return { status: "INACTIVE_TICKET" as const };
      const status = ticket.paymentStatus;
      if (status !== "paid") return { status: status === "refunded" ? "REFUNDED" as const : status === "cancelled" ? "CANCELLED" as const : "NOT_PAID" as const };
      const active = await alreadyCheckedIn(tx, ticket.id, ticket.participantName, ticket.ticketCode);
      if (active) return active;
      const [created] = await tx.insert(checkIns).values({ ticketId: ticket.id, requestId: input.requestId, operatorId: request.authUser.id, gateId: input.gateId, deviceId: input.deviceId }).onConflictDoNothing().returning();
      if (!created) {
        const concurrentRetry = await findRetry();
        const conflict = resolveCheckInConflict(concurrentRetry, undefined, ticket.participantName, ticket.ticketCode);
        if (conflict) return conflict;
        const concurrentActive = await alreadyCheckedIn(tx, ticket.id, ticket.participantName, ticket.ticketCode);
        if (concurrentActive) return concurrentActive;
        throw new Error("Konflik check-in tidak dapat ditemukan");
      }
      await tx.insert(auditLogs).values({ actorId: request.authUser.id, action: "check_in.created", targetType: "check_in", targetId: created.id, metadata: { gateId: input.gateId } });
      return { status: "CHECKED_IN" as const, checkInId: created.id, participantName: ticket.participantName, maskedWhatsapp: maskWhatsapp(ticket.whatsapp), maskedEmail: maskEmail(ticket.email), code: normalizeCode(input.code), checkedInAt: created.checkedInAt.toISOString(), gateName: gate.name };
    });
    return result;
  });
  app.post("/:id/void", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason } = voidCheckInSchema.parse(request.body);
    const [row] = await db.select().from(checkIns).where(and(eq(checkIns.id, id), isNull(checkIns.voidedAt))).limit(1);
    if (!row) return reply.notFound("Check-in aktif tidak ditemukan");
    const withinWindow = Date.now() - row.checkedInAt.getTime() <= config.UNDO_WINDOW_MINUTES * 60_000;
    if (request.authUser.role !== "admin" && (row.operatorId !== request.authUser.id || !withinWindow)) return reply.forbidden("Check-in tidak dapat dibatalkan");
    const result = await db.transaction(async (tx) => {
      const [updated] = await tx.update(checkIns).set({ voidedAt: new Date(), voidedBy: request.authUser.id, voidReason: reason }).where(and(eq(checkIns.id, id), isNull(checkIns.voidedAt))).returning({ id: checkIns.id });
      if (!updated) return false;
      await tx.insert(auditLogs).values({ actorId: request.authUser.id, action: "check_in.voided", targetType: "check_in", targetId: id, metadata: { reason } });
      return true;
    });
    if (!result) return reply.conflict("Check-in sudah dibatalkan");
    return { ok: true };
  });
  app.get("/recent", { preHandler: requireAuth }, async (request) => db.select({ id: checkIns.id, participantName: tickets.participantName, gateName: gates.name, checkedInAt: checkIns.checkedInAt, voidedAt: checkIns.voidedAt }).from(checkIns).innerJoin(tickets, eq(checkIns.ticketId, tickets.id)).innerJoin(gates, eq(checkIns.gateId, gates.id)).where(eq(checkIns.operatorId, request.authUser.id)).orderBy(desc(checkIns.checkedInAt)).limit(20));
};
