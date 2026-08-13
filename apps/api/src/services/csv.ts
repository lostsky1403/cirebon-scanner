import { parse } from "csv-parse/sync";
import { csvHeaders, type ParsedTicketRow, type PaymentStatus } from "@cpj/contracts";

const statusMap: Record<string, PaymentStatus> = {
  "Lunas (Paid)": "paid",
  "Menunggu (Received)": "pending",
  "ORDER REFUNDED": "refunded",
  "ORDER CANCELLED": "cancelled"
};

const parseDate = (value: string) => {
  const match = /^(\d{2}) ([A-Za-z]{3}) (\d{4}) (\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) throw new Error(`Tanggal tidak valid: ${value}`);
  const months: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const [, day = "", month = "", year = "", hour = "", minute = ""] = match;
  const monthIndex = months[month];
  if (monthIndex === undefined) throw new Error(`Bulan tidak valid: ${month}`);
  return new Date(Date.UTC(Number(year), monthIndex, Number(day), Number(hour) - 7, Number(minute)));
};

export const parseTicketCsv = (content: string): ParsedTicketRow[] => {
  const records = parse(content.replace(/^\uFEFF/, ""), { columns: true, skip_empty_lines: true, relax_column_count: false, bom: true }) as Record<string, string>[];
  if (records.length === 0) throw new Error("CSV kosong");
  const actualHeaders = Object.keys(records[0] ?? {});
  if (actualHeaders.join("|") !== csvHeaders.join("|")) throw new Error("Header CSV tidak sesuai format CPJ");
  return records.flatMap((record, index) => {
    const codes = (record["Kode Tiket"] ?? "").split(/\r?\n/).map((code) => code.trim().toUpperCase()).filter(Boolean);
    if (codes.length === 0) throw new Error(`Kode tiket kosong pada baris ${index + 2}`);
    return codes.map((ticketCode) => ({
      sourceRowNumber: index + 2,
      orderId: (record["Order ID"] ?? "").trim(),
      ticketCode,
      participantName: (record["Nama Pendaftar"] ?? "").trim(),
      event: (record.Event ?? "").trim(),
      whatsapp: (record.WhatsApp ?? "").trim(),
      email: (record.Email ?? "").trim(),
      amountRupiah: Number((record["Nominal (Rp)"] ?? "").replace(/[^0-9]/g, "")),
      paymentStatus: statusMap[(record.Status ?? "").trim()] ?? "unknown",
      registeredAt: parseDate(record["Tanggal Daftar"] ?? "")
    }));
  });
};
