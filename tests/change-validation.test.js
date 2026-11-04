const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEvent } = require('../src/validation');
const event = quantity => ({source_id:'TEST', event_id:'TEST-1', type:'COUNT', quantity, target_event_id:null, event_time:'2026-10-09T10:30:00Z'});
test('COUNT accepts inclusive limits and rejects invalid quantities', () => {
  for (const n of [1, 450, 500]) assert.equal(normalizeEvent(event(n)).event.quantity, n);
  for (const n of [0, -1, 501, 1.5, '500', null]) assert.match(normalizeEvent(event(n)).error, /1 to 500/);
});
test('existing COUNT target and VOID validation is preserved', () => {
  assert.ok(normalizeEvent({...event(5), target_event_id:'x'}).error);
  assert.equal(normalizeEvent({...event(null), type:'VOID', target_event_id:'x'}).event.type, 'VOID');
});
