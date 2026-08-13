import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.DATABASE_URL = "postgresql://cpj:cpj@localhost:5432/cpj";
  process.env.SESSION_SECRET = "test-session-secret-that-is-long-enough";
  process.env.TICKET_HMAC_KEY = "test-hmac-key-that-is-long-enough-123";
  process.env.ADMIN_USERNAME = "admin";
  process.env.ADMIN_PASSWORD = "password-test-123";
});

describe("resolusi konflik check-in", () => {
  it("memetakan konflik tiket aktif menjadi ALREADY_CHECKED_IN", async () => {
    const { resolveCheckInConflict } = await import("../src/routes/check-ins.js");
    const checkedInAt = new Date("2026-08-14T10:00:00.000Z");
    const result = resolveCheckInConflict(undefined, { id: "check-in-1", checkedInAt, gateName: "Gate A", operatorName: "Operator A" }, "Budi", "CPJ-1");
    expect(result).toEqual({ status: "ALREADY_CHECKED_IN", checkInId: "check-in-1", participantName: "Budi", code: "CPJ-1", checkedInAt: checkedInAt.toISOString(), gateName: "Gate A", operatorName: "Operator A" });
  });

  it("mempertahankan idempotency request yang sama sebagai CHECKED_IN", async () => {
    const { resolveCheckInConflict } = await import("../src/routes/check-ins.js");
    const checkedInAt = new Date("2026-08-14T10:00:00.000Z");
    const result = resolveCheckInConflict({ id: "check-in-1", participantName: "Budi", code: "CPJ-1", checkedInAt, gateName: "Gate A" }, { id: "check-in-2", checkedInAt, gateName: "Gate B", operatorName: "Operator B" }, "Budi", "CPJ-1");
    expect(result?.status).toBe("CHECKED_IN");
    expect(result?.checkInId).toBe("check-in-1");
  });
});
