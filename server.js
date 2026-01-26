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

// Initialize Groq (optional - will try, but will fallback to local search)
let groq = null;
const apiKey = process.env.GROQ_API_KEY;

if (apiKey) {
    try {
        groq = new Groq({ apiKey: apiKey });
        console.log('✅ Groq API available (will try, but not required)');
    } catch (e) {
        console.warn('⚠️ Groq initialization failed, using local search instead');
        groq = null;
    }
}

const SELECTED_MODEL = 'llama-3.3-70b-versatile';
const BACKUP_MODELS = [
    'llama-3.1-8b-instant',
    'groq/compound',
    'groq/compound-mini'
];

let tariffContext = '';
let tariffLoaded = false;
let hsCodeList = []; // Store structured codes
let hsCodeMap = {}; // Map for fast lookup

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
        
        // Extract structured HS codes from PDF
        const lines = data.text.split('\n');
        console.log('📄 Total lines in PDF:', lines.length);
        
        let currentCode = null;
        let currentDescription = '';
        
        for (let line of lines) {
            const trimmed = line.trim();
            
            // Look for 8-digit HS codes at the start of a line
            const codeMatch = trimmed.match(/^(\d{8})[\s\-–](.+)/);
            
            if (codeMatch) {
                // Save previous code if exists
                if (currentCode && currentDescription.trim()) {
                    hsCodeList.push({
                        code: currentCode,
                        description: currentDescription.trim()
                    });
                }
                
                // Start new code
                currentCode = codeMatch[1];
                currentDescription = codeMatch[2].trim();
            } else if (currentCode && trimmed && !trimmed.match(/^\d+$/) && trimmed.length > 2) {
                // Continue description if not empty
                if (currentDescription.length < 500) { // Limit description length
                    currentDescription += ' ' + trimmed;
                }
            }
        }

        // Save last code
        if (currentCode && currentDescription.trim()) {
            hsCodeList.push({
                code: currentCode,
                description: currentDescription.trim()
            });
        }

        console.log('🔍 Found', hsCodeList.length, 'HS codes');
        
        if (hsCodeList.length > 0) {
            console.log('📋 Sample codes:');
            hsCodeList.slice(0, 5).forEach(item => {
                console.log(`  ${item.code}: ${item.description.substring(0, 60)}`);
            });
            
            // Create tariff context from structured codes
            tariffContext = hsCodeList.map(item => `${item.code} - ${item.description}`).join('\n');
        } else {
            // Fallback: use raw PDF text
            console.log('⚠️ No structured HS codes found, using raw PDF text');
            tariffContext = data.text.substring(0, 50000);
        }
        
        console.log('📊 Context size:', tariffContext.length, 'chars');
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
        hsCodesExtracted: hsCodeList.length,
        contextLength: tariffContext.length,
        timestamp: new Date().toISOString()
    });
});

// Get HS codes list (for debugging)
app.get('/api/hs-codes', (req, res) => {
    if (!tariffLoaded) {
        return res.status(503).json({ error: 'PDF not loaded yet' });
    }
    res.json({
        total: hsCodeList.length,
        sample: hsCodeList.slice(0, 20),
        allCodes: hsCodeList.map(item => item.code)
    });
});

// Check available Groq models
app.get('/api/groq-models', async (req, res) => {
    try {
        console.log('🔍 Fetching available Groq models...');
        
        const response = await groq.models.list();
        const models = response.data || [];
        
        console.log('✅ Available models:', models.map(m => m.id));
        
        res.json({
            availableModels: models.map(m => ({
                id: m.id,
                owned_by: m.owned_by
            })),
            currentModel: SELECTED_MODEL,
            totalModels: models.length
        });
    } catch (error) {
        console.error('❌ Error fetching models:', error.message);
        res.status(500).json({
            error: 'Could not fetch available models',
            message: error.message,
            currentModel: SELECTED_MODEL
        });
    }
});

