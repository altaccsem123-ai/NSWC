import {
    supabase,
    requireSession,
    esc
} from './shell.js';

await requireSession({ admin: true });

const NAVY_RANKS = [
    ['SR', 'SR - Seaman Recruit'],
    ['SA', 'SA - Seaman Apprentice'],
    ['SN', 'SN - Seaman'],
    ['PO3', 'PO3 - Petty Officer Third Class'],
    ['PO2', 'PO2 - Petty Officer Second Class'],
    ['PO1', 'PO1 - Petty Officer First Class'],
    ['CPO', 'CPO - Chief Petty Officer'],
    ['SCPO', 'SCPO - Senior Chief Petty Officer'],
    ['MCPO', 'MCPO - Master Chief Petty Officer'],
    ['CWO2', 'CWO2 - Chief Warrant Officer 2'],
    ['CWO3', 'CWO3 - Chief Warrant Officer 3'],
    ['CWO4', 'CWO4 - Chief Warrant Officer 4'],
    ['CWO5', 'CWO5 - Chief Warrant Officer 5'],
    ['ENS', 'ENS - Ensign'],
    ['LTJG', 'LTJG - Lieutenant Junior Grade'],
    ['LT', 'LT - Lieutenant'],
    ['LCDR', 'LCDR - Lieutenant Commander'],
    ['CDR', 'CDR - Commander'],
    ['CAPT', 'CAPT - Captain']
];

const ARMY_RANKS = [
    ['PVT', 'PVT - Private'],
    ['PV2', 'PV2 - Private Second Class'],
    ['PFC', 'PFC - Private First Class'],
    ['SPC', 'SPC - Specialist'],
    ['CPL', 'CPL - Corporal'],
    ['SGT', 'SGT - Sergeant'],
    ['SSG', 'SSG - Staff Sergeant'],
    ['SFC', 'SFC - Sergeant First Class'],
    ['MSG', 'MSG - Master Sergeant'],
    ['1SG', '1SG - First Sergeant'],
    ['SGM', 'SGM - Sergeant Major'],
    ['CSM', 'CSM - Command Sergeant Major'],
    ['WO1', 'WO1 - Warrant Officer 1'],
    ['CW2', 'CW2 - Chief Warrant Officer 2'],
    ['CW3', 'CW3 - Chief Warrant Officer 3'],
    ['CW4', 'CW4 - Chief Warrant Officer 4'],
    ['CW5', 'CW5 - Chief Warrant Officer 5'],
    ['2LT', '2LT - Second Lieutenant'],
    ['1LT', '1LT - First Lieutenant'],
    ['CPT', 'CPT - Captain'],
    ['MAJ', 'MAJ - Major'],
    ['LTC', 'LTC - Lieutenant Colonel'],
    ['COL', 'COL - Colonel']
];

const AIR_FORCE_RANKS = [
    ['AB', 'AB - Airman Basic'],
    ['Amn', 'Amn - Airman'],
    ['A1C', 'A1C - Airman First Class'],
    ['SrA', 'SrA - Senior Airman'],
    ['SSgt', 'SSgt - Staff Sergeant'],
    ['TSgt', 'TSgt - Technical Sergeant'],
    ['MSgt', 'MSgt - Master Sergeant'],
    ['SMSgt', 'SMSgt - Senior Master Sergeant'],
    ['CMSgt', 'CMSgt - Chief Master Sergeant'],
    ['2d Lt', '2d Lt - Second Lieutenant'],
    ['1st Lt', '1st Lt - First Lieutenant'],
    ['Capt', 'Capt - Captain'],
    ['Maj', 'Maj - Major'],
    ['Lt Col', 'Lt Col - Lieutenant Colonel'],
    ['Col', 'Col - Colonel']
];

let people = [];
let slots = [];
let current = null;

const rows = document.getElementById('rows');
const search = document.getElementById('search');
const dialog = document.getElementById('edit');
const form = document.getElementById('edit-form');

const rankField = document.getElementById('rank-field');
const rankLabel = document.getElementById('rank-label');
const message = document.getElementById('message');

const createDialog =
    document.getElementById('create-account');

const createForm =
    document.getElementById('create-account-form');

const createButton =
    document.getElementById('create-account-button');

const createCancel =
    document.getElementById('create-account-cancel');

const createMessage =
    document.getElementById('create-account-message');

const createRankField =
    document.getElementById('create-rank-field');

const createRankLabel =
    document.getElementById('create-rank-label');


function getRank(person) {
    const branch = person.branch || '';

    if (branch === 'Navy') {
        return person.navy_rank || '';
    }

    if (branch === 'Army') {
        return person.army_rank || '';
    }

    if (branch === 'Air Force') {
        return person.air_force_rank || '';
    }

    return '';
}

