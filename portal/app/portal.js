import { supabase } from '../../assets/js/supabase-client.js';

const state = {
  user: null,
  account: null,
  instructor: false,
  candidate: false,
  people: [],
  qualifications: [],
  sessions: [],
  responses: [],
  scheduleFilter: 'upcoming',
  attendanceCohort: 'full',
  selectedQualificationPerson: null,
  selectedSession: null
};

const $ = (id) => document.getElementById(id);
const gate = $('gate');
const portal = $('portal');
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';

function rankFor(person) {
  if (person.branch === 'Navy') return person.navy_rank || 'Unassigned';
  if (person.branch === 'Army') return person.army_rank || 'Unassigned';
  if (person.branch === 'Air Force') return person.air_force_rank || 'Unassigned';
  return 'Unassigned';
}

function displayName(person) {
  return person.display_name || [person.fictional_first_name, person.fictional_last_name].filter(Boolean).join(' ') || person.callsign || 'Unassigned';
}

function formatLocal(iso, options = {}) {
  if (!iso) return 'Unscheduled';
  const date = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    weekday: options.weekday ?? 'short',
    year: options.year ?? 'numeric',
    month: options.month ?? 'short',
    day: options.day ?? 'numeric',
    hour: options.hour ?? '2-digit',
    minute: options.minute ?? '2-digit',
    timeZoneName: options.timeZoneName ?? 'short'
  }).format(date);
}

function formatDateOnly(value) {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString();
}

function localInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (v) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function setMessage(node, text = '', type = '') {
  if (!node) return;
  node.textContent = text;
  node.className = `form-message${type ? ` ${type}` : ''}`;
}

function showError(message) {
  console.error(message);
  alert(message);
}

function closeDialog(id) {
  const dialog = $(id);
  if (dialog?.open) dialog.close();
}

document.querySelectorAll('[data-close-dialog]').forEach((button) => {
  button.addEventListener('click', () => closeDialog(button.dataset.closeDialog));
});

document.querySelectorAll('.tab').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    button.classList.add('active');
    $(`tab-${button.dataset.tab}`)?.classList.add('active');
    if (button.dataset.tab === 'qualifications') loadQualificationsView();
    if (button.dataset.tab === 'attendance') loadAttendance();
  });
});

async function bootstrap() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.user) {
    window.location.replace('../../login/');
    return;
  }
  state.user = session.user;

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', state.user.id)
    .single();

  if (accountError || !account || account.account_status !== 'active') {
    await supabase.auth.signOut();
    window.location.replace('../../login/');
    return;
  }

  state.account = account;
  state.candidate = account.is_candidate || String(account.email || '').toLowerCase().endsWith('@candidate.mil');

  const { data: instructor, error: instructorError } = await supabase.rpc('portal_is_instructor', { p_user: state.user.id });
  if (instructorError) console.warn(instructorError);
  state.instructor = Boolean(instructor);

  const { data: people, error: peopleError } = await supabase.rpc('get_portal_people');
  if (peopleError) throw peopleError;
  state.people = people || [];

  $('timezone-label').textContent = timezone;
  $('identity-name').textContent = `${[account.fictional_first_name, account.fictional_last_name].filter(Boolean).join(' ') || account.email}${account.callsign ? ` / ${account.callsign}` : ''}`;
  $('identity-meta').textContent = `${account.branch || (state.candidate ? 'Green Team' : 'NSWC')} // ${rankFor(account)}`;

  if (!state.candidate) $('new-session-button').hidden = false;
  if (account.is_admin) $('personnel-tab-button').hidden = false;
  if (state.candidate) {
    document.querySelector('[data-cohort="full"]')?.setAttribute('hidden', '');
    document.querySelector('[data-cohort="green"]')?.classList.add('active');
    state.attendanceCohort = 'green';
  }

  await supabase.rpc('touch_last_seen');
  await loadSchedule();

  gate.hidden = true;
  portal.hidden = false;
}

$('logout-button')?.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.replace('../../login/');
});

supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') window.location.replace('../../login/');
});

