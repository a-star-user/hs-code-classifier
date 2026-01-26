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
            console.error('Current directory:', __dirname);
            console.error('Files in directory:', fs.readdirSync(__dirname).slice(0, 10));
            return;
        }

        const pdfBuffer = fs.readFileSync(pdfPath);
        console.log('📦 PDF size:', (pdfBuffer.length / 1024 / 1024).toFixed(2) + 'MB');
        
        const data = await pdfParse(pdfBuffer);
        console.log('✅ PDF parsed, pages:', data.numpages);
        
        // Extract HS codes and their descriptions from PDF
        const lines = data.text.split('\n');
        console.log('📄 Total lines in PDF:', lines.length);
        
        let extractedCodes = [];
        
        for (let line of lines) {
            // Look for 8-digit codes (Indian HS codes)
            const match = line.match(/^(\d{8})\s*[-–]\s*(.+)/);
            if (match) {
                extractedCodes.push(`${match[1]} - ${match[2].trim()}`);
            }
        }
        
        console.log('🔍 Found', extractedCodes.length, 'HS codes in PDF');
        
        // Use extracted codes for better accuracy
        if (extractedCodes.length > 0) {
            tariffContext = extractedCodes.slice(0, 300).join('\n');
            console.log('📊 Using first 300 codes, context size:', tariffContext.length, 'chars');
        } else {
            // If not enough codes, use raw text from PDF
            console.log('⚠️ Could not extract structured codes, using raw text');
            tariffContext = data.text.substring(0, 50000);
            console.log('📊 Using raw text, context size:', tariffContext.length, 'chars');
        }
        
        tariffLoaded = true;
        console.log('✅ PDF ready for HS code search');
        
    } catch (error) {
        console.error('❌ Error loading PDF:', error.message);
        tariffLoaded = false;
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
        
        const prompt = `You are an expert customs classifier with 50+ years of experience classifying products into Indian Customs Tariff codes.

PRODUCT: "${trimmedDescription}"

TARIFF CODES (use ONLY these):
${tariffContext}

TASK:
1. Find the BEST matching 8-digit HS code
2. Give 3 reasons why (from the tariff)
3. Suggest 2 related HS codes
4. Rate confidence (0-100)

RULES:
- If confidence >= 70: Return HS code + reasons + related codes + confidence
- If confidence < 70: Return clarification questions instead

CONFIDENCE GUIDE:
- 80-100: Very clear, specific product
- 60-79: Fairly clear, minor details helpful
- Below 60: Vague, need clarification

FORMAT (use ONLY this JSON structure):
{
  "hsCode": "XXXXXXXX" or null,
  "description": "product name" or null,
  "confidence": number,
  "reasons": ["reason1", "reason2", "reason3"] or [],
  "relatedCodes": [{"code": "XXXXXXXX", "description": "name"}, ...] or [],
  "clarificationQuestions": ["question1?", "question2?"] or null
}`;

        console.log('🚀 Calling Groq API...');

        const response = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: SELECTED_MODEL,
            temperature: 0.2,
            max_tokens: 1200,
        });

        const responseText = response.choices[0]?.message?.content;
        
        if (!responseText) {
            console.error('❌ Empty response from Groq');
            throw new Error('Empty response from AI');
        }

        console.log('📝 Raw response (first 300 chars):', responseText.substring(0, 300));

        // Extract JSON from response - be more flexible
        let jsonMatch = responseText.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
            // Try to find JSON between other text
            console.error('❌ No JSON found in response. Full response:', responseText);
            throw new Error('AI response format invalid');
        }

        let parsedResponse;
        try {
            parsedResponse = JSON.parse(jsonMatch[0]);
            console.log('✅ Successfully parsed JSON');
        } catch (parseError) {
            console.error('❌ JSON parse failed:', parseError.message);
            console.error('❌ Attempted to parse:', jsonMatch[0].substring(0, 200));
            throw new Error('Could not parse AI response: ' + parseError.message);
        }

        console.log('📊 Parsed response confidence:', parsedResponse.confidence);

        // If AI is asking clarification questions (confidence < 70)
        if (parsedResponse.clarificationQuestions && Array.isArray(parsedResponse.clarificationQuestions) && parsedResponse.clarificationQuestions.length > 0) {
            console.log('⚠️ AI needs clarifications (confidence:', parsedResponse.confidence + '%)');
            return res.json({
                needsClarification: true,
                message: `I need specific details to find the perfect HS code`,
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
            console.error('❌ No HS code in parsed response:', JSON.stringify(parsedResponse).substring(0, 200));
            throw new Error('AI did not return an HS code');
        }

        const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ Found HS Code: ${parsedResponse.hsCode} (confidence: ${parsedResponse.confidence}%, time: ${processingTime}s)`);

        // Build safe response
        const finalResponse = {
            needsClarification: false,
            hsCode: String(parsedResponse.hsCode || '').padStart(8, '0'),
            description: (parsedResponse.description || trimmedDescription).substring(0, 500),
            confidence: Math.min(100, Math.max(0, parseInt(parsedResponse.confidence) || 75)),
            reasons: Array.isArray(parsedResponse.reasons) ? parsedResponse.reasons.slice(0, 3) : [],
            relatedCodes: Array.isArray(parsedResponse.relatedCodes) ? parsedResponse.relatedCodes.slice(0, 2) : []
        };

        console.log('✅ Sending response - HS Code:', finalResponse.hsCode);
        res.json(finalResponse);

    } catch (error) {
        console.error('❌ CRITICAL API Error:', error.message);
        console.error('❌ Stack:', error.stack);
        
        // Provide detailed error messages for debugging
        let statusCode = 500;
        let errorMessage = 'Failed to classify HS code';
        
        if (error.message?.includes('Empty response')) {
            errorMessage = 'AI service did not respond. Please try again.';
            statusCode = 503;
        } else if (error.message?.includes('JSON')) {
            errorMessage = 'AI response was invalid format. Retrying...';
            statusCode = 500;
        } else if (error.message?.includes('No HS code')) {
            errorMessage = 'Could not determine HS code. Try more specific description.';
            statusCode = 400;
        } else if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
            errorMessage = 'Too many requests. Wait a moment and try again.';
            statusCode = 429;
        } else if (error.message?.includes('API')) {
            errorMessage = 'AI API error. Service may be temporarily unavailable.';
            statusCode = 503;
        }
        
        console.error('📨 Sending error response:', statusCode, errorMessage);
        
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
