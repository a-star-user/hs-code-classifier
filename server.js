import express from 'express';
import cors from 'cors';
import pdfParse from 'pdf-parse';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Groq from 'groq-sdk';
import fetch from 'node-fetch';

// Ensure fetch is available globally
if (!globalThis.fetch) {
    globalThis.fetch = fetch;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Initialize Groq
// IMPORTANT: API key must be in environment variable, NEVER hardcoded!
const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
    console.error('❌ FATAL ERROR: GROQ_API_KEY environment variable not set!');
    console.error('Set it using: export GROQ_API_KEY="your-key-here"');
    process.exit(1);
}

const groq = new Groq({ apiKey: apiKey });

// Use the most capable Groq model
const SELECTED_MODEL = 'mixtral-8x7b-32768';
console.log(`🤖 Using model: ${SELECTED_MODEL}`);

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
        // Modern Gemini models can handle large context (1M+ tokens)
        // Use more of the PDF for better accuracy
        const lines = data.text.split('\n');
        let extractedCodes = [];
        
        for (let line of lines) {
            // Look for 8-digit codes (Indian HS codes)
            const match = line.match(/^(\d{8})\s*[-–]\s*(.+)/);
            if (match) {
                extractedCodes.push(`${match[1]} - ${match[2].trim()}`);
            }
        }
        
        // Use more extracted codes (Gemini 1.5 can handle 1M tokens!)
        // Take first 300 codes instead of 100 for better accuracy
        tariffContext = extractedCodes.slice(0, 300).join('\n');
        
        if (tariffContext.length < 1000) {
            // If not enough codes, use raw text from PDF
            // Modern models can handle 50,000+ character contexts easily
            tariffContext = data.text.substring(0, 50000);
        }
        
        tariffLoaded = true;
        
        console.log('✅ PDF loaded successfully');
        console.log('📊 Found HS codes:', extractedCodes.length);
        console.log('📊 Context size:', tariffContext.length, 'characters');
        console.log('📄 PDF pages:', data.numpages);
        
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
        model: SELECTED_MODEL,
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

        // First, check if description is too vague using Groq
        const clarificationPrompt = `You are a customs expert analyzing a product description to determine if an 8-digit Indian HS code can be accurately assigned.

Product Description: "${description}"

Analyze this description and determine:
1. Is it too vague to classify accurately into a single HS code?
2. What SPECIFIC product characteristics would help determine the EXACT HS code?

Generate 3-5 SPECIFIC questions that are DIRECTLY relevant to this exact product type. These questions should help distinguish between similar HS codes.

Respond with JSON only:
{
  "isTooVague": true/false,
  "specificityScore": 0-10,
  "productType": "what type of product this is",
  "clarifications": [
    "Specific question 1 for THIS product type",
    "Specific question 2 for THIS product type",
    "Specific question 3 for THIS product type"
  ]
}`;

        const clarificationCheck = await groq.chat.completions.create({
            messages: [{ role: 'user', content: clarificationPrompt }],
            model: SELECTED_MODEL,
            temperature: 0.3,
            max_tokens: 500,
        });

        const clarificationText = clarificationCheck.choices[0].message.content;
        const clarificationMatch = clarificationText.match(/\{[\s\S]*\}/);
        
        if (!clarificationMatch) {
            throw new Error('Could not parse clarity check');
        }

        const clarityResponse = JSON.parse(clarificationMatch[0]);

        // If description is too vague, return clarification questions
        if (clarityResponse.isTooVague || clarityResponse.specificityScore < 5) {
            console.log('⚠️ Description too vague, requesting clarifications');
            return res.json({
                needsClarification: true,
                message: `Help us determine the perfect HS code for this ${clarityResponse.productType || 'product'}`,
                clarificationQuestions: clarityResponse.clarifications || [
                    'What is the material or composition?',
                    'What is the primary purpose or use?',
                    'What is the size, weight, or quantity?',
                    'Is it a finished product or raw material?'
                ],
                hsCode: null,
                description: null,
                confidence: 0,
                reasons: [],
                relatedCodes: []
            });
        }

        // If description is specific enough, proceed with HS code search using Groq
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
- Related codes must be logically connected

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
        
        const response = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: SELECTED_MODEL,
            temperature: 0.2,
            max_tokens: 1000,
        });

        const responseText = response.choices[0].message.content;

        // Extract JSON from response
        let jsonMatch = responseText.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
            throw new Error('Invalid response format from AI');
        }

        const parsedResponse = JSON.parse(jsonMatch[0]);

        console.log('✅ Found HS Code:', parsedResponse.hsCode);

        res.json({
            needsClarification: false,
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
            needsClarification: false,
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
    console.log(`✓ Using model: ${SELECTED_MODEL}`);
    console.log(`✓ Frontend: http://localhost:${PORT}/`);
    console.log(`✓ Health: http://localhost:${PORT}/api/health`);
    console.log(`✓ API: POST http://localhost:${PORT}/api/search-hs-code\n`);
});
