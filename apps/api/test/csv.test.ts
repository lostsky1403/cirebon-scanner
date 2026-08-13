import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseTicketCsv } from "../src/services/csv.js";

describe("parseTicketCsv", () => {
  it("memproses seluruh CSV CPJ dan memetakan status", () => {
    const content = readFileSync(resolve("../../Data_Pendaftar_CPJ.csv"), "utf8");
    const rows = parseTicketCsv(content);
    expect(new Set(rows.map((row) => row.sourceRowNumber)).size).toBe(793);
    expect(rows.length).toBe(794);
    expect(rows.filter((row) => row.paymentStatus === "paid")).toHaveLength(779);
    expect(rows.filter((row) => row.paymentStatus === "pending")).toHaveLength(7);
    expect(rows.filter((row) => row.paymentStatus === "refunded")).toHaveLength(7);
    expect(rows.filter((row) => row.paymentStatus === "cancelled")).toHaveLength(1);
  });
  it("memecah kode multiline dan mendukung BOM", () => {
    const csv = '\uFEFF"No","Order ID","Kode Tiket","Nama Pendaftar","Event","WhatsApp","Email","Nominal (Rp)","Status","Tanggal Daftar"\n"1","#ABC","ABC-1\nABC-2","Budi","EVENT","0812","budi@example.com","Rp 750.000","Lunas (Paid)","09 Mar 2026 07:11"';
    const rows = parseTicketCsv(csv);
    expect(rows.map((row) => row.ticketCode)).toEqual(["ABC-1", "ABC-2"]);
    expect(rows[0]?.amountRupiah).toBe(750000);
  });
  it("menolak header tidak valid", () => expect(() => parseTicketCsv("foo,bar\na,b")).toThrow("Header CSV"));
});