async function loadSchedule() {
  $('schedule-status').textContent = 'Loading sessions...';
  const { data: sessions, error } = await supabase
    .from('training_sessions')
    .select('*')
    .order('starts_at', { ascending: true });
  if (error) {
    $('schedule-status').textContent = `Unable to load sessions: ${error.message}`;
    return;
  }
  state.sessions = sessions || [];

  const ids = state.sessions.map((s) => s.id);
  state.responses = [];
  if (ids.length) {
    const { data: responses, error: responseError } = await supabase
      .from('session_responses')
      .select('session_id,user_id,response,tentative_reason,responded_at')
      .in('session_id', ids);
    if (!responseError) state.responses = responses || [];
  }
  renderSchedule();
}

function renderSchedule() {
  const container = $('session-list');
  container.replaceChildren();
  const now = Date.now();
  let sessions = [...state.sessions];
  if (state.scheduleFilter === 'upcoming') sessions = sessions.filter((s) => new Date(s.starts_at).getTime() >= now && !['completed', 'cancelled'].includes(s.status));
  if (state.scheduleFilter === 'completed') sessions = sessions.filter((s) => s.status === 'completed');

  if (!sessions.length) {
    $('schedule-status').textContent = 'No sessions match this view.';
    return;
  }
  $('schedule-status').textContent = `${sessions.length} session${sessions.length === 1 ? '' : 's'} shown.`;

  sessions.forEach((session) => {
    const mine = state.responses.find((r) => r.session_id === session.id && r.user_id === state.user.id);
    const d = new Date(session.starts_at);
    const card = document.createElement('article');
    card.className = 'session-card';
    card.tabIndex = 0;

    const dateBox = document.createElement('div');
    dateBox.className = 'session-date';
    const dateStrong = document.createElement('strong');
    dateStrong.textContent = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const dateSpan = document.createElement('span');
    dateSpan.textContent = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
    dateBox.append(dateStrong, dateSpan);

    const main = document.createElement('div');
    main.className = 'session-main';
    const title = document.createElement('h3');
    title.textContent = session.title;
    const desc = document.createElement('p');
    desc.textContent = session.description || 'No session description provided.';
    const tags = document.createElement('div');
    tags.className = 'session-tags';
    tags.append(tag(session.session_type, session.session_type === 'Official Training' ? 'official' : session.session_type === 'Green Team' ? 'green' : ''));
    tags.append(tag(session.location));
    tags.append(tag(session.status, session.status));
    main.append(title, desc, tags);

    const side = document.createElement('div');
    side.className = 'session-side';
    const creator = state.people.find((p) => p.id === session.created_by);
    const host = document.createElement('span');
    host.className = 'tag';
    host.textContent = `Host: ${creator?.callsign || displayName(creator || {}) || 'Personnel'}`;
    const response = document.createElement('span');
    response.className = `response-pill ${mine?.response || ''}`;
    response.textContent = mine ? mine.response.replace('_', ' ') : 'No response';
    side.append(host, response);

    card.append(dateBox, main, side);
    card.addEventListener('click', () => openSessionDetail(session.id));
    card.addEventListener('keydown', (event) => { if (event.key === 'Enter') openSessionDetail(session.id); });
    container.append(card);
  });
}

function tag(text, className = '') {
  const node = document.createElement('span');
  node.className = `tag ${className}`.trim();
  node.textContent = String(text || '');
  return node;
}

document.querySelectorAll('#schedule-filters button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('#schedule-filters button').forEach((b) => b.classList.remove('active'));
    button.classList.add('active');
    state.scheduleFilter = button.dataset.filter;
    renderSchedule();
  });
});

$('new-session-button')?.addEventListener('click', () => openSessionForm());

function configureSessionTypeOptions() {
  const type = $('session-type');
  [...type.options].forEach((option) => {
    option.disabled = !state.instructor && !state.account.is_admin && option.value !== 'Pro Development';
  });
  if (!state.instructor && !state.account.is_admin) type.value = 'Pro Development';
}

function openSessionForm(session = null) {
  configureSessionTypeOptions();
  $('session-id').value = session?.id || '';
  $('session-form-title').textContent = session ? 'Manage Session' : 'Create Session';
  $('session-title').value = session?.title || '';
  $('session-type').value = session?.session_type || 'Pro Development';
  $('session-location').value = session?.location || 'Undecided';
  $('session-start').value = session ? localInputValue(session.starts_at) : '';
  $('session-description').value = session?.description || '';
  $('session-status').value = session?.status || 'scheduled';
  $('session-aar').value = session?.aar || '';
  $('session-time-hint').textContent = `Entered in ${timezone}; viewers automatically see their own timezone.`;
  $('delete-session-button').hidden = !session;
  $('session-dialog').showModal();
}

