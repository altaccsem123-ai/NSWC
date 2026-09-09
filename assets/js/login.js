import { supabase } from './supabase-client.js';

const form = document.getElementById('login-form');
const email = document.getElementById('email');
const password = document.getElementById('password');
const submit = document.getElementById('login-submit');
const message = document.getElementById('login-message');
const toggle = document.getElementById('toggle-password');

const { data: { session } } = await supabase.auth.getSession();
if (session?.user) window.location.replace('../portal/');

function setMessage(text, type = 'error') {
  message.textContent = text;
  message.dataset.type = type;
  message.hidden = !text;
}

toggle?.addEventListener('click', () => {
  const visible = password.type === 'text';
  password.type = visible ? 'password' : 'text';
  toggle.textContent = visible ? 'Show' : 'Hide';
  toggle.setAttribute('aria-pressed', String(!visible));
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('');
  submit.disabled = true;
  submit.textContent = 'Authenticating...';

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.value.trim(),
      password: password.value
    });

    if (error || !data.session) {
      setMessage('Authentication failed. Check your email and password.');
      return;
    }

    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('account_status')
      .eq('id', data.user.id)
      .single();

    if (accountError || !account) {
      await supabase.auth.signOut();
      setMessage('Your authentication record exists, but no NSWC personnel record is available. Contact an administrator.');
      return;
    }

    if (account.account_status !== 'active') {
      await supabase.auth.signOut();
      setMessage('This NSWC account is not active. Contact an administrator.');
      return;
    }

    await supabase.rpc('touch_last_seen');
    window.location.replace('../portal/');
  } catch {
    setMessage('Unable to complete authentication. Try again later.');
  } finally {
    submit.disabled = false;
    submit.textContent = 'Sign In';
  }
});
