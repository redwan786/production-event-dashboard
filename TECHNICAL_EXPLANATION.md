# Technical explanation

## What this system does
One Node.js application serves the browser, REST endpoints and MQTT client. PostgreSQL stores the durable facts. The dashboard calls the real backend; it does not calculate production totals itself.

## Entities and code
- `production_events` holds one logical event per globally unique ID: source, type, normalized data, event/receipt times, status, correction link and acknowledgement time.
- `submission_attempts` records each received item, including rejected, duplicate and conflict attempts. `acknowledgements` records successful reviews. `mqtt_challenges` stores the first request and response per challenge ID; `mqtt_challenge_attempts` stores replays and conflicts.
- `src/validation.js` checks and normalizes events. `src/events.js` owns COUNT, VOID, pending resolution and duplicate detection. `src/state.js` returns summaries, queues and acknowledgements. `src/server.js` keeps REST routes thin. `src/challenge.js` validates and processes an MQTT challenge; `src/mqtt.js` manages the connection and topics. `src/db.js` connects to PostgreSQL using TLS certificate verification.
- REST calls `processEvents`; MQTT calls `processEventsInTransaction`. Both invoke the same `processOneInTransaction` function, so rules are not duplicated.

## Transactions and correctness
Every REST item uses a transaction; one invalid item does not undo another. A transaction-scoped PostgreSQL advisory lock serializes event changes and acknowledgement writes. The primary key prevents duplicate logical event IDs. This coarse lock is simple but limits throughput. The summary comes from stored database records, in a single SQL statement. The oldest stored valid pending VOID for a COUNT wins; others are rejected with reasons. A count is not deleted when reversed. Repeated acknowledgement is safe. `REQUIREMENT_DECISIONS.md` records conflicting requirements and assumptions.

For MQTT, a challenge, its events, state and original response are committed atomically before publication. Replays compare the JSONB body with the original; exact replay returns the saved response, while a changed body returns CHALLENGE_CONFLICT. Challenge attempts are retained. If expiry is reached during processing, a savepoint rolls back event effects and stores a failure. A network interruption after commit can prevent publication; a replay returns the saved response. Publishing before expiry cannot be guaranteed under network delays.

Restart reloads durable data; connection status and last error are process-local and reset. MQTT reconnects and resubscribes. The simulator must actually verify delivery and the response; a PUBACK is not proof of application-level success.

## Limits and future design
No login, access control or rate limiting is implemented, so deployment publicly risks unauthorized changes. Use synthetic data only and restrict access where possible. Plain MQTT is specified for this assessment only, not for sensitive production. Batch writes commit per item, so a system error can interrupt later items; earlier commits remain. Malformed MQTT JSON has no usable correlation ID, is not saved and cannot receive a correlated response. Invalid date strings follow JavaScript Date parsing after a timezone-shaped check; stricter calendar validation could be added. Extremely large totals can exceed JavaScript's safe integer range. The queue does not paginate. Challenge timestamps use the server clock. Provisioning, live MQTT, restart, concurrent-load and deployment behavior need verification; see TEST_RESULTS.md.

Later, move the MQTT adapter, event service and queries behind stable interfaces to separate services. Replace direct calls with durable messaging, use an outbox for events published after a committed transaction, plan idempotent consumers and migrations, and replace the global lock with finer-grained concurrency controls. Do not split deployment for this assessment.
