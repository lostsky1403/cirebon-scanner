import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { config } from "./apps/api/src/config.js";
import { db, pool } from "./apps/api/src/db/client.js";
import { users } from "./apps/api/src/db/schema.js";

const passwordHash = await argon2.hash(config.ADMIN_PASSWORD, { type: argon2.argon2id });
await db.update(users).set({ passwordHash, passwordChangedAt: new Date() }).where(eq(users.username, config.ADMIN_USERNAME.toLowerCase()));
console.log("Admin password reset successfully");
await pool.end();
