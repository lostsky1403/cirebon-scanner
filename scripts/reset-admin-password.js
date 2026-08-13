#!/usr/bin/env node
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { config } from "./apps/api/src/config.js";
import { db, pool } from "./apps/api/src/db/client.js";
import { users } from "./apps/api/src/db/schema.js";

async function main() {
  const passwordHash = await argon2.hash(config.ADMIN_PASSWORD, { type: argon2.argon2id });
  const result = await db.update(users).set({ passwordHash, passwordChangedAt: new Date() }).where(eq(users.username, config.ADMIN_USERNAME.toLowerCase()));
  console.log("Admin password updated. Rows affected:", result.length);
  await pool.end();
}

main().catch(console.error);
