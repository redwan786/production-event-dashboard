# Technical explanation — checkpoint 2

This is an incomplete development checkpoint, not the final submission.

## Entities and boundaries
- production_events stores one logical event per globally unique ID, including normalized values, event and receipt times, status, a reversal link, and acknowledgement time.
- submission_attempts stores every item and its classification, including invalid, duplicate and conflicting attempts.
- acknowledgements records each successful acknowledgement once.
- validation.js validates and normalizes; events.js owns COUNT, VOID and retries; state.js owns queries and acknowledgement; server.js exposes thin REST routes; db.js provides the PostgreSQL pool.

## Transactions and retries
Each submitted item uses a transaction and an advisory transaction lock. Under this simplified single-server design, the lock serializes competing event and acknowledgement changes; primary keys enforce global IDs. The first matching pending VOID with the same source wins. No deletion is used for corrections. Durable tables survive restart. Repeated ACK is safe. Batch items are processed in submitted order. A system-level database failure can interrupt a batch after earlier items have committed.

## Known limitations
This checkpoint has not yet implemented MQTT or automated tests. The frontend is implemented but not verified against a real database. Database integration has not been verified by the author in Supabase. HTTPS/authentication for a public deployment is not implemented. The summary currently uses two queries, so under simultaneous writes its fields might briefly represent different instants; improve before final submission. Very large accumulated totals may exceed JavaScript's safe integer range. Review REQUIREMENT_DECISIONS.md and examiner feedback. Future modules could be split into separate services with explicit APIs and durable messages/outbox once consistency and operational costs justify it.
