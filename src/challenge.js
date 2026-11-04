const { pool } = require('./db');
const { processEventsInTransaction, lockBusinessChanges } = require('./events');
const { getSummary } = require('./state');
function failure(challenge, code, message) {
  return { protocol_version:'1.0', candidate_id:process.env.CANDIDATE_ID || '04', challenge_id: typeof challenge?.challenge_id === 'string' ? challenge.challenge_id : null, status:'FAILED', processed_at:new Date().toISOString(), error_code:code, message };
}
function isZonedTime(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value) && Number.isFinite(Date.parse(value)); }
function validationError(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c) || typeof c.challenge_id !== 'string' || !c.challenge_id.trim()) return ['VALIDATION_ERROR','A non-empty challenge_id is required.'];
  if (c.protocol_version !== '1.0') return ['UNSUPPORTED_PROTOCOL','Only protocol version 1.0 is supported.'];
  if (c.candidate_id !== (process.env.CANDIDATE_ID || '04')) return ['CANDIDATE_MISMATCH','Candidate ID does not match.'];
  if (c.command !== 'PROCESS_EVENTS' || !Array.isArray(c.events) || !isZonedTime(c.sent_at) || !isZonedTime(c.expires_at)) return ['VALIDATION_ERROR','Invalid command, events, sent_at or expires_at.'];
  if (Date.parse(c.expires_at) <= Date.now()) return ['CHALLENGE_EXPIRED','Challenge has expired.'];
  return null;
}
// Store the challenge response and all its event effects in one transaction.
// Same-ID requests are compared as JSONB, so object key order does not matter.
async function handleChallenge(c) {
  const identifiable = c && typeof c === 'object' && !Array.isArray(c) && typeof c.challenge_id === 'string' && c.challenge_id.trim();
  if (!identifiable) {
    const response = failure(c,'VALIDATION_ERROR','A non-empty challenge_id is required.');
    await pool.query('INSERT INTO mqtt_challenge_attempts(challenge_id,request_body,response_body) VALUES(NULL,$1::jsonb,$2::jsonb)',[JSON.stringify(c),JSON.stringify(response)]);
    return response;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN'); await lockBusinessChanges(client);
    const existing = (await client.query('SELECT response_body, request_body = $2::jsonb AS same FROM mqtt_challenges WHERE challenge_id=$1',[c.challenge_id,JSON.stringify(c)])).rows[0];
    if (existing) { const response=existing.same ? existing.response_body : failure(c,'CHALLENGE_CONFLICT','Challenge ID was used with different data.'); await client.query('INSERT INTO mqtt_challenge_attempts(challenge_id,request_body,response_body) VALUES($1,$2::jsonb,$3::jsonb)',[c.challenge_id,JSON.stringify(c),JSON.stringify(response)]); await client.query('COMMIT'); return response; }
    const problem = validationError(c);
    let response;
    if (problem) response = failure(c,problem[0],problem[1]);
    else {
      await client.query('SAVEPOINT event_effects');
      const results = await processEventsInTransaction(client,c.events);
      response = { protocol_version:'1.0', candidate_id:process.env.CANDIDATE_ID || '04', challenge_id:c.challenge_id, status:'COMPLETED', processed_at:new Date().toISOString(), results, state:await getSummary(null,client) };
      if (Date.now() >= Date.parse(c.expires_at)) { await client.query('ROLLBACK TO SAVEPOINT event_effects'); response=failure(c,'CHALLENGE_EXPIRED','Challenge expired during processing.'); }
    }
    await client.query('INSERT INTO mqtt_challenges(challenge_id,request_body,response_body,status) VALUES($1,$2::jsonb,$3::jsonb,$4)',[c.challenge_id,JSON.stringify(c),JSON.stringify(response),response.status]);
    await client.query('INSERT INTO mqtt_challenge_attempts(challenge_id,request_body,response_body) VALUES($1,$2::jsonb,$3::jsonb)',[c.challenge_id,JSON.stringify(c),JSON.stringify(response)]);
    await client.query('COMMIT'); return response;
  } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}
module.exports = { handleChallenge, validationError, failure };
