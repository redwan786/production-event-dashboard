// Normalize optional null fields and timestamps so identical retries compare fairly.
function normalizeEvent(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'Event must be an object.' };
  const str = x => typeof x === 'string' ? x.trim() : '';
  const source_id = str(raw.source_id), event_id = str(raw.event_id), type = raw.type;
  if (!source_id || !event_id) return { error: 'source_id and event_id must be non-empty strings.' };
  if (type !== 'COUNT' && type !== 'VOID') return { error: 'type must be COUNT or VOID.' };
  if (typeof raw.event_time !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(raw.event_time) || !Number.isFinite(Date.parse(raw.event_time))) return { error: 'event_time must be an ISO 8601 timestamp with timezone.' };
  if (type === 'COUNT' && (!Number.isSafeInteger(raw.quantity) || raw.quantity <= 0 || raw.target_event_id != null)) return { error: 'COUNT requires a positive integer quantity and no target.' };
  if (type === 'VOID' && (raw.quantity != null || !str(raw.target_event_id))) return { error: 'VOID requires a target_event_id and no quantity.' };
  return { event: { source_id, event_id, type, quantity: type === 'COUNT' ? raw.quantity : null, target_event_id: type === 'VOID' ? str(raw.target_event_id) : null, event_time: new Date(raw.event_time).toISOString() } };
}
module.exports = { normalizeEvent };
