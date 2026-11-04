require('dotenv').config();
const express = require('express');
const { pool } = require('./db');
const { processEvents } = require('./events');
const { getSummary, getPending, getExceptions, acknowledge } = require('./state');
const { startMqtt, getMqttStatus } = require('./mqtt');
const app = express();
app.use(express.static(require('node:path').join(__dirname, '../public')));
app.use(express.json({ limit: '1mb' }));
app.get('/health', async (req, res) => { try { await pool.query('SELECT 1'); res.json({ ok: true, database: 'connected' }); } catch { res.status(503).json({ ok: false, database: 'unavailable' }); } });
app.get('/api/mqtt', async (req, res, next) => { try { res.json(await getMqttStatus()); } catch(e) { next(e); } });
app.post('/api/events', async (req, res, next) => {
  const input = req.body;
  if (!input || typeof input !== 'object') return res.status(400).json({ error: 'Send an event object or an array.' });
  try { res.json({ results: await processEvents(Array.isArray(input) ? input : [input]) }); } catch (e) { next(e); }
});
app.get('/api/state', async (req, res, next) => {
  const { source_id, view = 'summary' } = req.query;
  if (!['summary','pending','exceptions'].includes(view) || (source_id !== undefined && typeof source_id !== 'string')) return res.status(400).json({ error: 'Invalid view or source_id.' });
  try { res.json(await (view === 'summary' ? getSummary(source_id) : view === 'pending' ? getPending(source_id) : getExceptions(source_id))); } catch(e) { next(e); }
});
app.post('/api/ack', async (req, res, next) => {
  if (!Array.isArray(req.body?.event_ids) || !req.body.event_ids.every(x => typeof x === 'string' && x.trim())) return res.status(400).json({ error: 'event_ids must be an array of non-empty strings.' });
  try { res.json({ results: await acknowledge(req.body.event_ids.map(x => x.trim())) }); } catch(e) { next(e); }
});
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
  console.error('Request failed; error code:', err.code || 'unknown');
  res.status(500).json({ error: 'The request could not be completed.' });
});
const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => { console.log(`Server listening on port ${port}`); startMqtt(); });
