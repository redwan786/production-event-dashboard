const mqtt = require('mqtt');
const crypto = require('node:crypto');
const { pool } = require('./db');
const { handleChallenge, failure } = require('./challenge');
const candidate = process.env.CANDIDATE_ID || '04';
const base = `fse-01/${candidate}`;
const info = { connected:false, candidate_id:candidate, last_error:null };
let client, heartbeat, retryTimer, delay = 1000;
function sendStatus(status) { if(client?.connected) client.publish(`${base}/status`,JSON.stringify({candidate_id:candidate,status,time:new Date().toISOString()}),{qos:1,retain:false}); }
function startMqtt() {
  const clientId=`fse01-${candidate}-${crypto.randomBytes(3).toString('hex')}`;
  client=mqtt.connect(process.env.MQTT_URL || 'mqtt://152.42.238.142:1883', {clientId, reconnectPeriod:0, connectTimeout:10000, will:{topic:`${base}/status`,payload:JSON.stringify({candidate_id:candidate,status:'OFFLINE'}),qos:1,retain:false}});
  client.on('connect',()=>{delay=1000;client.subscribe(`${base}/challenge`,{qos:1},err=>{if(err){info.last_error='MQTT subscription failed';return}info.connected=true;info.last_error=null;sendStatus('ONLINE');clearInterval(heartbeat);heartbeat=setInterval(()=>sendStatus('HEARTBEAT'),30000);});});
  client.on('message',async(topic,payload)=>{
    if(topic!==`${base}/challenge`) return;
    let challenge; try { challenge=JSON.parse(payload.toString('utf8')); } catch { info.last_error='Invalid challenge JSON'; return; }
    let response; try { response=await handleChallenge(challenge); } catch { info.last_error='Challenge processing failed'; response=failure(challenge,'INTERNAL_ERROR','Unable to process challenge.'); }
    if(response.status==='FAILED') info.last_error=response.error_code;
    // Delivery before expiry depends on network and processing time; QoS 1 is not proof of simulator success.
    client.publish(`${base}/response`,JSON.stringify(response),{qos:1,retain:false},err=>{if(err) info.last_error='MQTT response publish failed';});
  });
  client.on('error',()=>{info.last_error='MQTT connection error';});
  client.on('close',()=>{info.connected=false;clearInterval(heartbeat);clearTimeout(retryTimer);retryTimer=setTimeout(()=>client.reconnect(),delay);delay=Math.min(delay*2,30000);});
}
async function getMqttStatus() {
  const counts=(await pool.query("SELECT count(*)::int AS total, count(*) FILTER (WHERE status='COMPLETED')::int AS completed, count(*) FILTER (WHERE status='FAILED')::int AS failed FROM mqtt_challenges")).rows[0];
  const last=(await pool.query('SELECT challenge_id,received_at,status FROM mqtt_challenges ORDER BY received_at DESC LIMIT 1')).rows[0] || null;
  return {...info,counts,last};
}
module.exports = { startMqtt, getMqttStatus };
