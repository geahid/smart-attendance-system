# ⚡ Smart Attendance System

A professional, mobile-first attendance management web application with a **dark maroon theme**, animated UI, and full backend API.

---

## 🚀 Features

- **Splash screen** with animated glowing rings
- **Secure login** with JWT authentication
- **Dashboard** with live statistics and animated counters
- **Attendance sessions** — mark students Present / Late / Absent
- **Student management** — add and remove students
- **Attendance history** with detailed session records
- **Export CSV** of any attendance session
- **Swipe gestures** for mobile navigation
- **Toast notifications** and smooth animations
- Dark Maroon + Neon Red theme, Orbitron/Exo 2 fonts

---

## 🛠 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | HTML, CSS, Vanilla JS |
| Backend | Node.js, Express.js |
| Auth | JWT + bcryptjs |
| Database | JSON file (db.json) |
| Hosting | Render-ready |

---

## 📦 Installation

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/smart-attendance-system.git
cd smart-attendance-system
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run the server

```bash
node server.js
```

Open: **http://localhost:3000**

---

## 🔐 Default Login

| Field | Value |
|-------|-------|
| Email | `admin@school.edu` |
| Password | `admin123` |

---

## 🌐 Deploy on Render

1. Push your project to GitHub
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your GitHub repo
4. Set:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Environment:** Node
5. Click **Deploy** ✅

The app uses `process.env.PORT` automatically on Render.

---

## 📁 Project Structure

```
attendance-system/
├── public/
│   ├── css/style.css
│   ├── js/app.js
│   └── index.html
├── server.js
├── package.json
├── db.json          ← auto-generated on first run
└── README.md
```

---

## 📱 Mobile Optimized

Designed for Android phones (portrait view), touch-optimized with swipe gestures between pages.

---

## 📄 API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/login` | Authenticate teacher |
| GET | `/api/students` | Get all students |
| POST | `/api/students` | Add new student |
| DELETE | `/api/students/:id` | Remove student |
| POST | `/api/attendance` | Save attendance session |
| GET | `/api/attendance/history` | Get all sessions |
| GET | `/api/attendance/:id` | Get session details |
| GET | `/api/dashboard/stats` | Get dashboard stats |
| PUT | `/api/profile` | Update teacher profile |

---

## 📝 License

MIT — Free to use and modify.
