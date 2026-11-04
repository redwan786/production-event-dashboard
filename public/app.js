const $ = id => document.getElementById(id);
let currentView = 'pending';
const labels = [['net_total','Net total'],['processed_events','Processed events'],['pending_ack','Pending review'],['unresolved','Unresolved'],['duplicates','Duplicates'],['conflicts','Conflicts']];
function notice(text, error=false) { $('notice').textContent=text; $('notice').className=error?'notice error':'notice'; }
async function api(url, options) { const r=await fetch(url,options); const body=await r.json(); if(!r.ok) throw new Error(body.error || 'Request failed.'); return body; }
function textCell(row, value) { const td=document.createElement('td');td.textContent=value ?? '—';row.append(td); }
async function refresh(){
  notice('Loading current data…');
  try {
    const source=$('source').value.trim(); const query=source?'&source_id='+encodeURIComponent(source):'';
    const [summary,data,mqtt]=await Promise.all([api('/api/state?view=summary'+query),api('/api/state?view='+currentView+query),api('/api/mqtt')]);
    $('mqttStatus').textContent = `Candidate ${mqtt.candidate_id} · ${mqtt.connected?'Connected':'Disconnected'} | Challenges: ${mqtt.counts.total}, completed: ${mqtt.counts.completed}, failed: ${mqtt.counts.failed} | Last: ${mqtt.last ? mqtt.last.challenge_id+' / '+mqtt.last.status+' / '+mqtt.last.received_at : 'none'} | Error: ${mqtt.last_error || 'none'}`;
    $('stats').replaceChildren();
    for(const [key,label] of labels){ const card=document.createElement('div');card.className='stat';const name=document.createElement('span');name.textContent=label;const value=document.createElement('strong');value.textContent=summary[key];card.append(name,value);$('stats').append(card); }
    const items=currentView==='pending'?data:[...data.events,...data.attempts];
    const wrap=$('tableWrap');wrap.replaceChildren(); $('ack').hidden=currentView!=='pending';
    if(!items.length){wrap.textContent=currentView==='pending'?'No events awaiting review.':'No exceptions found.';}
    else {const table=document.createElement('table'),head=document.createElement('tr'); for(const h of (currentView==='pending'?['Select','Event ID','Source','Type','Status','Reason']:['Event ID','Source','Type','Status','Reason'])){const th=document.createElement('th');th.textContent=h;head.append(th)} const thead=document.createElement('thead');thead.append(head);table.append(thead);const tbody=document.createElement('tbody');
      for(const item of items){const tr=document.createElement('tr');if(currentView==='pending'){const td=document.createElement('td'), box=document.createElement('input');box.type='checkbox';box.value=item.event_id;box.setAttribute('aria-label','Select '+item.event_id);td.append(box);tr.append(td)}for(const key of ['event_id','source_id','type','status','reason'])textCell(tr,item[key]);tbody.append(tr)}table.append(tbody);wrap.append(table);}
    notice('Data refreshed from the backend.');
  }catch(e){notice('Could not load data: '+e.message,true)}
}
$('refresh').onclick=refresh; $('source').onchange=refresh;
for(const view of ['pending','exceptions']) $(view+'Tab').onclick=()=>{currentView=view;for(const v of ['pending','exceptions'])$(v+'Tab').setAttribute('aria-pressed',String(v===view));refresh()};
$('submit').onclick=async()=>{let data;try{data=JSON.parse($('payload').value)}catch{notice('Event JSON is invalid. Check brackets and commas.',true);return}try{const result=await api('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});$('result').textContent=JSON.stringify(result,null,2);await refresh()}catch(e){notice('Submission failed: '+e.message,true)}};
$('ack').onclick=async()=>{const ids=[...$('tableWrap').querySelectorAll('input:checked')].map(x=>x.value);if(!ids.length){notice('Select at least one pending event.',true);return}try{const result=await api('/api/ack',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event_ids:ids})});$('result').textContent=JSON.stringify(result,null,2);await refresh()}catch(e){notice('Acknowledgement failed: '+e.message,true)}};
refresh();
