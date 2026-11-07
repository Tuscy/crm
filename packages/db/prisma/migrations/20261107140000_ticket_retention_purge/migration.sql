-- Retention (spec FR-014): raw agent output older than 12 months is purged. TicketEvent stays
-- append-only for everything else, so the one permitted UPDATE is narrow: it must run inside
-- a transaction that set `stky.retention_purge = 'on'` (SET LOCAL), and it may only set
-- "payload" to NULL, leaving every other column untouched. Rows are never removed by it.
CREATE OR REPLACE FUNCTION ticket_event_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF current_setting('stky.retention_purge', true) = 'on'
       AND NEW."payload" IS NULL
       AND (to_jsonb(NEW) - 'payload') = (to_jsonb(OLD) - 'payload') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'TicketEvent is append-only: updates are not allowed';
  END IF;
  IF TG_OP = 'DELETE' AND pg_trigger_depth() <= 1 THEN
    RAISE EXCEPTION 'TicketEvent is append-only: direct deletes are not allowed';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
