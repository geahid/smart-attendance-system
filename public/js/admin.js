const API = '';
let TOKEN = localStorage.getItem('att_token') || '';
let USER  = JSON.parse(localStorage.getItem('att_user') || 'null');
let ALL_STUDENTS = [], ATT_RECORDS = {}, ATT_SESSION = {}, FILTER_ABSENT = false;

window.addEventListener('DOMContentLoaded', () => {
  if (!TOKEN || !USER || USER.role !== 'admin') { window.location.href = '/'; return; }
  updateHeader();
  navigate('dashboard');
  let sx = 0, sy = 0;
  const pages = ['dashboard','attendance','students','history','profile'];
  document.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;
    if (document.querySelector('.modal-overlay.open')) return;
    const cur = document.querySelector('.nav-item.active')?.id?.replace('nav-', '');
    const idx = pages.indexOf(cur);
    if (dx < 0 && idx < pages.length - 1) navigate(pages[idx + 1]);
    if (dx > 0 && idx > 0) navigate(pages[idx - 1]);
  }, { passive: true });
});

function updateHeader() { document.getElementById('header-avatar').textContent = USER.avatar || 'AD'; }

const PAGES = ['dashboard','attendance','students','history','profile'];
function navigate(page) {
  PAGES.forEach(p => {
    document.getElementById(`page-${p}`)?.classList.remove('active');
    document.getElementById(`nav-${p}`)?.classList.remove('active');
  });
  document.getElementById(`page-${page}`)?.classList.add('active');
  document.getElementById(`nav-${page}`)?.classList.add('active');
  const titles = { dashboard:'Dashboard', attendance:'Attendance', students:'Students', history:'History', profile:'Profile' };
  document.getElementById('header-title').textContent = titles[page] || '';
  document.getElementById('fab-take-att').style.display = page === 'dashboard' ? 'flex' : 'none';
  if (page === 'dashboard')  loadDashboard();
  if (page === 'students')   loadStudents();
  if (page === 'history')    loadHistory();
  if (page === 'profile')    loadProfile();
  if (page === 'attendance') setupAttendancePage();
}

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  if (res.status === 401) { logout(); return null; }
  return res.json();
}

function logout() { localStorage.removeItem('att_token'); localStorage.removeItem('att_user'); window.location.href = '/'; }

async function loadDashboard() {
  const hr = new Date().getHours();
  document.getElementById('welcome-time').textContent = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('welcome-name').textContent = USER.name;
  const stats = await api('GET', '/api/dashboard/stats');
  if (stats) {
    animateCount('stat-total', 0, stats.totalStudents);
    animateCount('stat-classes', 0, stats.classesToday);
    animateCount('stat-present', 0, stats.presentToday);
    animateCount('stat-absent', 0, stats.absentToday);
  }
  const history = await api('GET', '/api/attendance/history');
  const c = document.getElementById('recent-sessions-list');
  if (!history || !history.length) { c.innerHTML = '<div class="empty-state"><p>No sessions yet</p></div>'; return; }
  c.innerHTML = history.slice(0, 3).map(renderHistoryCard).join('');
}

function animateCount(id, from, to) {
  const el = document.getElementById(id); if (!el) return;
  const dur = 800, start = performance.now();
  const step = now => { const p = Math.min((now - start) / dur, 1); el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

async function setupAttendancePage() {
  const now = new Date();
  document.getElementById('att-date').value = now.toISOString().split('T')[0];
  document.getElementById('att-time').value = now.toTimeString().slice(0, 5);
  document.getElementById('att-teacher').value = USER.name;
  const sel = document.getElementById('att-code');
  sel.innerHTML = '<option value="">Select code</option>';
  (USER.scheduleCodes || []).forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o); });
  document.getElementById('attendance-session').style.display = 'none';
  ATT_RECORDS = {}; FILTER_ABSENT = false;
}

async function startAttendance() {
  const teacher = document.getElementById('att-teacher').value.trim();
  const code    = document.getElementById('att-code').value;
  const subject = document.getElementById('att-subject').value.trim();
  const date    = document.getElementById('att-date').value;
  const time    = document.getElementById('att-time').value;
  if (!teacher || !code || !subject) { toast('Fill all session fields', 'error'); return; }
  ATT_SESSION = { teacherName: teacher, scheduleCode: code, subject, date, time };
  ATT_RECORDS = {};
  const students = await api('GET', '/api/students');
  if (!students) return;
  ALL_STUDENTS = students;
  students.forEach(s => ATT_RECORDS[s.id] = 'absent');
  renderAttStudents(students);
  document.getElementById('attendance-session').style.display = 'block';
  updateProgress();
  toast('Session started!', 'success');
}

