# HS Code Expert - Deployment Checklist

## Pre-Deployment Tasks

### File Preparation
- [x] HS CODE Expert.html (Frontend UI)
- [x] server.js (Backend API)
- [x] package.json (Dependencies)
- [x] .env (API Key configuration)
- [x] Customs Tariff of India.pdf (Tariff data)
- [x] README.md (Full documentation)
- [x] DEPLOYMENT_GUIDE.md (Detailed steps)
- [x] QUICK_START.md (Quick reference)
- [x] setup.bat (Windows setup)
- [x] deploy.sh (Linux setup)

### Verification Before Upload
- [x] Gemini API key is correct: `AIzaSyCt5uBy9ORizLHv8IIU2Wx-byYJh1VaiX4`
- [x] PDF filename is exact: `Customs Tariff of India.pdf`
- [x] No sensitive data in HTML file
- [x] All dependencies in package.json
- [x] .env file has GEMINI_API_KEY
- [x] Server port defaults to 3000

---

## cPanel Upload Steps

### 1. Connect to cPanel
- [ ] Go to HeroHosty control panel
- [ ] Login with your credentials
- [ ] Open File Manager

### 2. Navigate to Upload Location
- [ ] Click on **public_html** folder
- [ ] Make sure you're in the **root** (not a subfolder)
- [ ] Verify current path shows "public_html"

### 3. Upload Files (Choose One Method)

**Method A: Drag & Drop**
- [ ] Select all files from `HS CODE TEST` folder
- [ ] Drag them to cPanel File Manager
- [ ] Wait for all uploads to complete

**Method B: Upload Button**
- [ ] Click Upload button in cPanel
- [ ] Select files one by one
- [ ] Verify each file after upload

**Method C: ZIP Upload (Fastest)**
- [ ] Zip all files: `HS-Code-Expert.zip`
- [ ] Upload ZIP to cPanel
- [ ] Right-click ZIP → Extract
- [ ] Delete ZIP after extraction

### 4. Verify Files in cPanel
- [ ] HS CODE Expert.html ✓
- [ ] server.js ✓
- [ ] package.json ✓
- [ ] .env ✓
- [ ] Customs Tariff of India.pdf ✓
- [ ] All other files ✓

**Important:** All files should be in **public_html** root, not in a subfolder!

---

## Server Configuration (cPanel)

### 1. Access Node.js Manager
- [ ] In cPanel, find "Node.js App Manager"
- [ ] Click on it (sometimes under "SOFTWARE")

### 2. Create New Application
- [ ] Click "Create New Node.js App" button
- [ ] Fill in the following:

| Field | Value |
|-------|-------|
| **App URI** | Leave empty or use primary domain |
| **App name** | `hs-code-expert` |
| **Node version** | 18.x (or latest) |
| **App mode** | Production |
| **Script file** | `server.js` |
| **Port** | Auto (let cPanel assign) |

### 3. Create & Deploy
- [ ] Click "Create" button
- [ ] Wait for green success message
- [ ] Note the port number (e.g., 3000, 3001, etc.)
- [ ] Note the assigned URL/domain

### 4. Verify Deployment
- [ ] Status shows "Running" (green)
- [ ] No error messages
- [ ] Port is accessible

---

## Dependencies Installation

### In cPanel Terminal/SSH
```bash
cd public_html
npm install
```

### Expected Output
```
added XXX packages in Xs
```

### If npm install fails:
- [ ] Check Node.js version: `node -v`
- [ ] Verify package.json is correct
- [ ] Try: `npm install --save`
- [ ] Check disk space availability
- [ ] Contact HeroHosty support if error persists

---

## Post-Deployment Testing

### 1. Test Health Endpoint
- [ ] Visit: `http://your-domain.com:PORT/api/health`
- [ ] Should return JSON: `{"status":"OK","tariffCodesLoaded":12500,...}`
- [ ] If fails: Check server logs in cPanel

### 2. Test Main Interface
- [ ] Visit: `http://your-domain.com:PORT`
- [ ] Page loads (white background with purple)
- [ ] Header shows "HS Code Expert"
- [ ] Text input field is visible
- [ ] "Search HS Code" button is visible and clickable

### 3. Test Search Functionality
- [ ] Enter: "Cotton fabric polyester blend"
- [ ] Click "Search HS Code"
- [ ] Loading spinner appears
- [ ] Results appear within 5 seconds
- [ ] Results include:
  - [ ] Primary HS Code (large number)
  - [ ] Description of code
  - [ ] 3 Reasons in boxes
  - [ ] 2 Related codes

