# Requirement decisions — provisional

Ask the examiner if available; these are assumptions, not confirmed answers.

1. Globally unique event_id (brief page 3 and page 4 acknowledgement by ID) rather than a composite key (page 5). An ID reused on another source conflicts.
2. Process batch items in order and retain valid items even when others are rejected (pages 3–4), rather than reject the whole batch (page 5). Each item has its own transaction; an unexpected database failure may stop later items.
3. Completed COUNT and VOID events are manually acknowledged and appear in pending (page 4), rather than automatically acknowledging VOID (page 6). This changes the pending count and supervisor workflow compared with page 6.
4. A single PostgreSQL advisory transaction lock serializes event and acknowledgement writes. This is deliberately simple and limits throughput.
5. An event that passes field validation but fails a business rule is stored as a REJECTED logical event and its attempt is also recorded. Field-invalid items are retained as attempts only.