function getRankList(branch) {
    if (branch === 'Navy') {
        return NAVY_RANKS;
    }

    if (branch === 'Army') {
        return ARMY_RANKS;
    }

    if (branch === 'Air Force') {
        return AIR_FORCE_RANKS;
    }

    return [];
}

function getSlot(callsign) {
    return slots.find(
        slot => slot.callsign === callsign
    ) || null;
}

function getTeamFromSlot(slot) {
    if (!slot) {
        return '';
    }

    switch (slot.section_key) {
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
            return slot.section_title || '';
    }
}

function setSingleOption(select, value, label = value) {
    select.innerHTML = '';

    const option = document.createElement('option');
    option.value = value || '';
    option.textContent = label || 'Unassigned';

    select.appendChild(option);
    select.value = value || '';
}

function populateRankDropdown(branch, selectedRank = '') {
    const select = form.elements.rank;
    const ranks = getRankList(branch);

    select.innerHTML = '';

    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = 'Unassigned';

    select.appendChild(blank);

    for (const [value, label] of ranks) {
        const option = document.createElement('option');

        option.value = value;
        option.textContent = label;

        select.appendChild(option);
    }

    if (
        selectedRank &&
        !ranks.some(([value]) => value === selectedRank)
    ) {
        const legacy = document.createElement('option');

        legacy.value = selectedRank;
        legacy.textContent = `${selectedRank} - Current value`;

        select.appendChild(legacy);
    }

    select.value = selectedRank || '';
}

function updateBranchAndRank(person) {
    const branch = person.branch || '';

    form.elements.branch.value = branch;

    if (!branch) {
        rankField.hidden = true;
        form.elements.rank.innerHTML =
            '<option value="">Unassigned</option>';

        return;
    }

    rankField.hidden = false;
    rankLabel.textContent = `${branch} Rank`;

    populateRankDropdown(
        branch,
        getRank(person)
    );
}

function updateAssignmentPreview() {
    const callsign = form.elements.callsign.value;
    const slot = getSlot(callsign);

    if (!slot) {
        setSingleOption(
            form.elements.team,
            '',
            'Unassigned'
        );

        setSingleOption(
            form.elements.billet,
            '',
            'Unassigned'
        );

        setSingleOption(
            form.elements.squadron,
            '',
            'Unassigned'
        );

        setSingleOption(
            form.elements.troop,
            '',
            'Unassigned'
        );

        return;
    }

    const team = getTeamFromSlot(slot);

    setSingleOption(
        form.elements.team,
        team,
        team
    );

    setSingleOption(
        form.elements.billet,
        slot.default_role || '',
        slot.default_role || 'Unassigned'
    );

    setSingleOption(
        form.elements.squadron,
        'Red Squadron',
        'Red Squadron'
    );

    setSingleOption(
        form.elements.troop,
        '3 Troop',
        '3 Troop'
    );
}

function populateCreateRankDropdown(
    branch,
    selectedRank = ''
) {
    const select =
        createForm.elements.rank;

    const ranks =
        getRankList(branch);

    select.innerHTML = '';

    const blank =
        document.createElement('option');

    blank.value = '';
    blank.textContent = 'Unassigned';

    select.appendChild(blank);

    for (const [value, label] of ranks) {
        const option =
            document.createElement('option');

        option.value = value;
        option.textContent = label;

        select.appendChild(option);
    }

    select.value =
        selectedRank || '';
}

function populateCreateCallsigns() {
    const select =
        createForm.elements.callsign;

    select.innerHTML = '';

    const unassigned =
        document.createElement('option');

    unassigned.value = '';
    unassigned.textContent =
        'Unassigned';

    select.appendChild(unassigned);

    for (const slot of slots) {
        const occupant =
            people.find(person =>
                person.callsign ===
                slot.callsign
            );

        const option =
            document.createElement('option');

        option.value =
            slot.callsign;

        const role =
            slot.default_role
                ? ` - ${slot.default_role}`
                : '';

        if (occupant) {
            option.textContent =
                `${slot.callsign}${role} - OCCUPIED`;

            option.disabled = true;
        } else {
            option.textContent =
                `${slot.callsign}${role}`;
        }

        select.appendChild(option);
    }
}

function setCreatePreview(
    field,
    value
) {
    createForm.elements[field].value =
        value || 'Unassigned';
}

