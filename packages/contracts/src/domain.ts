import { z } from "zod";

export const roles = ["admin", "operator"] as const;
export const paymentStatuses = ["paid", "pending", "refunded", "cancelled", "unknown"] as const;
export const scanStatuses = ["CHECKED_IN", "ALREADY_CHECKED_IN", "INVALID_TICKET", "NOT_PAID", "REFUNDED", "CANCELLED", "INACTIVE_TICKET", "GATE_INACTIVE", "SERVICE_UNAVAILABLE"] as const;

export type Role = (typeof roles)[number];
export type PaymentStatus = (typeof paymentStatuses)[number];
export type ScanStatus = (typeof scanStatuses)[number];

export const loginSchema = z.object({ username: z.string().trim().min(1).max(80), password: z.string().min(8).max(200) });
export const checkInSchema = z.object({
  code: z.string().trim().min(1).max(128),
  requestId: z.string().uuid(),
  deviceId: z.string().uuid(),
  gateId: z.string().uuid()
});
export const voidCheckInSchema = z.object({ reason: z.string().trim().min(3).max(240) });
export const gateSchema = z.object({ name: z.string().trim().min(2).max(80), isActive: z.boolean().default(true) });
export const userCreateSchema = z.object({
  username: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/),
  displayName: z.string().trim().min(2).max(120),
  password: z.string().min(10).max(200),
  role: z.enum(roles).default("operator")
});
export const userUpdateSchema = z.object({ displayName: z.string().trim().min(2).max(120).optional(), isActive: z.boolean().optional(), password: z.string().min(10).max(200).optional() });

export type LoginInput = z.infer<typeof loginSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;

export interface SessionUser { id: string; username: string; displayName: string; role: Role }
export interface Gate { id: string; name: string; isActive: boolean }
export interface ScanResult {
  status: ScanStatus;
  checkInId?: string;
  participantName?: string;
  maskedWhatsapp?: string;
  maskedEmail?: string;
  code?: string;
  checkedInAt?: string;
  gateName?: string;
  operatorName?: string;
}
