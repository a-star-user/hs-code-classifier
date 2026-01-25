# HS Code Expert - Installation & Deployment Guide

## 📋 Features
- Intelligent HS Code lookup using Google Gemini AI
- Contextual product matching against Indian Customs Tariff
- Professional UI with real-time results
- Top 3 reasoning explanations
- Related alternative HS codes
- Confidence scoring

## 🚀 Local Setup (For Testing)

### Requirements
- Node.js 14+ ([Download](https://nodejs.org))
- PDF: `Customs Tariff of India.pdf` (already in folder)

### Installation Steps

1. **Install Node packages:**
```bash
npm install
```

2. **Verify Gemini API Key:**
The API key is configured in `.env` file:
```
GEMINI_API_KEY=AIzaSyCt5uBy9ORizLHv8IIU2Wx-byYJh1VaiX4
```

3. **Start the server:**
```bash
npm start
```

4. **Open in browser:**
```
http://localhost:3000
```

## 📤 Deployment to HeroHosty (cPanel)

### Step 1: Prepare Files
- All files are ready to upload
- Required files: `HS CODE Expert.html`, `server.js`, `package.json`, `.env`, `Customs Tariff of India.pdf`

### Step 2: Upload via cPanel File Manager
1. Login to your HeroHosty cPanel
2. Open **File Manager**
3. Navigate to **public_html** folder
4. Upload all files from `HS CODE TEST` folder
5. Make sure `Customs Tariff of India.pdf` is in the same directory

### Step 3: Install Dependencies
1. In cPanel, open **Terminal** (if available) or use **SSH**
2. Navigate to your public_html:
```bash
cd public_html
```

3. Install npm packages:
```bash
npm install
```

### Step 4: Configure Node.js App
1. In cPanel, find **Node.js App Manager**
2. Create a new Node.js application:
   - **App name:** `hs-code-expert`
   - **Node version:** Select latest stable (v18+)
   - **App mode:** Production
   - **Script:** `server.js`
   - **Port:** Ask cPanel to assign (usually 3000-4000)

3. Click **Create**
4. cPanel will automatically start your app

### Step 5: Configure Domain/Proxy
1. In cPanel, go to **Addon Domains** or **Domains**
2. Point your domain to the Node.js app port
3. Or use the URL provided by cPanel's Node.js manager

## 🔧 Environment Variables

If needed to change Gemini API key later:
1. Edit `.env` file in cPanel File Manager
2. Change the API key
3. Restart the Node.js app from cPanel

## 📞 Support & Troubleshooting

### Common Issues

**Issue: "Tariff database not loaded"**
- Ensure `Customs Tariff of India.pdf` is in the same directory as server.js
- Check file permissions (should be readable)

**Issue: Gemini API errors**
- Verify API key is correct in `.env`
- Check if API key quota is exceeded
- Ensure Google Cloud billing is enabled

**Issue: Port already in use**
- cPanel will automatically assign an available port
- If running locally, use: `PORT=8080 npm start`

**Issue: PDF not parsing correctly**
- Some PDFs have special formatting
- If issues persist, re-run the server to re-parse

## 🎨 Customization

### Change Colors
Edit the `<style>` section in `HS CODE Expert.html`:
```css
/* Change gradient from purple to your brand color */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

### Adjust Character Limit
In `HS CODE Expert.html`:
```html
<textarea maxlength="500"></textarea> <!-- Changed from 250 -->
```

And in JavaScript:
```javascript
if (description.length < 20) { // Change minimum length
```

## 📊 Monitoring

Check if app is running:
```
http://yourdomain.com/api/health
```

Response example:
```json
{
  "status": "OK",
  "tariffCodesLoaded": 12500,
  "timestamp": "2026-01-22T10:30:00Z"
}
```

## 🔐 Security

- Gemini API key is secure in `.env` (not exposed in frontend code)
- CORS is enabled for flexibility
- Input validation on both frontend and backend
- Never expose `.env` file publicly

## 📈 Performance Tips

- First request takes longer (PDF parsing)
- Subsequent requests are faster (cached database)
- Gemini API calls typically take 2-5 seconds
- Consider adding caching for frequently searched codes

---

**All set! Your HS Code Expert is ready to revolutionize tariff lookups!** 🚀
