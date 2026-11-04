# Change request: implementation and demo

## What changed
- `src/validation.js`: shared COUNT validation accepts integers 1–500 inclusive; no change to VOID validation. REST and MQTT both use the existing shared event processor. Invalid submissions are recorded by the existing `recordAttempt` path and do not create production events.
- `src/state.js`: summary now counts `REJECTED` submission attempts from PostgreSQL using the existing optional source filter. It retains all six previous summary fields. The MQTT response already uses this shared summary service.
- `public/index.html`, `public/app.js`, `public/style.css`: source filter and Clear button, loading/error/empty messages, and a responsive, visually distinct seventh indicator. Existing pending and exceptions views use the same source filter.
- `tests/assessment.test.js`, `tests/change-validation.test.js`: boundary, persistence, filters and MQTT handler tests alongside existing tests.
- `AI_USAGE.md`: disclosed examiner-approved AI help with this change request. Include all relevant AI conversation records, according to the examiner's instructions.

## Safety and testing
The test suite writes uniquely named **synthetic records** to the database configured by `.env`; it does not clean them up. Use only the new assessment database, never an unrelated production database. It also records synthetic MQTT challenges in that database. The automated MQTT tests invoke the handler directly, not a real broker. Run `npm run check` and `npm test` in the project folder. Do not share `.env`, connection strings, passwords, or screenshots that expose them. No schema change is needed for this update.

## Publish the change
1. Verify `git status --short`. Do not add `.env`, certificates or other secrets. Stage only the changed files from the update.
2. Commit, then push the branch that Render is configured to deploy. Confirm the new commit appears on GitHub and Render reports the corresponding deployment as live. If automatic deploy is off, trigger a manual deploy from the correct branch. Check `/health` on the deployed URL.
3. The existing service has no login or access control. A public URL can allow other people to read or modify data; use synthetic assessment data only.

## Live demo after deployment
Use a unique source ID and event IDs each time, so old records cannot affect the result. For example, use the following source and IDs on the first run; for a repeat, change `DEMO-CHANGE-01` and both event IDs to fresh values. In the dashboard, enter the source in **Production source** and press Tab or Refresh data.

Submit this through **Event JSON** and click **Submit event**:

```json
{"source_id":"DEMO-CHANGE-01","event_id":"DEMO-CHANGE-01-ACCEPT","type":"COUNT","quantity":450,"target_event_id":null,"event_time":"2026-10-09T10:30:00Z"}
```

The response should say `ACCEPTED`; for this fresh source, Net total should be 450. Now submit:

```json
{"source_id":"DEMO-CHANGE-01","event_id":"DEMO-CHANGE-01-REJECT","type":"COUNT","quantity":501,"target_event_id":null,"event_time":"2026-10-09T10:30:00Z"}
```

The response should say `REJECTED` with the 1–500 reason. Net total should remain 450 and Rejected submissions should become 1. The Exceptions tab should show the rejected attempt. Re-submitting a rejected event creates another rejected attempt, so the rejected count increases again. You can also demonstrate 500 is accepted using a new event ID.

Change the source filter to a different source: summary and Pending/Exceptions should follow it. Click **Clear** to see all sources. The displayed total for all sources may include previous synthetic tests and is not expected to be zero.

For the real MQTT demonstration, ask the examiner to send an actual challenge to candidate 04, then verify the matching challenge ID and response in the simulator, including the response's `state.rejected_submissions`. A Connected label by itself does not prove challenge success. Avoid running multiple clients for the same candidate during the demo. Free Render services can sleep, stopping MQTT while asleep.
