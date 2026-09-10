import { supabase, requireSession, displayName, esc } from './shell.js';
await requireSession();
const status=document.getElementById('status'),root=document.getElementById('orbat');
try{
  const {data,error}=await supabase.rpc('get_orbat');
  if(error) throw error;
  const rows=data||[], sections=[];
  for(const r of rows) if(!sections.some(s=>s.key===r.section_key)) sections.push({key:r.section_key,title:r.section_title,subtitle:r.section_subtitle});
  for(const s of sections){
    const col=document.createElement('section'); col.className='orbat-column';
    col.innerHTML=`<div class="orbat-column-head"><strong>${esc(s.title)}</strong><span>${esc(s.subtitle)}</span></div>`;
    for(const r of rows.filter(x=>x.section_key===s.key)){
      const occupied=!!r.user_id,item=document.createElement('div'); item.className=`orbat-slot${occupied?'':' vacant'}`;
      const avatar=r.avatar_url?`<img src="${esc(r.avatar_url)}" alt="">`:'?';
      item.innerHTML=`<div class="orbat-avatar">${avatar}</div><div><strong>${occupied?esc(displayName(r)):'Vacant'}</strong><small>${occupied?esc(r.rank||'Unassigned'):'Unassigned'}</small><small>${esc(r.billet||r.default_role)}</small></div><span class="orbat-code">${esc(r.callsign)}</span>`;
      col.appendChild(item);
    }
    root.appendChild(col);
  }
  status.textContent=`${rows.filter(r=>r.user_id).length} assigned // ${rows.filter(r=>!r.user_id).length} vacant`;
}catch(error){console.error(error);status.textContent=`Unable to load ORBAT: ${error.message}`;}
