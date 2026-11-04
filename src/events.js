const { pool } = require('./db');
const { normalizeEvent } = require('./validation');

// One lock serializes business changes. Simple and safe for a small demo; not high throughput.
async function lockBusinessChanges(client) { await client.query('SELECT pg_advisory_xact_lock($1)', [410401]); }
async function recordAttempt(client, raw, status, reason) {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const source = typeof obj.source_id === 'string' ? obj.source_id.trim() || null : null;
  const id = typeof obj.event_id === 'string' ? obj.event_id.trim() || null : null;
  await client.query('INSERT INTO submission_attempts(raw_payload, source_id, event_id, classification, reason) VALUES ($1::jsonb,$2,$3,$4,$5)', [JSON.stringify(raw), source, id, status, reason || null]);
}
async function insertEvent(client, e, status, reason) {
  await client.query(`INSERT INTO production_events(event_id,source_id,event_type,quantity,target_event_id,event_time,status,reason,normalized)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`, [e.event_id,e.source_id,e.type,e.quantity,e.target_event_id,e.event_time,status,reason,JSON.stringify(e)]);
}
async function resolvePendingVoids(client, count) {
  const { rows } = await client.query("SELECT * FROM production_events WHERE target_event_id=$1 AND status='PENDING_REFERENCE' ORDER BY received_at, event_id", [count.event_id]);
  let reversed = false;
  for (const item of rows) {
    const reason = item.source_id !== count.source_id ? 'Target COUNT has a different source.' : reversed ? 'Target COUNT was already reversed.' : null;
    if (reason) await client.query("UPDATE production_events SET status='REJECTED', reason=$2 WHERE event_id=$1", [item.event_id, reason]);
    else {
      await client.query("UPDATE production_events SET status='ACCEPTED', reason=NULL WHERE event_id=$1", [item.event_id]);
      await client.query('UPDATE production_events SET reversed_by=$2 WHERE event_id=$1', [count.event_id, item.event_id]);
      reversed = true;
    }
  }
}
async function processOne(raw) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockBusinessChanges(client);
    const checked = normalizeEvent(raw);
    let status, message, eventId = raw && typeof raw === 'object' && !Array.isArray(raw) && typeof raw.event_id === 'string' ? raw.event_id.trim() : null;
    if (checked.error) { status = 'REJECTED'; message = checked.error; }
    else {
      const e = checked.event; eventId = e.event_id;
      const existing = (await client.query('SELECT * FROM production_events WHERE event_id=$1', [e.event_id])).rows[0];
      if (existing) {
        // Both objects use the same normalized keys and are compared as JSONB in PostgreSQL.
        const identical = (await client.query('SELECT normalized = $2::jsonb AS same FROM production_events WHERE event_id=$1', [e.event_id, JSON.stringify(e)])).rows[0].same;
        status = identical ? 'DUPLICATE' : 'CONFLICT'; message = identical ? 'Identical event already stored.' : 'Event ID already belongs to different data.';
      } else if (e.type === 'COUNT') {
        await insertEvent(client, e, 'ACCEPTED', null);
        await resolvePendingVoids(client, e);
        status = 'ACCEPTED'; message = 'COUNT processed.';
      } else {
        const target = (await client.query('SELECT * FROM production_events WHERE event_id=$1', [e.target_event_id])).rows[0];
        let reason = null;
        if (e.target_event_id === e.event_id) reason = 'VOID cannot target itself.';
        else if (target && target.event_type !== 'COUNT') reason = 'Target must be a COUNT.';
        else if (target && target.source_id !== e.source_id) reason = 'Target COUNT has a different source.';
        else if (target && target.reversed_by) reason = 'Target COUNT was already reversed.';
        status = reason ? 'REJECTED' : target ? 'ACCEPTED' : 'PENDING_REFERENCE';
        message = reason || (target ? 'VOID processed.' : 'Waiting for target COUNT.');
        await insertEvent(client, e, status, reason);
        if (status === 'ACCEPTED') await client.query('UPDATE production_events SET reversed_by=$2 WHERE event_id=$1', [e.target_event_id, e.event_id]);
      }
    }
    await recordAttempt(client, raw, status, message);
    await client.query('COMMIT');
    return { event_id: eventId, status, message };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
// Process and commit each item separately so one invalid item does not undo others.
async function processEvents(items) { const results = []; for (const item of items) results.push(await processOne(item)); return results; }
module.exports = { processEvents, lockBusinessChanges };
