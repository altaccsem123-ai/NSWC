import { supabase } from '../supabase-client.js';

export { supabase };

const navHost = document.querySelector('[data-portal-nav]');

if (navHost) {
    renderPortalNav(
        navHost.dataset.active || 'scheduling',
        navHost.dataset.appTabs === 'true'
    );
}

export function renderPortalNav(
    active = 'scheduling',
    appTabs = false
) {
    const host = document.querySelector('[data-portal-nav]');

    if (!host) {
        return;
    }

    const root = relativePortalRoot();

    const link = (
        key,
        label,
        href
    ) => `
        <a
            class="tab${active === key ? ' active' : ''}"
            href="${href}"
        >
            ${label}
        </a>
    `;

    const button = (
        key,
        label,
        tab
    ) => `
        <button
            class="tab${active === key ? ' active' : ''}"
            data-tab="${tab}"
            type="button"
        >
            ${label}
        </button>
    `;

    let navigation = '';

    if (appTabs) {
        navigation += button(
            'scheduling',
            'Scheduling',
            'schedule'
        );

        navigation += button(
            'qualifications',
            'Qualifications',
            'qualifications'
        );

        navigation += button(
            'attendance',
            'Attendance',
            'attendance'
        );
    } else {
        navigation += link(
            'scheduling',
            'Scheduling',
            `${root}app/?tab=schedule`
        );

        navigation += link(
            'qualifications',
            'Qualifications',
            `${root}app/?tab=qualifications`
        );

        navigation += link(
            'attendance',
            'Attendance',
            `${root}app/?tab=attendance`
        );
    }

    navigation += link(
        'orbat',
        'ORBAT',
        `${root}orbat/`
    );

    navigation += link(
        'checklist',
        'Checklist',
        `${root}checklist/`
    );

    navigation += link(
        'loa',
        'LOA',
        `${root}loa/`
    );

    navigation += link(
        'profile',
        'Profile',
        `${root}profile/`
    );

    navigation += link(
        'admin',
        'Admin',
        `${root}admin/`
    );

    if (appTabs) {
        navigation += `
            <button
                class="tab"
                data-tab="personnel"
                id="personnel-tab-button"
                type="button"
                hidden
            >
                Personnel
            </button>
        `;
    }

    host.outerHTML = `
        <nav class="tabs" aria-label="Portal sections">
            <div class="tabs-inner">
                ${navigation}
            </div>
        </nav>
    `;
}

function relativePortalRoot() {
    const path = location.pathname.replace(/\\/g, '/');

    const marker = '/portal/';
    const index = path.toLowerCase().indexOf(marker);

    if (index < 0) {
        return './portal/';
    }

    const tail = path
        .slice(index + marker.length)
        .split('/')
        .filter(Boolean);

    return tail.length
        ? '../'
        : './';
}

export async function requireSession({
    admin = false
} = {}) {
    const {
        data: { session },
        error
    } = await supabase.auth.getSession();

    if (
        error ||
        !session?.user
    ) {
        location.replace('../../login/');

        throw new Error(
            'No authenticated session'
        );
    }

    const {
        data: account,
        error: accountError
    } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if (
        accountError ||
        !account ||
        account.account_status !== 'active'
    ) {
        await supabase.auth.signOut();

        location.replace('../../login/');

        throw new Error(
            'Account unavailable'
        );
    }

    if (
        admin &&
        !account.is_admin
    ) {
        location.replace('../app/');

        throw new Error(
            'Administrator access required'
        );
    }

    renderIdentity(account);
    bindLogout();

    return {
        session,
        account
    };
}

export function displayName(account) {
    return (
        account?.display_name ||
        [
            account?.fictional_first_name,
            account?.fictional_last_name
        ]
            .filter(Boolean)
            .join(' ') ||
        account?.callsign ||
        account?.email ||
        'Unknown'
    );
}

export function rankFor(account) {
    if (account?.branch === 'Navy') {
        return account.navy_rank || 'Unassigned';
    }

    if (account?.branch === 'Army') {
        return account.army_rank || 'Unassigned';
    }

    if (account?.branch === 'Air Force') {
        return account.air_force_rank || 'Unassigned';
    }

    return 'Unassigned';
}

export function formatDate(value) {
    if (!value) {
        return '—';
    }

    return new Date(
        `${value}T00:00:00`
    ).toLocaleDateString();
}

export function formatDateTime(value) {
    if (!value) {
        return '—';
    }

    return new Intl.DateTimeFormat(
        undefined,
        {
            dateStyle: 'medium',
            timeStyle: 'short'
        }
    ).format(
        new Date(value)
    );
}

function renderIdentity(account) {
    document
        .querySelectorAll('[data-identity-name]')
        .forEach(element => {
            element.textContent =
                `${displayName(account)}${
                    account.callsign
                        ? ` / ${account.callsign}`
                        : ''
                }`;
        });

    document
        .querySelectorAll('[data-identity-meta]')
        .forEach(element => {
            element.textContent =
                `${account.branch || 'NSWC'} // ${rankFor(account)}`;
        });
}

function bindLogout() {
    document
        .querySelectorAll('[data-logout]')
        .forEach(button => {
            button.addEventListener(
                'click',
                async event => {
                    event.preventDefault();

                    await supabase.auth.signOut();

                    location.replace(
                        '../../login/'
                    );
                }
            );
        });
}

export function esc(value = '') {
    return String(value).replace(
        /[&<>'"]/g,
        character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        })[character]
    );
}