const API = '';
let TOKEN = localStorage.getItem('att_token') || '';
let USER  = JSON.parse(localStorage.getItem('att_user') || 'null');

window.addEventListener('DOMContentLoaded', () => {
  if (!TOKEN || !USER || USER.role !== 'student') { window.location.href = '/'; return; }
  updateHeader();
  navigate('attendance');
  let sx = 0, sy = 0;
  document.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;
    if (document.querySelector('.modal-overlay.open')) return;
    const pages = ['attendance', 'profile'];
    const cur = document.querySelector('.nav-item.active')?.id?.replace('nav-', '');
    const idx = pages.indexOf(cur);
    if (dx < 0 && idx < pages.length - 1) navigate(pages[idx + 1]);
    if (dx > 0 && idx > 0) navigate(pages[idx - 1]);
  }, { passive: true });
});

function updateHeader() { document.getElementById('header-avatar').textContent = USER.avatar || 'ST'; }

function navigate(page) {
  ['attendance', 'profile'].forEach(p => {
    document.getElementById(`page-${p}`)?.classList.remove('active');
    document.getElementById(`nav-${p}`)?.classList.remove('active');
  });
  document.getElementById(`page-${page}`)?.classList.add('active');
  document.getElementById(`nav-${page}`)?.classList.add('active');
  document.getElementById('header-title').textContent = page === 'attendance' ? 'My Attendance' : 'My Profile';
  if (page === 'attendance') loadMyAttendance();
  if (page === 'profile') loadProfile();
}

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  if (res.status === 401) { logout(); return null; }
  return res.json();
}

function logout() { localStorage.removeItem('att_token'); localStorage.removeItem('att_user'); window.location.href = '/'; }

async function loadMyAttendance() {
  const hr = new Date().getHours();
  document.getElementById('welcome-time').textContent = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('welcome-name').textContent = USER.name;
  document.getElementById('my-history-list').innerHTML = '<div class="spinner"></div>';
  const history = await api('GET', '/api/attendance/history');
  if (!history || !history.length) {
    ['my-present','my-late','my-absent'].forEach(id => document.getElementById(id).textContent = '0');
    document.getElementById('my-history-list').innerHTML = '<div class="empty-state"><p>No attendance records yet</p></div>';
    return;
  }
  let totalPresent = 0, totalLate = 0, totalAbsent = 0;
  history.forEach(s => s.records?.forEach(r => { if (r.status === 'present') totalPresent++; else if (r.status === 'late') totalLate++; else totalAbsent++; }));
  animateCount('my-present', 0, totalPresent);
  animateCount('my-late', 0, totalLate);
  animateCount('my-absent', 0, totalAbsent);
  document.getElementById('my-history-list').innerHTML = history.map(s => {
    const myRecord = s.records?.[0];
    const status = myRecord?.status || 'absent';
    return `<div class="history-card" onclick="openDetail('${s.id}')">
      <div class="history-header">
        <div class="history-subject">${s.subject}</div>
        <div class="chip chip-${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</div>
      </div>
      <div class="history-meta"><span>📅 ${s.date}</span><span>🕐 ${s.time}</span><span>${s.scheduleCode}</span></div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Teacher: ${s.teacherName}</div>
    </div>`;
  }).join('');
}

async function openDetail(id) {
  const s = await api('GET', `/api/attendance/${id}`); if (!s) return;
  const myRecord = s.records?.[0];
  const status = myRecord?.status || 'absent';
  document.getElementById('modal-detail-title').textContent = `${s.subject} — ${s.date}`;
  document.getElementById('modal-detail-content').innerHTML = `
    <div class="glass-card" style="text-align:center;padding:30px 20px;margin-bottom:16px;">
      <div style="font-family:'Rajdhani',sans-serif;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:var(--text-muted);margin-bottom:12px;">Your Status</div>
      <div class="chip chip-${status}" style="font-size:18px;padding:10px 24px;">${status.toUpperCase()}</div>
    </div>
    <div class="glass-card">
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;justify-content:space-between;font-family:'Rajdhani',sans-serif;font-size:14px;"><span style="color:var(--text-muted);">Subject</span><span>${s.subject}</span></div>
        <div style="display:flex;justify-content:space-between;font-family:'Rajdhani',sans-serif;font-size:14px;"><span style="color:var(--text-muted);">Schedule</span><span>${s.scheduleCode}</span></div>
        <div style="display:flex;justify-content:space-between;font-family:'Rajdhani',sans-serif;font-size:14px;"><span style="color:var(--text-muted);">Date</span><span>${s.date}</span></div>
        <div style="display:flex;justify-content:space-between;font-family:'Rajdhani',sans-serif;font-size:14px;"><span style="color:var(--text-muted);">Time</span><span>${s.time}</span></div>
        <div style="display:flex;justify-content:space-between;font-family:'Rajdhani',sans-serif;font-size:14px;"><span style="color:var(--text-muted);">Teacher</span><span>${s.teacherName}</span></div>
      </div>
    </div>`;
  openModal('modal-history-detail');
}

function animateCount(id, from, to) {
  const el = document.getElementById(id); if (!el) return;
  const dur = 800, start = performance.now();
  const step = now => { const p = Math.min((now - start) / dur, 1); el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

async function loadProfile() {
  const me = await api('GET', '/api/me'); if (!me) return;
  USER = { ...USER, ...me }; localStorage.setItem('att_user', JSON.stringify(USER));
  document.getElementById('profile-avatar-lg').textContent = me.avatar || 'ST';
  document.getElementById('profile-name').textContent = me.name;
  document.getElementById('profile-studentid').textContent = 'Student ID: ' + (me.studentInfo?.studentId || '');
  document.getElementById('profile-section').textContent = 'Section: ' + (me.studentInfo?.section || '');
  document.getElementById('profile-name-input').value = me.name;
  document.getElementById('profile-email-input').value = me.email || '';
  document.getElementById('profile-avatar-input').value = me.avatar || '';
  updateHeader();
}

async function saveProfile() {
  const name   = document.getElementById('profile-name-input').value.trim();
  const email  = document.getElementById('profile-email-input').value.trim();
  const avatar = document.getElementById('profile-avatar-input').value.trim().toUpperCase().substring(0, 2);
  if (!name) { toast('Name required', 'error'); return; }
  const r = await api('PUT', '/api/profile', { name, email, avatar });
  if (r?.success) {
    USER.name = name; USER.email = email; if (avatar) USER.avatar = avatar;
    localStorage.setItem('att_user', JSON.stringify(USER));
    updateHeader(); loadProfile(); toast('Profile updated!', 'success');
  } else toast('Failed to update', 'error');
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
