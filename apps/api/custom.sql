CREATE UNIQUE INDEX IF NOT EXISTS check_ins_active_ticket_idx ON check_ins (ticket_id) WHERE voided_at IS NULL;
