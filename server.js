const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'smartattendance_secret_2024';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// DB Helpers
const DB_PATH = path.join(__dirname, 'db.json');

function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = {
      users: [
        {
          id: 1,
          name: 'Admin Teacher',
          email: 'admin@school.edu',
          password: bcrypt.hashSync('admin123', 10),
          role: 'teacher',
          scheduleCodes: ['CS101', 'MATH201', 'ENG301'],
          avatar: 'AT'
        }
      ],
      students: [
        { id: 's001', name: 'Juan dela Cruz', studentId: '2024-001', section: 'CS-1A', avatar: 'JD' },
        { id: 's002', name: 'Maria Santos', studentId: '2024-002', section: 'CS-1A', avatar: 'MS' },
        { id: 's003', name: 'Pedro Reyes', studentId: '2024-003', section: 'CS-1A', avatar: 'PR' },
        { id: 's004', name: 'Ana Garcia', studentId: '2024-004', section: 'CS-1A', avatar: 'AG' },
        { id: 's005', name: 'Carlo Mendoza', studentId: '2024-005', section: 'CS-1A', avatar: 'CM' },
        { id: 's006', name: 'Lisa Torres', studentId: '2024-006', section: 'CS-1B', avatar: 'LT' },
        { id: 's007', name: 'Marco Ramos', studentId: '2024-007', section: 'CS-1B', avatar: 'MR' },
        { id: 's008', name: 'Sofia Lim', studentId: '2024-008', section: 'CS-1B', avatar: 'SL' }
      ],
      attendance: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Auth Middleware
function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ── Routes ──────────────────────────────────────────────────────────────────

// POST /login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.email === email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, scheduleCodes: user.scheduleCodes, avatar: user.avatar } });
});

// GET /students
app.get('/api/students', authenticate, (req, res) => {
  const db = readDB();
  res.json(db.students);
});

// POST /students
app.post('/api/students', authenticate, (req, res) => {
  const { name, studentId, section } = req.body;
  if (!name || !studentId || !section) return res.status(400).json({ error: 'Missing fields' });
  const db = readDB();
  if (db.students.find(s => s.studentId === studentId)) {
    return res.status(409).json({ error: 'Student ID already exists' });
  }
  const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  const student = { id: 's' + Date.now(), name, studentId, section, avatar: initials };
  db.students.push(student);
  writeDB(db);
  res.status(201).json(student);
});

// DELETE /students/:id
app.delete('/api/students/:id', authenticate, (req, res) => {
  const db = readDB();
  db.students = db.students.filter(s => s.id !== req.params.id);
  writeDB(db);
  res.json({ success: true });
});

// POST /attendance
app.post('/api/attendance', authenticate, (req, res) => {
  const { teacherName, scheduleCode, subject, date, time, records } = req.body;
  if (!teacherName || !scheduleCode || !subject || !records) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const db = readDB();
  const session = {
    id: 'att' + Date.now(),
    teacherName,
    scheduleCode,
    subject,
    date: date || new Date().toISOString().split('T')[0],
    time: time || new Date().toLocaleTimeString(),
    records,
    totalPresent: records.filter(r => r.status === 'present').length,
    totalLate: records.filter(r => r.status === 'late').length,
    totalAbsent: records.filter(r => r.status === 'absent').length,
    createdAt: new Date().toISOString()
  };
  db.attendance.push(session);
  writeDB(db);
  res.status(201).json(session);
});

// GET /attendance/history
app.get('/api/attendance/history', authenticate, (req, res) => {
  const db = readDB();
  res.json(db.attendance.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// GET /attendance/:id
app.get('/api/attendance/:id', authenticate, (req, res) => {
  const db = readDB();
  const session = db.attendance.find(a => a.id === req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });
  res.json(session);
});

// GET /dashboard/stats
app.get('/api/dashboard/stats', authenticate, (req, res) => {
  const db = readDB();
  const today = new Date().toISOString().split('T')[0];
  const todaySessions = db.attendance.filter(a => a.date === today);
  const totalPresent = todaySessions.reduce((sum, s) => sum + s.totalPresent, 0);
  const totalAbsent = todaySessions.reduce((sum, s) => sum + s.totalAbsent, 0);
  res.json({
    totalStudents: db.students.length,
    classesToday: todaySessions.length,
    presentToday: totalPresent,
    absentToday: totalAbsent
  });
});

// PUT /profile
app.put('/api/profile', authenticate, (req, res) => {
  const { name, scheduleCodes } = req.body;
  const db = readDB();
  const idx = db.users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  if (name) db.users[idx].name = name;
  if (scheduleCodes) db.users[idx].scheduleCodes = scheduleCodes;
  writeDB(db);
  res.json({ success: true, user: db.users[idx] });
});

// Fallback — serve index for SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Smart Attendance Server running on http://localhost:${PORT}`);
  readDB(); // initialise DB on first run
});
