/* ═══════════════════════════════════════════════════════
   SMART ATTENDANCE SYSTEM — app.js
   ═══════════════════════════════════════════════════════ */

const API = '';  // same origin (Express serves frontend)
let TOKEN = localStorage.getItem('att_token') || '';
let USER  = JSON.parse(localStorage.getItem('att_user') || 'null');
let ALL_STUDENTS = [];
let ATT_RECORDS  = {};   // studentId → status
let ATT_SESSION  = {};
let FILTER_ABSENT = false;

/* ─────────────────────────────────────────
   SPLASH → LOGIN / DASHBOARD
───────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const splash = document.getElementById('splash');
    splash.classList.add('hide');
    setTimeout(() => {
      splash.style.display = 'none';
      if (TOKEN && USER) {
        showApp();
      } else {
        showLogin();
      }
    }, 600);
  }, 2800);
});

function showLogin() {
  document.getElementById('page-login').classList.add('active');
  document.getElementById('app').classList.remove('active');
  // Enter key
  document.getElementById('login-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });
}

function showApp() {
  document.getElementById('page-login').classList.remove('active');
  document.getElementById('app').classList.add('active');
  updateHeaderUser();
  navigate('dashboard');
}

/* ─────────────────────────────────────────
   AUTH
───────────────────────────────────────── */
async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  const btn   = document.getElementById('login-btn');
  const btnTxt= document.getElementById('login-btn-text');

  errEl.classList.remove('show');
  btn.disabled = true;
  btnTxt.textContent = 'Signing in…';

  try {
    const res  = await fetch(`${API}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    TOKEN = data.token;
    USER  = data.user;
    localStorage.setItem('att_token', TOKEN);
    localStorage.setItem('att_user', JSON.stringify(USER));
    showApp();
  } catch (err) {
    errEl.classList.add('show');
    errEl.textContent = '⚠ ' + (err.message || 'Login failed');
  } finally {
    btn.disabled = false;
    btnTxt.textContent = 'Sign In';
  }
}

function logout() {
  TOKEN = '';
  USER  = null;
  localStorage.removeItem('att_token');
  localStorage.removeItem('att_user');
  location.reload();
}

/* ─────────────────────────────────────────
   API HELPER
───────────────────────────────────────── */
async function api(method, path, body) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  if (res.status === 401) { logout(); return null; }
  return res.json();
}

/* ─────────────────────────────────────────
   NAVIGATION
───────────────────────────────────────── */
const PAGES = ['dashboard','attendance','students','history','profile'];

function navigate(page) {
  PAGES.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) {
      el.style.display = 'none';
      el.classList.remove('active');
    }
    const nav = document.getElementById(`nav-${p}`);
    if (nav) nav.classList.remove('active');
  });

  const target = document.getElementById(`page-${page}`);
  if (target) {
    target.style.display = 'block';
    target.classList.add('active');
  }
  const navItem = document.getElementById(`nav-${page}`);
  if (navItem) navItem.classList.add('active');

  const titles = {
    dashboard: 'Dashboard',
    attendance: 'Attendance',
    students: 'Students',
    history: 'History',
    profile: 'Profile'
  };
  document.getElementById('header-title').textContent = titles[page] || '';

  // Show/hide FAB
  const fab = document.getElementById('fab-take-att');
  fab.style.display = (page === 'dashboard') ? 'flex' : 'none';

  // Load data per page
  if (page === 'dashboard') loadDashboard();
  if (page === 'students')  loadStudents();
  if (page === 'history')   loadHistory();
  if (page === 'profile')   loadProfile();
  if (page === 'attendance') setupAttendancePage();
}

/* ─────────────────────────────────────────
   HEADER
───────────────────────────────────────── */
function updateHeaderUser() {
  if (USER) {
    document.getElementById('header-avatar').textContent = USER.avatar || USER.name?.substring(0,2).toUpperCase() || 'T';
  }
}

/* ─────────────────────────────────────────
   DASHBOARD
───────────────────────────────────────── */
async function loadDashboard() {
  // Greeting
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('welcome-time').textContent = greet;
  if (USER) document.getElementById('welcome-name').textContent = USER.name;

  // Stats
  const stats = await api('GET', '/api/dashboard/stats');
  if (stats) {
    animateCount('stat-total',   0, stats.totalStudents, 800);
    animateCount('stat-classes', 0, stats.classesToday,  800);
    animateCount('stat-present', 0, stats.presentToday,  800);
    animateCount('stat-absent',  0, stats.absentToday,   800);
  }

  // Recent sessions
  const history = await api('GET', '/api/attendance/history');
  const container = document.getElementById('recent-sessions-list');
  if (!history || history.length === 0) {
    container.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>No sessions yet. Take attendance!</p></div>';
    return;
  }
  container.innerHTML = history.slice(0,3).map(renderHistoryCard).join('');
}

function animateCount(id, from, to, duration) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = performance.now();
  const step = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(from + (to - from) * ease);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ─────────────────────────────────────────
   ATTENDANCE PAGE
───────────────────────────────────────── */
async function setupAttendancePage() {
  // Set today's date + current time
  const now = new Date();
  document.getElementById('att-date').value = now.toISOString().split('T')[0];
  document.getElementById('att-time').value = now.toTimeString().slice(0,5);

  // Fill teacher name
  if (USER) document.getElementById('att-teacher').value = USER.name;

  // Fill schedule codes
  const sel = document.getElementById('att-code');
  sel.innerHTML = '<option value="">Select schedule code</option>';
  if (USER && USER.scheduleCodes) {
    USER.scheduleCodes.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      sel.appendChild(opt);
    });
  }

  // Reset session
  document.getElementById('attendance-session').style.display = 'none';
  ATT_RECORDS = {};
  FILTER_ABSENT = false;
}

async function startAttendance() {
  const teacher  = document.getElementById('att-teacher').value.trim();
  const code     = document.getElementById('att-code').value;
  const subject  = document.getElementById('att-subject').value.trim();
  const date     = document.getElementById('att-date').value;
  const time     = document.getElementById('att-time').value;

  if (!teacher || !code || !subject) {
    toast('Please fill all session fields', 'error'); return;
  }

  ATT_SESSION = { teacherName: teacher, scheduleCode: code, subject, date, time };
  ATT_RECORDS = {};
  FILTER_ABSENT = false;

  const students = await api('GET', '/api/students');
  if (!students) return;
  ALL_STUDENTS = students;

  // Default all to absent
  students.forEach(s => { ATT_RECORDS[s.id] = 'absent'; });

  renderAttStudents(students);
  document.getElementById('attendance-session').style.display = 'block';
  updateProgress();
  toast('Session started! Mark attendance below', 'success');
}

function renderAttStudents(list) {
  const container = document.getElementById('att-student-list');
  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.5"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg><p>No students found</p></div>';
    return;
  }
  container.innerHTML = list.map(s => {
    const status = ATT_RECORDS[s.id] || 'absent';
    return `
    <div class="student-card" id="scard-${s.id}" style="animation-delay:${list.indexOf(s)*0.04}s">
      <div class="student-avatar">${s.avatar}</div>
      <div class="student-info">
        <div class="student-name">${s.name}</div>
        <div class="student-meta">
          <span>${s.studentId}</span>
          <span>${s.section}</span>
        </div>
      </div>
      <div class="status-btns">
        <button class="status-btn ${status==='present'?'present':''}" title="Present" onclick="setStatus('${s.id}','present')">✓</button>
        <button class="status-btn ${status==='late'?'late':''}" title="Late" onclick="setStatus('${s.id}','late')">⏱</button>
        <button class="status-btn ${status==='absent'?'absent':''}" title="Absent" onclick="setStatus('${s.id}','absent')">✗</button>
      </div>
    </div>`;
  }).join('');
}

function setStatus(studentId, status) {
  ATT_RECORDS[studentId] = status;
  // Update card buttons
  const card = document.getElementById(`scard-${studentId}`);
  if (!card) return;
  const btns = card.querySelectorAll('.status-btn');
  btns[0].className = `status-btn ${status==='present'?'present':''}`;
  btns[1].className = `status-btn ${status==='late'?'late':''}`;
  btns[2].className = `status-btn ${status==='absent'?'absent':''}`;
  updateProgress();
}

function updateProgress() {
  const vals = Object.values(ATT_RECORDS);
  const total   = ALL_STUDENTS.length;
  const present = vals.filter(v=>v==='present').length;
  const late    = vals.filter(v=>v==='late').length;
  const absent  = vals.filter(v=>v==='absent').length;
  const marked  = present + late;
  const pct = total ? Math.round(marked / total * 100) : 0;

  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('progress-pct').textContent = pct + '%';
  document.getElementById('cnt-present').textContent = present;
  document.getElementById('cnt-late').textContent    = late;
  document.getElementById('cnt-absent').textContent  = absent;
}

function markAllPresent() {
  ALL_STUDENTS.forEach(s => { ATT_RECORDS[s.id] = 'present'; });
  renderAttStudents(ALL_STUDENTS);
  updateProgress();
  toast('All students marked as present', 'success');
}

function filterAbsent() {
  FILTER_ABSENT = !FILTER_ABSENT;
  const list = FILTER_ABSENT
    ? ALL_STUDENTS.filter(s => ATT_RECORDS[s.id] === 'absent')
    : ALL_STUDENTS;
  renderAttStudents(list);
  toast(FILTER_ABSENT ? 'Showing absent students only' : 'Showing all students', 'info');
}

function filterStudents() {
  const q = document.getElementById('att-search').value.toLowerCase();
  const list = ALL_STUDENTS.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.studentId.toLowerCase().includes(q) ||
    s.section.toLowerCase().includes(q)
  );
  renderAttStudents(list);
}

async function saveAttendance() {
  const records = ALL_STUDENTS.map(s => ({
    studentId: s.id,
    studentName: s.name,
    studentIdNum: s.studentId,
    section: s.section,
    status: ATT_RECORDS[s.id] || 'absent'
  }));

  const payload = { ...ATT_SESSION, records };
  const result  = await api('POST', '/api/attendance', payload);
  if (result && result.id) {
    toast('Attendance saved successfully!', 'success');
    document.getElementById('attendance-session').style.display = 'none';
    setTimeout(() => navigate('history'), 1200);
  } else {
    toast('Failed to save attendance', 'error');
  }
}

function exportCSV() {
  if (ALL_STUDENTS.length === 0) { toast('No data to export', 'error'); return; }
  const rows = [['Name','Student ID','Section','Status']];
  ALL_STUDENTS.forEach(s => {
    rows.push([s.name, s.studentId, s.section, ATT_RECORDS[s.id] || 'absent']);
  });
  const csv  = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `attendance_${ATT_SESSION.scheduleCode}_${ATT_SESSION.date}.csv`;
  a.click();
  toast('CSV exported!', 'success');
}

/* ─────────────────────────────────────────
   STUDENTS
───────────────────────────────────────── */
async function loadStudents() {
  const container = document.getElementById('student-list-container');
  container.innerHTML = '<div class="spinner"></div>';
  const students = await api('GET', '/api/students');
  ALL_STUDENTS = students || [];
  renderStudentList(ALL_STUDENTS);
}

function renderStudentList(list) {
  const container = document.getElementById('student-list-container');
  if (!list || list.length === 0) {
    container.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.5"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg><p>No students yet. Add some!</p></div>';
    return;
  }
  container.innerHTML = list.map((s, i) => `
    <div class="student-card" style="animation-delay:${i*0.04}s">
      <div class="student-avatar">${s.avatar}</div>
      <div class="student-info">
        <div class="student-name">${s.name}</div>
        <div class="student-meta"><span>${s.studentId}</span><span>${s.section}</span></div>
      </div>
      <button class="status-btn absent" title="Remove" onclick="removeStudent('${s.id}')">✗</button>
    </div>
  `).join('');
}

function filterStudentList() {
  const q = document.getElementById('student-search').value.toLowerCase();
  const filtered = ALL_STUDENTS.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.studentId.toLowerCase().includes(q) ||
    s.section.toLowerCase().includes(q)
  );
  renderStudentList(filtered);
}

function openAddStudent() {
  document.getElementById('new-student-name').value = '';
  document.getElementById('new-student-id').value   = '';
  document.getElementById('new-student-section').value = '';
  openModal('modal-add-student');
}

async function addStudent() {
  const name    = document.getElementById('new-student-name').value.trim();
  const id      = document.getElementById('new-student-id').value.trim();
  const section = document.getElementById('new-student-section').value.trim();
  if (!name || !id || !section) { toast('Fill all student fields', 'error'); return; }

  const result = await api('POST', '/api/students', { name, studentId: id, section });
  if (result && result.id) {
    closeModal('modal-add-student');
    toast(`${name} added!`, 'success');
    loadStudents();
  } else {
    toast(result?.error || 'Failed to add student', 'error');
  }
}

async function removeStudent(id) {
  if (!confirm('Remove this student?')) return;
  await api('DELETE', `/api/students/${id}`);
  toast('Student removed', 'success');
  loadStudents();
}

/* ─────────────────────────────────────────
   HISTORY
───────────────────────────────────────── */
async function loadHistory() {
  const container = document.getElementById('history-list');
  container.innerHTML = '<div class="spinner"></div>';
  const history = await api('GET', '/api/attendance/history');
  if (!history || history.length === 0) {
    container.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><p>No attendance history yet</p></div>';
    return;
  }
  container.innerHTML = history.map(renderHistoryCard).join('');
}

function renderHistoryCard(session) {
  const date = new Date(session.createdAt).toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' });
  return `
  <div class="history-card" onclick="openHistoryDetail('${session.id}')">
    <div class="history-header">
      <div class="history-subject">${session.subject}</div>
      <div class="history-code">${session.scheduleCode}</div>
    </div>
    <div class="history-meta">
      <span>📅 ${session.date}</span>
      <span>🕐 ${session.time}</span>
      <span>👤 ${session.teacherName}</span>
    </div>
    <div class="history-stats">
      <div class="hist-stat present"><div class="dot"></div>${session.totalPresent} Present</div>
      <div class="hist-stat late"><div class="dot"></div>${session.totalLate || 0} Late</div>
      <div class="hist-stat absent"><div class="dot"></div>${session.totalAbsent} Absent</div>
    </div>
  </div>`;
}

async function openHistoryDetail(id) {
  const session = await api('GET', `/api/attendance/${id}`);
  if (!session) return;
  document.getElementById('modal-detail-title').textContent = `${session.subject} — ${session.date}`;
  const content = document.getElementById('modal-detail-content');

  const total = session.records?.length || 0;
  const pct   = total ? Math.round(session.totalPresent / total * 100) : 0;

  content.innerHTML = `
    <div style="margin-bottom:16px;">
      <div class="progress-label">
        <span class="font-raj text-sm">Attendance Rate</span>
        <span class="text-accent font-raj">${pct}%</span>
      </div>
      <div class="progress-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>
    </div>
    <div class="history-stats" style="margin-bottom:16px;">
      <div class="hist-stat present"><div class="dot"></div>${session.totalPresent} Present</div>
      <div class="hist-stat late"><div class="dot"></div>${session.totalLate||0} Late</div>
      <div class="hist-stat absent"><div class="dot"></div>${session.totalAbsent} Absent</div>
    </div>
    <div class="divider"></div>
    ${(session.records || []).map(r => `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
        <div class="student-avatar" style="width:36px;height:36px;font-size:11px;">${r.studentName?.substring(0,2).toUpperCase()||'?'}</div>
        <div style="flex:1;">
          <div class="font-raj" style="font-size:15px;">${r.studentName}</div>
          <div style="font-size:12px;color:var(--text-muted);">${r.studentIdNum} · ${r.section}</div>
        </div>
        <div class="chip chip-${r.status}">${r.status.charAt(0).toUpperCase()+r.status.slice(1)}</div>
      </div>
    `).join('')}
  `;
  openModal('modal-history-detail');
}

/* ─────────────────────────────────────────
   PROFILE
───────────────────────────────────────── */
function loadProfile() {
  if (!USER) return;
  const initials = USER.avatar || USER.name?.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase() || 'T';
  document.getElementById('profile-avatar-lg').textContent = initials;
  document.getElementById('profile-name').textContent  = USER.name;
  document.getElementById('profile-email').textContent = USER.email;
  document.getElementById('profile-name-input').value  = USER.name;
  document.getElementById('profile-codes-input').value = (USER.scheduleCodes || []).join(', ');

  const codesWrap = document.getElementById('profile-codes');
  codesWrap.innerHTML = (USER.scheduleCodes || []).map(c => `<div class="code-badge">${c}</div>`).join('');
}

async function saveProfile() {
  const name  = document.getElementById('profile-name-input').value.trim();
  const codes = document.getElementById('profile-codes-input').value.split(',').map(c=>c.trim()).filter(Boolean);
  if (!name) { toast('Name is required', 'error'); return; }

  const result = await api('PUT', '/api/profile', { name, scheduleCodes: codes });
  if (result?.success) {
    USER.name = name;
    USER.scheduleCodes = codes;
    USER.avatar = name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
    localStorage.setItem('att_user', JSON.stringify(USER));
    updateHeaderUser();
    loadProfile();
    toast('Profile updated!', 'success');
  } else {
    toast('Failed to update profile', 'error');
  }
}

/* ─────────────────────────────────────────
   MODAL
───────────────────────────────────────── */
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

/* ─────────────────────────────────────────
   TOAST
───────────────────────────────────────── */
function toast(msg, type = 'info') {
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'💡' };
  const container = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type]||'💡'}</span><span>${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'toastOut 0.35s ease forwards';
    setTimeout(() => t.remove(), 350);
  }, 3000);
}

/* ─────────────────────────────────────────
   SWIPE GESTURES (mobile)
───────────────────────────────────────── */
let touchStartX = 0;
let touchStartY = 0;
const pages_order = ['dashboard','attendance','students','history','profile'];

document.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;

  // Don't swipe if a modal is open
  const openModal = document.querySelector('.modal-overlay.open');
  if (openModal) return;

  const activeNav = document.querySelector('.nav-item.active');
  if (!activeNav) return;
  const currentId = activeNav.id.replace('nav-', '');
  const idx = pages_order.indexOf(currentId);
  if (dx < 0 && idx < pages_order.length - 1) navigate(pages_order[idx + 1]);
  if (dx > 0 && idx > 0) navigate(pages_order[idx - 1]);
}, { passive: true });
