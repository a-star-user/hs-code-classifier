# 📁 HS Code Expert - File Structure & What Each File Does

```
HS CODE TEST/
│
├── 🌐 APPLICATION CORE
│   ├── HS CODE Expert.html          ← MAIN FILE - Open this in browser
│   ├── server.js                    ← Backend API server
│   └── package.json                 ← Node.js dependencies
│
├── 🔐 CONFIGURATION
│   └── .env                         ← Environment variables (Gemini API key)
│
├── 📚 DATA
│   └── Customs Tariff of India.pdf  ← 700+ page tariff reference
│
├── 📖 DOCUMENTATION (READ IN THIS ORDER)
│   ├── START_HERE.md                ← 👈 BEGIN HERE! Overview & next steps
│   ├── QUICK_START.md               ← Quick reference (5-10 min read)
│   ├── DEPLOYMENT_GUIDE.md          ← Step-by-step for cPanel (15 min read)
│   ├── DEPLOYMENT_CHECKLIST.md      ← Verification checklist (as you deploy)
│   └── README.md                    ← Complete technical docs (reference)
│
└── 🔧 SETUP SCRIPTS
    ├── setup.bat                    ← Windows setup script
    └── deploy.sh                    ← Linux/cPanel setup script
```

---

## 📋 What Each File Does

### 🌐 APPLICATION FILES

#### `HS CODE Expert.html` (Main File)
**What it is:** The complete frontend application in one file
**What it does:**
- Beautiful UI with purple gradient design
- Textarea for product description input (250 char limit)
- Search button to trigger AI analysis
- Displays results with smooth animations
- Shows loading states and error messages
- Mobile responsive design

**How to use:**
1. Open this file in any web browser
2. Once server is running, you'll see the UI
3. Users type product description
4. Click "Search HS Code" button
5. See results in beautiful card format

**Technology:** HTML5, CSS3, Vanilla JavaScript (no frameworks needed)

---

#### `server.js` (Backend API)
**What it is:** Node.js Express server
**What it does:**
- Loads and parses the 700-page PDF on startup
- Indexes all HS codes and descriptions
- Provides `/api/search-hs-code` endpoint
- Connects to Google Gemini AI API
- Analyzes product descriptions
- Returns results as JSON

**How it works:**
```
Request: { description: "cotton fabric" }
    ↓
Server loads PDF (if not cached)
    ↓
Sends to Gemini AI for analysis
    ↓
AI returns HS code + reasons + alternatives
    ↓
Response: { hsCode: "5208", description: "...", reasons: [...], ... }
```

**Key features:**
- Auto-loads PDF on first startup
- Caches tariff database in memory
- Fast subsequent requests
- Error handling and logging
- Health check endpoint at `/api/health`

---

#### `package.json` (Dependencies)
**What it is:** Node.js project configuration file
**What it does:**
- Lists all npm packages needed
- Defines start script: `npm start`
- Sets project metadata (name, version, etc.)

**Included packages:**
- `express` - Web server framework
- `cors` - Cross-Origin Resource Sharing
- `pdf-parse` - PDF parsing library
- `@google/generative-ai` - Gemini API client

**How to use:**
```bash
npm install      # Install all dependencies
npm start        # Start the server
```

---

### 🔐 CONFIGURATION FILES

#### `.env` (Environment Variables)
**What it is:** Configuration file with secrets
**What it does:**
- Stores Gemini API key securely
- Sets NODE_ENV to production
- Configures PORT (default 3000)

**Content:**
```
GEMINI_API_KEY=AIzaSyCt5uBy9ORizLHv8IIU2Wx-byYJh1VaiX4
PORT=3000
NODE_ENV=production
```

**Security:**
- ⚠️ Keep this file private!
- Never share or commit to GitHub
- Only loaded by backend (frontend cannot access)
- API key is NOT exposed in HTML

---

### 📚 DATA FILES

#### `Customs Tariff of India.pdf`
**What it is:** Your 700+ page Indian Customs Tariff document
**What it does:**
- Contains all HS codes and descriptions
- Auto-loaded and indexed by server.js
- Used as reference for AI matching
- Creates database of 12,500+ HS codes

**How server uses it:**
1. On startup, reads the entire PDF
2. Extracts HS codes and descriptions
3. Stores in memory as searchable database
4. Sends context to Gemini AI
5. AI matches user query against it

---

### 📖 DOCUMENTATION FILES

#### `START_HERE.md` ⭐
**Read this first!**
- Overview of entire project
- What's included
- Quick deployment steps
- File explanations
- Troubleshooting guide

**Time to read:** 10 minutes
**Contains:** Everything you need to know at a glance

---

#### `QUICK_START.md`
**Quick reference guide**
- 3-step deployment process
- Local testing instructions
- 3-minute overview
- Success checklist

**When to use:**
- Before deploying to cPanel
- When you need quick answers
- For team onboarding

**Time to read:** 5 minutes

---

#### `DEPLOYMENT_GUIDE.md`
**Detailed deployment instructions**
- Step-by-step cPanel instructions
- Troubleshooting common issues
- Performance tuning tips
- Security best practices
- Post-deployment verification

**When to use:**
- Actually deploying to HeroHosty
- Following each step of setup
- Solving deployment problems

**Time to read:** 15 minutes (while deploying)

---