$('session-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = $('session-id').value;
  const localStart = $('session-start').value;
  if (!localStart) return;
  const payload = {
    title: $('session-title').value.trim(),
    session_type: $('session-type').value,
    location: $('session-location').value,
    starts_at: new Date(localStart).toISOString(),
    description: $('session-description').value.trim(),
    status: $('session-status').value,
    aar: $('session-aar').value.trim(),
    completed_at: $('session-status').value === 'completed' ? new Date().toISOString() : null
  };
  let result;
  if (id) {
    result = await supabase.from('training_sessions').update(payload).eq('id', id);
  } else {
    result = await supabase.from('training_sessions').insert({ ...payload, created_by: state.user.id });
  }
  if (result.error) {
    showError(`Session could not be saved: ${result.error.message}`);
    return;
  }
  closeDialog('session-dialog');
  await loadSchedule();
  if (id) await openSessionDetail(id);
});

$('delete-session-button')?.addEventListener('click', async () => {
  const id = $('session-id').value;
  if (!id || !confirm('Remove this session permanently?')) return;
  const { error } = await supabase.from('training_sessions').delete().eq('id', id);
  if (error) return showError(`Session could not be removed: ${error.message}`);
  closeDialog('session-dialog');
  closeDialog('session-detail-dialog');
  await loadSchedule();
});

async function openSessionDetail(id) {
  const session = state.sessions.find((s) => s.id === id);
  if (!session) return;
  state.selectedSession = session;
  $('detail-type').textContent = session.session_type;
  $('detail-title').textContent = session.title;
  $('detail-description').textContent = session.description || 'No description provided.';
  $('detail-facts').replaceChildren(
    fact('Local Time', formatLocal(session.starts_at)),
    fact('Location', session.location),
    fact('Status', session.status),
    fact('Timezone', timezone)
  );
  $('detail-aar').textContent = session.aar || '';
  $('aar-block').hidden = !session.aar;

  const mine = state.responses.find((r) => r.session_id === id && r.user_id === state.user.id);
  document.querySelectorAll('#response-buttons button').forEach((button) => button.classList.toggle('active', button.dataset.response === mine?.response));
  $('tentative-wrap').hidden = mine?.response !== 'tentative';
  $('tentative-reason').value = mine?.tentative_reason || '';
  setMessage($('response-message'));

  const canManage = state.instructor || state.account.is_admin || (session.created_by === state.user.id && session.session_type === 'Pro Development');
  $('manage-session-button').hidden = !canManage;
  $('attendance-marking-block').hidden = !state.instructor;

  await loadSessionRoster(id);
  $('session-detail-dialog').showModal();
}

function fact(label, value) {
  const node = document.createElement('div');
  node.className = 'fact';
  const s = document.createElement('span'); s.textContent = label;
  const b = document.createElement('strong'); b.textContent = value;
  node.append(s, b);
  return node;
}

$('manage-session-button')?.addEventListener('click', () => {
  const session = state.selectedSession;
  if (!session) return;
  closeDialog('session-detail-dialog');
  openSessionForm(session);
});

document.querySelectorAll('#response-buttons button').forEach((button) => {
  button.addEventListener('click', async () => {
    const response = button.dataset.response;
    if (response === 'tentative') {
      $('tentative-wrap').hidden = false;
      document.querySelectorAll('#response-buttons button').forEach((b) => b.classList.toggle('active', b === button));
      $('tentative-reason').focus();
      return;
    }
    $('tentative-wrap').hidden = true;
    await saveResponse(response, null);
  });
});

$('save-tentative')?.addEventListener('click', async () => {
  const reason = $('tentative-reason').value.trim();
  if (!reason) return setMessage($('response-message'), 'A reason is required for tentative responses.', 'error');
  await saveResponse('tentative', reason);
});

async function saveResponse(response, tentativeReason) {
  if (!state.selectedSession) return;
  const { error } = await supabase.from('session_responses').upsert({
    session_id: state.selectedSession.id,
    user_id: state.user.id,
    response,
    tentative_reason: tentativeReason,
    responded_at: new Date().toISOString()
  }, { onConflict: 'session_id,user_id' });
  if (error) return setMessage($('response-message'), error.message, 'error');
  setMessage($('response-message'), 'Response saved.', 'success');
  await loadSchedule();
  await loadSessionRoster(state.selectedSession.id);
  document.querySelectorAll('#response-buttons button').forEach((b) => b.classList.toggle('active', b.dataset.response === response));
}

