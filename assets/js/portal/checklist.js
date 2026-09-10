import {
    supabase,
    requireSession,
    displayName,
    rankFor,
    formatDate,
    formatDateTime,
    esc
} from './shell.js';


const state = {
    account: null,
    canManage: false,
    mode: null,

    people: [],
    greenItems: [],
    greenProgress: [],

    cycles: [],
    cycleId: null,
    cycleItems: [],
    cycleProgress: [],

    library: [],
    unitPersonnel: [],

    selectedPerson: null
};


const greenModeButton =
    document.getElementById('green-mode-button');

const deploymentModeButton =
    document.getElementById('deployment-mode-button');

const deploymentControls =
    document.getElementById('deployment-controls');

const createCycleButton =
    document.getElementById('create-cycle-button');

const cycleSelect =
    document.getElementById('cycle-select');

const searchInput =
    document.getElementById('checklist-search');

const teamFilter =
    document.getElementById('checklist-team-filter');

const statusFilter =
    document.getElementById('checklist-status-filter');

const sortSelect =
    document.getElementById('checklist-sort');

const personnelGrid =
    document.getElementById('personnel-grid');

const emptyState =
    document.getElementById('checklist-empty');

const message =
    document.getElementById('checklist-message');


const summaryTitle =
    document.getElementById('summary-title');

const summarySubtitle =
    document.getElementById('summary-subtitle');

const summaryPersonnel =
    document.getElementById('summary-personnel');

const summaryCompleted =
    document.getElementById('summary-completed');

const summaryPercent =
    document.getElementById('summary-percent');

const summaryProgressBar =
    document.getElementById('summary-progress-bar');


const detailDialog =
    document.getElementById('personnel-checklist-dialog');

const detailClose =
    document.getElementById('detail-close');

const detailEyebrow =
    document.getElementById('detail-eyebrow');

const detailName =
    document.getElementById('detail-name');

const detailMeta =
    document.getElementById('detail-meta');

const detailPercent =
    document.getElementById('detail-percent');

const detailProgressBar =
    document.getElementById('detail-progress-bar');

const detailCount =
    document.getElementById('detail-count');

const detailGroups =
    document.getElementById('detail-groups');


const createCycleDialog =
    document.getElementById('create-cycle-dialog');

const createCycleForm =
    document.getElementById('create-cycle-form');

const createCycleCancel =
    document.getElementById('create-cycle-cancel');

const createCycleMessage =
    document.getElementById('create-cycle-message');

const memberList =
    document.getElementById('cycle-member-list');

const libraryHost =
    document.getElementById('cycle-library');

const customItemList =
    document.getElementById('custom-item-list');


function progressPercent(completed, total) {
    if (!total) {
        return 0;
    }

    return Math.round(
        (completed / total) * 100
    );
}


function progressState(percent) {
    if (percent <= 0) {
        return 'not-started';
    }

    if (percent >= 100) {
        return 'complete';
    }

    return 'in-progress';
}


function personName(person) {
    return displayName(person);
}


function personMeta(person) {
    const parts = [];

    if (person.callsign) {
        parts.push(person.callsign);
    }

    if (person.team) {
        parts.push(person.team);
    }

    if (person.billet) {
        parts.push(person.billet);
    }

    return parts.join(' // ') || 'Unassigned';
}


function getCurrentItems() {
    return state.mode === 'green'
        ? state.greenItems
        : state.cycleItems;
}


function getCurrentProgress() {
    return state.mode === 'green'
        ? state.greenProgress
        : state.cycleProgress;
}


function progressKey(progress) {
    return state.mode === 'green'
        ? progress.pipeline_item_id
        : progress.cycle_item_id;
}


function itemKey(item) {
    return state.mode === 'green'
        ? item.pipeline_item_id
        : item.id;
}


function personProgress(personId) {
    const items =
        getCurrentItems();

    const progress =
        getCurrentProgress();

    const completed =
        progress.filter(entry =>
            entry.user_id === personId &&
            items.some(item =>
                itemKey(item) ===
                progressKey(entry)
            )
        ).length;

    return {
        completed,
        total: items.length,
        percent: progressPercent(
            completed,
            items.length
        )
    };
}


function findProgress(personId, itemId) {
    return getCurrentProgress().find(entry =>
        entry.user_id === personId &&
        progressKey(entry) === itemId
    );
}


function setProgressBar(element, percent) {
    element.style.width =
        `${Math.max(
            0,
            Math.min(100, percent)
        )}%`;
}


function canSeeGreen() {
    return (
        state.canManage ||
        state.account.is_candidate === true
    );
}