function updateCreateAssignmentPreview() {
    const callsign =
        createForm.elements.callsign.value;

    const slot =
        getSlot(callsign);

    if (!slot) {
        setCreatePreview(
            'team',
            'Unassigned'
        );

        setCreatePreview(
            'billet',
            'Unassigned'
        );

        setCreatePreview(
            'squadron',
            'Unassigned'
        );

        setCreatePreview(
            'troop',
            'Unassigned'
        );

        return;
    }

    const team =
        getTeamFromSlot(slot);

    setCreatePreview(
        'team',
        team
    );

    setCreatePreview(
        'billet',
        slot.default_role
    );

    setCreatePreview(
        'squadron',
        'Red Squadron'
    );

    setCreatePreview(
        'troop',
        '3 Troop'
    );

    if (
        slot.default_branch &&
        !createForm.elements.branch.value
    ) {
        createForm.elements.branch.value =
            slot.default_branch;

        createRankField.hidden =
            false;

        createRankLabel.textContent =
            `${slot.default_branch} Rank`;

        populateCreateRankDropdown(
            slot.default_branch
        );
    }
}

function openCreateAccount() {
    createForm.reset();

    createMessage.textContent = '';

    createForm.elements.candidate.value =
        'false';

    createForm.elements.leadership.value =
        'Member';

    createForm.elements.status.value =
        'active';

    createForm.elements.admin.value =
        'false';

    createForm.elements.cadre.value =
        'false';

    const today =
        new Date();

    const localDate =
        [
            today.getFullYear(),
            String(
                today.getMonth() + 1
            ).padStart(2, '0'),
            String(
                today.getDate()
            ).padStart(2, '0')
        ].join('-');

    createForm.elements.unit_joined_at.value =
        localDate;

    createRankField.hidden = true;

    populateCreateRankDropdown('');
    populateCreateCallsigns();
    updateCreateAssignmentPreview();

    createDialog.showModal();
}

async function load() {
    const [
        accountsResponse,
        slotsResponse
    ] = await Promise.all([
        supabase.rpc('get_admin_accounts'),

        supabase
            .from('orbat_slots')
            .select(`
                callsign,
                section_key,
                section_title,
                section_subtitle,
                default_role,
                default_branch,
                sort_order,
                active
            `)
            .eq('active', true)
            .order('sort_order')
    ]);

    if (accountsResponse.error) {
        throw accountsResponse.error;
    }

    if (slotsResponse.error) {
        throw slotsResponse.error;
    }

    people = accountsResponse.data || [];
    slots = slotsResponse.data || [];

    render();
}

