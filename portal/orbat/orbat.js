import { supabase, requireSession, esc } from '../shared/portal-shell.js';
await requireSession();
const { data, error } = await supabase.rpc('get_orbat');
const status=document.getElementById('status'),root=document.getElementById('orbat');
if(error){status.textContent=error.message;throw error}
const rows=data||[]; const sections=[]; const seen=new Set();
for(const r of rows){if(!seen.has(r.section_key)){seen.add(r.section_key);sections.push({key:r.section_key,title:r.section_title,subtitle:r.section_subtitle})}}
for(const s of sections){
  const col=document.createElement('section');col.className='column';
  col.innerHTML=`<div class="column-head">${esc(s.title)}</div><div class="column-sub">${esc(s.subtitle)}</div>`;
  for(const r of rows.filter(x=>x.section_key===s.key)){
    const occupied=!!r.user_id; const item=document.createElement('div');item.className=`slot${occupied?'':' vacant'}`;
    const avatar=r.avatar_url?`<img src="${esc(r.avatar_url)}" alt="">`:'?';
    const name=occupied?`${esc(r.email || [r.fictional_first_name,r.fictional_last_name].filter(Boolean).join(' '))}`:'Vacant';
    const rank=occupied?esc(r.rank||'Unassigned'):'Unassigned';
    const role=esc(r.billet||r.default_role);
    item.innerHTML=`<div class="avatar">${avatar}</div><div><strong>${name}</strong><small>${rank}</small><small><b>${role}</b></small></div><span class="code">${esc(r.callsign)}</span>`;
    col.appendChild(item);
  }
  root.appendChild(col);
}
status.textContent=`${rows.filter(r=>r.user_id).length} assigned // ${rows.filter(r=>!r.user_id).length} vacant`;