// SMART LOCAL SEARCH - Works instantly without API
function findHSCodeLocally(productDescription) {
    if (!hsCodeList.length) {
        return null;
    }
    
    const keywords = productDescription.toLowerCase().split(/\s+/);
    const scored = hsCodeList.map(item => {
        let score = 0;
        const descLower = item.description.toLowerCase();
        
        // Exact phrase match = highest score
        if (descLower.includes(productDescription.toLowerCase())) {
            score += 100;
        }
        
        // Each keyword match
        keywords.forEach(keyword => {
            if (descLower.includes(keyword)) {
                score += 10;
            }
        });
        
        // Prioritize shorter, more specific descriptions
        score -= item.description.length / 100;
        
        return { ...item, score };
    });
    
    const best = scored.sort((a, b) => b.score - a.score)[0];
    const top3 = scored.sort((a, b) => b.score - a.score).slice(1, 4);
    
    if (!best || best.score < 5) {
        return null; // Not confident
    }
    
    return {
        hsCode: best.code,
        description: best.description,
        confidence: Math.min(100, Math.max(50, best.score * 5)),
        reasons: [
            `Matches keyword "${keywords[0]}"`,
            `Related to ${best.description.split(' ').slice(0, 3).join(' ')}`,
            `Classification: 8-digit HS code from Indian Customs Tariff`
        ],
        relatedCodes: top3.map(item => ({
            code: item.code,
            description: item.description
        }))
    };
}

