import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "../config.js";
import * as schema from "./schema.js";

export const pool = new Pool({ connectionString: config.DATABASE_URL, max: 20 });
export const db = drizzle(pool, { schema });