### 4. Test Error Handling
- [ ] Try empty search → Shows error
- [ ] Try very short text → Shows error
- [ ] Check error messages are helpful

---

## Domain & SSL Setup

### If Using Custom Domain
- [ ] Point domain to server IP in DNS
- [ ] Or use cPanel Domain Manager
- [ ] Update Node.js app domain settings
- [ ] Test domain loads the app

### SSL Certificate
- [ ] Install AutoSSL in cPanel (if available)
- [ ] Or manually upload SSL certificate
- [ ] Update .htaccess to redirect HTTP → HTTPS (if using Apache proxy)
- [ ] Test: `https://your-domain.com` loads app

---

## Monitoring & Maintenance

### Daily Checks
- [ ] App shows "Running" status in Node.js Manager
- [ ] Health endpoint works
- [ ] Sample search returns results
- [ ] No error emails from server

### Weekly Reviews
- [ ] Check API usage/costs
- [ ] Review error logs
- [ ] Verify uptime
- [ ] Test with new product descriptions

### Monthly Tasks
- [ ] Update npm packages: `npm update`
- [ ] Review Gemini API billing
- [ ] Back up database/logs
- [ ] Plan feature improvements

---

## Troubleshooting During Deployment

### Issue: "npm: command not found"
**Solution:**
- [ ] Verify Node.js is installed: `node -v`
- [ ] Contact HeroHosty to install Node.js
- [ ] Use their Node.js installer tool

### Issue: "Cannot find module 'pdf-parse'"
**Solution:**
- [ ] Run: `npm install` again
- [ ] Delete node_modules folder, run `npm install`
- [ ] Check package.json is not corrupted

### Issue: "GEMINI_API_KEY not found"
**Solution:**
- [ ] Check .env file exists
- [ ] Verify content: `GEMINI_API_KEY=AIzaSyCt5uBy9ORizLHv8IIU2Wx-byYJh1VaiX4`
- [ ] Restart Node.js app in cPanel

### Issue: "PDF file not found"
**Solution:**
- [ ] Verify filename exact: `Customs Tariff of India.pdf`
- [ ] Check file is in public_html root
- [ ] Check file permissions (should be readable)
- [ ] Re-upload if corrupted

### Issue: "API returns 500 error"
**Solution:**
- [ ] Check cPanel error logs
- [ ] Restart Node.js app
- [ ] Verify .env variables
- [ ] Check server has sufficient memory
- [ ] Contact HeroHosty support

### Issue: "Slow response (>10 seconds)"
**Solution:**
- [ ] Normal first request (PDF parsing)
- [ ] Subsequent requests should be 2-5 seconds
- [ ] Check internet connection
- [ ] Monitor server CPU/memory usage

---

## Performance Optimization

After deployment is working:

- [ ] Enable caching headers in server.js
- [ ] Set up CDN for static files (if needed)
- [ ] Monitor API response times
- [ ] Optimize PDF parsing
- [ ] Add request logging
- [ ] Set up uptime monitoring

---

## Security Checklist

- [ ] .env file exists and is not accessible via web
- [ ] API key is not exposed in frontend code
- [ ] CORS headers are properly configured
- [ ] No sensitive data in logs
- [ ] Server has latest security patches
- [ ] Regular backups enabled
- [ ] Only essential ports exposed

---

## Final Sign-Off

Deployment is complete when:

- [x] All files uploaded
- [ ] npm dependencies installed
- [ ] Node.js app created and running
- [ ] Health endpoint returns 200 OK
- [ ] Main interface loads without errors
- [ ] Sample search works and returns results
- [ ] Results are displayed beautifully
- [ ] Mobile view is responsive
- [ ] Domain is accessible publicly
- [ ] SSL certificate is active (if applicable)
- [ ] Error handling works properly
- [ ] No console errors in browser
- [ ] API logs show successful requests
- [ ] Backup created before going live
- [ ] Team trained on usage

---

## Go-Live Announcement

Once all checks pass:

- [ ] Notify team the tool is live
- [ ] Share the URL with users
- [ ] Create usage documentation
- [ ] Set up feedback channel
- [ ] Monitor first 24 hours closely
- [ ] Be ready for support questions

---

**Deployment Date:** _______________

**Deployed By:** _______________

**Live URL:** _______________

**Status:** ⭕ Not Started | 🟡 In Progress | 🟢 Live | 🔴 Failed

---

**For support:** Contact HeroHosty or refer to DEPLOYMENT_GUIDE.md
