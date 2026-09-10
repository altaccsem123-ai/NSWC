import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL =
  Deno.env.get('SUPABASE_URL');

const SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (
  !SUPABASE_URL ||
  !SERVICE_ROLE_KEY
) {
  throw new Error(
    'Supabase function environment is not configured.'
  );
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

const NAVY_RANKS = [
  'SR',
  'SA',
  'SN',
  'PO3',
  'PO2',
  'PO1',
  'CPO',
  'SCPO',
  'MCPO',
  'CWO2',
  'CWO3',
  'CWO4',
  'CWO5',
  'ENS',
  'LTJG',
  'LT',
  'LCDR',
  'CDR',
  'CAPT'
];

const ARMY_RANKS = [
  'PVT',
  'PV2',
  'PFC',
  'SPC',
  'CPL',
  'SGT',
  'SSG',
  'SFC',
  'MSG',
  '1SG',
  'SGM',
  'CSM',
  'WO1',
  'CW2',
  'CW3',
  'CW4',
  'CW5',
  '2LT',
  '1LT',
  'CPT',
  'MAJ',
  'LTC',
  'COL'
];

const AIR_FORCE_RANKS = [
  'AB',
  'Amn',
  'A1C',
  'SrA',
  'SSgt',
  'TSgt',
  'MSgt',
  'SMSgt',
  'CMSgt',
  '2d Lt',
  '1st Lt',
  'Capt',
  'Maj',
  'Lt Col',
  'Col'
];

const VALID_BRANCHES = [
  'Navy',
  'Army',
  'Air Force'
];

const VALID_LEADERSHIP = [
  'Member',
  'Team Leader',
  'HQ'
];

const VALID_STATUS = [
  'active',
  'inactive',
  'suspended',
  'retired'
];

function corsHeaders(req: Request) {
  const origin =
    req.headers.get('origin') || '';

  const allowed =
    origin === 'https://nswc.us' ||
    origin === 'https://www.nswc.us' ||
    origin.startsWith(
      'https://altaccsem123-ai.github.io'
    );

  return {
    'Access-Control-Allow-Origin':
      allowed
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
        'Content-Type':
          'application/json'
      }
    }
  );
}

function cleanText(
  value: unknown,
  maxLength = 200
): string | null {
  if (
    typeof value !== 'string'
  ) {
    return null;
  }

  const cleaned =
    value.trim();

  if (!cleaned) {
    return null;
  }

  return cleaned.slice(
    0,
    maxLength
  );
}

function validRank(
  branch: string | null,
  rank: string | null
) {
  if (!rank) {
    return true;
  }

  if (branch === 'Navy') {
    return NAVY_RANKS.includes(
      rank
    );
  }

  if (branch === 'Army') {
    return ARMY_RANKS.includes(
      rank
    );
  }

  if (
    branch === 'Air Force'
  ) {
    return AIR_FORCE_RANKS.includes(
      rank
    );
  }

  return false;
}

function getTeamFromSection(
  sectionKey: string,
  sectionTitle: string
) {
  switch (
    sectionKey
      .trim()
      .toLowerCase()
  ) {
    case 'golf':
      return 'Golf';

    case 'hotel':
      return 'Hotel';

    case 'india':
      return 'India';

    case 'troop-hq':
      return 'Troop HQ';

    case 'enablers':
      return 'Enablers';

    default:
      return sectionTitle || null;
  }
}

