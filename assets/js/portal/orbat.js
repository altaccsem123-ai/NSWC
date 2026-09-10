import {
    supabase,
    requireSession,
    displayName,
    esc
} from './shell.js';

await requireSession();

const status = document.getElementById('status');
const root = document.getElementById('orbat');

try {
    const { data, error } = await supabase.rpc('get_orbat');

    if (error) {
        throw error;
    }

    const rows = data || [];
    const sections = [];

    for (const row of rows) {
        if (
            !sections.some(
                section => section.key === row.section_key
            )
        ) {
            sections.push({
                key: row.section_key,
                title: row.section_title,
                subtitle: row.section_subtitle
            });
        }
    }

    root.innerHTML = '';

    for (const section of sections) {
        const column = document.createElement('section');

        column.className = 'orbat-column';

        column.innerHTML = `
            <div class="orbat-column-head">
                <strong>
                    ${esc(section.title)}
                </strong>

                <span>
                    ${esc(section.subtitle)}
                </span>
            </div>
        `;

        const sectionRows = rows.filter(
            row => row.section_key === section.key
        );

        for (const row of sectionRows) {
            const occupied = Boolean(row.user_id);

            const item = document.createElement('div');

            item.className =
                `orbat-slot${occupied ? '' : ' vacant'}`;

            item.innerHTML = `
                <div class="orbat-person">

                    <strong>
                        ${
                            occupied
                                ? esc(displayName(row))
                                : 'Vacant'
                        }
                    </strong>

                    <small>
                        ${
                            occupied
                                ? esc(row.rank || 'Unassigned')
                                : 'Unassigned'
                        }
                    </small>

                    <small>
                        ${esc(
                            row.billet ||
                            row.default_role ||
                            'Unassigned'
                        )}
                    </small>

                </div>

                <span class="orbat-code">
                    ${esc(row.callsign)}
                </span>
            `;

            column.appendChild(item);
        }

        root.appendChild(column);
    }

    const assigned = rows.filter(
        row => row.user_id
    ).length;

    const vacant = rows.filter(
        row => !row.user_id
    ).length;

    status.textContent =
        `${assigned} assigned // ${vacant} vacant`;

} catch (error) {
    console.error(error);

    status.textContent =
        `Unable to load ORBAT: ${error.message}`;
}