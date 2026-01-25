import express from 'express';
import cors from 'cors';
import pdfParse from 'pdf-parse';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'AIzaSyCt5uBy9ORizLHv8IIU2Wx-byYJh1VaiX4');
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

let tariffContext = '';
let tariffLoaded = false;

// Load and parse PDF on startup
async function loadPDF() {
    try {
        console.log('📄 Loading Customs Tariff PDF...');
        const pdfPath = path.join(__dirname, 'Customs Tariff of India.pdf');
        
        if (!fs.existsSync(pdfPath)) {
            console.error('❌ PDF file not found at:', pdfPath);
            return;
        }

        const pdfBuffer = fs.readFileSync(pdfPath);
        const data = await pdfParse(pdfBuffer);
        
        // Extract HS codes and their descriptions from PDF
        // Format: XXXXXX - Description
        const lines = data.text.split('\n');
        let extractedCodes = [];
        
        for (let line of lines) {
            // Look for 8-digit codes (Indian HS codes can be 8 or 10 digits, we'll use 8)
            const match = line.match(/^(\d{8})\s*[-–]\s*(.+)/);
            if (match) {
                extractedCodes.push(`${match[1]} - ${match[2].trim()}`);
            }
        }
        
        // Use extracted codes + full context
        tariffContext = extractedCodes.slice(0, 100).join('\n');
        if (tariffContext.length < 500) {
            // If not enough codes extracted, use raw text
            tariffContext = data.text.substring(0, 5000);
        }
        
        tariffLoaded = true;
        
        console.log('✅ PDF loaded successfully');
        console.log('📊 Found HS codes:', extractedCodes.length);
        console.log('📊 Context length:', tariffContext.length, 'characters');
        
    } catch (error) {
        console.error('❌ Error loading PDF:', error.message);
    }
}

// Serve home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        pdfLoaded: tariffLoaded,
        contextLength: tariffContext.length,
        timestamp: new Date().toISOString()
    });
});

// Search HS Code using PDF + Gemini
app.post('/api/search-hs-code', async (req, res) => {
    try {
        const { description } = req.body;

        if (!description || description.trim().length === 0) {
            return res.status(400).json({ error: 'Product description is required' });
        }

        if (!tariffLoaded || !tariffContext) {
            return res.status(500).json({ error: 'PDF not loaded yet. Try again in a moment.' });
        }

        // Create prompt with PDF context
        const prompt = `You are an expert Indian Customs Tariff classifier. Use ONLY the tariff codes provided below.

PRODUCT: "${description}"

TARIFF REFERENCE (use these exact codes):
${tariffContext}

INSTRUCTIONS:
1. Find the BEST matching 8-digit HS code from the reference above
2. Explain 3 SPECIFIC reasons from the tariff definition why this code matches
3. Suggest 2 RELATED 8-digit HS codes for complementary/similar products

IMPORTANT: 
- Use ONLY codes from the reference provided
- Reasons must reference specific tariff descriptions
- Related codes must be logically connected (e.g., printer → printer parts, cartridges)

Return ONLY valid JSON:
{
  "hsCode": "XXXXXXXX",
  "description": "Product name from tariff",
  "confidence": 85,
  "reasons": [
    "Specific reason from tariff definition",
    "Another reason from tariff",
    "Third reason from tariff"
  ],
  "relatedCodes": [
    { "code": "XXXXXXXX", "description": "Related product name" },
    { "code": "XXXXXXXX", "description": "Another related product" }
  ]
}`;

        console.log('🔍 Searching for:', description);
        
        const response = await model.generateContent(prompt);
        const responseText = response.response.text();

        // Extract JSON from response
        let jsonMatch = responseText.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
            throw new Error('Invalid response format from AI');
        }

        const parsedResponse = JSON.parse(jsonMatch[0]);

        console.log('✅ Found HS Code:', parsedResponse.hsCode);

        res.json({
            hsCode: parsedResponse.hsCode || '00000000',
            description: parsedResponse.description || description,
            confidence: parsedResponse.confidence || 85,
            reasons: parsedResponse.reasons || ['Based on tariff classification'],
            relatedCodes: parsedResponse.relatedCodes || []
        });

    } catch (error) {
        console.error('❌ API Error:', error.message);
        res.status(500).json({
            error: error.message || 'Failed to search HS code',
            hsCode: '00000000',
            description: 'Error occurred',
            confidence: 0,
            reasons: ['Error processing request'],
            relatedCodes: []
        });
    }
});

// Start server and load PDF
app.listen(PORT, async () => {
    await loadPDF();
    console.log(`\n✓ Server running on port ${PORT}`);
    console.log(`✓ Frontend: http://localhost:${PORT}/`);
    console.log(`✓ Health: http://localhost:${PORT}/api/health`);
    console.log(`✓ API: POST http://localhost:${PORT}/api/search-hs-code\n`);
});
