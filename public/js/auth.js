const API = '';

window.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('att_token');
  const user  = JSON.parse(localStorage.getItem('att_user') || 'null');

  // If already logged in, go straight to the right page
  if (token && user) {
    redirectByRole(user.role);
    return;
  }

  // Show splash then reveal login
  const splash = document.getElementById('splash');
  const authScreen = document.getElementById('auth-screen');

  setTimeout(() => {
    splash.style.opacity = '0';
    splash.style.transform = 'scale(1.05)';
    splash.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    setTimeout(() => {
      splash.style.display = 'none';
      authScreen.style.display = 'flex';
    }, 600);
  }, 2500);

  document.getElementById('login-password')
    .addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  document.getElementById('reg-confirm')
    .addEventListener('keydown', e => { if (e.key === 'Enter') handleRegister(); });
});

function redirectByRole(role) {
  if (role === 'admin') window.location.href = '/admin.html';
  else window.location.href = '/student.html';
}

function showRegister() {
  document.getElementById('form-login').style.display = 'none';
  document.getElementById('form-register').style.display = 'block';
  document.getElementById('register-error').style.display = 'none';
  document.getElementById('register-success').style.display = 'none';
}
function showLogin() {
  document.getElementById('form-register').style.display = 'none';
  document.getElementById('form-login').style.display = 'block';
  document.getElementById('login-error').style.display = 'none';
}

async function handleLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-btn');
  const btnTxt = document.getElementById('login-btn-text');
  document.getElementById('login-error').style.display = 'none';
  if (!username || !password) { showErr('login-error', 'Please enter username and password'); return; }
  btn.disabled = true; btnTxt.textContent = 'Signing in…';
  try {
    const res  = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    localStorage.setItem('att_token', data.token);
    localStorage.setItem('att_user', JSON.stringify(data.user));
    toast('Welcome, ' + data.user.name + '!', 'success');
    setTimeout(() => redirectByRole(data.user.role), 800);
  } catch (err) {
    showErr('login-error', err.message);
  } finally {
    btn.disabled = false; btnTxt.textContent = 'Sign In';
  }
}

async function handleRegister() {
  const studentId = document.getElementById('reg-studentid').value.trim();
  const username  = document.getElementById('reg-username').value.trim();
  const password  = document.getElementById('reg-password').value;
  const confirm   = document.getElementById('reg-confirm').value;
  const btn = document.getElementById('register-btn');
  const btnTxt = document.getElementById('register-btn-text');
  document.getElementById('register-error').style.display = 'none';
  document.getElementById('register-success').style.display = 'none';
  if (!studentId || !username || !password || !confirm) { showErr('register-error', 'All fields are required'); return; }
  if (password.length < 6) { showErr('register-error', 'Password must be at least 6 characters'); return; }
  if (password !== confirm) { showErr('register-error', 'Passwords do not match'); return; }
  btn.disabled = true; btnTxt.textContent = 'Creating…';
  try {
    const res  = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, studentId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    localStorage.setItem('att_token', data.token);
    localStorage.setItem('att_user', JSON.stringify(data.user));
    const s = document.getElementById('register-success');
    s.textContent = '✅ Account created! Redirecting…';
    s.style.display = 'block';
    setTimeout(() => window.location.href = '/student.html', 1200);
  } catch (err) {
    showErr('register-error', err.message);
  } finally {
    btn.disabled = false; btnTxt.textContent = 'Create Account';
  }
}

function showErr(id, msg) {
  const el = document.getElementById(id);
  el.textContent = '⚠ ' + msg;
  el.style.display = 'block';
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

function toast(msg, type = 'info') {
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'💡' };
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'toastOut 0.35s ease forwards';
    setTimeout(() => t.remove(), 350);
  }, 3000);
}
