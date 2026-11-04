# Production Event Processing Dashboard

A small, function-based modular monolith for the CSI Smart Tech FSE 01 assessment. One Node.js backend serves a responsive dashboard, three REST APIs and an MQTT client; one PostgreSQL database stores events, attempts, acknowledgements and challenge responses.

**Verification:** Nine automated tests passed using an isolated local PostgreSQL server. A local MQTT broker verified one challenge, replay and conflict; browser submission, duplicate and acknowledgement were checked locally. Real Supabase, the examiner MQTT challenge, Render, and the candidate's local setup are not yet verified. See TEST_RESULTS.md for actual test results and update it when you run tests. This demo has no user authentication or authorization: do not put it on a public internet service with sensitive data.

## Setup (Windows PowerShell)

1. Create a **new** Supabase project, not the traffic-project database. Follow SUPABASE_SETUP_GUIDE.md, which explains TLS and private credentials.
2. Open PowerShell in this project folder:

```powershell
npm install
Copy-Item .env.example .env
notepad .env
```

3. Privately enter the NEW project's session-pooler DATABASE_URL in .env. Check the project reference yourself before migration. Then run:

```powershell
npm run migrate
npm test
npm start
```

The migration is additive, but it creates tables. Do not run it if the target database is uncertain. Tests create uniquely named synthetic data and intentionally do not delete it; run only against the new assessment database. Keep .env out of Git and submissions. Open http://localhost:3000/ for the dashboard, and http://localhost:3000/health for a basic database query. `npm run check` checks syntax; it is not an integration test.

## REST examples

In another PowerShell window:

```powershell
$event = @{source_id='LINE-01';event_id='EV-101';type='COUNT';quantity=5;target_event_id=$null;event_time='2026-10-09T10:30:00Z'} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/events -ContentType 'application/json' -Body $event
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/events -ContentType 'application/json' -Body $event
Invoke-RestMethod -Uri 'http://localhost:3000/api/state?view=summary'
Invoke-RestMethod -Uri 'http://localhost:3000/api/state?view=pending&source_id=LINE-01'
Invoke-RestMethod -Uri 'http://localhost:3000/api/state?view=exceptions'
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/ack -ContentType 'application/json' -Body '{"event_ids":["EV-101","EV-101"]}'
```

The second identical COUNT is a duplicate and does not add to the total. Use fresh event IDs if you repeat the demo. For a VOID-before-COUNT example, submit this array through the dashboard (change both IDs for another run):

```json
[
  {"source_id":"LINE-01","event_id":"VOID-DEMO-1","type":"VOID","quantity":null,"target_event_id":"COUNT-DEMO-1","event_time":"2026-10-09T10:30:00Z"},
  {"source_id":"LINE-01","event_id":"COUNT-DEMO-1","type":"COUNT","quantity":7,"target_event_id":null,"event_time":"2026-10-09T10:31:00Z"}
]
```

The first result is PENDING_REFERENCE at submission time; after the second item arrives, the stored VOID resolves. Refresh the Pending/Exceptions views. The COUNT and completed VOID are both eligible for manual acknowledgement, based on the documented assumption in REQUIREMENT_DECISIONS.md.

## MQTT

Default broker: `mqtt://152.42.238.142:1883` (plain MQTT for this synthetic assessment only). Candidate ID defaults to `04`; confirm this exact value with the examiner. The client subscribes to `fse-01/04/challenge` and publishes to `fse-01/04/response` and `fse-01/04/status`. It uses QoS 1, retain false, an ONLINE status after subscribing, HEARTBEAT every 30 seconds, OFFLINE last will and reconnect backoff. `GET /api/mqtt` gives connection and persisted challenge summary for the dashboard.

Ask the examiner to send a real challenge and inspect the dashboard and simulator's matching response. TCP reachability or MQTT connection alone is not proof that the examiner received the response. Challenge effects and saved response are committed together; matching replay returns the saved response. A changed body with the same ID is a conflict. A repeated original is returned even if it is now expired, without processing again; this is an explicit replay assumption.

## Submission and deployment

See REQUIREMENT_DECISIONS.md, TECHNICAL_EXPLANATION.md, AI_USAGE.md, TEST_RESULTS.md and RENDER_DEPLOYMENT_GUIDE.md. Before submission, add real screenshots, the relevant AI conversation record (including any assessment-related prior chat), and update test results honestly. Verify the GitHub repository and clean final ZIP match and contain no secrets. See CHECKPOINT_AND_SUBMISSION_GUIDE.md.
