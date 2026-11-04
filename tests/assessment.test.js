// These tests insert uniquely named synthetic records into the configured NEW database.
// They do not delete existing records. Do not run against an unrelated database.
const test = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config();
const { pool } = require('../src/db');
const { processEvents } = require('../src/events');
const { getSummary, acknowledge } = require('../src/state');
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
test.after(async()=>{await pool.end()});
