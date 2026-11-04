-- Additive setup for a NEW assessment database. No DROP or DELETE commands.
CREATE TABLE IF NOT EXISTS production_events (
  event_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('COUNT', 'VOID')),
  quantity BIGINT,
  target_event_id TEXT,
  event_time TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('ACCEPTED', 'PENDING_REFERENCE', 'REJECTED')),
  reason TEXT,
  reversed_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  normalized JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pending_target ON production_events (target_event_id, received_at) WHERE status = 'PENDING_REFERENCE';
CREATE TABLE IF NOT EXISTS submission_attempts (
  id BIGSERIAL PRIMARY KEY,
  raw_payload JSONB NOT NULL,
  source_id TEXT,
  event_id TEXT,
  classification TEXT NOT NULL,
  reason TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS acknowledgements (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES production_events(event_id),
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id)
);
-- MQTT persistence is added when MQTT support is implemented in a later checkpoint.
