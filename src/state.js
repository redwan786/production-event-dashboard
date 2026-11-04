const { pool } = require('./db');
const { lockBusinessChanges } = require('./events');
async function getSummary(source, db = pool) {
  const p = [source || null];
  const result = await db.query(`SELECT
    (SELECT COALESCE(sum(CASE WHEN event_type='COUNT' AND status='ACCEPTED' AND reversed_by IS NULL THEN quantity ELSE 0 END),0)::bigint FROM production_events WHERE ($1::text IS NULL OR source_id=$1)) AS net_total,
    (SELECT count(*)::int FROM production_events WHERE status='ACCEPTED' AND ($1::text IS NULL OR source_id=$1)) AS processed_events,
    (SELECT count(*)::int FROM production_events WHERE status='ACCEPTED' AND acknowledged_at IS NULL AND ($1::text IS NULL OR source_id=$1)) AS pending_ack,
    (SELECT count(*)::int FROM production_events WHERE status='PENDING_REFERENCE' AND ($1::text IS NULL OR source_id=$1)) AS unresolved,
    (SELECT count(*)::int FROM submission_attempts WHERE classification='DUPLICATE' AND ($1::text IS NULL OR source_id=$1)) AS duplicates,
    (SELECT count(*)::int FROM submission_attempts WHERE classification='CONFLICT' AND ($1::text IS NULL OR source_id=$1)) AS conflicts`,p);
  return {...result.rows[0], net_total:Number(result.rows[0].net_total)};
}
async function getPending(source) {
  return (await pool.query("SELECT event_id,source_id,event_type AS type,quantity,target_event_id,event_time,status FROM production_events WHERE status='ACCEPTED' AND acknowledged_at IS NULL AND ($1::text IS NULL OR source_id=$1) ORDER BY received_at,event_id", [source || null])).rows;
}
async function getExceptions(source) {
  const events = (await pool.query("SELECT event_id,source_id,event_type AS type,status,reason,received_at FROM production_events WHERE status IN ('PENDING_REFERENCE','REJECTED') AND ($1::text IS NULL OR source_id=$1) ORDER BY received_at", [source || null])).rows;
  const attempts = (await pool.query("SELECT event_id,source_id,classification AS status,reason,received_at FROM submission_attempts WHERE classification IN ('REJECTED','CONFLICT') AND ($1::text IS NULL OR source_id=$1) ORDER BY received_at", [source || null])).rows;
  return { events, attempts };
}
async function acknowledge(ids) {
  const client = await pool.connect(); const results = [];
  try {
    await client.query('BEGIN'); await lockBusinessChanges(client);
    for (const id of ids) {
      const row = (await client.query('SELECT status,acknowledged_at FROM production_events WHERE event_id=$1', [id])).rows[0];
      let status = !row ? 'NOT_FOUND' : row.status !== 'ACCEPTED' ? 'NOT_READY' : row.acknowledged_at ? 'ALREADY_ACKED' : 'ACKED';
      if (status === 'ACKED') {
        await client.query('UPDATE production_events SET acknowledged_at=now() WHERE event_id=$1', [id]);
        await client.query('INSERT INTO acknowledgements(event_id) VALUES($1)', [id]);
      }
      results.push({ event_id: id, status });
    }
    await client.query('COMMIT'); return results;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
module.exports = { getSummary, getPending, getExceptions, acknowledge };
