// These tests insert uniquely named synthetic records into the configured NEW database.
// They do not delete existing records. Do not run against an unrelated database.
const test = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config();
const { pool } = require('../src/db');
const { processEvents } = require('../src/events');
const { getSummary, getPending, getExceptions, acknowledge } = require('../src/state');
const { handleChallenge } = require('../src/challenge');
const prefix = 'TEST-' + Date.now() + '-' + Math.random().toString(36).slice(2,8);
const source = prefix;
const makeCount = (suffix, quantity=5) => ({source_id:source,event_id:prefix+'-'+suffix,type:'COUNT',quantity,target_event_id:null,event_time:'2026-10-09T10:30:00Z'});
test('COUNT increases its source total', async()=>{const [r]=await processEvents([makeCount('A')]);assert.equal(r.status,'ACCEPTED');assert.equal((await getSummary(source)).net_total,5)});
test('identical duplicate does not double count', async()=>{const [r]=await processEvents([makeCount('A')]);assert.equal(r.status,'DUPLICATE');assert.equal((await getSummary(source)).net_total,5)});
test('VOID before COUNT resolves automatically', async()=>{const target=makeCount('B',7);const v={source_id:source,event_id:prefix+'-V',type:'VOID',quantity:null,target_event_id:target.event_id,event_time:'2026-10-09T10:30:00Z'};assert.equal((await processEvents([v]))[0].status,'PENDING_REFERENCE');assert.equal((await processEvents([target]))[0].status,'ACCEPTED');const s=await getSummary(source);assert.equal(s.unresolved,0);assert.equal(s.net_total,5)});
test('repeated acknowledgement is safe', async()=>{const r=await acknowledge([prefix+'-A',prefix+'-A']);assert.deepEqual(r.map(x=>x.status),['ACKED','ALREADY_ACKED'])});
test('repeated MQTT challenge returns original without processing again', async()=>{const c={protocol_version:'1.0',candidate_id:process.env.CANDIDATE_ID||'04',challenge_id:prefix+'-CH',command:'PROCESS_EVENTS',sent_at:new Date().toISOString(),expires_at:new Date(Date.now()+120000).toISOString(),events:[makeCount('C',3)]};const a=await handleChallenge(c),b=await handleChallenge(c);assert.equal(a.status,'COMPLETED');assert.deepEqual(b,a);assert.equal((await getSummary(source)).net_total,8);assert.equal((await getSummary(source)).duplicates,1)});
test('mixed batch preserves order and accepts valid items', async()=>{const good=makeCount('D',2); const r=await processEvents([{source_id:source,event_id:prefix+'-BAD',type:'COUNT',quantity:0,event_time:'2026-10-09T10:30:00Z'},good]);assert.deepEqual(r.map(x=>x.status),['REJECTED','ACCEPTED'])});
test('changed duplicate conflicts without replacing original', async()=>{const r=await processEvents([makeCount('D',99)]);assert.equal(r[0].status,'CONFLICT');assert.equal((await getSummary(source)).net_total,10)});
test('concurrent identical requests only count once', async()=>{const e=makeCount('E',4);const results=await Promise.all(Array.from({length:5},()=>processEvents([e])));const states=results.map(x=>x[0].status).sort();assert.deepEqual(states,['ACCEPTED','DUPLICATE','DUPLICATE','DUPLICATE','DUPLICATE']);assert.equal((await getSummary(source)).net_total,14)});
test('changed MQTT challenge body is a conflict', async()=>{const c={protocol_version:'1.0',candidate_id:process.env.CANDIDATE_ID||'04',challenge_id:prefix+'-CH',command:'PROCESS_EVENTS',sent_at:new Date().toISOString(),expires_at:new Date(Date.now()+120000).toISOString(),events:[]};const r=await handleChallenge(c);assert.equal(r.status,'FAILED');assert.equal(r.error_code,'CHALLENGE_CONFLICT')});

test('quantity limits, persisted rejection and source filters', async()=>{
  const src=prefix+'-LIMIT';
  const e=(id,quantity)=>({...makeCount('LIMIT-'+id,quantity),source_id:src});
  const a=e('A',1), b=e('B',500), invalid=e('BAD',501);
  const results=await processEvents([a,b,invalid,a,{...a,quantity:2}, {...e('VOID',null),type:'VOID',target_event_id:prefix+'-NOT-FOUND'}]);
  assert.deepEqual(results.map(r=>r.status),['ACCEPTED','ACCEPTED','REJECTED','DUPLICATE','CONFLICT','PENDING_REFERENCE']);
  assert.match(results[2].message,/1 to 500/);
  const summary=await getSummary(src);
  assert.equal(summary.net_total,501); assert.equal(summary.rejected_submissions,1);
  assert.equal(summary.duplicates,1); assert.equal(summary.conflicts,1); assert.equal(summary.unresolved,1);
  const stored=await pool.query("SELECT count(*)::int AS n FROM submission_attempts WHERE source_id=$1 AND event_id=$2 AND classification='REJECTED'",[src,invalid.event_id]);
  assert.equal(stored.rows[0].n,1);
  assert.equal((await getSummary(prefix+'-NO-SUCH-SOURCE')).rejected_submissions,0);
  const pending=await getPending(src), exceptions=await getExceptions(src);
  assert.ok(pending.length>=2); assert.ok(pending.every(x=>x.source_id===src));
  assert.ok(exceptions.attempts.some(x=>x.event_id===invalid.event_id));
  assert.ok([...exceptions.events,...exceptions.attempts].every(x=>x.source_id===src));
});
test('MQTT shares limits and reports rejected submissions in state', async()=>{
  const src=prefix+'-MQTT-LIMIT';
  const count=(id,n)=>({...makeCount('MQTT-'+id,n),source_id:src});
  const c={protocol_version:'1.0',candidate_id:process.env.CANDIDATE_ID||'04',challenge_id:prefix+'-LIMIT-CH',command:'PROCESS_EVENTS',sent_at:new Date().toISOString(),expires_at:new Date(Date.now()+120000).toISOString(),events:[count('GOOD',500),count('BAD',501)]};
  const response=await handleChallenge(c);
  assert.equal(response.status,'COMPLETED');
  assert.deepEqual(response.results.map(x=>x.status),['ACCEPTED','REJECTED']);
  assert.ok(Number.isInteger(response.state.rejected_submissions));
  assert.ok(response.state.rejected_submissions>=1);
  const summary=await getSummary(src); assert.equal(summary.net_total,500); assert.equal(summary.rejected_submissions,1);
  const replay=await handleChallenge(c); assert.deepEqual(replay,response); assert.equal((await getSummary(src)).rejected_submissions,1);
});

test.after(async()=>{await pool.end()});
