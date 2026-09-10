import { supabase } from '../supabase-client.js';

export { supabase };

const navHost = document.querySelector('[data-portal-nav]');
if (navHost) renderPortalNav(navHost.dataset.active || 'scheduling', navHost.dataset.appTabs === 'true');

export function renderPortalNav(active='scheduling', appTabs=false) {
  const host=document.querySelector('[data-portal-nav]');
  if(!host) return;
  const root=relativePortalRoot();
  const link=(key,label,path)=>`<a class="tab${active===key?' active':''}" href="${root}${path}">${label}</a>`;
  host.outerHTML=`<nav class="tabs" aria-label="Portal sections"><div class="tabs-inner">${
    appTabs
      ? `<button class="tab active" data-tab="schedule" type="button">Scheduling</button><button class="tab" data-tab="qualifications" type="button">Qualifications</button><button class="tab" data-tab="attendance" type="button">Attendance</button>`
      : link('scheduling','Scheduling','app/')
  }${link('orbat','ORBAT','orbat/')}${link('loa','LOA','loa/')}${link('profile','Profile','profile/')}${link('admin','Admin','admin/')}${appTabs?'<button class="tab" data-tab="personnel" id="personnel-tab-button" type="button" hidden>Personnel</button>':''}</div></nav>`;
}

function relativePortalRoot(){
  const path=location.pathname.replace(/\\/g,'/');
  const marker='/portal/';
  const i=path.toLowerCase().indexOf(marker);
  if(i<0) return '../portal/';
  const tail=path.slice(i+marker.length).split('/').filter(Boolean);
  return tail.length ? '../' : './';
}

export async function requireSession({ admin = false } = {}) {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.user) {
    location.replace('../../login/');
    throw new Error('No authenticated session');
  }
  const { data: account, error: accountError } = await supabase.from('accounts').select('*').eq('id', session.user.id).single();
  if (accountError || !account || account.account_status !== 'active') {
    await supabase.auth.signOut();
    location.replace('../../login/');
    throw new Error('Account unavailable');
  }
  if (admin && !account.is_admin) {
    location.replace('../app/');
    throw new Error('Administrator access required');
  }
  renderIdentity(account);
  bindLogout();
  return { session, account };
}

export function displayName(a) {
  return a?.display_name || [a?.fictional_first_name, a?.fictional_last_name].filter(Boolean).join(' ') || a?.callsign || a?.email || 'Unknown';
}

export function rankFor(a) {
  if (a?.branch === 'Navy') return a.navy_rank || 'Unassigned';
  if (a?.branch === 'Army') return a.army_rank || 'Unassigned';
  if (a?.branch === 'Air Force') return a.air_force_rank || 'Unassigned';
  return 'Unassigned';
}

export function formatDate(v) {
  if (!v) return '—';
  return new Date(`${v}T00:00:00`).toLocaleDateString();
}

export function formatDateTime(v) {
  if (!v) return '—';
  return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(v));
}

function renderIdentity(account) {
  document.querySelectorAll('[data-identity-name]').forEach(el => el.textContent = `${displayName(account)}${account.callsign ? ` / ${account.callsign}` : ''}`);
  document.querySelectorAll('[data-identity-meta]').forEach(el => el.textContent = `${account.branch || 'NSWC'} // ${rankFor(account)}`);
}

function bindLogout() {
  document.querySelectorAll('[data-logout]').forEach(btn => btn.addEventListener('click', async (e) => {
    e.preventDefault();
    await supabase.auth.signOut();
    location.replace('../../login/');
  }));
}

export function esc(s='') {
  return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
