import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { config } from "../config.js";
import { db, pool } from "./client.js";
import { events, gates, users } from "./schema.js";

const passwordHash = await argon2.hash(config.ADMIN_PASSWORD, { type: argon2.argon2id });
const [admin] = await db.insert(users).values({ username: config.ADMIN_USERNAME.toLowerCase(), displayName: config.ADMIN_DISPLAY_NAME, passwordHash, role: "admin" }).onConflictDoNothing().returning();
const [event] = await db.insert(events).values({ name: "ANNIVERSARY 2nd CIREBON PRIDE JAPAN", slug: "anniversary-2nd-cpj" }).onConflictDoUpdate({ target: events.slug, set: { isActive: true } }).returning();
if (event) await db.insert(gates).values({ eventId: event.id, name: "Gate Utama" }).onConflictDoNothing();
if (!admin) {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, config.ADMIN_USERNAME.toLowerCase())).limit(1);
  if (!existing) throw new Error("Bootstrap admin gagal");
}
await pool.end();
