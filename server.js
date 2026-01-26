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

// Use the latest Groq model (confirmed available)
const SELECTED_MODEL = 'llama-3.3-70b-versatile';
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
        const lines = data.text.split('\n');
        let extractedCodes = [];
        
        for (let line of lines) {
            // Look for 8-digit codes (Indian HS codes)
            const match = line.match(/^(\d{8})\s*[-–]\s*(.+)/);
            if (match) {
                extractedCodes.push(`${match[1]} - ${match[2].trim()}`);
            }
        }
        
        // Use extracted codes for better accuracy
        tariffContext = extractedCodes.slice(0, 300).join('\n');
        
        if (tariffContext.length < 1000) {
            // If not enough codes, use raw text from PDF
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

// Search HS Code using PDF + Groq
app.post('/api/search-hs-code', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { description, isFollowUp } = req.body;

        // STEP 1: Validate input
        if (!description || typeof description !== 'string' || description.trim().length === 0) {
            return res.status(400).json({ 
                error: 'Product description is required',
                needsClarification: false,
                hsCode: null,
                description: null,
                confidence: 0,
                reasons: [],
                relatedCodes: []
            });
        }

        if (!tariffLoaded || !tariffContext) {
            return res.status(503).json({ 
                error: 'Service initializing. Please try again in a moment.',
                needsClarification: false,
                hsCode: null,
                description: null,
                confidence: 0,
                reasons: [],
                relatedCodes: []
            });
        }

        const trimmedDescription = description.trim();
        console.log('🔍 Processing:', trimmedDescription.substring(0, 100), isFollowUp ? '(Follow-up)' : '(Initial)');

        // SMART FLOW: Always try to find HS code first
        // If confident → return results
        // If NOT confident → ask clarification questions
        
        const prompt = `You are an expert customs classifier with 50+ years of experience in the Indian Customs Tariff system. You've classified thousands of products into the perfect HS codes.

PRODUCT DESCRIPTION: "${trimmedDescription}"

TARIFF REFERENCE (search ONLY from these codes):
${tariffContext}

YOUR TASK:
1. Find the BEST matching 8-digit HS code from the tariff above
2. Provide 3 SPECIFIC reasons why this code matches (reference the tariff definitions)
3. Suggest 2 RELATED HS codes for similar/complementary products
4. Rate your CONFIDENCE in this classification (0-100)

CONFIDENCE EVALUATION:
- 80-100: Extremely clear and specific product description. You are certain.
- 60-79: Fairly clear but could benefit from minor details
- Below 60: Product description is vague or ambiguous. You need clarification.

IF YOUR CONFIDENCE IS BELOW 70%, include these 2-3 clarification questions that would help you find the PERFECT HS code (NOT generic questions - be very specific to THIS product).

IMPORTANT RULES:
- Be confident! With your expertise, you can usually classify products from descriptions
- ONLY ask clarification questions if you're genuinely uncertain (confidence < 70%)
- Use ONLY codes from the tariff reference provided
- Reasons must reference tariff descriptions
- Return ONLY valid JSON

Return JSON in this format:
{
  "hsCode": "XXXXXXXX",
  "description": "Product name from tariff",
  "confidence": 85,
  "reasons": [
    "Specific reason from tariff",
    "Another reason from tariff", 
    "Third reason from tariff"
  ],
  "relatedCodes": [
    { "code": "XXXXXXXX", "description": "Related product" },
    { "code": "XXXXXXXX", "description": "Another related product" }
  ],
  "clarificationQuestions": null
}

OR if confidence < 70%, include clarification questions:
{
  "hsCode": null,
  "description": null,
  "confidence": 45,
  "reasons": [],
  "relatedCodes": [],
  "clarificationQuestions": [
    "Specific clarification Q1 for THIS product?",
    "Specific clarification Q2 for THIS product?"
  ]
}`;

        const response = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: SELECTED_MODEL,
            temperature: 0.2,
            max_tokens: 1200,
        });

        const responseText = response.choices[0]?.message?.content;
        
        if (!responseText) {
            throw new Error('Empty response from HS code search');
        }

        // Extract JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
            console.error('Could not find JSON in response:', responseText.substring(0, 200));
            throw new Error('Invalid response format from AI');
        }

        let parsedResponse;
        try {
            parsedResponse = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
            console.error('JSON parse error:', parseError.message);
            throw new Error('Could not parse AI response');
        }

        // If AI is asking clarification questions (confidence < 70)
        if (parsedResponse.clarificationQuestions && Array.isArray(parsedResponse.clarificationQuestions) && parsedResponse.clarificationQuestions.length > 0) {
            console.log('⚠️ AI needs clarifications (confidence:', parsedResponse.confidence + '%)');
            return res.json({
                needsClarification: true,
                message: `I need a few specific details to find the PERFECT HS code for this ${trimmedDescription.split(' ')[0].toLowerCase()}`,
                clarificationQuestions: parsedResponse.clarificationQuestions.slice(0, 3),
                hsCode: null,
                description: null,
                confidence: parsedResponse.confidence || 0,
                reasons: [],
                relatedCodes: []
            });
        }

        // Validate response structure - AI found an HS code
        if (!parsedResponse.hsCode) {
            throw new Error('No HS code found in response');
        }

        const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ Found HS Code: ${parsedResponse.hsCode} (confidence: ${parsedResponse.confidence}%, time: ${processingTime}s)`);

        res.json({
            needsClarification: false,
            hsCode: String(parsedResponse.hsCode).padStart(8, '0'),
            description: parsedResponse.description || trimmedDescription,
            confidence: Math.min(100, Math.max(0, parsedResponse.confidence || 85)),
            reasons: Array.isArray(parsedResponse.reasons) ? parsedResponse.reasons.slice(0, 3) : [],
            relatedCodes: Array.isArray(parsedResponse.relatedCodes) ? parsedResponse.relatedCodes.slice(0, 2) : []
        });

    } catch (error) {
        console.error('❌ API Error:', error.message);
        
        // Provide user-friendly error messages
        let statusCode = 500;
        let errorMessage = 'Failed to classify HS code';
        
        if (error.message?.includes('Cannot read')) {
            errorMessage = 'Invalid data received. Please try again.';
            statusCode = 400;
        } else if (error.message?.includes('JSON')) {
            errorMessage = 'Invalid response from AI. Please try again.';
            statusCode = 500;
        } else if (error.message?.includes('Rate limit')) {
            errorMessage = 'Too many requests. Please wait a moment.';
            statusCode = 429;
        } else if (error.message?.includes('Service initializing')) {
            errorMessage = 'Service initializing. Please try again.';
            statusCode = 503;
        }
        
        res.status(statusCode).json({
            error: errorMessage,
            needsClarification: false,
            hsCode: null,
            description: null,
            confidence: 0,
            reasons: [],
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
