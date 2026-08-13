import type { FastifyPluginAsync } from "fastify";
import argon2 from "argon2";
import { createHash } from "node:crypto";
import { and, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { gateSchema, userCreateSchema, userUpdateSchema, type ImportPreview, type ParsedTicketRow } from "@cpj/contracts";
import { db } from "../db/client.js";
import { auditLogs, checkIns, events, gates, imports, sessions, tickets, users } from "../db/schema.js";
import { requireAdmin } from "../lib/auth.js";
import { safeCsvCell, ticketHmac } from "../lib/security.js";
import { parseTicketCsv } from "../services/csv.js";

const activeEvent = async () => {
  const [event] = await db.select().from(events).where(eq(events.isActive, true)).limit(1);
  if (!event) throw new Error("Event aktif tidak tersedia");
  return event;
};

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAdmin);
  app.get("/dashboard", async () => {
    const event = await activeEvent();
    const [[paid], [present], perGate, recent] = await Promise.all([
      db.select({ value: count() }).from(tickets).where(and(eq(tickets.eventId, event.id), eq(tickets.paymentStatus, "paid"), eq(tickets.isPresentInLatestImport, true))),
      db.select({ value: count() }).from(checkIns).innerJoin(tickets, eq(checkIns.ticketId, tickets.id)).where(and(eq(tickets.eventId, event.id), eq(tickets.paymentStatus, "paid"), eq(tickets.isPresentInLatestImport, true), isNull(checkIns.voidedAt))),
      db.select({ gateName: gates.name, total: count() }).from(checkIns).innerJoin(gates, eq(checkIns.gateId, gates.id)).where(and(eq(gates.eventId, event.id), isNull(checkIns.voidedAt))).groupBy(gates.name),
      db.select({ id: checkIns.id, name: tickets.participantName, gate: gates.name, operator: users.displayName, at: checkIns.checkedInAt }).from(checkIns).innerJoin(tickets, eq(checkIns.ticketId, tickets.id)).innerJoin(gates, eq(checkIns.gateId, gates.id)).innerJoin(users, eq(checkIns.operatorId, users.id)).where(eq(tickets.eventId, event.id)).orderBy(desc(checkIns.checkedInAt)).limit(12)
    ]);
    return { paid: paid?.value ?? 0, present: present?.value ?? 0, absent: (paid?.value ?? 0) - (present?.value ?? 0), perGate, recent };
  });
  app.get("/tickets", async (request) => {
    const query = request.query as { q?: string; page?: string };
    const page = Math.max(1, Number(query.page ?? 1));
    const event = await activeEvent();
    const search = query.q?.trim();
    const condition = search ? and(eq(tickets.eventId, event.id), or(ilike(tickets.ticketCode, `%${search}%`), ilike(tickets.orderId, `%${search}%`), ilike(tickets.participantName, `%${search}%`), ilike(tickets.whatsapp, `%${search}%`), ilike(tickets.email, `%${search}%`))) : eq(tickets.eventId, event.id);
    return db.select({ id: tickets.id, orderId: tickets.orderId, ticketCode: tickets.ticketCode, participantName: tickets.participantName, whatsapp: tickets.whatsapp, email: tickets.email, paymentStatus: tickets.paymentStatus, present: sql<boolean>`${checkIns.id} is not null`, checkedInAt: checkIns.checkedInAt }).from(tickets).leftJoin(checkIns, and(eq(checkIns.ticketId, tickets.id), isNull(checkIns.voidedAt))).where(condition).orderBy(tickets.participantName).limit(50).offset((page - 1) * 50);
  });
  app.get("/check-ins", async () => db.select({ id: checkIns.id, code: tickets.ticketCode, name: tickets.participantName, gate: gates.name, operator: users.displayName, checkedInAt: checkIns.checkedInAt, voidedAt: checkIns.voidedAt, voidReason: checkIns.voidReason }).from(checkIns).innerJoin(tickets, eq(checkIns.ticketId, tickets.id)).innerJoin(gates, eq(checkIns.gateId, gates.id)).innerJoin(users, eq(checkIns.operatorId, users.id)).orderBy(desc(checkIns.checkedInAt)).limit(500));
  app.get("/audit", async () => db.select({ id: auditLogs.id, action: auditLogs.action, actor: users.displayName, targetType: auditLogs.targetType, metadata: auditLogs.metadata, createdAt: auditLogs.createdAt }).from(auditLogs).leftJoin(users, eq(auditLogs.actorId, users.id)).orderBy(desc(auditLogs.createdAt)).limit(500));
  app.get("/users", async () => db.select({ id: users.id, username: users.username, displayName: users.displayName, role: users.role, isActive: users.isActive, createdAt: users.createdAt }).from(users).orderBy(users.displayName));
  app.post("/users", async (request, reply) => {
    const input = userCreateSchema.parse(request.body);
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const [created] = await db.insert(users).values({ username: input.username.toLowerCase(), displayName: input.displayName, passwordHash, role: input.role }).returning({ id: users.id });
    if (!created) return reply.internalServerError();
    await db.insert(auditLogs).values({ actorId: request.authUser.id, action: "user.created", targetType: "user", targetId: created.id });
    return reply.code(201).send(created);
  });
  app.patch("/users/:id", async (request) => {
    const { id } = request.params as { id: string };
    const input = userUpdateSchema.parse(request.body);
    const patch: Partial<typeof users.$inferInsert> = {};
    if (input.displayName !== undefined) patch.displayName = input.displayName;
    if (input.isActive !== undefined) patch.isActive = input.isActive;
    if (input.password !== undefined) { patch.passwordHash = await argon2.hash(input.password, { type: argon2.argon2id }); patch.passwordChangedAt = new Date(); }
    await db.transaction(async (tx) => {
      await tx.update(users).set(patch).where(eq(users.id, id));
      if (input.password !== undefined || input.isActive === false) await tx.delete(sessions).where(eq(sessions.userId, id));
      await tx.insert(auditLogs).values({ actorId: request.authUser.id, action: "user.updated", targetType: "user", targetId: id });
    });
    return { ok: true };
  });
  app.get("/gates", async () => db.select().from(gates).orderBy(gates.name));
  app.post("/gates", async (request, reply) => {
    const input = gateSchema.parse(request.body);
    const event = await activeEvent();
    const [created] = await db.insert(gates).values({ eventId: event.id, name: input.name, isActive: input.isActive }).returning();
    return reply.code(201).send(created);
  });
  app.patch("/gates/:id", async (request) => {
    const { id } = request.params as { id: string };
    const input = gateSchema.partial().parse(request.body);
    await db.update(gates).set(input).where(eq(gates.id, id));
    return { ok: true };
  });
  app.post("/imports/preview", async (request, reply) => {
    const file = await request.file({ limits: { fileSize: 5_242_880, files: 1 } });
    if (!file) return reply.badRequest("File CSV diperlukan");
    const content = (await file.toBuffer()).toString("utf8");
    const parsed = parseTicketCsv(content);
    const duplicateCodes = parsed.filter((row, index) => parsed.findIndex((other) => other.ticketCode === row.ticketCode) !== index).map((row) => row.ticketCode);
    if (duplicateCodes.length) return reply.badRequest(`Kode duplikat: ${[...new Set(duplicateCodes)].join(", ")}`);
    const event = await activeEvent();
    const existing = await db.select().from(tickets).where(eq(tickets.eventId, event.id));
    const existingMap = new Map(existing.map((ticket) => [ticket.ticketCodeHmac, ticket]));
    let added = 0; let changed = 0; let unchanged = 0;
    for (const row of parsed) {
      const current = existingMap.get(ticketHmac(row.ticketCode));
      if (!current) added++;
      else if (current.participantName !== row.participantName || current.paymentStatus !== row.paymentStatus || current.amountRupiah !== row.amountRupiah || current.email !== row.email || current.whatsapp !== row.whatsapp) changed++;
      else unchanged++;
    }
    const incoming = new Set(parsed.map((row) => ticketHmac(row.ticketCode)));
    const missing = existing.filter((ticket) => !incoming.has(ticket.ticketCodeHmac)).length;
    const warnings = parsed.filter((row) => row.paymentStatus === "unknown").map((row) => `Status tidak dikenal pada baris ${row.sourceRowNumber}`);
    const summary = { totalRows: new Set(parsed.map((row) => row.sourceRowNumber)).size, totalTickets: parsed.length, added, changed, unchanged, missing, warnings, errors: [] };
    const [created] = await db.insert(imports).values({ eventId: event.id, uploaderId: request.authUser.id, fileHash: createHash("sha256").update(content).digest("hex"), summary, payload: parsed.map((row) => ({ ...row, registeredAt: row.registeredAt.toISOString() })) }).returning({ id: imports.id });
    if (!created) return reply.internalServerError();
    return { id: created.id, ...summary } satisfies ImportPreview;
  });
  app.post("/imports/:id/apply", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [job] = await db.select().from(imports).where(eq(imports.id, id)).limit(1);
    if (!job || job.status !== "preview") return reply.badRequest("Preview import tidak tersedia");
    const rows = (job.payload as Array<Omit<ParsedTicketRow, "registeredAt"> & { registeredAt: string }>).map((row) => ({ ...row, registeredAt: new Date(row.registeredAt) }));
    const hashes = rows.map((row) => ticketHmac(row.ticketCode));
    const applied = await db.transaction(async (tx) => {
      const [claimed] = await tx.update(imports).set({ status: "applied", appliedAt: new Date() }).where(and(eq(imports.id, id), eq(imports.status, "preview"))).returning({ id: imports.id });
      if (!claimed) return false;
      await tx.update(tickets).set({ isPresentInLatestImport: false }).where(eq(tickets.eventId, job.eventId));
      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        await tx.insert(tickets).values(batch.map(row => ({ eventId: job.eventId, orderId: row.orderId, ticketCode: row.ticketCode, ticketCodeHmac: ticketHmac(row.ticketCode), participantName: row.participantName, whatsapp: row.whatsapp, email: row.email, amountRupiah: row.amountRupiah, paymentStatus: row.paymentStatus, registeredAt: row.registeredAt, sourceRowNumber: row.sourceRowNumber, sourceImportId: id, isPresentInLatestImport: true }))).onConflictDoUpdate({ target: [tickets.eventId, tickets.ticketCodeHmac], set: { orderId: sql`excluded.order_id`, ticketCode: sql`excluded.ticket_code`, participantName: sql`excluded.participant_name`, whatsapp: sql`excluded.whatsapp`, email: sql`excluded.email`, amountRupiah: sql`excluded.amount_rupiah`, paymentStatus: sql`excluded.payment_status`, registeredAt: sql`excluded.registered_at`, sourceRowNumber: sql`excluded.source_row_number`, sourceImportId: id, isPresentInLatestImport: true, updatedAt: new Date() } });
      }
      await tx.insert(auditLogs).values({ actorId: request.authUser.id, action: "import.applied", targetType: "import", targetId: id, metadata: { tickets: hashes.length } });
      return true;
    });
    if (!applied) return reply.conflict("Preview import sudah diproses");
    return { ok: true, tickets: rows.length };
  });
  app.get("/exports/check-ins.csv", async (_request, reply) => {
    const event = await activeEvent();
    const rows = await db.select({ orderId: tickets.orderId, code: tickets.ticketCode, name: tickets.participantName, whatsapp: tickets.whatsapp, email: tickets.email, payment: tickets.paymentStatus, checkedInAt: checkIns.checkedInAt, gate: gates.name, operator: users.displayName, voidedAt: checkIns.voidedAt, voidReason: checkIns.voidReason }).from(tickets).leftJoin(checkIns, eq(checkIns.ticketId, tickets.id)).leftJoin(gates, eq(checkIns.gateId, gates.id)).leftJoin(users, eq(checkIns.operatorId, users.id)).where(eq(tickets.eventId, event.id)).orderBy(tickets.participantName);
    const header = ["Order ID", "Kode Tiket", "Nama", "WhatsApp", "Email", "Pembayaran", "Check-in", "Gate", "Petugas", "Dibatalkan", "Alasan"];
    const csv = [header, ...rows.map((row) => Object.values(row))].map((row) => row.map(safeCsvCell).join(",")).join("\r\n");
    return reply.header("Content-Type", "text/csv; charset=utf-8").header("Content-Disposition", "attachment; filename=cpj-check-ins.csv").send(`\uFEFF${csv}`);
  });
};