Deno.serve(
  async (req: Request) => {
    if (
      req.method === 'OPTIONS'
    ) {
      return new Response(
        'ok',
        {
          headers:
            corsHeaders(req)
        }
      );
    }

    if (
      req.method !== 'POST'
    ) {
      return json(
        req,
        {
          error:
            'Method not allowed.'
        },
        405
      );
    }

    const authHeader =
      req.headers.get(
        'authorization'
      );

    const token =
      authHeader?.replace(
        /^Bearer\s+/i,
        ''
      );

    if (!token) {
      return json(
        req,
        {
          error:
            'Authentication required.'
        },
        401
      );
    }

    const {
      data: callerData,
      error: callerError
    } =
      await adminClient.auth.getUser(
        token
      );

    if (
      callerError ||
      !callerData.user
    ) {
      return json(
        req,
        {
          error:
            'Invalid personnel session.'
        },
        401
      );
    }

    const {
      data: callerAccount,
      error: callerAccountError
    } =
      await adminClient
        .from('accounts')
        .select(
          'id,is_admin,account_status'
        )
        .eq(
          'id',
          callerData.user.id
        )
        .single();

    if (
      callerAccountError ||
      !callerAccount ||
      callerAccount.account_status !==
        'active' ||
      !callerAccount.is_admin
    ) {
      return json(
        req,
        {
          error:
            'Administrator authorization required.'
        },
        403
      );
    }

    let body:
      Record<string, unknown>;

    try {
      body =
        await req.json();
    } catch {
      return json(
        req,
        {
          error:
            'Invalid request body.'
        },
        400
      );
    }

    const firstName =
      cleanText(
        body.first_name,
        80
      );

    const lastName =
      cleanText(
        body.last_name,
        80
      );

    const email =
      cleanText(
        body.email,
        320
      )?.toLowerCase() ||
      null;

    const password =
      typeof body.password ===
      'string'
        ? body.password
        : '';

    const candidate =
      body.is_candidate ===
      true;

    const branch =
      cleanText(
        body.branch,
        30
      );

    const rank =
      cleanText(
        body.rank,
        30
      );

    const callsign =
      cleanText(
        body.callsign,
        30
      );

    const leadership =
      cleanText(
        body.leadership_level,
        30
      ) ||
      'Member';

    const accountStatus =
      cleanText(
        body.account_status,
        30
      ) ||
      'active';

    const isAdmin =
      body.is_admin === true;

    const isCadre =
      body.is_cadre === true;

    const timezone =
      cleanText(
        body.timezone,
        80
      );

    const unitJoinedAt =
      cleanText(
        body.unit_joined_at,
        10
      );

    if (!firstName) {
      return json(
        req,
        {
          error:
            'First name is required.'
        },
        400
      );
    }

    if (!lastName) {
      return json(
        req,
        {
          error:
            'Last name is required.'
        },
        400
      );
    }

    if (!email) {
      return json(
        req,
        {
          error:
            'Email is required.'
        },
        400
      );
    }

    if (
      password.length < 10
    ) {
      return json(
        req,
        {
          error:
            'Temporary password must contain at least 10 characters.'
        },
        400
      );
    }

    if (
      branch &&
      !VALID_BRANCHES.includes(
        branch
      )
    ) {
      return json(
        req,
        {
          error:
            'Invalid branch.'
        },
        400
      );
    }

    if (
      !VALID_LEADERSHIP.includes(
        leadership
      )
    ) {
      return json(
        req,
        {
          error:
            'Invalid leadership level.'
        },
        400
      );
    }

    if (
      !VALID_STATUS.includes(
        accountStatus
      )
    ) {
      return json(
        req,
        {
          error:
            'Invalid account status.'
        },
        400
      );
    }

    if (
      rank &&
      !branch
    ) {
      return json(
        req,
        {
          error:
            'A branch must be selected when assigning a rank.'
        },
        400
      );
    }

    if (
      !validRank(
        branch,
        rank
      )
    ) {
      return json(
        req,
        {
          error:
            'The selected rank does not belong to the selected branch.'
        },
        400
      );
    }

    let team:
      string | null =
      null;

    let billet:
      string | null =
      null;

    let squadron:
      string | null =
      null;

    let troop:
      string | null =
      null;

    if (callsign) {
      const {
        data: slot,
        error: slotError
      } =
        await adminClient
          .from(
            'orbat_slots'
          )
          .select(
            `
              callsign,
              section_key,
              section_title,
              section_subtitle,
              default_role,
              default_branch,
              active
            `
          )
          .eq(
            'callsign',
            callsign
          )
          .eq(
            'active',
            true
          )
          .maybeSingle();

      if (slotError) {
        return json(
          req,
          {
            error:
              slotError.message
          },
          400
        );
      }

      if (!slot) {
        return json(
          req,
          {
            error:
              'Unknown or inactive ORBAT position.'
          },
          400
        );
      }

      const {
        data: occupied,
        error:
          occupiedError
      } =
        await adminClient
          .from('accounts')
          .select(
            'id,callsign'
          )
          .eq(
            'callsign',
            callsign
          )
          .maybeSingle();

      if (occupiedError) {
        return json(
          req,
          {
            error:
              occupiedError.message
          },
          400
        );
      }

      if (occupied) {
        return json(
          req,
          {
            error:
              `${callsign} is already occupied.`
          },
          400
        );
      }

      if (
        slot.default_branch &&
        branch &&
        slot.default_branch !==
          branch
      ) {
        return json(
          req,
          {
            error:
              `${callsign} is assigned to ${slot.default_branch}.`
          },
          400
        );
      }

      team =
        getTeamFromSection(
          slot.section_key,
          slot.section_title
        );

      billet =
        slot.default_role ||
        null;

      squadron =
        'Red Squadron';

      troop =
        '3 Troop';
    }

    const {
      data: created,
      error: createError
    } =
      await adminClient
        .auth
        .admin
        .createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            fictional_first_name:
              firstName,

            fictional_last_name:
              lastName,

            callsign,

            candidate
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

    const userId =
      created.user.id;

    const updateData = {
      id:
        userId,

      email,

      fictional_first_name:
        firstName,

      fictional_last_name:
        lastName,

      branch:
        branch || null,

      navy_rank:
        branch === 'Navy'
          ? rank || null
          : null,

      army_rank:
        branch === 'Army'
          ? rank || null
          : null,

      air_force_rank:
        branch === 'Air Force'
          ? rank || null
          : null,

      callsign:
        callsign || null,

      billet,
      team,
      squadron,
      troop,

      is_admin:
        isAdmin,

      is_cadre:
        isCadre,

      is_candidate:
        candidate,

      account_status:
        accountStatus,

      leadership_level:
        leadership,

      timezone:
        timezone || null,

      ...(unitJoinedAt
        ? {
            unit_joined_at:
              unitJoinedAt
          }
        : {})
    };

    const {
      data: profile,
      error: profileError
    } =
      await adminClient
        .from('accounts')
        .upsert(
          updateData,
          {
            onConflict: 'id'
          }
        )
        .select(
          `
            id,
            email,
            fictional_first_name,
            fictional_last_name,
            branch,
            navy_rank,
            army_rank,
            air_force_rank,
            callsign,
            billet,
            team,
            squadron,
            troop,
            is_candidate,
            is_admin,
            is_cadre,
            leadership_level,
            account_status,
            unit_joined_at
          `
        )
        .single();

    if (profileError) {
      await adminClient
        .auth
        .admin
        .deleteUser(
          userId
        );

      return json(
        req,
        {
          error:
            `Personnel profile could not be created: ${profileError.message}`
        },
        500
      );
    }

    return json(
      req,
      {
        ok: true,
        success: true,
        user_id:
          userId,
        account:
          profile
      }
    );
  }
);