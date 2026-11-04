-- Add challenge persistence without modifying or deleting existing events.
CREATE TABLE IF NOT EXISTS mqtt_challenges (
  challenge_id TEXT PRIMARY KEY,
  request_body JSONB NOT NULL,
  response_body JSONB NOT NULL,
  status TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Gives pending VOID records a stable storage order under concurrent arrivals.
ALTER TABLE production_events ADD COLUMN IF NOT EXISTS storage_order BIGSERIAL;
CREATE INDEX IF NOT EXISTS idx_event_storage_order ON production_events (storage_order);
CREATE TABLE IF NOT EXISTS mqtt_challenge_attempts (
  id BIGSERIAL PRIMARY KEY,
  challenge_id TEXT,
  request_body JSONB NOT NULL,
  response_body JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
