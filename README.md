# Production Event Processing Dashboard — checkpoint 2

This is a genuine intermediate checkpoint. It contains the initial PostgreSQL schema, event processing and three REST endpoints. The dashboard is implemented; the MQTT worker and automated tests are not implemented yet. Do not treat this as the final assessment submission.

## Prerequisites
Windows, Node.js 20 or later, Git, internet, and a NEW Supabase PostgreSQL project. Follow SUPABASE_SETUP_GUIDE.md. Never use an existing traffic-project database. Never commit or share .env or credentials.

## Setup and run in PowerShell
In the project folder:

```powershell
npm install
Copy-Item .env.example .env
# Privately edit .env with the new database settings. Never paste the contents into chat.
notepad .env
npm run migrate
npm start
```

Open http://localhost:3000/health. A response of `{"ok":true,"database":"connected"}` verifies the backend can query the configured database, but independently check you selected the NEW project before migrating. Run `npm run check` for syntax checks; this is not a substitute for the required automated tests.

## REST examples in a second PowerShell window

```powershell
$event = @{source_id='LINE-01';event_id='EV-101';type='COUNT';quantity=5;target_event_id=$null;event_time='2026-10-09T10:30:00Z'} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/events -ContentType 'application/json' -Body $event
Invoke-RestMethod -Uri 'http://localhost:3000/api/state?view=summary'
Invoke-RestMethod -Uri 'http://localhost:3000/api/state?view=pending'
Invoke-RestMethod -Uri 'http://localhost:3000/api/state?view=exceptions'
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/ack -ContentType 'application/json' -Body '{"event_ids":["EV-101"]}'
```

Send the same COUNT twice to see DUPLICATE. The actual count changes only on the first submission. See REQUIREMENT_DECISIONS.md for unresolved assessment contradictions. MQTT topics, final flow, tests and dashboard instructions will be added in later checkpoints.

## Checkpoint 2 dashboard
The dashboard is now implemented and served at http://localhost:3000/ after starting the backend. It uses the real APIs, has a source filter, JSON submission, six summary indicators, pending and exceptions views, and selection-based acknowledgements. Browser integration against a real database is not yet verified. MQTT and required tests remain incomplete at this checkpoint.
