import { supabase } from './supabase-client.js';

const tableBody = document.getElementById('accounts-body');
const status = document.getElementById('admin-status');
const app = document.getElementById('admin-app');
const gate = document.getElementById('admin-gate');
const logout = document.getElementById('logout-button');

async function loadAdmin() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    window.location.replace('../login/');
    return;
  }

  const { data: me, error: meError } = await supabase
    .from('accounts')
    .select('is_admin, account_status')
    .eq('id', session.user.id)
    .single();

  if (meError || !me?.is_admin || me.account_status !== 'active') {
    window.location.replace('../portal/');
    return;
  }

  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('fictional_first_name, fictional_last_name, callsign, email, branch, navy_rank, army_rank, air_force_rank, billet, team, account_status, is_admin, unit_joined_at')
    .order('callsign', { ascending: true, nullsFirst: false });

  if (error) {
    status.textContent = 'Unable to retrieve personnel records.';
    return;
  }

  tableBody.textContent = '';
  for (const account of accounts) {
    const rank = account.branch === 'Navy' ? account.navy_rank : account.branch === 'Army' ? account.army_rank : account.branch === 'Air Force' ? account.air_force_rank : null;
    const row = document.createElement('tr');
    const values = [
      account.callsign || '—',
      [account.fictional_first_name, account.fictional_last_name].filter(Boolean).join(' ') || '—',
      account.email || '—',
      account.branch || '—',
      rank || '—',
      account.billet || '—',
      account.team || '—',
      account.account_status,
      account.is_admin ? 'Admin' : 'Member',
      account.unit_joined_at || '—'
    ];
    for (const value of values) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.appendChild(cell);
    }
    tableBody.appendChild(row);
  }

  status.textContent = `${accounts.length} personnel record${accounts.length === 1 ? '' : 's'}`;
  gate.hidden = true;
  app.hidden = false;
}

logout?.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.replace('../login/');
});

await loadAdmin();
