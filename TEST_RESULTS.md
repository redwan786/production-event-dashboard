# Verification record

Results from the build environment, not the candidate's computer:

- Dependencies installed and JavaScript syntax checks passed.
- Migrations ran against an isolated local PostgreSQL server with TLS verification enabled.
- Nine automated tests passed: COUNT, identical duplicate, VOID-before-COUNT resolution, repeated acknowledgement, repeated MQTT challenge, mixed batch, event conflict, concurrent identical events, and changed challenge conflict.
- A local test MQTT broker verified ONLINE, a COUNT challenge and correlated response, identical replay, and a changed-body conflict. This is not the examiner's simulator.
- The dashboard loaded against the local test database at desktop and mobile widths. In the local desktop browser, COUNT submission, duplicate handling and acknowledgement were exercised successfully.
- The assessment broker's TCP port was reachable from the build environment. TCP reachability is not an MQTT challenge test.

Still unverified: the candidate's Supabase connection and migrations; tests and dashboard on the candidate's computer; a real examiner MQTT challenge and response; GitHub pushes; Render deployment; and the candidate's screenshots. Update this record only after observing actual results. Tests add uniquely prefixed synthetic events to the configured database and do not clean them up; use the new assessment database only.
