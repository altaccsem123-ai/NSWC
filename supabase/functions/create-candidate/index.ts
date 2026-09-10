import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Supabase function environment is not configured.');
}

const adminClient = createClient(
  SUPABASE_URL,
  SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';

  const allowed =
    origin === 'https://nswc.us' ||
    origin === 'https://www.nswc.us' ||
    origin.startsWith('https://altaccsem123-ai.github.io');

  return {
    'Access-Control-Allow-Origin': allowed
      ? origin
      : 'https://nswc.us',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods':
      'POST, OPTIONS',
    'Vary':
      'Origin'
  };
}

function json(
  req: Request,
  body: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders(req),
        'Content-Type': 'application/json'
      }
    }
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(
      'ok',
      {
        headers: corsHeaders(req)
      }
    );
  }

  if (req.method !== 'POST') {
    return json(
      req,
      {
        error: 'Method not allowed.'
      },
      405
    );
  }

  const authHeader =
    req.headers.get('authorization');

  const token =
    authHeader?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return json(
      req,
      {
        error: 'Authentication required.'
      },
      401
    );
  }

  const {
    data: callerData,
    error: callerError
  } = await adminClient.auth.getUser(token);

  if (
    callerError ||
    !callerData.user
  ) {
    return json(
      req,
      {
        error: 'Invalid personnel session.'
      },
      401
    );
  }

  const {
    data: callerAccount,
    error: accountError
  } = await adminClient
    .from('accounts')
    .select('id,is_admin,account_status')
    .eq('id', callerData.user.id)
    .single();

  if (
    accountError ||
    !callerAccount ||
    callerAccount.account_status !== 'active' ||
    !callerAccount.is_admin
  ) {
    return json(
      req,
      {
        error: 'Administrator authorization required.'
      },
      403
    );
  }

  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return json(
      req,
      {
        error: 'Invalid request body.'
      },
      400
    );
  }

  const email =
    String(body.email || '')
      .trim()
      .toLowerCase();

  const password =
    String(body.password || '');

  const firstName =
    String(body.first_name || '')
      .trim()
      .slice(0, 80);

  const lastName =
    String(body.last_name || '')
      .trim()
      .slice(0, 80);

  const callsign =
    body.callsign
      ? String(body.callsign)
          .trim()
          .slice(0, 30)
      : null;

  const timezone =
    body.timezone
      ? String(body.timezone)
          .trim()
          .slice(0, 80)
      : null;

  if (!email.endsWith('@candidate.mil')) {
    return json(
      req,
      {
        error:
          'Candidate email must end in @candidate.mil.'
      },
      400
    );
  }

  if (
    !firstName ||
    !lastName
  ) {
    return json(
      req,
      {
        error:
          'Fictional first and last name are required.'
      },
      400
    );
  }

  if (password.length < 10) {
    return json(
      req,
      {
        error:
          'Password must contain at least 10 characters.'
      },
      400
    );
  }

  const {
    data: created,
    error: createError
  } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      fictional_first_name:
        firstName,
      fictional_last_name:
        lastName,
      callsign,
      candidate: true
    }
  });

  if (
    createError ||
    !created.user
  ) {
    return json(
      req,
      {
        error:
          createError?.message ||
          'Auth account could not be created.'
      },
      400
    );
  }

  const {
    error: profileError
  } = await adminClient
    .from('accounts')
    .upsert(
      {
        id:
          created.user.id,

        email,

        fictional_first_name:
          firstName,

        fictional_last_name:
          lastName,

        callsign,

        is_candidate:
          true,

        is_admin:
          false,

        is_cadre:
          false,

        account_status:
          'active',

        timezone,

        unit_joined_at:
          new Date()
            .toISOString()
            .slice(0, 10)
      },
      {
        onConflict: 'id'
      }
    );

  if (profileError) {
    await adminClient.auth.admin.deleteUser(
      created.user.id
    );

    return json(
      req,
      {
        error:
          `Candidate profile could not be created: ${profileError.message}`
      },
      500
    );
  }

  return json(
    req,
    {
      ok: true,
      user_id: created.user.id,
      email
    }
  );
});