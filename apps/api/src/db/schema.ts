import { relations } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "operator"]);
export const paymentStatusEnum = pgEnum("payment_status", ["paid", "pending", "refunded", "cancelled", "unknown"]);
export const importStatusEnum = pgEnum("import_status", ["preview", "applied", "failed"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("operator"),
  isActive: boolean("is_active").notNull().default(true),
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }).notNull().defaultNow(),
  ...timestamps
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("sessions_user_idx").on(table.userId)]);

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps
});

export const gates = pgTable("gates", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps
}, (table) => [uniqueIndex("gates_event_name_idx").on(table.eventId, table.name)]);

export const imports = pgTable("imports", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id),
  uploaderId: uuid("uploader_id").notNull().references(() => users.id),
  fileHash: text("file_hash").notNull(),
  status: importStatusEnum("status").notNull().default("preview"),
  summary: jsonb("summary").notNull(),
  payload: jsonb("payload").notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const tickets = pgTable("tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id),
  orderId: text("order_id").notNull(),
  ticketCode: text("ticket_code").notNull(),
  ticketCodeHmac: text("ticket_code_hmac").notNull(),
  participantName: text("participant_name").notNull(),
  whatsapp: text("whatsapp").notNull(),
  email: text("email").notNull(),
  amountRupiah: integer("amount_rupiah").notNull(),
  paymentStatus: paymentStatusEnum("payment_status").notNull(),
  registeredAt: timestamp("registered_at", { withTimezone: true }).notNull(),
  sourceRowNumber: integer("source_row_number").notNull(),
  sourceImportId: uuid("source_import_id").references(() => imports.id),
  isPresentInLatestImport: boolean("is_present_in_latest_import").notNull().default(true),
  ...timestamps
}, (table) => [uniqueIndex("tickets_event_hmac_idx").on(table.eventId, table.ticketCodeHmac), index("tickets_search_idx").on(table.orderId, table.participantName)]);

export const checkIns = pgTable("check_ins", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").notNull().references(() => tickets.id),
  requestId: uuid("request_id").notNull().unique(),
  operatorId: uuid("operator_id").notNull().references(() => users.id),
  gateId: uuid("gate_id").notNull().references(() => gates.id),
  deviceId: uuid("device_id").notNull(),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }).notNull().defaultNow(),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  voidedBy: uuid("voided_by").references(() => users.id),
  voidReason: text("void_reason")
}, (table) => [index("check_ins_ticket_idx").on(table.ticketId), index("check_ins_time_idx").on(table.checkedInAt)]);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").references(() => users.id),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("audit_time_idx").on(table.createdAt)]);

export const usersRelations = relations(users, ({ many }) => ({ sessions: many(sessions), checkIns: many(checkIns) }));
export const ticketsRelations = relations(tickets, ({ many }) => ({ checkIns: many(checkIns) }));