function renderAttStudents(list) {
  const c = document.getElementById('att-student-list');
  if (!list.length) { c.innerHTML = '<div class="empty-state"><p>No students found</p></div>'; return; }
  c.innerHTML = list.map((s, i) => `
    <div class="student-card" id="scard-${s.id}" style="animation-delay:${i * 0.04}s">
      <div class="student-avatar">${s.avatar}</div>
      <div class="student-info">
        <div class="student-name">${s.name}</div>
        <div class="student-meta"><span>${s.studentId}</span><span>${s.section}</span></div>
      </div>
      <div class="status-btns">
        <button class="status-btn ${ATT_RECORDS[s.id]==='present'?'present':''}" onclick="setStatus('${s.id}','present')" title="Present">✓</button>
        <button class="status-btn ${ATT_RECORDS[s.id]==='late'?'late':''}" onclick="setStatus('${s.id}','late')" title="Late">⏱</button>
        <button class="status-btn ${ATT_RECORDS[s.id]==='absent'?'absent':''}" onclick="setStatus('${s.id}','absent')" title="Absent">✗</button>
      </div>
    </div>`).join('');
}

function setStatus(id, status) {
  ATT_RECORDS[id] = status;
  const card = document.getElementById(`scard-${id}`); if (!card) return;
  const btns = card.querySelectorAll('.status-btn');
  btns[0].className = `status-btn ${status === 'present' ? 'present' : ''}`;
  btns[1].className = `status-btn ${status === 'late' ? 'late' : ''}`;
  btns[2].className = `status-btn ${status === 'absent' ? 'absent' : ''}`;
  updateProgress();
}

function updateProgress() {
  const vals = Object.values(ATT_RECORDS);
  const total = ALL_STUDENTS.length, present = vals.filter(v => v === 'present').length, late = vals.filter(v => v === 'late').length, absent = vals.filter(v => v === 'absent').length;
  const pct = total ? Math.round((present + late) / total * 100) : 0;
  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('progress-pct').textContent = pct + '%';
  document.getElementById('cnt-present').textContent = present;
  document.getElementById('cnt-late').textContent = late;
  document.getElementById('cnt-absent').textContent = absent;
}

function markAllPresent() { ALL_STUDENTS.forEach(s => ATT_RECORDS[s.id] = 'present'); renderAttStudents(ALL_STUDENTS); updateProgress(); toast('All marked present', 'success'); }
function filterAbsent() { FILTER_ABSENT = !FILTER_ABSENT; renderAttStudents(FILTER_ABSENT ? ALL_STUDENTS.filter(s => ATT_RECORDS[s.id] === 'absent') : ALL_STUDENTS); toast(FILTER_ABSENT ? 'Showing absent only' : 'Showing all', 'info'); }
function filterStudents() { const q = document.getElementById('att-search').value.toLowerCase(); renderAttStudents(ALL_STUDENTS.filter(s => s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q))); }

async function saveAttendance() {
  const records = ALL_STUDENTS.map(s => ({ studentId: s.id, studentName: s.name, studentIdNum: s.studentId, section: s.section, status: ATT_RECORDS[s.id] || 'absent' }));
  const result = await api('POST', '/api/attendance', { ...ATT_SESSION, records });
  if (result?.id) { toast('Attendance saved!', 'success'); document.getElementById('attendance-session').style.display = 'none'; setTimeout(() => navigate('history'), 1000); }
  else toast('Failed to save', 'error');
}

function exportCSV() {
  if (!ALL_STUDENTS.length) { toast('No data', 'error'); return; }
  const rows = [['Name','Student ID','Section','Status'], ...ALL_STUDENTS.map(s => [s.name, s.studentId, s.section, ATT_RECORDS[s.id] || 'absent'])];
  const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `att_${ATT_SESSION.scheduleCode}_${ATT_SESSION.date}.csv`; a.click();
  toast('CSV exported!', 'success');
}

async function loadStudents() {
  document.getElementById('student-list-container').innerHTML = '<div class="spinner"></div>';
  ALL_STUDENTS = await api('GET', '/api/students') || [];
  renderStudentList(ALL_STUDENTS);
}

function renderStudentList(list) {
  const c = document.getElementById('student-list-container');
  if (!list.length) { c.innerHTML = '<div class="empty-state"><p>No students yet. Add some!</p></div>'; return; }
  c.innerHTML = list.map((s, i) => `
    <div class="student-card" style="animation-delay:${i * 0.04}s">
      <div class="student-avatar">${s.avatar}</div>
      <div class="student-info">
        <div class="student-name">${s.name}</div>
        <div class="student-meta"><span>${s.studentId}</span><span>${s.section}</span>${s.accountId ? '<span class="chip chip-present" style="font-size:10px;">✓ Registered</span>' : '<span style="font-size:10px;color:var(--text-muted);">No account</span>'}</div>
      </div>
      <button class="status-btn absent" title="Remove" onclick="removeStudent('${s.id}')">✗</button>
    </div>`).join('');
}

function filterStudentList() { const q = document.getElementById('student-search').value.toLowerCase(); renderStudentList(ALL_STUDENTS.filter(s => s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q) || s.section.toLowerCase().includes(q))); }

