const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'smartattendance_secret_2024';

const PUBLIC_DIR = path.resolve(__dirname, 'public');
const DB_PATH    = path.resolve(__dirname, 'db.json');

app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = {
      accounts: [{
        id: 'admin', username: 'admin',
        password: bcrypt.hashSync('admin123', 10),
        role: 'admin', name: 'Administrator',
        email: 'admin@school.edu', avatar: 'AD',
        scheduleCodes: ['CS101', 'MATH201', 'ENG301']
      }],
      students: [
        { id: 's001', name: 'Juan dela Cruz',  studentId: '2024-001', section: 'CS-1A', avatar: 'JD', accountId: null },
        { id: 's002', name: 'Maria Santos',    studentId: '2024-002', section: 'CS-1A', avatar: 'MS', accountId: null },
        { id: 's003', name: 'Pedro Reyes',     studentId: '2024-003', section: 'CS-1A', avatar: 'PR', accountId: null },
        { id: 's004', name: 'Ana Garcia',      studentId: '2024-004', section: 'CS-1A', avatar: 'AG', accountId: null },
        { id: 's005', name: 'Carlo Mendoza',   studentId: '2024-005', section: 'CS-1A', avatar: 'CM', accountId: null },
        { id: 's006', name: 'Lisa Torres',     studentId: '2024-006', section: 'CS-1B', avatar: 'LT', accountId: null },
        { id: 's007', name: 'Marco Ramos',     studentId: '2024-007', section: 'CS-1B', avatar: 'MR', accountId: null },
        { id: 's008', name: 'Sofia Lim',       studentId: '2024-008', section: 'CS-1B', avatar: 'SL', accountId: null }
      ],
      attendance: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}
function writeDB(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }

function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
}
function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
  const acc = db.accounts.find(a => a.username === username);
  if (!acc || !bcrypt.compareSync(password, acc.password))
    return res.status(401).json({ error: 'Invalid username or password' });
  const token = jwt.sign({ id: acc.id, username: acc.username, role: acc.role, name: acc.name }, JWT_SECRET, { expiresIn: '7d' });
  const { password: _, ...safe } = acc;
  res.json({ token, user: safe });
});

app.post('/api/register', (req, res) => {
  const { username, password, studentId } = req.body;
  if (!username || !password || !studentId) return res.status(400).json({ error: 'All fields required' });
  const db = readDB();
  if (db.accounts.find(a => a.username === username)) return res.status(409).json({ error: 'Username already taken' });
  const student = db.students.find(s => s.studentId === studentId);
  if (!student) return res.status(404).json({ error: 'Student ID not found. Contact your teacher.' });
  if (student.accountId) return res.status(409).json({ error: 'This Student ID already has an account.' });
  const newAcc = {
    id: 'acc_' + Date.now(), username,
    password: bcrypt.hashSync(password, 10),
    role: 'student', name: student.name, email: '',
    avatar: student.avatar, studentId: student.id, scheduleCodes: []
  };
  db.accounts.push(newAcc);
  student.accountId = newAcc.id;
  writeDB(db);
  const token = jwt.sign({ id: newAcc.id, username, role: 'student', name: newAcc.name }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user: { id: newAcc.id, username, role: 'student', name: newAcc.name, avatar: newAcc.avatar, studentId: student.id } });
});

app.get('/api/students', authenticate, (req, res) => res.json(readDB().students));
app.post('/api/students', authenticate, adminOnly, (req, res) => {
  const { name, studentId, section } = req.body;
  if (!name || !studentId || !section) return res.status(400).json({ error: 'Missing fields' });
  const db = readDB();
  if (db.students.find(s => s.studentId === studentId)) return res.status(409).json({ error: 'Student ID exists' });
  const student = { id: 's' + Date.now(), name, studentId, section, avatar: name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase(), accountId: null };
  db.students.push(student); writeDB(db); res.status(201).json(student);
});
app.delete('/api/students/:id', authenticate, adminOnly, (req, res) => {
  const db = readDB();
  db.students = db.students.filter(s => s.id !== req.params.id);
  writeDB(db); res.json({ success: true });
});

app.post('/api/attendance', authenticate, adminOnly, (req, res) => {
  const { teacherName, scheduleCode, subject, date, time, records } = req.body;
  if (!teacherName || !scheduleCode || !subject || !records) return res.status(400).json({ error: 'Missing fields' });
  const db = readDB();
  const session = {
    id: 'att' + Date.now(), teacherName, scheduleCode, subject,
    date: date || new Date().toISOString().split('T')[0],
    time: time || new Date().toLocaleTimeString(),
    records,
    totalPresent: records.filter(r=>r.status==='present').length,
    totalLate:    records.filter(r=>r.status==='late').length,
    totalAbsent:  records.filter(r=>r.status==='absent').length,
    createdAt: new Date().toISOString()
  };
  db.attendance.push(session); writeDB(db); res.status(201).json(session);
});

app.get('/api/attendance/history', authenticate, (req, res) => {
  const db = readDB();
  let sessions = [...db.attendance].sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
  if (req.user.role === 'student') {
    const acc = db.accounts.find(a => a.id === req.user.id);
    const sid = acc?.studentId;
    sessions = sid ? sessions.filter(s=>s.records.some(r=>r.studentId===sid)).map(s=>({...s,records:s.records.filter(r=>r.studentId===sid)})) : [];
  }
  res.json(sessions);
});

app.get('/api/attendance/:id', authenticate, (req, res) => {
  const session = readDB().attendance.find(a => a.id === req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });
  res.json(session);
});

app.get('/api/dashboard/stats', authenticate, adminOnly, (req, res) => {
  const db = readDB();
  const today = new Date().toISOString().split('T')[0];
  const ts = db.attendance.filter(a => a.date === today);
  res.json({ totalStudents: db.students.length, classesToday: ts.length, presentToday: ts.reduce((s,x)=>s+x.totalPresent,0), absentToday: ts.reduce((s,x)=>s+x.totalAbsent,0) });
});

app.get('/api/me', authenticate, (req, res) => {
  const db = readDB();
  const acc = db.accounts.find(a => a.id === req.user.id);
  if (!acc) return res.status(404).json({ error: 'Not found' });
  const { password, ...safe } = acc;
  if (acc.role === 'student') safe.studentInfo = db.students.find(s=>s.id===acc.studentId) || null;
  res.json(safe);
});

app.put('/api/profile', authenticate, (req, res) => {
  const db = readDB();
  const idx = db.accounts.findIndex(a => a.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'admin') {
    const { name, scheduleCodes } = req.body;
    if (name) db.accounts[idx].name = name;
    if (scheduleCodes) db.accounts[idx].scheduleCodes = scheduleCodes;
  } else {
    const { name, avatar, email } = req.body;
    if (name) { db.accounts[idx].name = name; const s = db.students.find(s=>s.id===db.accounts[idx].studentId); if(s) s.name=name; }
    if (avatar) { db.accounts[idx].avatar = avatar.toUpperCase().substring(0,2); const s = db.students.find(s=>s.id===db.accounts[idx].studentId); if(s) s.avatar=avatar.toUpperCase().substring(0,2); }
    if (email !== undefined) db.accounts[idx].email = email;
  }
  writeDB(db);
  const { password, ...safe } = db.accounts[idx];
  res.json({ success: true, user: safe });
});

app.get('*', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
app.listen(PORT, () => { console.log(`✅ Running on http://localhost:${PORT}`); readDB(); });