function canSeeDeployment() {
    return (
        state.canManage ||
        state.account.is_candidate === false
    );
}


async function getManagementState() {
    const {
        data,
        error
    } = await supabase.rpc(
        'checklist_can_manage',
        {
            p_user:
                state.account.id
        }
    );

    if (error) {
        throw error;
    }

    state.canManage =
        Boolean(data);
}


async function loadGreenDefinition() {
    const {
        data,
        error
    } = await supabase.rpc(
        'checklist_get_green_items'
    );

    if (error) {
        throw error;
    }

    state.greenItems =
        data || [];
}


async function loadGreen() {
    const [
        peopleResult,
        progressResult
    ] = await Promise.all([
        supabase.rpc(
            'checklist_get_people',
            {
                p_mode: 'green',
                p_cycle_id: null
            }
        ),

        supabase.rpc(
            'checklist_get_green_progress'
        )
    ]);

    if (peopleResult.error) {
        throw peopleResult.error;
    }

    if (progressResult.error) {
        throw progressResult.error;
    }

    state.people =
        peopleResult.data || [];

    state.greenProgress =
        progressResult.data || [];

    updateTeamFilter();
    render();
}


async function loadCycles() {
    const {
        data,
        error
    } = await supabase.rpc(
        'checklist_get_cycles'
    );

    if (error) {
        throw error;
    }

    state.cycles =
        data || [];

    renderCycleSelect();
}


function renderCycleSelect() {
    const previous =
        state.cycleId;

    cycleSelect.innerHTML = '';

    if (!state.cycles.length) {
        const option =
            document.createElement('option');

        option.value = '';
        option.textContent =
            'No Deployment Cycles';

        cycleSelect.appendChild(option);

        state.cycleId = null;

        return;
    }

    for (const cycle of state.cycles) {
        const option =
            document.createElement('option');

        option.value =
            cycle.id;

        const status =
            cycle.status
                .replace(/_/g, ' ')
                .toUpperCase();

        option.textContent =
            `${cycle.name} // ${status}`;

        cycleSelect.appendChild(option);
    }

    const exists =
        state.cycles.some(cycle =>
            cycle.id === previous
        );

    state.cycleId =
        exists
            ? previous
            : state.cycles[0].id;

    cycleSelect.value =
        state.cycleId;
}


async function loadDeploymentCycle() {
    if (!state.cycleId) {
        state.people = [];
        state.cycleItems = [];
        state.cycleProgress = [];

        updateTeamFilter();
        render();

        return;
    }

    const [
        peopleResult,
        itemsResult,
        progressResult
    ] = await Promise.all([
        supabase.rpc(
            'checklist_get_people',
            {
                p_mode: 'deployment',
                p_cycle_id:
                    state.cycleId
            }
        ),

        supabase.rpc(
            'checklist_get_cycle_items',
            {
                p_cycle_id:
                    state.cycleId
            }
        ),

        supabase.rpc(
            'checklist_get_cycle_progress',
            {
                p_cycle_id:
                    state.cycleId
            }
        )
    ]);

    if (peopleResult.error) {
        throw peopleResult.error;
    }

    if (itemsResult.error) {
        throw itemsResult.error;
    }

    if (progressResult.error) {
        throw progressResult.error;
    }

    state.people =
        peopleResult.data || [];

    state.cycleItems =
        itemsResult.data || [];

    state.cycleProgress =
        progressResult.data || [];

    updateTeamFilter();
    render();
}


async function setMode(mode) {
    if (
        mode === 'green' &&
        !canSeeGreen()
    ) {
        return;
    }

    if (
        mode === 'deployment' &&
        !canSeeDeployment()
    ) {
        return;
    }

    state.mode = mode;

    greenModeButton.classList.toggle(
        'active',
        mode === 'green'
    );

    deploymentModeButton.classList.toggle(
        'active',
        mode === 'deployment'
    );

    deploymentControls.hidden =
        mode !== 'deployment';

    searchInput.value = '';
    teamFilter.value = '';
    statusFilter.value = '';
    sortSelect.value =
        'progress-asc';

    message.textContent = '';

    if (mode === 'green') {
        await loadGreen();

        return;
    }

    await loadCycles();

    if (state.cycleId) {
        await loadDeploymentCycle();
    } else {
        state.people = [];
        state.cycleItems = [];
        state.cycleProgress = [];

        updateTeamFilter();
        render();
    }
}


