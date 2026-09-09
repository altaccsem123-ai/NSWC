import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://sstseksivbuddbhrsiyd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_lhVsX6Rae76lbLN_6NHXGw_7diKW1Io';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