async function addStudent() {
  const name = document.getElementById('new-student-name').value.trim();
  const id   = document.getElementById('new-student-id').value.trim();
  const sec  = document.getElementById('new-student-section').value.trim();
  if (!name || !id || !sec) { toast('Fill all fields', 'error'); return; }
  const r = await api('POST', '/api/students', { name, studentId: id, section: sec });
  if (r?.id) { closeModal('modal-add-student'); toast(`${name} added!`, 'success'); loadStudents(); }
  else toast(r?.error || 'Failed', 'error');
}

async function removeStudent(id) {
  if (!confirm('Remove this student?')) return;
  await api('DELETE', `/api/students/${id}`);
  toast('Student removed', 'success'); loadStudents();
}

async function loadHistory() {
  document.getElementById('history-list').innerHTML = '<div class="spinner"></div>';
  const history = await api('GET', '/api/attendance/history');
  if (!history || !history.length) { document.getElementById('history-list').innerHTML = '<div class="empty-state"><p>No history yet</p></div>'; return; }
  document.getElementById('history-list').innerHTML = history.map(renderHistoryCard).join('');
}

function renderHistoryCard(s) {
  return `<div class="history-card" onclick="openHistoryDetail('${s.id}')">
    <div class="history-header"><div class="history-subject">${s.subject}</div><div class="history-code">${s.scheduleCode}</div></div>
    <div class="history-meta"><span>📅 ${s.date}</span><span>🕐 ${s.time}</span><span>👤 ${s.teacherName}</span></div>
    <div class="history-stats">
      <div class="hist-stat present"><div class="dot"></div>${s.totalPresent} Present</div>
      <div class="hist-stat late"><div class="dot"></div>${s.totalLate || 0} Late</div>
      <div class="hist-stat absent"><div class="dot"></div>${s.totalAbsent} Absent</div>
    </div>
  </div>`;
}

async function openHistoryDetail(id) {
  const s = await api('GET', `/api/attendance/${id}`); if (!s) return;
  document.getElementById('modal-detail-title').textContent = `${s.subject} — ${s.date}`;
  const total = s.records?.length || 0, pct = total ? Math.round(s.totalPresent / total * 100) : 0;
  document.getElementById('modal-detail-content').innerHTML = `
    <div style="margin-bottom:16px;">
      <div class="progress-label"><span class="font-raj text-sm">Attendance Rate</span><span class="text-accent font-raj">${pct}%</span></div>
      <div class="progress-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>
    </div>
    <div class="history-stats" style="margin-bottom:16px;">
      <div class="hist-stat present"><div class="dot"></div>${s.totalPresent} Present</div>
      <div class="hist-stat late"><div class="dot"></div>${s.totalLate || 0} Late</div>
      <div class="hist-stat absent"><div class="dot"></div>${s.totalAbsent} Absent</div>
    </div>
    <div class="divider"></div>
    ${(s.records || []).map(r => `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
        <div class="student-avatar" style="width:36px;height:36px;font-size:11px;">${r.studentName?.substring(0,2).toUpperCase() || '?'}</div>
        <div style="flex:1;"><div class="font-raj" style="font-size:15px;">${r.studentName}</div><div style="font-size:12px;color:var(--text-muted);">${r.studentIdNum} · ${r.section}</div></div>
        <div class="chip chip-${r.status}">${r.status.charAt(0).toUpperCase() + r.status.slice(1)}</div>
      </div>`).join('')}`;
  openModal('modal-history-detail');
}

function loadProfile() {
  document.getElementById('profile-avatar-lg').textContent = USER.avatar || 'AD';
  document.getElementById('profile-name').textContent = USER.name;
  document.getElementById('profile-email').textContent = USER.email || '';
  document.getElementById('profile-name-input').value = USER.name;
  document.getElementById('profile-codes-input').value = (USER.scheduleCodes || []).join(', ');
  document.getElementById('profile-codes').innerHTML = (USER.scheduleCodes || []).map(c => `<div class="code-badge">${c}</div>`).join('');
}

async function saveProfile() {
  const name = document.getElementById('profile-name-input').value.trim();
  const codes = document.getElementById('profile-codes-input').value.split(',').map(c => c.trim()).filter(Boolean);
  if (!name) { toast('Name required', 'error'); return; }
  const r = await api('PUT', '/api/profile', { name, scheduleCodes: codes });
  if (r?.success) {
    USER.name = name; USER.scheduleCodes = codes;
    USER.avatar = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    localStorage.setItem('att_user', JSON.stringify(USER));
    updateHeader(); loadProfile(); toast('Profile updated!', 'success');
  } else toast('Failed', 'error');
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function toast(msg, type = 'info') {
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'💡' };
  const c = document.getElementById('toast-container');
  const t = document.createElement('div'); t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`; c.appendChild(t);
  setTimeout(() => { t.style.animation = 'toastOut 0.35s ease forwards'; setTimeout(() => t.remove(), 350); }, 3000);
}
