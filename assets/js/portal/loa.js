import { supabase, requireSession, displayName, formatDate, esc } from './shell.js';
const {account}=await requireSession(); let requests=[],people=[],reviewer=false,current=null;
const mine=document.getElementById('mine'),review=document.getElementById('review');
const {data:canReview,error:reviewAccessError}=await supabase.rpc('portal_can_review_loa',{p_user:account.id});
if(reviewAccessError) console.warn(reviewAccessError); reviewer=!!canReview; document.getElementById('review-panel').hidden=!reviewer;
function person(id){return people.find(p=>p.id===id)}
function card(r,lead=false){
  const p=person(r.user_id),d=document.createElement('article'); d.className='loa-entry';
  d.innerHTML=`<div class="loa-entry-head"><div><strong>${lead?esc(displayName(p)):esc(`${formatDate(r.starts_on)} - ${formatDate(r.ends_on)}`)}</strong><div class="loa-entry-meta">${lead?`${esc(p?.callsign||'NO CALLSIGN')} // ${esc(p?.team||'UNASSIGNED')}`:esc(r.reason)}</div></div><span class="status ${esc(r.status)}">${esc(r.status)}</span></div>${lead?`<div class="loa-entry-copy">${esc(formatDate(r.starts_on))} - ${esc(formatDate(r.ends_on))}<br>${esc(r.reason)}</div>`:''}${r.review_note?`<div class="portal-notice" style="margin-top:9px">Review note: ${esc(r.review_note)}</div>`:''}`;
  if(!lead&&r.status==='pending'){const b=document.createElement('button');b.className='secondary-button';b.style.marginTop='10px';b.textContent='Withdraw';b.onclick=()=>withdraw(r);d.appendChild(b)}
  if(lead&&r.status==='pending'){const b=document.createElement('button');b.className='primary-button';b.style.marginTop='10px';b.textContent='Review';b.onclick=()=>openReview(r);d.appendChild(b)} return d;
}
function render(){
  mine.replaceChildren(); const own=requests.filter(r=>r.user_id===account.id); if(!own.length) mine.innerHTML='<div class="empty-state">No LOA requests submitted.</div>'; own.forEach(r=>mine.appendChild(card(r)));
  if(reviewer){review.replaceChildren();const pending=requests.filter(r=>r.status==='pending'&&r.user_id!==account.id);if(!pending.length)review.innerHTML='<div class="empty-state">No pending requests.</div>';pending.forEach(r=>review.appendChild(card(r,true)))}
}
async function load(){
  try{const [l,p]=await Promise.all([supabase.from('leave_of_absence').select('*').order('created_at',{ascending:false}),supabase.rpc('get_loa_people')]);if(l.error)throw l.error;if(p.error)throw p.error;requests=l.data||[];people=p.data||[];render()}catch(error){console.error(error);mine.innerHTML=`<div class="form-message error">Unable to load LOA records: ${esc(error.message)}</div>`;}
}
async function withdraw(r){if(!confirm('Withdraw this LOA request?'))return;const {error}=await supabase.from('leave_of_absence').update({status:'withdrawn',updated_at:new Date().toISOString()}).eq('id',r.id);if(error)alert(error.message);else load()}
const nd=document.getElementById('new-dialog'),nf=document.getElementById('new-form'); document.getElementById('new-btn').onclick=()=>nd.showModal(); document.getElementById('new-cancel').onclick=()=>nd.close();
nf.onsubmit=async e=>{e.preventDefault();const f=nf.elements,err=document.getElementById('new-error');err.textContent='';if(f.end.value<f.start.value){err.textContent='End date cannot be before start date.';return}const {error}=await supabase.from('leave_of_absence').insert({user_id:account.id,starts_on:f.start.value,ends_on:f.end.value,reason:f.reason.value.trim()});if(error){err.textContent=error.message;return}nf.reset();nd.close();load()};
function openReview(r){current=r;const p=person(r.user_id);document.getElementById('review-summary').innerHTML=`<b>${esc(displayName(p))}${p?.callsign?` / ${esc(p.callsign)}`:''}</b><br>${esc(formatDate(r.starts_on))} - ${esc(formatDate(r.ends_on))}<br>${esc(r.reason)}`;document.getElementById('review-form').elements.note.value='';document.getElementById('review-error').textContent='';document.getElementById('review-dialog').showModal()}
async function decide(status){const note=document.getElementById('review-form').elements.note.value.trim();const {error}=await supabase.rpc('review_loa',{p_loa:current.id,p_status:status,p_note:note});if(error){document.getElementById('review-error').textContent=error.message;return}document.getElementById('review-dialog').close();load()}
document.getElementById('approve').onclick=()=>decide('approved');document.getElementById('deny').onclick=()=>decide('denied');document.getElementById('review-cancel').onclick=()=>document.getElementById('review-dialog').close(); await load();