function render() {
    const query = search.value
        .trim()
        .toLowerCase();

    rows.innerHTML = '';

    const filtered = people.filter(person => {
        if (!query) {
            return true;
        }

        return JSON.stringify(person)
            .toLowerCase()
            .includes(query);
    });

    for (const person of filtered) {
        const branch = person.branch || '';
        const personRank = getRank(person);

        const name = [
            person.fictional_first_name,
            person.fictional_last_name
        ]
            .filter(Boolean)
            .join(' ') || 'Unnamed';

        const assignment = [
            person.team,
            person.billet
        ]
            .filter(Boolean);

        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td>
                <b>${esc(name)}</b>
                <br>
                <span class="muted">
                    ${esc(person.email || '')}
                </span>
            </td>

            <td>
                ${esc(person.callsign || '—')}
            </td>

            <td>
                ${esc(branch || 'Unassigned')}
                <br>
                <span class="muted">
                    ${esc(personRank || 'Unassigned')}
                </span>
            </td>

            <td>
                ${esc(assignment[0] || '—')}
                <br>
                <span class="muted">
                    ${esc(assignment[1] || 'Unassigned')}
                </span>
            </td>

            <td>
                ${esc(person.leadership_level || 'Member')}
            </td>

            <td>
                <span class="status ${esc(person.account_status || '')}">
                    ${esc(person.account_status || 'unknown')}
                </span>
            </td>

            <td>
                <button class="button" type="button">
                    Edit
                </button>
            </td>
        `;

        tr.querySelector('button').addEventListener(
            'click',
            () => openEdit(person)
        );

        rows.appendChild(tr);
    }
}

function populateCallsigns(person) {
    const select = form.elements.callsign;

    select.innerHTML = '';

    const unassigned = document.createElement('option');

    unassigned.value = '';
    unassigned.textContent = 'Unassigned';

    select.appendChild(unassigned);

    for (const slot of slots) {
        const occupant = people.find(other =>
            other.callsign === slot.callsign &&
            other.id !== person.id
        );

        const option = document.createElement('option');

        option.value = slot.callsign;

        const role = slot.default_role
            ? ` - ${slot.default_role}`
            : '';

        option.textContent =
            occupant
                ? `${slot.callsign}${role} - OCCUPIED`
                : `${slot.callsign}${role}`;

        option.disabled = Boolean(occupant);

        select.appendChild(option);
    }

    select.value = person.callsign || '';
}

function openEdit(person) {
    current = person;

    const fields = form.elements;

    fields.first.value =
        person.fictional_first_name || '';

    fields.last.value =
        person.fictional_last_name || '';

    fields.email.value =
        person.email || '';

    populateCallsigns(person);

    updateBranchAndRank(person);
    updateAssignmentPreview();

    fields.leadership.value =
        person.leadership_level || 'Member';

    fields.status.value =
        person.account_status || 'active';

    fields.admin.value =
        String(Boolean(person.is_admin));

    fields.cadre.value =
        String(Boolean(person.is_cadre));

    fields.candidate.value =
        String(Boolean(person.is_candidate));

    message.textContent = '';

    dialog.showModal();
}

form.elements.callsign.addEventListener(
    'change',
    updateAssignmentPreview
);

form.addEventListener('submit', async event => {
    event.preventDefault();

    if (!current) {
        return;
    }

    message.textContent = '';

    const fields = form.elements;

const args = {
    p_id: current.id,

    p_callsign:
        fields.callsign.value || null,

    p_branch:
        fields.branch.value || null,

    p_rank:
        fields.rank.value || null,

    p_leadership_level:
        fields.leadership.value,

    p_is_admin:
        fields.admin.value === 'true',

    p_is_cadre:
        fields.cadre.value === 'true',

    p_is_candidate:
        fields.candidate.value === 'true',

    p_account_status:
        fields.status.value
};

    const { error } = await supabase.rpc(
        'admin_update_account',
        args
    );

    if (error) {
        message.textContent = error.message;
        return;
    }

    dialog.close();

    await load();
});

document
    .getElementById('cancel')
    .addEventListener('click', () => {
        dialog.close();
    });

createButton.addEventListener(
    'click',
    openCreateAccount
);

createCancel.addEventListener(
    'click',
    () => {
        createDialog.close();
    }
);

createForm.elements.branch.addEventListener(
    'change',
    () => {
        const branch =
            createForm.elements.branch.value;

        if (!branch) {
            createRankField.hidden =
                true;

            populateCreateRankDropdown('');

            return;
        }

        createRankField.hidden =
            false;

        createRankLabel.textContent =
            `${branch} Rank`;

        populateCreateRankDropdown(
            branch
        );
    }
);

createForm.elements.callsign.addEventListener(
    'change',
    updateCreateAssignmentPreview
);

createForm.addEventListener(
    'submit',
    async event => {
        event.preventDefault();

        createMessage.textContent = '';

        const fields =
            createForm.elements;

        const submitButton =
            createForm.querySelector(
                'button[type="submit"]'
            );

        submitButton.disabled = true;
        submitButton.textContent =
            'Creating...';

        try {
            const {
                data,
                error
            } =
                await supabase.functions.invoke(
                    'create-personnel-account',
                    {
                        body: {
                            first_name:
                                fields.first.value
                                    .trim(),

                            last_name:
                                fields.last.value
                                    .trim(),

                            email:
                                fields.email.value
                                    .trim()
                                    .toLowerCase(),

                            password:
                                fields.password.value,

                            is_candidate:
                                fields.candidate.value ===
                                'true',

                            branch:
                                fields.branch.value ||
                                null,

                            rank:
                                fields.rank.value ||
                                null,

                            callsign:
                                fields.callsign.value ||
                                null,

                            leadership_level:
                                fields.leadership.value,

                            account_status:
                                fields.status.value,

                            is_admin:
                                fields.admin.value ===
                                'true',

                            is_cadre:
                                fields.cadre.value ===
                                'true',

                            unit_joined_at:
                                fields.unit_joined_at.value ||
                                null,

                            timezone:
                                Intl.DateTimeFormat()
                                    .resolvedOptions()
                                    .timeZone ||
                                null
                        }
                    }
                );

            if (error) {
                let errorMessage =
                    error.message ||
                    'Account creation failed.';

                if (
                    error.context &&
                    typeof error.context.json ===
                    'function'
                ) {
                    try {
                        const response =
                            await error.context.json();

                        if (response?.error) {
                            errorMessage =
                                response.error;
                        }
                    } catch {
                    }
                }

                throw new Error(
                    errorMessage
                );
            }

            if (
                !data?.ok &&
                !data?.success
            ) {
                throw new Error(
                    data?.error ||
                    'Account creation failed.'
                );
            }

            createDialog.close();

            await load();
        } catch (error) {
            console.error(
                'Create account failed:',
                error
            );

            createMessage.textContent =
                error?.message ||
                'Account creation failed.';
        } finally {
            submitButton.disabled = false;

            submitButton.textContent =
                'Create Account';
        }
    }
);

search.addEventListener(
    'input',
    render
);

await load();