import { supabase } from '../../assets/js/supabase-client.js';

export { supabase };

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
  return [a?.fictional_first_name, a?.fictional_last_name].filter(Boolean).join(' ') || a?.callsign || a?.email || 'Unknown';
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
  document.querySelectorAll('[data-logout]').forEach(btn => btn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    location.replace('../../login/');
  }));
}

export function esc(s='') {
  return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