async function loadSessionRoster(sessionId) {
  const { data: roster, error } = await supabase.rpc('get_session_roster', { p_session: sessionId });
  if (error) {
    $('response-roster').textContent = error.message;
    return;
  }
  renderResponseRoster(roster || []);
  if (state.instructor) renderAttendanceMarking(roster || []);
}

function renderResponseRoster(roster) {
  const root = $('response-roster');
  root.replaceChildren();
  const groups = [
    ['Attending', 'attending'],
    ['Tentative', 'tentative'],
    ['Not Attending', 'not_attending'],
    ['No Response', null]
  ];
  groups.forEach(([label, value]) => {
    const group = document.createElement('div');
    group.className = 'roster-group';
    const h = document.createElement('h4');
    const people = roster.filter((p) => value === null ? !p.response : p.response === value);
    h.textContent = `${label} (${people.length})`;
    group.append(h);
    if (!people.length) {
      const empty = document.createElement('div'); empty.className = 'roster-person'; empty.textContent = 'None'; group.append(empty);
    } else {
      people.forEach((person) => {
        const row = document.createElement('div'); row.className = 'roster-person';
        row.textContent = `${displayName(person)}${person.callsign ? ` / ${person.callsign}` : ''}`;
        if (person.tentative_reason) { const reason = document.createElement('span'); reason.textContent = person.tentative_reason; row.append(reason); }
        group.append(row);
      });
    }
    root.append(group);
  });
}

function renderAttendanceMarking(roster) {
  const root = $('attendance-marking-list');
  root.replaceChildren();
  roster.forEach((person) => {
    const row = document.createElement('div');
    row.className = 'attendance-mark-row';
    row.dataset.userId = person.id;

    const name = document.createElement('strong');
    name.textContent = `${displayName(person)}${person.callsign ? ` / ${person.callsign}` : ''}`;

    const outcome = document.createElement('select');
    outcome.innerHTML = '<option value="">Not marked</option><option value="attended">Attended</option><option value="late">Late</option><option value="absent">Absent</option>';
    outcome.value = person.outcome || '';

    const stars = document.createElement('div'); stars.className = 'stars-input'; stars.dataset.rating = String(person.my_rating || 0);
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('button'); star.type = 'button'; star.textContent = '★'; star.classList.toggle('active', i <= (person.my_rating || 0));
      star.addEventListener('click', () => {
        stars.dataset.rating = String(i);
        [...stars.children].forEach((child, idx) => child.classList.toggle('active', idx < i));
      });
      stars.append(star);
    }

    const review = document.createElement('textarea'); review.rows = 2; review.maxLength = 1000; review.placeholder = 'Instructor review'; review.value = person.my_review || '';
    const save = document.createElement('button'); save.type = 'button'; save.className = 'secondary-button'; save.textContent = 'Save';
    save.addEventListener('click', () => saveAttendanceReview(person.id, outcome.value, Number(stars.dataset.rating || 0), review.value.trim(), save));
    row.append(name, outcome, stars, review, save);
    root.append(row);
  });
}

async function saveAttendanceReview(userId, outcome, rating, review, button) {
  if (!state.selectedSession) return;
  button.disabled = true;
  try {
    if (outcome) {
      const { error } = await supabase.from('session_attendance').upsert({
        session_id: state.selectedSession.id,
        user_id: userId,
        outcome,
        marked_by: state.user.id,
        marked_at: new Date().toISOString()
      }, { onConflict: 'session_id,user_id' });
      if (error) throw error;
    } else {
      const { error } = await supabase.from('session_attendance').delete().eq('session_id', state.selectedSession.id).eq('user_id', userId);
      if (error) throw error;
    }

    if (rating > 0) {
      const { error } = await supabase.from('session_reviews').upsert({
        session_id: state.selectedSession.id,
        subject_id: userId,
        instructor_id: state.user.id,
        rating,
        review,
        updated_at: new Date().toISOString()
      }, { onConflict: 'session_id,subject_id,instructor_id' });
      if (error) throw error;
    }
    button.textContent = 'Saved';
    setTimeout(() => { button.textContent = 'Save'; }, 1200);
  } catch (error) {
    showError(error.message);
  } finally {
    button.disabled = false;
  }
}

