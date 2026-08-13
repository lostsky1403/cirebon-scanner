import { describe, expect, it } from "vitest";
import { checkInSchema, loginSchema } from "../src/index.js";

describe("kontrak API", () => {
  it("menerima check-in valid", () => expect(checkInSchema.safeParse({ code: "ABC-1", requestId: crypto.randomUUID(), deviceId: crypto.randomUUID(), gateId: crypto.randomUUID() }).success).toBe(true));
  it("menolak ID non UUID", () => expect(checkInSchema.safeParse({ code: "ABC", requestId: "x", deviceId: "y", gateId: "z" }).success).toBe(false));
  it("memvalidasi login", () => expect(loginSchema.safeParse({ username: "admin", password: "password123" }).success).toBe(true));
});
