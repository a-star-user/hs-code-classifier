import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// CORS Configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'AIzaSyCt5uBy9ORizLHv8IIU2Wx-byYJh1VaiX4');
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

let tariffDatabase = [];

// Load tariff data from file (simple approach)
async function loadTariffData() {
    try {
        console.log('Loading tariff data...');
        const pdfPath = path.join(__dirname, 'Customs Tariff of India.pdf');
        
        if (!fs.existsSync(pdfPath)) {
            console.error('PDF file not found at:', pdfPath);
            return;
        }

        // For now, create sample tariff data
        // In production, you'd parse the PDF
        tariffDatabase = [
            { code: '0901', description: 'Coffee, not roasted, not decaffeinated' },
            { code: '0902', description: 'Tea' },
            { code: '0703', description: 'Onions, shallots and garlic, fresh or chilled' },
            { code: '0704', description: 'Cabbages, cauliflowers, kale and other brassicas' },
            { code: '5407', description: 'Woven fabrics of synthetic filament yarn' },
            { code: '5408', description: 'Woven fabrics of artificial filament yarn' },
            { code: '6204', description: 'Women\'s or girls\' suits, jackets, dresses' },
            { code: '7326', description: 'Articles of iron or steel, not elsewhere specified' },
            { code: '8431', description: 'Parts of machinery' },
            { code: '8704', description: 'Motor vehicles for the transport of goods' }
        ];

        console.log('✓ Tariff database loaded with', tariffDatabase.length, 'entries');
    } catch (error) {
        console.error('Error loading tariff data:', error.message);
    }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        tariffCodesLoaded: tariffDatabase.length,
        timestamp: new Date().toISOString()
    });
});

// Search HS Code endpoint
app.post('/api/search-hs-code', async (req, res) => {
    try {
        const { description } = req.body;

        if (!description || description.trim().length === 0) {
            return res.status(400).json({ error: 'Product description is required' });
        }

        if (tariffDatabase.length === 0) {
            return res.status(500).json({ error: 'Tariff database not loaded' });
        }

        // Create context from tariff database
        const tariffContext = tariffDatabase
            .map(item => `HS Code: ${item.code} - ${item.description}`)
            .join('\n');

        // Call Gemini API
        const prompt = `You are an expert in Indian Customs Tariff classification.

Product Description: "${description}"

Based on this Indian Customs Tariff reference:
${tariffContext}

Return ONLY a valid JSON response (no markdown, no code blocks) with this exact structure:
{
  "hsCode": "XXXX",
  "description": "Product description here",
  "confidence": 85,
  "reasons": [
    "Reason 1",
    "Reason 2",
    "Reason 3"
  ],
  "relatedCodes": [
    { "code": "YYYY", "description": "Related product 1" },
    { "code": "ZZZZ", "description": "Related product 2" }
  ]
}`;

        const response = await model.generateContent(prompt);
        const responseText = response.response.text();

        // Extract JSON from response
        let jsonMatch = responseText.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
            throw new Error('No JSON found in response');
        }

        const parsedResponse = JSON.parse(jsonMatch[0]);

        res.json({
            hsCode: parsedResponse.hsCode || '0000',
            description: parsedResponse.description || description,
            confidence: parsedResponse.confidence || 75,
            reasons: parsedResponse.reasons || ['Based on product characteristics'],
            relatedCodes: parsedResponse.relatedCodes || []
        });

    } catch (error) {
        console.error('API Error:', error.message);
        res.status(500).json({ 
            error: error.message || 'Failed to search HS code',
            hsCode: '0000',
            description: 'Error occurred',
            confidence: 0,
            reasons: ['Error processing request'],
            relatedCodes: []
        });
    }
});

// Start server
app.listen(PORT, async () => {
    await loadTariffData();
    console.log(`✓ Server running on http://localhost:${PORT}`);
    console.log(`✓ Frontend: http://localhost:${PORT}/`);
    console.log(`✓ API Health: http://localhost:${PORT}/api/health`);
});