async function loadQualificationsView() {
  if (!state.qualifications.length) {
    const { data, error } = await supabase.from('qualifications').select('*').order('sort_order');
    if (error) return showError(error.message);
    state.qualifications = data || [];
    const select = $('qualification-select');
    select.replaceChildren();
    state.qualifications.forEach((q) => {
      const option = document.createElement('option'); option.value = q.id; option.textContent = `${q.name} // ${q.category}`; select.append(option);
    });
  }
  renderQualificationPeople();
}

function renderQualificationPeople() {
  const query = $('qualification-person-search').value.trim().toLowerCase();
  const root = $('qualification-people');
  root.replaceChildren();
  state.people
    .filter((p) => `${displayName(p)} ${p.callsign || ''}`.toLowerCase().includes(query))
    .forEach((person) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'person-row';
      button.classList.toggle('active', state.selectedQualificationPerson?.id === person.id);
      const strong = document.createElement('strong'); strong.textContent = displayName(person);
      const span = document.createElement('span'); span.textContent = `${person.callsign || 'NO CALLSIGN'} // ${person.is_candidate ? 'GREEN TEAM' : `${person.branch || 'UNASSIGNED'} ${rankFor(person)}`}`;
      button.append(strong, span);
      button.addEventListener('click', () => selectQualificationPerson(person));
      root.append(button);
    });
}

$('qualification-person-search')?.addEventListener('input', renderQualificationPeople);

async function selectQualificationPerson(person) {
  state.selectedQualificationPerson = person;
  renderQualificationPeople();
  $('qualification-empty').hidden = true;
  $('qualification-detail').hidden = false;
  $('qualification-person-name').textContent = displayName(person);
  $('qualification-person-meta').textContent = `${person.callsign || 'No callsign'} // ${person.is_candidate ? 'Green Team Candidate' : `${person.branch || 'Unassigned'} ${rankFor(person)}`}`;
  $('award-qualification-button').hidden = !state.instructor;

  const { data, error } = await supabase
    .from('member_qualifications')
    .select('user_id,qualification_id,awarded_at,expires_at,notes,qualifications(id,name,category,code)')
    .eq('user_id', person.id)
    .order('awarded_at', { ascending: false });
  if (error) return showError(error.message);

  const root = $('member-qualifications');
  root.replaceChildren();
  if (!data?.length) {
    const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'No qualifications awarded.'; root.append(empty); return;
  }
  data.forEach((record) => {
    const item = document.createElement('div'); item.className = 'qualification-item';
    const strong = document.createElement('strong'); strong.textContent = record.qualifications?.name || 'Qualification';
    const meta = document.createElement('span'); meta.textContent = `Awarded ${formatDateOnly(record.awarded_at)}${record.expires_at ? ` // Expires ${formatDateOnly(record.expires_at)}` : ''}`;
    const notes = document.createElement('span'); notes.textContent = record.notes || record.qualifications?.category || '';
    item.append(strong, meta, notes);
    if (state.instructor) {
      const actions = document.createElement('div'); actions.className = 'qualification-actions';
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Revoke';
      remove.addEventListener('click', () => revokeQualification(person.id, record.qualification_id));
      actions.append(remove); item.append(actions);
    }
    root.append(item);
  });
}

$('award-qualification-button')?.addEventListener('click', () => {
  if (!state.selectedQualificationPerson) return;
  $('qualification-target-id').value = state.selectedQualificationPerson.id;
  $('qualification-date').value = new Date().toISOString().slice(0, 10);
  $('qualification-expiry').value = '';
  $('qualification-notes').value = '';
  $('qualification-dialog').showModal();
});

$('qualification-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const { error } = await supabase.from('member_qualifications').upsert({
    user_id: $('qualification-target-id').value,
    qualification_id: $('qualification-select').value,
    awarded_by: state.user.id,
    awarded_at: $('qualification-date').value,
    expires_at: $('qualification-expiry').value || null,
    notes: $('qualification-notes').value.trim()
  }, { onConflict: 'user_id,qualification_id' });
  if (error) return showError(error.message);
  closeDialog('qualification-dialog');
  await selectQualificationPerson(state.selectedQualificationPerson);
  const selected = state.qualifications.find((q) => q.id === $('qualification-select').value);
  if (selected?.name === 'USN Instructor' && state.selectedQualificationPerson.id === state.user.id) state.instructor = true;
});