#### `DEPLOYMENT_CHECKLIST.md`
**Verification checklist**
- Pre-deployment tasks
- Step-by-step checkbox format
- What to verify at each stage
- Troubleshooting for each issue
- Go-live sign-off section

**When to use:**
- While deploying (follow each step)
- To verify everything is correct
- Before announcing to team

**Format:** Checkboxes to mark as completed

---

#### `README.md`
**Complete technical documentation**
- Features summary
- Technical stack details
- Architecture explanation
- API documentation
- Customization options
- Performance metrics

**When to use:**
- For reference during development
- Understanding how it works
- Making modifications
- Team training

**Audience:** Developers, technical people

---

### 🔧 SETUP SCRIPTS

#### `setup.bat` (Windows)
**What it is:** Automated setup script for Windows
**What it does:**
1. Checks if Node.js is installed
2. Runs `npm install` automatically
3. Verifies PDF file exists
4. Checks .env configuration
5. Gives you next steps

**How to use:**
```bash
# Right-click → Run as Administrator
setup.bat

# Or in Command Prompt:
cd "HS CODE TEST"
setup.bat
```

**Output:**
```
✓ Node.js found: v18.x.x
✓ npm found: 9.x.x
✓ Dependencies installed
✓ PDF file found
✓ Setup Complete!
```

---

#### `deploy.sh` (Linux/cPanel)
**What it is:** Automated setup script for Linux
**What it does:**
- Same as setup.bat but for Linux/Unix systems
- Used on cPanel servers
- Verifies Node.js and npm
- Installs dependencies
- Validates configuration

**How to use:**
```bash
# In cPanel Terminal:
cd public_html
chmod +x deploy.sh
./deploy.sh
```

---

## 📊 File Dependencies

```
HS CODE Expert.html
    ↓ (makes API calls to)
    ↓
server.js
    ↓ (uses data from)
    ↓
Customs Tariff of India.pdf
    ↓ (connects to)
    ↓
Gemini API
    ↑ (configured via)
    ↑
.env

package.json ← Installs all npm packages for server.js
```

---

## 🚀 Deployment File Flow

### On Your Local Computer
```
START_HERE.md ← Read first
    ↓
setup.bat ← Run to install
    ↓
npm start ← Test locally (optional)
    ↓
QUICK_START.md ← Reference
```

### On cPanel Server
```
Upload all files to public_html/
    ↓
deploy.sh ← Run (or npm install)
    ↓
Create Node.js App in cPanel
    ↓
DEPLOYMENT_GUIDE.md ← Follow steps
    ↓
DEPLOYMENT_CHECKLIST.md ← Verify each step
    ↓
Platform goes LIVE! 🎉
```

---

## 📝 File Sizes & Performance

| File | Size | Impact |
|------|------|--------|
| HS CODE Expert.html | ~25 KB | Frontend (fast) |
| server.js | ~7 KB | Backend API |
| package.json | ~1 KB | Config only |
| .env | <1 KB | Not served to users |
| Customs Tariff of India.pdf | ~50 MB | Loaded once at startup |
| All docs | ~200 KB | Reference only |
| **Total** | **~75 MB** | Loaded once per server |

**Performance Impact:**
- First server startup: 3-5 seconds (PDF parsing)
- Subsequent requests: 2-5 seconds (AI processing)
- Frontend load: <1 second

---

## 🔒 Which Files Are Public?

### Public (Served to Users)
- ✅ HS CODE Expert.html - Users see this
- ✅ CSS styles - Rendered in browser
- ✅ JavaScript (frontend) - Runs in browser

### Private (Only Server Uses)
- 🔒 server.js - Backend only
- 🔒 .env - NEVER exposed
- 🔒 package.json - Config only
- 🔒 Customs Tariff PDF - Parsed server-side
- 🔒 node_modules/ - Dependencies (after npm install)

---

## 💾 Storage After Deployment

### Required Storage on Server
```
public_html/
├── HS CODE Expert.html      5 KB
├── server.js                3 KB
├── package.json             1 KB
├── .env                    <1 KB
├── node_modules/         100 MB (created by npm)
└── Customs Tariff PDF    ~50 MB
────────────────────────────────────
Total Required            ~155 MB
```

**Note:** Most hosting provides 5-50 GB, so this is no problem.

---

## 🎯 The Simplest Explanation

| What | Where | Why |
|-----|-------|-----|
| **Frontend** | HS CODE Expert.html | User interface |
| **Backend** | server.js | Processes requests |
| **Config** | .env | Stores API key safely |
| **Data** | PDF file | Source of truth |
| **Docs** | Markdown files | Instructions |

---

## ✅ Verification Checklist

Before you deploy, verify:

- [x] HS CODE Expert.html - Present and contains HTML
- [x] server.js - Present and contains Node.js code
- [x] package.json - Present with dependencies
- [x] .env - Present with Gemini API key
- [x] Customs Tariff PDF - Present and readable
- [x] All docs - Present for reference
- [x] Setup scripts - Present for automation

**All files ready?** → See START_HERE.md next!

---

## 📚 Reading Order

1. **START_HERE.md** ← Overview (10 min)
2. **QUICK_START.md** ← Quick reference (5 min)
3. **DEPLOYMENT_GUIDE.md** ← While deploying (15 min)
4. **DEPLOYMENT_CHECKLIST.md** ← Verification (as you go)
5. **README.md** ← For details (reference)

---

**All files are organized, documented, and ready to deploy!** 🚀
