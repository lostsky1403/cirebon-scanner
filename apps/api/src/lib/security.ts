import { createHash, createHmac, randomBytes } from "node:crypto";
import { config } from "../config.js";

export const normalizeCode = (code: string) => code.trim().toUpperCase();
export const ticketHmac = (code: string) => createHmac("sha256", config.TICKET_HMAC_KEY).update(normalizeCode(code)).digest("hex");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const createToken = () => randomBytes(32).toString("base64url");
export const isAllowedMutationOrigin = (origin: string | undefined) => {
  if (!origin) return true; // same-origin requests don't send Origin header
  try { return new URL(origin).origin === new URL(config.WEB_ORIGIN).origin; } catch { return false; }
};
export const maskWhatsapp = (value: string) => value.length < 5 ? "••••" : `${"•".repeat(Math.min(8, value.length - 4))}${value.slice(-4)}`;
export const maskEmail = (value: string) => {
  const [local = "", domain = ""] = value.split("@");
  return `${local.slice(0, 2)}${"•".repeat(Math.max(2, local.length - 2))}@${domain}`;
};
export const safeCsvCell = (value: unknown) => {
  const text = String(value ?? "");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};