async function revokeQualification(userId, qualificationId) {
  if (!confirm('Revoke this qualification?')) return;
  const { error } = await supabase.from('member_qualifications').delete().eq('user_id', userId).eq('qualification_id', qualificationId);
  if (error) return showError(error.message);
  await selectQualificationPerson(state.selectedQualificationPerson);
}

document.querySelectorAll('#attendance-cohort button').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.hidden) return;
    document.querySelectorAll('#attendance-cohort button').forEach((b) => b.classList.remove('active'));
    button.classList.add('active');
    state.attendanceCohort = button.dataset.cohort;
    loadAttendance();
  });
});

$('attendance-sort')?.addEventListener('change', loadAttendance);

async function loadAttendance() {
  $('attendance-status').textContent = 'Loading attendance...';
  const { data, error } = await supabase.rpc('get_attendance_leaderboard', { p_cohort: state.attendanceCohort });
  if (error) {
    $('attendance-status').textContent = error.message;
    return;
  }
  let rows = [...(data || [])];
  const sort = $('attendance-sort').value;
  if (sort === 'attendance_desc') rows.sort((a, b) => Number(b.attendance_percent) - Number(a.attendance_percent));
  if (sort === 'attendance_asc') rows.sort((a, b) => Number(a.attendance_percent) - Number(b.attendance_percent));
  if (sort === 'name') rows.sort((a, b) => displayName(a).localeCompare(displayName(b)));
  if (sort === 'sessions_desc') rows.sort((a, b) => Number(b.attended) - Number(a.attended));

  $('attendance-status').textContent = `${rows.length} member${rows.length === 1 ? '' : 's'} // ${state.attendanceCohort === 'green' ? 'Green Team' : 'Full Unit'}`;
  const body = $('attendance-body'); body.replaceChildren();
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    const pct = Number(row.attendance_percent || 0);
    if (Number(row.eligible_sessions) > 0 && pct < 75) tr.classList.add('low-attendance');
    appendCell(tr, displayName(row), Number(row.eligible_sessions) > 0 && pct < 75 ? 'ATTENTION' : '');
    appendCell(tr, row.callsign || '—');
    appendCell(tr, formatDateOnly(row.unit_joined_at));
    appendCell(tr, row.eligible_sessions);
    appendCell(tr, row.attended);
    appendCell(tr, row.late);
    appendCell(tr, row.absent);
    const attendanceCell = document.createElement('td');
    const value = document.createElement('span'); value.className = `attendance-value${Number(row.eligible_sessions) > 0 && pct < 75 ? ' low' : ''}`; value.textContent = `${pct.toFixed(1)}%`; attendanceCell.append(value); tr.append(attendanceCell);
    appendCell(tr, Number(row.average_review) > 0 ? `${Number(row.average_review).toFixed(2)} / 5` : '—');
    body.append(tr);
  });
}

function appendCell(row, value, warning = '') {
  const td = document.createElement('td'); td.textContent = value ?? '—';
  if (warning) { const chip = document.createElement('span'); chip.className = 'warning-chip'; chip.textContent = warning; td.append(chip); }
  row.append(td);
}

$('candidate-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = $('candidate-message');
  setMessage(message, 'Creating candidate...');
  const email = $('candidate-email').value.trim().toLowerCase();
  if (!email.endsWith('@candidate.mil')) return setMessage(message, 'Candidate email must end in @candidate.mil.', 'error');
  const payload = {
    first_name: $('candidate-first').value.trim(),
    last_name: $('candidate-last').value.trim(),
    email,
    password: $('candidate-password').value,
    callsign: $('candidate-callsign').value.trim() || null,
    timezone: $('candidate-timezone').value.trim() || null
  };
  const { data, error } = await supabase.functions.invoke('create-unit-account', { body: payload });
  if (error || data?.error) return setMessage(message, data?.error || error?.message || 'Candidate could not be created.', 'error');
  setMessage(message, 'Candidate account created successfully.', 'success');
  event.target.reset();
  const { data: people } = await supabase.rpc('get_portal_people');
  if (people) state.people = people;
});

bootstrap().catch(async (error) => {
  console.error(error);
  gate.textContent = `Portal initialization failed: ${error.message}`;
});
