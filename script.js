(() => {
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = 'mentormeet_appointments_v1';
  const TIMES = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','14:00','14:30','15:00','15:30','16:00','16:30'];
  let appointments = loadAppointments();
  let selectedDate = '';
  let selectedTime = '';
  let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let cancelTarget = null;
  let toastTimer = null;

  // Front-end demo sign-in. This is a UI gate, not secure server authentication.
  const STUDENT_EMAIL = 'student@mentormeet.demo';
  const MENTOR_EMAIL = 'mentor@mentormeet.demo';
  const DEMO_PASSWORD = 'mentor123';
  const SESSION_KEY = 'mentormeet_demo_session';
  function showApp(role = 'student') {
    $('authScreen').hidden = true;
    $('appShell').hidden = false;
    document.body.dataset.role = role;
    const mentorMode = role === 'mentor';
    $('workspaceLabel').textContent = mentorMode ? 'MENTOR WORKSPACE' : 'STUDENT WORKSPACE';
    $('roleChip').textContent = mentorMode ? 'MENTOR PORTAL' : 'STUDENT PORTAL';
    $('userAvatar').textContent = mentorMode ? 'ME' : 'ST';
    document.body.classList.toggle('mentor-mode', mentorMode);
    $('studentBookNav').hidden = mentorMode;
    $('studentSessionsNav').hidden = mentorMode;
    $('mentorInboxNav').hidden = !mentorMode;
    $('crumbCurrent').textContent = mentorMode ? 'Incoming requests' : 'Book mentoring';
    if (mentorMode) setView('mentorDashboard'); else setView('book');
  }
  function showLogin() {
    $('authScreen').hidden = false;
    $('appShell').hidden = true;
  }
  function signIn(email, password, demoShortcut = false) {
    const cleanEmail = email.trim().toLowerCase();
    const emailError = $('loginEmailError');
    const passwordError = $('loginPasswordError');
    const alert = $('loginAlert');
    emailError.textContent = '';
    passwordError.textContent = '';
    alert.classList.remove('show');
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      emailError.textContent = 'Enter a valid email address.';
      $('loginEmail').focus();
      return;
    }
    if (!password) {
      passwordError.textContent = 'Please enter your password.';
      $('loginPassword').focus();
      return;
    }
    const role = cleanEmail === STUDENT_EMAIL ? 'student' : cleanEmail === MENTOR_EMAIL ? 'mentor' : '';
    if (!role || password !== DEMO_PASSWORD) {
      alert.textContent = 'Email or password is incorrect. Use one of the demo accounts shown below.';
      alert.classList.add('show');
      return;
    }
    const session = { email: cleanEmail, name: role === 'mentor' ? 'Mentor' : 'Student', role, signedInAt: new Date().toISOString() };
    if ($('rememberMe').checked || demoShortcut) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    showApp(role);
    showToast(role === 'mentor' ? 'Welcome! Incoming bookings are ready to review.' : 'Welcome to MentorMeet! Your mentoring space is ready.');
  }
  $('loginForm').addEventListener('submit', event => {
    event.preventDefault();
    signIn($('loginEmail').value, $('loginPassword').value);
  });
  $('demoLoginBtn').addEventListener('click', () => {
    $('loginEmail').value = STUDENT_EMAIL;
    $('loginPassword').value = DEMO_PASSWORD;
    signIn(STUDENT_EMAIL, DEMO_PASSWORD, true);
  });
  $('mentorDemoLoginBtn').addEventListener('click', () => {
    $('loginEmail').value = MENTOR_EMAIL;
    $('loginPassword').value = DEMO_PASSWORD;
    signIn(MENTOR_EMAIL, DEMO_PASSWORD, true);
  });
  $('togglePassword').addEventListener('click', () => {
    const input = $('loginPassword');
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    $('togglePassword').textContent = showing ? 'Show' : 'Hide';
    $('togglePassword').setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  });
  $('signOutBtn').addEventListener('click', () => {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    showLogin();
    $('loginPassword').value = '';
    showToast('You have signed out.');
  });

  function loadAppointments() {
    try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(saved) ? saved : []; }
    catch { return []; }
  }
  function saveAppointments() { localStorage.setItem(STORAGE_KEY, JSON.stringify(appointments)); }
  function localDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
  function parseDate(key) { const [y,m,d] = key.split('-').map(Number); return new Date(y,m-1,d); }
  function prettyDate(key, options = { weekday:'short', month:'short', day:'numeric', year:'numeric' }) {
    return parseDate(key).toLocaleDateString('en-IN', options);
  }
  function timeLabel(time) {
    const [h,m] = time.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    return `${String(h % 12 || 12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${suffix}`;
  }
  // Status changes are explicit: a session is only completed when the mentor marks it complete.
  function dateTimeStatus(appt) {
    if (['cancelled', 'declined', 'completed', 'pending'].includes(appt.status)) return appt.status;
    return 'upcoming';
  }
  function statusLabel(appt) {
    if (appt.status === 'pending') return 'Awaiting mentor';
    if (appt.status === 'declined') return 'Declined';
    if (appt.status === 'cancelled') return 'Cancelled';
    if (appt.status === 'completed') return 'Session completed';
    return 'Approved · Confirmed';
  }
  function sessionHasEnded(appt) {
    const end = parseDate(appt.date);
    const [h, m] = appt.time.split(':').map(Number);
    end.setHours(h, m + 30, 0, 0);
    return end <= new Date();
  }
  function showToast(message) {
    const toast = $('toast'); toast.textContent = message; toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
  }
  function setView(view) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
    const viewId = view === 'book' ? 'bookView' : view === 'appointments' ? 'appointmentsView' : 'mentorDashboardView';
    $(viewId).classList.add('active');
    $('crumbCurrent').textContent = view === 'book' ? 'Book mentoring' : view === 'appointments' ? 'My sessions' : 'Incoming requests';
    if (view === 'appointments') renderAppointments();
    if (view === 'mentorDashboard') renderMentorDashboard();
    window.scrollTo({top:0,behavior:'smooth'});
  }
  document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
  $('newBookingBtn').addEventListener('click', () => setView('book'));

  function renderCalendar() {
    const year = calendarMonth.getFullYear(), month = calendarMonth.getMonth();
    $('monthLabel').textContent = calendarMonth.toLocaleDateString('en-IN',{month:'long',year:'numeric'});
    const firstDay = new Date(year,month,1);
    const offset = (firstDay.getDay()+6)%7;
    const daysInMonth = new Date(year,month+1,0).getDate();
    const today = new Date(); today.setHours(0,0,0,0);
    const days = $('calendarDays'); days.innerHTML = '';
    for (let i=0;i<offset;i++) { const empty=document.createElement('span'); empty.className='day empty'; days.appendChild(empty); }
    for (let day=1;day<=daysInMonth;day++) {
      const date = new Date(year,month,day); date.setHours(0,0,0,0);
      const key = localDateKey(date);
      const btn = document.createElement('button'); btn.type='button'; btn.className='day'; btn.textContent=day;
      btn.setAttribute('aria-label', prettyDate(key,{weekday:'long',month:'long',day:'numeric',year:'numeric'}));
      if (date < today) { btn.disabled=true; btn.title='Past dates are unavailable'; }
      if (key === localDateKey(today)) btn.classList.add('today');
      if (key === selectedDate) { btn.classList.add('selected'); btn.setAttribute('aria-pressed','true'); }
      if (date >= today) btn.title = 'Select ' + prettyDate(key);
      btn.addEventListener('click', () => { selectedDate=key; selectedTime=''; renderCalendar(); renderSlots(); updateSummary(); });
      days.appendChild(btn);
    }
    const total = offset + daysInMonth;
    for (let i=total;i%7!==0;i++) { const empty=document.createElement('span'); empty.className='day empty'; days.appendChild(empty); }
    $('prevMonth').disabled = year < today.getFullYear() || (year===today.getFullYear() && month<=today.getMonth());
    $('prevMonth').style.opacity = $('prevMonth').disabled ? '.35' : '1';
  }
  $('prevMonth').addEventListener('click', () => { if (!$('prevMonth').disabled) { calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1); renderCalendar(); }});
  $('nextMonth').addEventListener('click', () => { calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1); renderCalendar(); });

  function activeBookingAt(date,time) {
    return appointments.some(a => a.date===date && a.time===time && !['cancelled','declined'].includes(a.status));
  }
  function isPastSlot(date,time) {
    const d=parseDate(date), [h,m]=time.split(':').map(Number); d.setHours(h,m,0,0); return d < new Date();
  }
  function renderSlots() {
    const grid=$('slotsGrid'); grid.innerHTML='';
    if (!selectedDate) { grid.innerHTML='<div class="empty-slots">← Select a date first</div>'; $('selectedDateLabel').textContent='Choose a date to see times'; return; }
    $('selectedDateLabel').textContent=prettyDate(selectedDate,{weekday:'short',month:'short',day:'numeric'});
    let available=0;
    TIMES.forEach(time => {
      const booked=activeBookingAt(selectedDate,time), past=isPastSlot(selectedDate,time);
      const btn=document.createElement('button'); btn.type='button'; btn.className='slot'; btn.textContent=timeLabel(time);
      if (booked || past) { btn.disabled=true; btn.classList.add('booked'); btn.title=booked?'This time is already booked':'This time has passed'; }
      else { available++; }
      if (time===selectedTime) btn.classList.add('selected');
      btn.setAttribute('aria-pressed', String(time===selectedTime));
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        selectedTime=time; renderSlots(); updateSummary();
      });
      grid.appendChild(btn);
    });
    if (!available) { const msg=document.createElement('div'); msg.className='empty-slots'; msg.textContent='All times are taken. Try another date.'; grid.appendChild(msg); }
  }
  function updateSummary() {
    $('summaryDate').textContent=selectedDate ? prettyDate(selectedDate,{weekday:'short',month:'short',day:'numeric',year:'numeric'}) : 'Not selected yet';
    $('summaryTime').textContent=selectedTime ? timeLabel(selectedTime) : 'Choose a slot to continue';
    $('summaryService').textContent=$('service').value || 'Your mentoring topic';
    $('summaryMentor').textContent=$('mentor').value || 'Choose a mentor';
  }
  $('service').addEventListener('change', updateSummary);
  $('mentor').addEventListener('change', updateSummary);
  $('notes').addEventListener('input', () => $('charCount').textContent = `${$('notes').value.length} / 300`);

  function validate() {
    const fields = [
      ['fullName', v => v.trim().length >= 2 && /[A-Za-z\u00C0-\u024F\u0900-\u097F]/.test(v), 'Please enter your name (at least 2 characters).'],
      ['email', v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()), 'Enter a valid email address.'],
      ['phone', v => (v.match(/\d/g)||[]).length >= 10 && (v.match(/\d/g)||[]).length <= 15, 'Enter a phone number with 10–15 digits.'],
      ['service', v => !!v, 'Please choose a mentoring topic.'],
      ['mentor', v => !!v, 'Please choose a mentor.']
    ];
    let firstInvalid = null, messages = [];
    fields.forEach(([id, test, message]) => {
      const input=$(id), wrapper=input.closest('.field'), valid=test(input.value);
      wrapper.classList.toggle('invalid', !valid);
      const error=$(id+'Error'); if (error) error.textContent=valid?'':message;
      if (!valid) { messages.push(message); if (!firstInvalid) firstInvalid=input; }
    });
    if (!selectedDate) messages.push('Please select an appointment date.');
    if (selectedDate && parseDate(selectedDate) < new Date(new Date().setHours(0,0,0,0))) messages.push('Please choose today or a future date.');
    if (!selectedTime) messages.push('Please select an available time slot.');
    if (selectedDate && selectedTime && (activeBookingAt(selectedDate,selectedTime) || isPastSlot(selectedDate,selectedTime))) messages.push('That time is no longer available. Please choose another slot.');
    if (firstInvalid) firstInvalid.focus();
    return messages;
  }
  $('bookingForm').addEventListener('submit', event => {
    event.preventDefault();
    const messages=validate(), alert=$('formAlert');
    if (messages.length) { alert.innerHTML='Please check the following:<br>• '+messages.map(escapeHTML).join('<br>• '); alert.classList.add('show'); alert.scrollIntoView({behavior:'smooth',block:'nearest'}); return; }
    alert.classList.remove('show');
    // Re-check the slot immediately before saving to prevent duplicate bookings in this browser.
    if (activeBookingAt(selectedDate,selectedTime)) { showToast('That slot was just booked. Please choose another time.'); renderSlots(); return; }
    const appointment = {
      id: 'AS-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,6).toUpperCase(),
      name:$('fullName').value.trim(), email:$('email').value.trim(), phone:$('phone').value.trim(),
      service:$('service').value, mentor:$('mentor').value, notes:$('notes').value.trim(), date:selectedDate, time:selectedTime,
      status:'pending', createdAt:new Date().toISOString()
    };
    appointments.push(appointment); saveAppointments(); updateNavCount(); renderSlots();
    $('passService').textContent=appointment.service; $('passMentor').textContent='with ' + appointment.mentor; $('passDate').textContent=prettyDate(appointment.date,{weekday:'short',month:'short',day:'numeric',year:'numeric'}); $('passTime').textContent=timeLabel(appointment.time); $('passId').textContent=appointment.id;
    $('successModal').classList.add('open'); $('successModal').setAttribute('aria-hidden','false'); $('closeModal').focus();
  });
  function escapeHTML(value) { return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function closeSuccess() { $('successModal').classList.remove('open'); $('successModal').setAttribute('aria-hidden','true'); }
  $('closeModal').addEventListener('click', closeSuccess);
  $('successModal').addEventListener('click', e => { if (e.target === $('successModal')) closeSuccess(); });
  $('viewAppointmentsBtn').addEventListener('click', () => { closeSuccess(); setView('appointments'); });
  $('bookAnotherBtn').addEventListener('click', () => { closeSuccess(); resetFormForAnother(); });
  function resetFormForAnother() {
    $('bookingForm').reset(); document.querySelectorAll('.field.invalid').forEach(f=>f.classList.remove('invalid'));
    document.querySelectorAll('.error').forEach(e=>e.textContent=''); $('charCount').textContent='0 / 300';
    selectedTime=''; $('formAlert').classList.remove('show'); updateSummary(); renderSlots(); setView('book');
  }
  function updateNavCount() { if ($('navCount')) $('navCount').textContent = appointments.filter(a => ['pending','confirmed'].includes(a.status)).length; if ($('mentorNavCount')) $('mentorNavCount').textContent = appointments.filter(a => a.status === 'pending').length; }
  function renderAppointments() {
    const mentorMode = false;
    const filter = $('appointmentFilter').value;
    const list = $('appointmentsList');
    const sorted = [...appointments].sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    const matches = appt => {
      if (filter === 'all') return true;
      if (mentorMode) return appt.status === filter || (filter === 'upcoming' && dateTimeStatus(appt) === 'upcoming');
      return filter === 'upcoming' ? ['pending', 'confirmed'].includes(appt.status) : appt.status === filter;
    };
    const filtered = sorted.filter(matches);
    $('totalStat').textContent = appointments.length;
    $('upcomingStat').textContent = appointments.filter(a => ['pending', 'confirmed'].includes(a.status)).length;
    $('completedStat').textContent = appointments.filter(a => dateTimeStatus(a) === 'completed').length;
    list.innerHTML = '';
    if (!filtered.length) {
      const empty = document.createElement('div'); empty.className = 'empty-state';
      empty.innerHTML = mentorMode
        ? '<div class="empty-illustration">▦</div><h3>No booking requests yet.</h3><p>When students book a session, their details and appointment requests will appear here.</p>'
        : '<div class="empty-illustration">✳</div><h3>Your calendar has room to bloom.</h3><p>No appointments here just yet. Book your first session when you’re ready.</p><button class="primary-btn" id="emptyBookBtn">Book an appointment <span>↗</span></button>';
      list.appendChild(empty);
      if (!mentorMode) $('emptyBookBtn').addEventListener('click',()=>setView('book'));
      return;
    }
    filtered.forEach(appt => {
      const status = dateTimeStatus(appt);
      const label = statusLabel(appt);
      const row = document.createElement('article'); row.className = 'appointment-row';
      const date = parseDate(appt.date);
      const mentorActionButtons = appt.status === 'pending'
        ? `<div class="mentor-actions"><button class="approve-btn" data-action="confirm" data-id="${escapeHTML(appt.id)}">✓ Approve appointment</button><button class="decline-btn" data-action="decline" data-id="${escapeHTML(appt.id)}">✕ Reject appointment</button></div>`
        : appt.status === 'confirmed' && sessionHasEnded(appt)
          ? `<div class="mentor-actions"><button class="complete-btn" data-action="complete" data-id="${escapeHTML(appt.id)}">✓ Session complete</button></div>`
          : appt.status === 'confirmed'
            ? `<small class="completion-hint">Mark complete after the session ends</small>` : '';
      const actions = mentorMode
        ? `<span class="status-pill ${escapeHTML(appt.status || 'confirmed')}">${escapeHTML(label)}</span>${mentorActionButtons}`
        : `<span class="status-pill ${status}">${escapeHTML(label)}</span>${appt.status === 'pending' ? '<small class="student-status-note">Waiting for mentor approval</small>' : ''}${appt.status === 'confirmed' ? '<small class="student-status-note approved-note">Your appointment is approved</small>' : ''}${status === 'upcoming' && appt.status !== 'completed' ? `<button class="cancel-btn" data-cancel="${escapeHTML(appt.id)}">Cancel booking</button>` : ''}`;
      const studentDetails = mentorMode
        ? `<p><strong>Student:</strong> ${escapeHTML(appt.name)} · ${escapeHTML(appt.email)} · ${escapeHTML(appt.phone || 'No phone provided')}</p><p><strong>Mentor:</strong> ${escapeHTML(appt.mentor || 'Not specified')} · <strong>Topic:</strong> ${escapeHTML(appt.service)}</p>${appt.notes ? `<p><strong>Notes:</strong> ${escapeHTML(appt.notes)}</p>` : ''}`
        : `<p>${escapeHTML(appt.mentor || 'Mentor not recorded')} · ${escapeHTML(appt.name)} · ${escapeHTML(appt.email)}</p>`;
      row.innerHTML = `<div class="date-tile"><small>${escapeHTML(date.toLocaleDateString('en-IN',{month:'short'}).toUpperCase())}</small><strong>${date.getDate()}</strong></div>
        <div class="appt-info"><h3>${escapeHTML(appt.service)}</h3>${studentDetails}<div class="appt-meta"><span>◷ ${escapeHTML(timeLabel(appt.time))} · ${escapeHTML(prettyDate(appt.date,{weekday:'short',month:'short',day:'numeric',year:'numeric'}))}</span><span>⌁ ${escapeHTML(appt.id)}</span></div></div>
        <div class="appt-actions">${actions}</div>`;
      list.appendChild(row);
    });
    list.querySelectorAll('[data-cancel]').forEach(btn=>btn.addEventListener('click',()=>openCancel(btn.dataset.cancel)));
    list.querySelectorAll('[data-action]').forEach(btn=>btn.addEventListener('click',()=>{
      const appt = appointments.find(a => a.id === btn.dataset.id);
      if (!appt) return;
      if (btn.dataset.action === 'confirm' || btn.dataset.action === 'decline') {
        if (appt.status !== 'pending') return;
        appt.status = btn.dataset.action === 'confirm' ? 'confirmed' : 'declined';
        saveAppointments(); renderAppointments(); renderSlots(); updateNavCount();
        showToast(appt.status === 'confirmed' ? 'Appointment approved. The student will see it as confirmed.' : 'Appointment rejected. The student will see the update.');
      } else if (btn.dataset.action === 'complete') {
        if (appt.status !== 'confirmed' || !sessionHasEnded(appt)) {
          showToast('You can mark this session complete after its scheduled 30-minute time has ended.');
          return;
        }
        appt.status = 'completed';
        appt.completedAt = new Date().toISOString();
        saveAppointments(); renderAppointments(); renderSlots(); updateNavCount();
        showToast('Session marked complete. The student portal will now show Session completed.');
      }
    }));
  }
  function renderMentorDashboard() {
    const list = $('mentorRequestsList');
    const filter = $('mentorRequestFilter').value;
    const sorted = [...appointments].sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    const filtered = sorted.filter(a => filter === 'all' || a.status === filter);
    $('mentorTotalStat').textContent = appointments.length;
    $('mentorPendingStat').textContent = appointments.filter(a => a.status === 'pending').length;
    $('mentorConfirmedStat').textContent = appointments.filter(a => a.status === 'confirmed').length;
    list.innerHTML = '';
    if (!filtered.length) {
      list.innerHTML = '<div class="mentor-empty"><div class="empty-illustration">▤</div><h3>No requests to show</h3><p>New student appointment requests will appear here with their details and available actions.</p></div>';
      return;
    }
    filtered.forEach(appt => {
      const date = parseDate(appt.date);
      const label = statusLabel(appt);
      const actions = appt.status === 'pending'
        ? `<div class="mentor-request-actions"><button class="approve-btn" data-mentor-action="confirm" data-id="${escapeHTML(appt.id)}">✓ Approve request</button><button class="decline-btn" data-mentor-action="decline" data-id="${escapeHTML(appt.id)}">✕ Reject request</button></div>`
        : appt.status === 'confirmed' && sessionHasEnded(appt)
          ? `<div class="mentor-request-actions"><button class="complete-btn" data-mentor-action="complete" data-id="${escapeHTML(appt.id)}">✓ Mark session complete</button></div>`
          : appt.status === 'confirmed'
            ? '<small class="completion-hint">Available to mark complete after the scheduled session ends.</small>' : '';
      const card = document.createElement('article');
      card.className = 'mentor-request-card';
      card.innerHTML = `<div class="mentor-request-date"><small>${escapeHTML(date.toLocaleDateString('en-IN',{month:'short'}).toUpperCase())}</small><strong>${date.getDate()}</strong><span>${escapeHTML(date.toLocaleDateString('en-IN',{weekday:'short'}))}</span></div>
        <div class="mentor-request-main"><div class="mentor-request-title"><div><span class="request-topic-label">${escapeHTML(appt.service)}</span><h3>${escapeHTML(appt.name)}</h3></div><span class="status-pill ${escapeHTML(appt.status || 'pending')}">${escapeHTML(label)}</span></div>
        <div class="mentor-detail-grid"><p><small>STUDENT EMAIL</small><strong>${escapeHTML(appt.email)}</strong></p><p><small>PHONE</small><strong>${escapeHTML(appt.phone || 'Not provided')}</strong></p><p><small>REQUESTED MENTOR</small><strong>${escapeHTML(appt.mentor || 'Not specified')}</strong></p><p><small>REQUESTED TIME</small><strong>${escapeHTML(timeLabel(appt.time))} · ${escapeHTML(prettyDate(appt.date,{weekday:'short',month:'short',day:'numeric',year:'numeric'}))}</strong></p></div>
        ${appt.notes ? `<div class="mentor-student-notes"><small>STUDENT NOTE</small><p>${escapeHTML(appt.notes)}</p></div>` : ''}<div class="mentor-request-footer"><span>REFERENCE · ${escapeHTML(appt.id)}</span>${actions}</div></div>`;
      list.appendChild(card);
    });
    list.querySelectorAll('[data-mentor-action]').forEach(btn => btn.addEventListener('click', () => {
      const appt = appointments.find(a => a.id === btn.dataset.id);
      if (!appt) return;
      const action = btn.dataset.mentorAction;
      if (action === 'confirm' || action === 'decline') {
        if (appt.status !== 'pending') return;
        appt.status = action === 'confirm' ? 'confirmed' : 'declined';
        appt.reviewedAt = new Date().toISOString();
        saveAppointments(); renderMentorDashboard(); renderSlots(); updateNavCount();
        showToast(action === 'confirm' ? 'Request approved. The student portal will show Approved.' : 'Request rejected. The student portal will show Rejected.');
      } else if (action === 'complete') {
        if (appt.status !== 'confirmed' || !sessionHasEnded(appt)) { showToast('You can mark the session complete only after its scheduled time ends.'); return; }
        appt.status = 'completed'; appt.completedAt = new Date().toISOString(); saveAppointments(); renderMentorDashboard(); updateNavCount();
        showToast('Session completed. The student portal will show Session completed.');
      }
    }));
  }
  $('mentorRequestFilter').addEventListener('change', renderMentorDashboard);

  $('appointmentFilter').addEventListener('change', renderAppointments);
  function openCancel(id) { cancelTarget=id; $('cancelModal').classList.add('open'); $('cancelModal').setAttribute('aria-hidden','false'); $('keepBookingBtn').focus(); }
  function closeCancel() { $('cancelModal').classList.remove('open'); $('cancelModal').setAttribute('aria-hidden','true'); cancelTarget=null; }
  $('keepBookingBtn').addEventListener('click',closeCancel);
  $('cancelModal').addEventListener('click',e=>{if(e.target===$('cancelModal'))closeCancel();});
  $('confirmCancelBtn').addEventListener('click',()=>{
    const appt=appointments.find(a=>a.id===cancelTarget);
    if(appt){appt.status='cancelled';saveAppointments();if(document.body.dataset.role === 'mentor') renderMentorDashboard(); else renderAppointments();renderSlots();updateNavCount();updateSummary();showToast('Appointment cancelled. The slot is available again.');}
    closeCancel();
  });
  $('themeToggle').addEventListener('click',()=>{
    document.body.classList.toggle('dark');
    const dark=document.body.classList.contains('dark');
    $('themeToggle').textContent=dark?'☼':'◐';
    $('themeToggle').setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');
    localStorage.setItem('mentormeet_theme',dark?'dark':'light');
  });
  if (localStorage.getItem('mentormeet_theme')==='dark') { document.body.classList.add('dark'); $('themeToggle').textContent='☼'; }
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeSuccess();closeCancel();}});
  // Default to the first valid day and keep the calendar date in the current month.
  selectedDate=localDateKey(new Date());
  renderCalendar(); renderSlots(); updateSummary(); updateNavCount();
  let storedSession = null;
  try { storedSession = JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || 'null'); } catch {}
  if (storedSession && [STUDENT_EMAIL, MENTOR_EMAIL].includes(storedSession.email)) showApp(storedSession.role || (storedSession.email === MENTOR_EMAIL ? 'mentor' : 'student'));
  else showLogin();
})();