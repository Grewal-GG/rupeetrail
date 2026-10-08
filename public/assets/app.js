'use strict';
const $ = selector => document.querySelector(selector), form = $('#encounter-form');
const DENOMINATIONS = [1,2,5,10,20,50,100,200,500,2000];
let encounters = [], csrf = '', editing = null, busy = false, ready = false;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key = row => JSON.stringify(['denomination','serial','series','year','inset','governor'].map(name => String(row[name] ?? '').trim().toUpperCase()));
const money = value => '₹' + Number(value).toLocaleString('en-IN');
const days = (a,b) => Math.floor(Math.abs(new Date(a)-new Date(b))/86400000);
function localTime(value) {
 const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(p => [p.type,p.value]));
 return parts.year+'-'+parts.month+'-'+parts.day+'T'+parts.hour+':'+parts.minute;
}
const displayDate = value => new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
const detailText = row => [row.series,row.year,row.inset ? 'Inset '+row.inset : '',row.governor].filter(Boolean).join(' · ');
const noteImage = denomination => window.NoteFaces.render(denomination);
function groups() {
 const map = new Map();
 for(const row of encounters) { const k=key(row); if(!map.has(k))map.set(k,[]); map.get(k).push(row); }
 return [...map.values()].map(rows => rows.sort((a,b) => new Date(b.seen_at)-new Date(a.seen_at)||b.id-a.id));
}
function render() {
 const all=groups();
 $('#unique').textContent=all.length; $('#total').textContent=encounters.length; $('#repeat').textContent=encounters.length-all.length;
 $('#value').textContent=money(all.reduce((sum,rows)=>sum+Number(rows[0].denomination),0));
 $('#repeat-notes').textContent=all.filter(rows=>rows.length>1).length;
 let longest=0;
 for(const rows of all)for(let i=1;i<rows.length;i++)longest=Math.max(longest,days(rows[i-1].seen_at,rows[i].seen_at));
 $('#gap').textContent=longest+' days';
 const latest=encounters.reduce((last,row)=>!last||new Date(row.seen_at)>new Date(last.seen_at)?row:last,null);
 $('#last-recorded').textContent=latest?'Last encounter: '+displayDate(latest.seen_at)+' IST':'No encounters yet. Add your first note below.';
 $('#denominations').innerHTML=all.length?DENOMINATIONS.filter(d=>all.some(rows=>Number(rows[0].denomination)===d)).map(d=>{
  const notes=all.filter(rows=>Number(rows[0].denomination)===d), count=notes.reduce((sum,rows)=>sum+rows.length,0);
  return '<div class="denomination-row">'+noteImage(d)+'<div><strong>'+money(d)+'</strong><p>'+notes.length+' '+(notes.length===1?'note':'notes')+' · '+count+' '+(count===1?'encounter':'encounters')+'</p></div><button type="button" data-denomination="'+d+'" aria-label="Add a '+money(d)+' encounter">Add</button></div>';
 }).join(''):'<p class="empty">Your denomination totals will appear here after you save a note.</p>';
 const query=$('#search').value.trim().toLowerCase(), denom=$('#filter').value, from=$('#from').value, to=$('#to').value;
 const invalidRange=from&&to&&from>to;
 const visible=invalidRange?[]:all.filter(rows=>rows.some(row=>{
  const day=localTime(row.seen_at).slice(0,10);
  return (!denom||String(row.denomination)===denom)&&(!query||[row.serial,row.context,row.series,row.year,row.inset,row.governor].join(' ').toLowerCase().includes(query))&&(!from||day>=from)&&(!to||day<=to);
 }));
 const sort=$('#sort').value;
 visible.sort((a,b)=>sort==='count'?b.length-a.length||new Date(b[0].seen_at)-new Date(a[0].seen_at):sort==='value'?Number(a[0].denomination)-Number(b[0].denomination):sort==='first'?new Date(a.at(-1).seen_at)-new Date(b.at(-1).seen_at):new Date(b[0].seen_at)-new Date(a[0].seen_at));
 $('#note-count').textContent=visible.length+' / '+all.length;
 $('#filter-status').textContent=invalidRange?'The From date must be on or before the To date.':'Showing '+visible.length+' of '+all.length+' recorded notes. Totals above include all records.';
 $('#entries').innerHTML=visible.length?visible.map(rows=>{
  const row=rows[0], first=rows.at(-1);
  return '<tr><td>'+noteImage(row.denomination)+'<span class="note-value">'+money(row.denomination)+'</span></td><td><strong class="serial">'+esc(row.serial)+'</strong><small>'+esc(detailText(row)||'No extra identity details')+'</small></td><td>'+rows.length+'</td><td>'+esc(displayDate(first.seen_at))+'</td><td>'+esc(displayDate(row.seen_at))+'</td><td class="context-cell">'+esc(row.context||'—')+'</td><td><div class="table-actions"><button data-again="'+row.id+'">Add again</button><button data-history="'+row.id+'">History</button><button data-edit="'+row.id+'">Edit latest</button></div></td></tr>';
 }).join(''):'<tr><td colspan="7" class="empty">'+(encounters.length?'No notes match these filters.':'No notes yet. Enter a denomination and serial above to start.')+'</td></tr>';
}
async function refresh() {
 const response=await fetch('api.php',{cache:'no-store'}), data=await response.json();
 if(!response.ok)throw Error(data.error||'Could not load records.');
 if(!Array.isArray(data.encounters)||!data.csrf)throw Error('Invalid response from the PHP server.');
 encounters=data.encounters.map(row=>({...row,id:Number(row.id),denomination:Number(row.denomination)})); csrf=data.csrf; ready=true; $('#save').disabled=busy; $('#load-status').textContent=''; render(); match();
}
async function mutate(data) {
 const response=await fetch('api.php',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(data)});
 const result=await response.json();
 if(!response.ok)throw Error(result.error||'Could not save.');
}
function match() {
 const data=Object.fromEntries(new FormData(form)); data.serial=data.serial.toUpperCase().replace(/\s/g,'');
 const rows=encounters.filter(row=>row.serial===data.serial&&String(row.denomination)===data.denomination&&row.id!==editing);
 $('#match').textContent=rows.length?'This serial has '+rows.length+' previous encounter(s). Check the extra details if these are different notes.':'';
}
form.addEventListener('input',event=>{
 match();
});
function rememberedDenomination() {try {const value=localStorage.getItem('rupeetrail-denomination');return DENOMINATIONS.includes(Number(value))?value:'100';}catch{return '100';}}
function resetForm() {
 editing=null; form.reset(); form.elements.denomination.value=rememberedDenomination(); form.elements.seen_at.value=localTime(new Date());
 $('#save').textContent='Save encounter'; $('#form-title').textContent='Add encounter'; $('#cancel-edit').hidden=true; $('#identity').open=false; $('#form-status').textContent='';match();
}
document.addEventListener('rupeetrail:scan-complete',event=>{
 if(busy)return;
 for(const name of ['denomination','serial','year','series','inset','governor'])form.elements[name].value=event.detail[name]||'';
 $('#identity').open=!!detailText(event.detail);$('#form-status').textContent='Scanned details added. Add a context if needed, then save.';match();form.elements.context.focus();
});
form.addEventListener('submit',async event=>{
 event.preventDefault(); if(busy||!ready)return; busy=true; $('#save').disabled=true; form.setAttribute('aria-busy','true');
 try {
  const data=Object.fromEntries(new FormData(form)); data.action=editing?'edit':'add'; if(editing)data.id=editing;
  await mutate(data);
  try{localStorage.setItem('rupeetrail-denomination',data.denomination);}catch{}
  resetForm(); $('#form-status').textContent='Encounter saved.'; form.elements.serial.focus();
  try{await refresh();}catch(error){$('#load-status').textContent='Saved, but the dashboard could not reload. Press Refresh. '+error.message;}
 }catch(error){$('#form-status').textContent=error.message;}
 finally{busy=false;$('#save').disabled=!ready;form.removeAttribute('aria-busy');}
});
$('#cancel-edit').onclick=()=>{if(!busy)resetForm();};
function fillRecord(id,mode) {
 if(busy)return;
 const row=encounters.find(item=>item.id===id);if(!row)return;
 resetForm();
 for(const name of ['denomination','serial','series','year','inset','governor','context'])form.elements[name].value=row[name]??'';
 form.elements.seen_at.value=mode==='edit'?localTime(row.seen_at):localTime(new Date());
 editing=mode==='edit'?id:null;
 $('#form-title').textContent=editing?'Edit encounter':'Add encounter';
 $('#save').textContent=editing?'Save changes':'Save encounter'; $('#cancel-edit').hidden=!editing;
 $('#identity').open=!!detailText(row);
 if($('#history').open)$('#history').close();
 match(); $('#scan').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});form.elements.serial.focus();
}
function history(id) {
 const row=encounters.find(item=>item.id===id);if(!row)return;
 const rows=encounters.filter(item=>key(item)===key(row)).sort((a,b)=>new Date(a.seen_at)-new Date(b.seen_at)||a.id-b.id);
 $('#history-content').innerHTML='<div class="history-note">'+noteImage(row.denomination)+'<div><strong>'+money(row.denomination)+' · <span class="serial">'+esc(row.serial)+'</span></strong><small>'+esc(detailText(row)||'No extra identity details; matches are provisional.')+'</small></div></div>'+rows.map((item,i)=>'<article class="history-row"><strong>'+esc(displayDate(item.seen_at))+' IST</strong><p class="fine">'+(i?days(item.seen_at,rows[i-1].seen_at)+' days since previous encounter':'First recorded encounter')+'</p><p>'+esc(item.context||'No context added')+'</p><button data-edit="'+item.id+'">Edit</button><button class="danger" data-delete="'+item.id+'">Delete</button></article>').join('');
 $('#history').showModal();
}
document.addEventListener('click',async event=>{
 const button=event.target.closest('button');if(!button||busy)return;
 if(button.dataset.history)history(Number(button.dataset.history));
 if(button.dataset.edit)fillRecord(Number(button.dataset.edit),'edit');
 if(button.dataset.again)fillRecord(Number(button.dataset.again),'add');
 if(button.dataset.denomination){resetForm();form.elements.denomination.value=button.dataset.denomination;$('#scan').scrollIntoView();form.elements.serial.focus();}
 if(button.dataset.delete&&confirm('Delete this encounter permanently?')) {
  busy=true;button.disabled=true;$('#save').disabled=true;
  try{await mutate({action:'delete',id:Number(button.dataset.delete)});$('#history').close();resetForm();$('#form-status').textContent='Encounter deleted.';try{await refresh();}catch(error){$('#load-status').textContent='Deleted, but the dashboard could not reload. Press Refresh. '+error.message;}}
  catch(error){alert(error.message);}
  finally{busy=false;button.disabled=false;$('#save').disabled=!ready;}
 }
});
$('#close-history').onclick=()=>$('#history').close();
for(const id of ['search','filter','from','to','sort'])$('#'+id).addEventListener('input',render);
$('#clear-filters').onclick=()=>{for(const id of ['search','filter','from','to'])$('#'+id).value='';$('#sort').value='latest';render();};
$('#reload').onclick=async()=>{
 if(busy)return;const button=$('#reload');button.disabled=true;
 try{await refresh();}catch(error){$('#load-status').textContent=error.message+' Press Refresh to retry.';}
 finally{button.disabled=false;}
};

resetForm();
refresh().catch(error=>{
 $('#entries').innerHTML='<tr><td colspan="7" class="empty">'+esc(error.message)+' Press Refresh to retry.</td></tr>';
 $('#denominations').innerHTML='<p class="empty">Records could not be loaded.</p>';
 $('#last-recorded').textContent='Records unavailable';$('#load-status').textContent=error.message+' Press Refresh to retry.';
});