// Search HS Code - TRY LOCAL FIRST, then API if available
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
        // STEP 2: TRY LOCAL SEARCH FIRST (instant, no API calls)
        console.log('🔎 Searching locally in extracted HS codes...');
        const localResult = findHSCodeLocally(trimmedDescription);
        
        if (localResult && localResult.confidence >= 70) {
            console.log(`✅ Local match found: ${localResult.hsCode} (confidence: ${localResult.confidence}%)`);
            const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`⚡ Instant result in ${processingTime}s (no API needed)`);
            
            return res.json({
                needsClarification: false,
                hsCode: localResult.hsCode,
                description: localResult.description,
                confidence: localResult.confidence,
                reasons: localResult.reasons,
                relatedCodes: localResult.relatedCodes
            });
        }

        // STEP 3: If local search not confident enough AND Groq available, try API
        if (!groq) {
            // No Groq, return local result with lower confidence or ask for clarification
            if (localResult) {
                console.log('⚠️ Low confidence local match, Groq not available');
                return res.json({
                    needsClarification: true,
                    clarificationQuestions: [
                        'What is the material composition?',
                        'What is the intended use?',
                        'What is the weight or quantity?'
                    ],
                    hsCode: null,
                    description: null,
                    confidence: 0,
                    reasons: [],
                    relatedCodes: []
                });
            }
            
            return res.status(503).json({
                error: 'Could not determine HS code. No AI service available.',
                needsClarification: false,
                hsCode: null,
                description: null,
                confidence: 0,
                reasons: [],
                relatedCodes: []
            });
        }

        console.log('🚀 Confidence low, trying Groq API for detailed analysis...');
        
        const prompt = `You are an expert customs classifier with 50+ years of experience.

PRODUCT: "${trimmedDescription}"

HS CODES TO SEARCH FROM:
${tariffContext}

TASK (STRICT RULES):
1. Find the BEST matching 8-digit HS code
2. Provide 3 reasons (reference the tariff code descriptions)
3. List 2 related codes
4. Rate confidence (0-100)

CONFIDENCE DECISION:
- 75-100: Clear product → Return HS code
- Below 75: Need more info → Return clarification questions

FORMAT (ONLY this JSON, nothing else):
{
  "hsCode": "12345678" or null,
  "description": "product name" or null,
  "confidence": 85,
  "reasons": ["reason1", "reason2", "reason3"] or [],
  "relatedCodes": [{"code": "12345678", "description": "name"}] or [],
  "clarificationQuestions": null or ["question1?", "question2?"]
}`;

        let response;
        let usedModel = SELECTED_MODEL;
        
        try {
            response = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: SELECTED_MODEL,
                temperature: 0.2,
                max_tokens: 1200,
            });
        } catch (apiError) {
            console.error('❌ Primary model failed:', SELECTED_MODEL);
            console.error('❌ Error message:', apiError.message);
            console.error('❌ Error status:', apiError.status);
            if (apiError.response?.data) {
                console.error('❌ Groq response:', JSON.stringify(apiError.response.data));
            }
            
            // Try backup models
            for (let backupModel of BACKUP_MODELS) {
                try {
                    console.log('🔄 Trying backup model:', backupModel);
                    response = await groq.chat.completions.create({
                        messages: [{ role: 'user', content: prompt }],
                        model: backupModel,
                        temperature: 0.2,
                        max_tokens: 1200,
                    });
                    usedModel = backupModel;
                    console.log('✅ Backup model worked:', backupModel);
                    break;
                } catch (backupError) {
                    console.warn('⚠️ Backup model failed:', backupModel);
                    continue;
                }
            }
            
            if (!response) {
                throw new Error('All Groq models failed: ' + apiError.message);
            }
        }

        console.log('📡 Using model:', usedModel);
        
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
        console.error('❌ CRITICAL ERROR:', error.message);
        console.error('❌ Error type:', error.constructor.name);
        console.error('❌ Stack:', error.stack?.substring(0, 500));
        
        // Detailed error logging
        if (error.response) {
            console.error('❌ API Response Status:', error.response.status);
            console.error('❌ API Response Body:', JSON.stringify(error.response.data));
        }
        
        if (error.status === 401) {
            return res.status(401).json({
                error: 'Invalid API key. Please check GROQ_API_KEY environment variable.',
                needsClarification: false,
                hsCode: null,
                description: null,
                confidence: 0,
                reasons: [],
                relatedCodes: []
            });
        }
        
        if (error.status === 404 || error.message?.includes('model')) {
            return res.status(400).json({
                error: 'Model not available. Check available models at /api/groq-models',
                currentModel: SELECTED_MODEL,
                needsClarification: false,
                hsCode: null,
                description: null,
                confidence: 0,
                reasons: [],
                relatedCodes: []
            });
        }
        
        let statusCode = 500;
        let errorMessage = 'Failed to classify HS code';
        
        if (error.message?.includes('Empty response')) {
            errorMessage = 'AI service did not respond. Please try again.';
            statusCode = 503;
        } else if (error.message?.includes('JSON')) {
            errorMessage = 'AI response format was invalid.';
            statusCode = 500;
        } else if (error.message?.includes('No HS code')) {
            errorMessage = 'Could not determine HS code. Try more specific description.';
            statusCode = 400;
        } else if (error.message?.includes('Rate limit') || error.status === 429) {
            errorMessage = 'Too many requests. Please wait a moment.';
            statusCode = 429;
        } else if (error.message?.includes('API') || error.message?.includes('network')) {
            errorMessage = 'API connection issue. Retrying...';
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

// Debug endpoint: Check PDF and extracted codes
app.get('/api/health', (req, res) => {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: {
            nodeVersion: process.version,
            apiKey: process.env.GROQ_API_KEY ? 'SET' : 'NOT SET',
            pdfLoaded: tariffLoaded,
            hsCodesExtracted: hsCodeList.length,
            contextLength: tariffContext?.length || 0,
            selectedModel: SELECTED_MODEL,
            backupModels: BACKUP_MODELS
        }
    };
    res.json(health);
});

// Debug: Show sample of extracted HS codes
app.get('/api/hs-codes', (req, res) => {
    const sampleSize = 20;
    const sample = hsCodeList.slice(0, sampleSize);
    const allCodes = hsCodeList.map(item => item.code);
    
    res.json({
        totalExtracted: hsCodeList.length,
        sampleSize: sample.length,
        sample: sample,
        allCodes: allCodes,
        contextPreview: tariffContext?.substring(0, 500) + '...'
    });
});

// Debug: List available Groq models
app.get('/api/groq-models', async (req, res) => {
    try {
        const models = await groq.models.list();
        const modelList = models.data.map(m => ({
            id: m.id,
            created: m.created,
            owned_by: m.owned_by
        }));
        
        res.json({
            availableModels: modelList,
            totalModels: modelList.length,
            selectedPrimary: SELECTED_MODEL,
            backups: BACKUP_MODELS,
            message: 'Use any of these model IDs in the application'
        });
    } catch (error) {
        console.error('❌ Failed to list Groq models:', error.message);
        res.status(500).json({
            error: 'Could not fetch model list: ' + error.message,
            message: 'Check if GROQ_API_KEY is valid'
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
