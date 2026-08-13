export const csvHeaders = ["No", "Order ID", "Kode Tiket", "Nama Pendaftar", "Event", "WhatsApp", "Email", "Nominal (Rp)", "Status", "Tanggal Daftar"] as const;

export interface ParsedTicketRow {
  sourceRowNumber: number;
  orderId: string;
  ticketCode: string;
  participantName: string;
  event: string;
  whatsapp: string;
  email: string;
  amountRupiah: number;
  paymentStatus: "paid" | "pending" | "refunded" | "cancelled" | "unknown";
  registeredAt: Date;
}

export interface ImportPreview {
  id: string;
  totalRows: number;
  totalTickets: number;
  added: number;
  changed: number;
  unchanged: number;
  missing: number;
  warnings: string[];
  errors: string[];
}
