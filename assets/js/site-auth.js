import { supabase } from './supabase-client.js';

const accountLink = document.getElementById('account-link');
if (accountLink) {
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.user) {
    const { data: account } = await supabase
      .from('accounts')
      .select('callsign, fictional_last_name')
      .eq('id', session.user.id)
      .maybeSingle();

    accountLink.href = 'portal/';
    accountLink.textContent = account?.callsign || account?.fictional_last_name || 'Personnel Portal';
  }
}
