'use strict';
(()=>{
const cases=[{request:'equipment',name:'Studio equipment',quote:8400,budget:10000},{request:'training',name:'Team training',quote:2400,budget:3000}];
const session=crypto.randomUUID();const previous={};let locked=false;let attempt=0;
const $=id=>document.getElementById(id);
$('cases').innerHTML=cases.map(c=>`<article class="request"><div class="request-head"><h3>${c.name}</h3><span class="badge" id="badge-${c.request}">Not recorded</span></div><div class="fields"><label>Offer (€)<input type="number" min="100" max="100000" step="1" id="${c.request}-quote" value="${c.quote}"></label><label>Available budget (€)<input type="number" min="100" max="100000" step="1" id="${c.request}-budget" value="${c.budget}"></label><label>Supplier document<select id="${c.request}-document"><option value="current">Current</option><option value="expired">Expired</option></select></label><label>Human approval<select id="${c.request}-approval"><option value="approved">Approved</option><option value="withdrawn">Withdrawn</option></select></label></div></article>`).join('');
function payload(c){return {session,request:c.request,quote:Number($(c.request+'-quote').value),budget:Number($(c.request+'-budget').value),document:$(c.request+'-document').value,approval:$(c.request+'-approval').value,...(previous[c.request]?{previous:previous[c.request]}:{})};}
function addText(parent,tag,text,cls){const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;parent.appendChild(n);return n;}
function render(c,data){
 if(attempt===1 && $('trail').querySelector('.empty'))$('trail').textContent='';
 const event=document.createElement('article');event.className='event';
 const outcome=data.outcome.decision;const isHold=outcome==='HOLD';
 addText(event,'div',c.name+' · '+(isHold?'Pause this purchase':'Ready to proceed'),'result-title');
 const comparison=data.comparison;
 const descriptions={DECISION_STABLE:'The decision is unchanged. Inspect the checks and recorded input changes below.',ATTRIBUTED_DECISION_CHANGE:'The decision changed alongside the recorded inputs.',UNATTRIBUTED_DECISION_CHANGE:'The decision changed without a recorded input change. Investigate before relying on it.',DERIVATION_REVALIDATION_REQUIRED:'The evaluation method changed. Revalidation is required.',INVALID_DECISION_RECORD:'The comparison could not validate the record bindings.'};
 addText(event,'p',data.comparison_error?'The decision was recorded, but comparison is unavailable.':comparison?(descriptions[comparison.status] || 'Comparison result requires inspection.'):'Starting decision recorded by the service.');
 const list=document.createElement('ul');list.className='checks';for(const check of data.outcome.checks)addText(list,'li',(check.passed?'✓ ':'! ')+check.text);event.appendChild(list);
 if(comparison?.changed_dimensions?.length)addText(event,'p','Recorded changes: '+comparison.changed_dimensions.join(', '),'subtle');
 const link=document.createElement('a');link.href='/verify?id='+encodeURIComponent(data.proof.seal_id);link.target='_blank';link.rel='noopener';link.textContent='Inspect this real record ↗';event.appendChild(link);
 $('trail').prepend(event);const badge=$('badge-'+c.request);badge.textContent=isHold?'On hold':'Can proceed';badge.className='badge '+(isHold?'hold':'pass');
 $('raw').textContent=JSON.stringify(data,null,2);
}
$('run').addEventListener('click',async()=>{
 if(locked)return;const inputs=cases.map(payload);
 if(inputs.some(b=>![b.quote,b.budget].every(v=>Number.isSafeInteger(v)&&v>=100&&v<=100000))){$('progress').textContent='Use whole amounts between €100 and €100,000.';return;}
 locked=true;attempt++;$('run').disabled=true;document.querySelectorAll('input,select').forEach(n=>n.disabled=true);
 try{
  for(let i=0;i<cases.length;i++){
   const c=cases[i];$('progress').className='subtle';$('progress').textContent=`Recording ${c.name.toLowerCase()} (${i+1}/2)… Timestamp checks can take a moment.`;
   const response=await fetch('/api/procurement',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(inputs[i]),signal:AbortSignal.timeout(65000)});
   const data=await response.json();
   if(!response.ok || data.ok!==true || !/^seal_[A-Za-z0-9_-]+$/.test(data.proof?.seal_id || '') || !['APPROVE','HOLD'].includes(data.outcome?.decision) || !Array.isArray(data.outcome?.checks))throw new Error(data.error || 'INCOMPLETE_RESPONSE');
   previous[c.request]=data.proof.seal_id;render(c,data);
  }
  $('trail-heading').textContent='The past stays on record.';
  $('step1').className='';$('step2').className='active';$('step3').className='active';
  $('progress').textContent='Now raise the equipment offer above €10,000, expire its document, or withdraw approval. Leave training unchanged and evaluate both again.';
  $('run').textContent='Evaluate both again';
 }catch(e){
  $('progress').className='subtle error';$('progress').textContent='This round did not finish. Earlier confirmed records remain above. A timed-out request may still have created a record; it was not automatically retried. '+(e.message==='DEMO_NOT_CONFIGURED'?'The demo is not configured yet.':'');
  $('run').textContent='Start a new evaluation round';
 }finally{locked=false;$('run').disabled=false;document.querySelectorAll('input,select').forEach(n=>n.disabled=false);}
});
})();
