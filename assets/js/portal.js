import { supabase } from './supabase-client.js';

const gate = document.getElementById('portal-gate');
const app = document.getElementById('portal-app');
const logout = document.getElementById('logout-button');

const fields = {
  name: document.getElementById('profile-name'),
  callsign: document.getElementById('profile-callsign'),
  email: document.getElementById('profile-email'),
  branch: document.getElementById('profile-branch'),
  rank: document.getElementById('profile-rank'),
  billet: document.getElementById('profile-billet'),
  team: document.getElementById('profile-team'),
  joined: document.getElementById('profile-joined'),
  status: document.getElementById('profile-status'),
  access: document.getElementById('profile-access')
};

function rankFor(account) {
  if (account.branch === 'Navy') return account.navy_rank || 'Unassigned';
  if (account.branch === 'Army') return account.army_rank || 'Unassigned';
  if (account.branch === 'Air Force') return account.air_force_rank || 'Unassigned';
  return 'Unassigned';
}

async function loadPortal() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    window.location.replace('../login/');
    return;
  }

  const { data: account, error } = await supabase
    .from('accounts')
    .select('fictional_first_name, fictional_last_name, email, branch, navy_rank, army_rank, air_force_rank, callsign, billet, team, unit_joined_at, account_status, is_admin, is_cadre')
    .eq('id', session.user.id)
    .single();

  if (error || !account || account.account_status !== 'active') {
    await supabase.auth.signOut();
    window.location.replace('../login/');
    return;
  }

  await supabase.rpc('touch_last_seen');

  fields.name.textContent = [account.fictional_first_name, account.fictional_last_name].filter(Boolean).join(' ') || 'Unassigned';
  fields.callsign.textContent = account.callsign || 'Unassigned';
  fields.email.textContent = account.email || session.user.email || 'Unavailable';
  fields.branch.textContent = account.branch || 'Unassigned';
  fields.rank.textContent = rankFor(account);
  fields.billet.textContent = account.billet || 'Unassigned';
  fields.team.textContent = account.team || 'Unassigned';
  fields.joined.textContent = account.unit_joined_at ? new Date(`${account.unit_joined_at}T00:00:00`).toLocaleDateString() : 'Unassigned';
  fields.status.textContent = account.account_status;
  fields.access.textContent = account.is_admin ? 'Administrator' : account.is_cadre ? 'Cadre' : 'Member';

  if (account.is_admin) {
    const adminLink = document.getElementById('admin-link');
    if (adminLink) adminLink.hidden = false;
  }

  gate.hidden = true;
  app.hidden = false;
}

logout?.addEventListener('click', async () => {
  logout.disabled = true;
  await supabase.auth.signOut();
  window.location.replace('../login/');
});

supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') window.location.replace('../login/');
});

await loadPortal();
