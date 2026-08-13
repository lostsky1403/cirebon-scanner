import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.DATABASE_URL = "postgresql://cpj:cpj@localhost:5432/cpj";
  process.env.SESSION_SECRET = "test-session-secret-that-is-long-enough";
  process.env.TICKET_HMAC_KEY = "test-hmac-key-that-is-long-enough-123";
  process.env.ADMIN_USERNAME = "admin";
  process.env.ADMIN_PASSWORD = "password-test-123";
});

describe("security helpers", () => {
  it("menormalisasi kode dan memasking PII", async () => {
    const { normalizeCode, maskEmail, maskWhatsapp, safeCsvCell } = await import("../src/lib/security.js");
    expect(normalizeCode(" abc-1 ")).toBe("ABC-1");
    expect(maskWhatsapp("081234567890")).toBe("••••••••7890");
    expect(maskEmail("budi@example.com")).toBe("bu••@example.com");
    expect(safeCsvCell("=SUM(1,2)")).toBe('"\'=SUM(1,2)"');
  });

  it("hanya menerima Origin mutation yang dikonfigurasi", async () => {
    const { isAllowedMutationOrigin } = await import("../src/lib/security.js");
    expect(isAllowedMutationOrigin("http://localhost:5173")).toBe(true);
    expect(isAllowedMutationOrigin("http://localhost:5173/path")).toBe(true);
    expect(isAllowedMutationOrigin("https://evil.example")).toBe(false);
    expect(isAllowedMutationOrigin(undefined)).toBe(false);
    expect(isAllowedMutationOrigin("bukan-url")).toBe(false);
  });
});
