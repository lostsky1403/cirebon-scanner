import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  TICKET_HMAC_KEY: z.string().min(32),
  ADMIN_USERNAME: z.string().min(3),
  ADMIN_PASSWORD: z.string().min(10),
  ADMIN_DISPLAY_NAME: z.string().default("Administrator"),
  COOKIE_SECURE: z.string().transform((value) => value === "true").default(false),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(12),
  UNDO_WINDOW_MINUTES: z.coerce.number().positive().default(5),
  MAX_CSV_BYTES: z.coerce.number().positive().default(5_242_880)
});

export const config = schema.parse(process.env);