function updateTeamFilter() {
    const current =
        teamFilter.value;

    const teams = [
        ...new Set(
            state.people
                .map(person =>
                    person.team
                )
                .filter(Boolean)
        )
    ].sort(
        (a, b) =>
            a.localeCompare(b)
    );

    teamFilter.innerHTML = '';

    const all =
        document.createElement('option');

    all.value = '';

    all.textContent =
        state.mode === 'green'
            ? 'All Green Team'
            : 'Full Team';

    teamFilter.appendChild(all);

    for (const team of teams) {
        const option =
            document.createElement('option');

        option.value = team;
        option.textContent = team;

        teamFilter.appendChild(option);
    }

    if (teams.includes(current)) {
        teamFilter.value = current;
    }
}


function filteredPeople() {
    const search =
        searchInput.value
            .trim()
            .toLowerCase();

    const team =
        teamFilter.value;

    const requiredState =
        statusFilter.value;

    let people =
        state.people.filter(person => {
            const progress =
                personProgress(
                    person.id
                );

            const status =
                progressState(
                    progress.percent
                );

            const haystack = [
                personName(person),
                person.callsign,
                person.team,
                person.billet,
                person.branch,
                rankFor(person)
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            if (
                search &&
                !haystack.includes(search)
            ) {
                return false;
            }

            if (
                team &&
                person.team !== team
            ) {
                return false;
            }

            if (
                requiredState &&
                status !== requiredState
            ) {
                return false;
            }

            return true;
        });

    const sort =
        sortSelect.value;

    people.sort(
        (a, b) => {
            const aProgress =
                personProgress(a.id);

            const bProgress =
                personProgress(b.id);

            if (
                sort ===
                'progress-asc'
            ) {
                return (
                    aProgress.percent -
                    bProgress.percent
                );
            }

            if (
                sort ===
                'progress-desc'
            ) {
                return (
                    bProgress.percent -
                    aProgress.percent
                );
            }

            if (
                sort ===
                'name-desc'
            ) {
                return personName(b)
                    .localeCompare(
                        personName(a)
                    );
            }

            if (
                sort ===
                'callsign'
            ) {
                return String(
                    a.callsign || ''
                ).localeCompare(
                    String(
                        b.callsign || ''
                    )
                );
            }

            if (
                sort ===
                'team'
            ) {
                return String(
                    a.team || ''
                ).localeCompare(
                    String(
                        b.team || ''
                    )
                );
            }

            return personName(a)
                .localeCompare(
                    personName(b)
                );
        }
    );

    return people;
}


function blockBreakdown(personId) {
    if (state.mode !== 'green') {
        return [];
    }

    const blocks =
        new Map();

    for (
        const item
        of state.greenItems
    ) {
        if (
            !blocks.has(
                item.block_name
            )
        ) {
            blocks.set(
                item.block_name,
                {
                    name:
                        item.block_name,

                    order:
                        item.block_order,

                    total: 0,
                    completed: 0
                }
            );
        }

        const block =
            blocks.get(
                item.block_name
            );

        block.total += 1;

        if (
            findProgress(
                personId,
                item.pipeline_item_id
            )
        ) {
            block.completed += 1;
        }
    }

    return [
        ...blocks.values()
    ].sort(
        (a, b) =>
            a.order - b.order
    );
}


function renderPersonCard(person) {
    const progress =
        personProgress(
            person.id
        );

    const status =
        progressState(
            progress.percent
        );

    const card =
        document.createElement(
            'article'
        );

    card.className =
        'checklist-person-card';

    const breakdown =
        blockBreakdown(
            person.id
        );

    card.innerHTML = `
        <div class="checklist-person-head">

            <div>

                <span class="checklist-person-type">
                    ${
                        state.mode === 'green'
                            ? 'Green Team Candidate'
                            : esc(
                                person.team ||
                                'Unit Personnel'
                            )
                    }
                </span>

                <strong>
                    ${esc(personName(person))}
                </strong>

                <span>
                    ${esc(personMeta(person))}
                </span>

            </div>

            <div class="checklist-person-percent ${status}">
                ${progress.percent}%
            </div>

        </div>

        <div class="checklist-progress-track">

            <div
                class="checklist-progress-fill"
                style="width:${progress.percent}%"
            ></div>

        </div>

        <div class="checklist-person-count">

            <span>
                ${progress.completed} / ${progress.total}
                complete
            </span>

            <strong class="${status}">
                ${
                    status === 'complete'
                        ? 'Complete'
                        : status === 'not-started'
                            ? 'Not Started'
                            : 'In Progress'
                }
            </strong>

        </div>

        ${
            breakdown.length
                ? `
                    <div class="checklist-card-blocks">

                        ${breakdown.map(
                            block => {
                                const percent =
                                    progressPercent(
                                        block.completed,
                                        block.total
                                    );

                                return `
                                    <div>
                                        <span>
                                            ${esc(block.name)}
                                        </span>

                                        <strong>
                                            ${block.completed}
                                            /
                                            ${block.total}
                                        </strong>

                                        <small>
                                            ${percent}%
                                        </small>
                                    </div>
                                `;
                            }
                        ).join('')}

                    </div>
                `
                : ''
        }

        <div class="checklist-card-footer">

            <button
                class="secondary-button"
                type="button"
            >
                Open Checklist
            </button>

        </div>
    `;

    card
        .querySelector('button')
        .addEventListener(
            'click',
            () => openPerson(
                person
            )
        );

    return card;
}


function renderSummary(
    visiblePeople
) {
    const items =
        getCurrentItems();

    let completed = 0;

    for (
        const person
        of visiblePeople
    ) {
        completed +=
            personProgress(
                person.id
            ).completed;
    }

    const total =
        visiblePeople.length *
        items.length;

    const percent =
        progressPercent(
            completed,
            total
        );

    summaryPersonnel.textContent =
        String(
            visiblePeople.length
        );

    summaryCompleted.textContent =
        `${completed} / ${total}`;

    summaryPercent.textContent =
        `${percent}%`;

    setProgressBar(
        summaryProgressBar,
        percent
    );

    if (
        state.mode === 'green'
    ) {
        summaryTitle.textContent =
            'Green Team Pipeline';

        summarySubtitle.textContent =
            'Introduction through Block 4';

        return;
    }

    const cycle =
        state.cycles.find(
            item =>
                item.id ===
                state.cycleId
        );

    summaryTitle.textContent =
        cycle?.name ||
        'Pre-Deployment Cycle';

    if (!cycle) {
        summarySubtitle.textContent =
            'No active cycle selected';

        return;
    }

    const dates = [];

    if (cycle.starts_on) {
        dates.push(
            formatDate(
                cycle.starts_on
            )
        );
    }

    if (cycle.ends_on) {
        dates.push(
            formatDate(
                cycle.ends_on
            )
        );
    }

    summarySubtitle.textContent =
        [
            cycle.status
                .toUpperCase(),
            dates.join(' - ')
        ]
            .filter(Boolean)
            .join(' // ');
}


function render() {
    const people =
        filteredPeople();

    personnelGrid.innerHTML =
        '';

    for (
        const person
        of people
    ) {
        personnelGrid.appendChild(
            renderPersonCard(
                person
            )
        );
    }

    emptyState.hidden =
        people.length > 0;

    renderSummary(
        people
    );
}


function groupGreenItems() {
    const blocks =
        new Map();

    for (
        const item
        of state.greenItems
    ) {
        if (
            !blocks.has(
                item.block_name
            )
        ) {
            blocks.set(
                item.block_name,
                {
                    name:
                        item.block_name,

                    order:
                        item.block_order,

                    groups:
                        new Map()
                }
            );
        }

        const block =
            blocks.get(
                item.block_name
            );

        if (
            !block.groups.has(
                item.group_name
            )
        ) {
            block.groups.set(
                item.group_name,
                {
                    name:
                        item.group_name,

                    order:
                        item.group_order,

                    items: []
                }
            );
        }

        block.groups
            .get(
                item.group_name
            )
            .items
            .push(item);
    }

    return [
        ...blocks.values()
    ]
        .sort(
            (a, b) =>
                a.order -
                b.order
        )
        .map(block => ({
            ...block,

            groups: [
                ...block.groups.values()
            ].sort(
                (a, b) =>
                    a.order -
                    b.order
            )
        }));
}


function groupCycleItems() {
    const groups =
        new Map();

    for (
        const item
        of state.cycleItems
    ) {
        const name =
            item.module_name ||
            'Custom';

        if (
            !groups.has(name)
        ) {
            groups.set(
                name,
                {
                    name,
                    items: []
                }
            );
        }

        groups.get(name)
            .items
            .push(item);
    }

    return [
        ...groups.values()
    ];
}


function renderRequirement(
    person,
    item
) {
    const id =
        itemKey(item);

    const progress =
        findProgress(
            person.id,
            id
        );

    const completed =
        Boolean(progress);

    const row =
        document.createElement(
            'div'
        );

    row.className =
        `checklist-requirement${
            completed
                ? ' complete'
                : ''
        }`;

    let displayTitle =
        state.mode === 'green'
            ? item.item_title
            : item.title;

    if (
        displayTitle ===
        'Block 1 Board Review' ||
        displayTitle ===
        'Block 2 Board Review' ||
        displayTitle ===
        'Block 3 Board Review' ||
        displayTitle ===
        'Block 4 Board Review'
    ) {
        displayTitle =
            'Board Review';
    }

    const location =
        state.mode === 'green'
            ? item.location
            : item.location;

    row.innerHTML = `
        <label class="checklist-check">

            <input
                type="checkbox"
                ${completed ? 'checked' : ''}
                ${state.canManage ? '' : 'disabled'}
            >

            <span class="checklist-check-box"></span>

        </label>

        <div class="checklist-requirement-copy">

            <strong>
                ${esc(displayTitle)}
            </strong>

            ${
                location
                    ? `
                        <span>
                            ${esc(location)}
                        </span>
                    `
                    : ''
            }

            ${
                progress
                    ? `
                        <small>
                            Completed
                            ${esc(
                                formatDateTime(
                                    progress.completed_at
                                )
                            )}
                            ${
                                progress.completed_by_name
                                    ? ` by ${esc(
                                        progress.completed_by_name
                                    )}`
                                    : ''
                            }
                        </small>
                    `
                    : `
                        <small>
                            Requirement outstanding
                        </small>
                    `
            }

        </div>

        <div class="checklist-requirement-state">
            ${completed ? 'Complete' : 'Pending'}
        </div>
    `;

    const checkbox =
        row.querySelector(
            'input'
        );

    if (state.canManage) {
        checkbox.addEventListener(
            'change',
            async () => {
                checkbox.disabled =
                    true;

                try {
                    if (
                        state.mode ===
                        'green'
                    ) {
                        const {
                            error
                        } =
                            await supabase.rpc(
                                'checklist_set_green_item',
                                {
                                    p_user_id:
                                        person.id,

                                    p_pipeline_item_id:
                                        id,

                                    p_complete:
                                        checkbox.checked,

                                    p_notes:
                                        ''
                                }
                            );

                        if (error) {
                            throw error;
                        }

                        await loadGreen();
                    } else {
                        const {
                            error
                        } =
                            await supabase.rpc(
                                'checklist_set_cycle_item',
                                {
                                    p_user_id:
                                        person.id,

                                    p_cycle_item_id:
                                        id,

                                    p_complete:
                                        checkbox.checked,

                                    p_notes:
                                        ''
                                }
                            );

                        if (error) {
                            throw error;
                        }

                        await loadDeploymentCycle();
                    }

                    const refreshed =
                        state.people.find(
                            item =>
                                item.id ===
                                person.id
                        );

                    if (refreshed) {
                        openPerson(
                            refreshed,
                            true
                        );
                    }
                } catch (error) {
                    checkbox.checked =
                        !checkbox.checked;

                    message.textContent =
                        error.message ||
                        'Checklist update failed.';
                } finally {
                    checkbox.disabled =
                        false;
                }
            }
        );
    }

    return row;
}


function openPerson(
    person,
    refresh = false
) {
    state.selectedPerson =
        person;

    detailEyebrow.textContent =
        state.mode === 'green'
            ? 'Green Team Pipeline'
            : 'Pre-Deployment Cycle';

    detailName.textContent =
        personName(person);

    detailMeta.textContent =
        personMeta(person);

    const progress =
        personProgress(
            person.id
        );

    detailPercent.textContent =
        `${progress.percent}%`;

    detailCount.textContent =
        `${progress.completed} / ${progress.total} requirements completed`;

    setProgressBar(
        detailProgressBar,
        progress.percent
    );

    detailGroups.innerHTML =
        '';

    if (
        state.mode === 'green'
    ) {
        const blocks =
            groupGreenItems();

        for (
            const block
            of blocks
        ) {
            const blockItems =
                block.groups
                    .flatMap(
                        group =>
                            group.items
                    );

            const blockCompleted =
                blockItems.filter(
                    item =>
                        findProgress(
                            person.id,
                            item.pipeline_item_id
                        )
                ).length;

            const blockPercent =
                progressPercent(
                    blockCompleted,
                    blockItems.length
                );

            const section =
                document.createElement(
                    'section'
                );

            section.className =
                'checklist-detail-block';

            section.innerHTML = `
                <div class="checklist-detail-block-head">

                    <div>

                        <strong>
                            ${esc(block.name)}
                        </strong>

                        <span>
                            ${blockCompleted}
                            /
                            ${blockItems.length}
                            requirements
                        </span>

                    </div>

                    <b>
                        ${blockPercent}%
                    </b>

                </div>

                <div class="checklist-progress-track">

                    <div
                        class="checklist-progress-fill"
                        style="width:${blockPercent}%"
                    ></div>

                </div>

                <div class="checklist-detail-group-host"></div>
            `;

            const groupHost =
                section.querySelector(
                    '.checklist-detail-group-host'
                );

            for (
                const group
                of block.groups
            ) {
                const groupElement =
                    document.createElement(
                        'div'
                    );

                groupElement.className =
                    'checklist-detail-group';

                const completed =
                    group.items.filter(
                        item =>
                            findProgress(
                                person.id,
                                item.pipeline_item_id
                            )
                    ).length;

                groupElement.innerHTML = `
                    <div class="checklist-detail-group-head">

                        <strong>
                            ${esc(group.name)}
                        </strong>

                        <span>
                            ${completed}
                            /
                            ${group.items.length}
                        </span>

                    </div>

                    <div class="checklist-requirements"></div>
                `;

                const requirements =
                    groupElement.querySelector(
                        '.checklist-requirements'
                    );

                for (
                    const item
                    of group.items
                ) {
                    requirements.appendChild(
                        renderRequirement(
                            person,
                            item
                        )
                    );
                }

                groupHost.appendChild(
                    groupElement
                );
            }

            detailGroups.appendChild(
                section
            );
        }
    } else {
        const groups =
            groupCycleItems();

        for (
            const group
            of groups
        ) {
            const completed =
                group.items.filter(
                    item =>
                        findProgress(
                            person.id,
                            item.id
                        )
                ).length;

            const section =
                document.createElement(
                    'section'
                );

            section.className =
                'checklist-detail-block';

            const percent =
                progressPercent(
                    completed,
                    group.items.length
                );

            section.innerHTML = `
                <div class="checklist-detail-block-head">

                    <div>

                        <strong>
                            ${esc(group.name)}
                        </strong>

                        <span>
                            ${completed}
                            /
                            ${group.items.length}
                            requirements
                        </span>

                    </div>

                    <b>
                        ${percent}%
                    </b>

                </div>

                <div class="checklist-progress-track">

                    <div
                        class="checklist-progress-fill"
                        style="width:${percent}%"
                    ></div>

                </div>

                <div class="checklist-requirements"></div>
            `;

            const requirements =
                section.querySelector(
                    '.checklist-requirements'
                );

            for (
                const item
                of group.items
            ) {
                requirements.appendChild(
                    renderRequirement(
                        person,
                        item
                    )
                );
            }

            detailGroups.appendChild(
                section
            );
        }
    }

    if (
        !refresh ||
        !detailDialog.open
    ) {
        detailDialog.showModal();
    }
}


async function loadCreateCycleData() {
    if (
        state.library.length &&
        state.unitPersonnel.length
    ) {
        return;
    }

    const [
        libraryResult,
        personnelResult
    ] = await Promise.all([
        supabase.rpc(
            'checklist_get_library'
        ),

        supabase.rpc(
            'checklist_get_unit_personnel'
        )
    ]);

    if (libraryResult.error) {
        throw libraryResult.error;
    }

    if (personnelResult.error) {
        throw personnelResult.error;
    }

    state.library =
        libraryResult.data || [];

    state.unitPersonnel =
        personnelResult.data || [];
}


function renderCycleMembers() {
    memberList.innerHTML =
        '';

    for (
        const person
        of state.unitPersonnel
    ) {
        const label =
            document.createElement(
                'label'
            );

        label.className =
            'checklist-selection-item';

        label.innerHTML = `
            <input
                type="checkbox"
                name="cycle-member"
                value="${esc(person.id)}"
            >

            <span>

                <strong>
                    ${esc(
                        personName(
                            person
                        )
                    )}
                </strong>

                <small>
                    ${esc(
                        [
                            person.callsign,
                            person.team,
                            person.billet
                        ]
                            .filter(Boolean)
                            .join(' // ') ||
                        'Unassigned'
                    )}
                </small>

            </span>
        `;

        memberList.appendChild(
            label
        );
    }
}


function libraryByModule() {
    const modules =
        new Map();

    for (
        const item
        of state.library
    ) {
        if (
            !modules.has(
                item.module_name
            )
        ) {
            modules.set(
                item.module_name,
                {
                    name:
                        item.module_name,

                    order:
                        item.module_order,

                    items: []
                }
            );
        }

        modules
            .get(
                item.module_name
            )
            .items
            .push(item);
    }

    return [
        ...modules.values()
    ].sort(
        (a, b) =>
            a.order -
            b.order
    );
}


function renderCycleLibrary() {
    libraryHost.innerHTML =
        '';

    for (
        const module
        of libraryByModule()
    ) {
        const section =
            document.createElement(
                'section'
            );

        section.className =
            'checklist-library-module';

        section.innerHTML = `
            <div class="checklist-library-module-head">

                <label>

                    <input
                        type="checkbox"
                        class="module-toggle"
                    >

                    <strong>
                        ${esc(module.name)}
                    </strong>

                </label>

                <span>
                    ${module.items.length}
                    item${
                        module.items.length === 1
                            ? ''
                            : 's'
                    }
                </span>

            </div>

            <div class="checklist-library-items"></div>
        `;

        const host =
            section.querySelector(
                '.checklist-library-items'
            );

        const moduleToggle =
            section.querySelector(
                '.module-toggle'
            );

        for (
            const item
            of module.items
        ) {
            const label =
                document.createElement(
                    'label'
                );

            label.className =
                'checklist-library-item';

            label.innerHTML = `
                <input
                    type="checkbox"
                    name="cycle-library-item"
                    value="${esc(item.item_id)}"
                >

                <span>

                    <strong>
                        ${esc(item.title)}
                    </strong>

                    ${
                        item.location
                            ? `
                                <small>
                                    ${esc(item.location)}
                                </small>
                            `
                            : ''
                    }

                </span>
            `;

            host.appendChild(
                label
            );
        }

        const itemCheckboxes =
            [
                ...host.querySelectorAll(
                    'input[type="checkbox"]'
                )
            ];

        moduleToggle.addEventListener(
            'change',
            () => {
                for (
                    const checkbox
                    of itemCheckboxes
                ) {
                    checkbox.checked =
                        moduleToggle.checked;
                }
            }
        );

        for (
            const checkbox
            of itemCheckboxes
        ) {
            checkbox.addEventListener(
                'change',
                () => {
                    moduleToggle.checked =
                        itemCheckboxes.every(
                            item =>
                                item.checked
                        );

                    moduleToggle.indeterminate =
                        !moduleToggle.checked &&
                        itemCheckboxes.some(
                            item =>
                                item.checked
                        );
                }
            );
        }

        libraryHost.appendChild(
            section
        );
    }
}


function addCustomItem(
    module = '',
    title = '',
    location = ''
) {
    const row =
        document.createElement(
            'div'
        );

    row.className =
        'checklist-custom-item';

    row.innerHTML = `
        <input
            class="custom-module"
            type="text"
            placeholder="Module"
            maxlength="80"
            value="${esc(module)}"
        >

        <input
            class="custom-title"
            type="text"
            placeholder="Requirement"
            maxlength="160"
            value="${esc(title)}"
        >

        <input
            class="custom-location"
            type="text"
            placeholder="Location"
            maxlength="160"
            value="${esc(location)}"
        >

        <button
            class="danger-button"
            type="button"
        >
            Remove
        </button>
    `;

    row
        .querySelector('button')
        .addEventListener(
            'click',
            () => row.remove()
        );

    customItemList.appendChild(
        row
    );
}


async function openCreateCycle() {
    createCycleMessage.textContent =
        '';

    try {
        await loadCreateCycleData();

        createCycleForm.reset();

        renderCycleMembers();
        renderCycleLibrary();

        customItemList.innerHTML =
            '';

        createCycleDialog.showModal();
    } catch (error) {
        message.textContent =
            error.message ||
            'Unable to load cycle creator.';
    }
}


function selectedValues(name) {
    return [
        ...createCycleForm
            .querySelectorAll(
                `input[name="${name}"]:checked`
            )
    ].map(
        input =>
            input.value
    );
}


function customItems() {
    return [
        ...customItemList
            .querySelectorAll(
                '.checklist-custom-item'
            )
    ]
        .map(row => ({
            module:
                row
                    .querySelector(
                        '.custom-module'
                    )
                    .value
                    .trim(),

            title:
                row
                    .querySelector(
                        '.custom-title'
                    )
                    .value
                    .trim(),

            location:
                row
                    .querySelector(
                        '.custom-location'
                    )
                    .value
                    .trim()
        }))
        .filter(
            item =>
                item.title
        );
}


greenModeButton.addEventListener(
    'click',
    async () => {
        try {
            await setMode(
                'green'
            );
        } catch (error) {
            message.textContent =
                error.message;
        }
    }
);


deploymentModeButton.addEventListener(
    'click',
    async () => {
        try {
            await setMode(
                'deployment'
            );
        } catch (error) {
            message.textContent =
                error.message;
        }
    }
);


cycleSelect.addEventListener(
    'change',
    async () => {
        state.cycleId =
            cycleSelect.value ||
            null;

        try {
            await loadDeploymentCycle();
        } catch (error) {
            message.textContent =
                error.message;
        }
    }
);


for (
    const control
    of [
        searchInput,
        teamFilter,
        statusFilter,
        sortSelect
    ]
) {
    control.addEventListener(
        control === searchInput
            ? 'input'
            : 'change',
        render
    );
}


detailClose.addEventListener(
    'click',
    () => {
        detailDialog.close();
    }
);


createCycleButton.addEventListener(
    'click',
    openCreateCycle
);


createCycleCancel.addEventListener(
    'click',
    () => {
        createCycleDialog.close();
    }
);


document
    .getElementById(
        'select-all-members'
    )
    .addEventListener(
        'click',
        () => {
            memberList
                .querySelectorAll(
                    'input[type="checkbox"]'
                )
                .forEach(
                    input =>
                        input.checked = true
                );
        }
    );


document
    .getElementById(
        'clear-members'
    )
    .addEventListener(
        'click',
        () => {
            memberList
                .querySelectorAll(
                    'input[type="checkbox"]'
                )
                .forEach(
                    input =>
                        input.checked = false
                );
        }
    );


document
    .getElementById(
        'select-all-items'
    )
    .addEventListener(
        'click',
        () => {
            libraryHost
                .querySelectorAll(
                    'input[type="checkbox"]'
                )
                .forEach(
                    input => {
                        input.checked =
                            true;

                        input.indeterminate =
                            false;
                    }
                );
        }
    );


document
    .getElementById(
        'clear-items'
    )
    .addEventListener(
        'click',
        () => {
            libraryHost
                .querySelectorAll(
                    'input[type="checkbox"]'
                )
                .forEach(
                    input => {
                        input.checked =
                            false;

                        input.indeterminate =
                            false;
                    }
                );
        }
    );


document
    .getElementById(
        'add-custom-item'
    )
    .addEventListener(
        'click',
        () => {
            addCustomItem();
        }
    );


createCycleForm.addEventListener(
    'submit',
    async event => {
        event.preventDefault();

        createCycleMessage.textContent =
            '';

        const fields =
            createCycleForm.elements;

        const members =
            selectedValues(
                'cycle-member'
            );

        const items =
            selectedValues(
                'cycle-library-item'
            );

        const custom =
            customItems();

        if (!members.length) {
            createCycleMessage.textContent =
                'Select at least one unit member.';

            return;
        }

        if (
            !items.length &&
            !custom.length
        ) {
            createCycleMessage.textContent =
                'Select or add at least one training requirement.';

            return;
        }

        const submit =
            createCycleForm.querySelector(
                'button[type="submit"]'
            );

        submit.disabled = true;
        submit.textContent =
            'Creating...';

        try {
            const {
                data,
                error
            } = await supabase.rpc(
                'checklist_create_cycle',
                {
                    p_name:
                        fields.name.value
                            .trim(),

                    p_starts_on:
                        fields.starts_on.value ||
                        null,

                    p_ends_on:
                        fields.ends_on.value ||
                        null,

                    p_member_ids:
                        members,

                    p_library_item_ids:
                        items,

                    p_custom_items:
                        custom
                }
            );

            if (error) {
                throw error;
            }

            createCycleDialog.close();

            state.cycleId =
                data;

            state.cycles = [];

            await loadCycles();

            state.cycleId =
                data;

            cycleSelect.value =
                data;

            await loadDeploymentCycle();
        } catch (error) {
            createCycleMessage.textContent =
                error.message ||
                'Cycle creation failed.';
        } finally {
            submit.disabled =
                false;

            submit.textContent =
                'Create Cycle';
        }
    }
);


async function initialize() {
    try {
        const {
            account
        } = await requireSession();

        state.account =
            account;

        await getManagementState();
        await loadGreenDefinition();

        greenModeButton.hidden =
            !canSeeGreen();

        deploymentModeButton.hidden =
            !canSeeDeployment();

        createCycleButton.hidden =
            !state.canManage;

        if (canSeeGreen()) {
            await setMode(
                'green'
            );
        } else {
            await setMode(
                'deployment'
            );
        }
    } catch (error) {
        console.error(
            'Checklist initialization failed:',
            error
        );

        message.textContent =
            error.message ||
            'Checklist could not be loaded.';
    }
}


await initialize();