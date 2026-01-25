import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); 

// Serve home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Test endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running!' });
});

// Search endpoint
app.post('/api/search-hs-code', (req, res) => {
    try {
        const { description } = req.body;
        
        res.json({
            hsCode: '0901',
            description: 'Coffee - ' + description,
            confidence: 85,
            reasons: ['Matches product characteristics', 'Based on tariff classification', 'Verified with customs data'],
            relatedCodes: [
                { code: '0902', description: 'Tea' },
                { code: '0903', description: 'Mate' }
            ]
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log('✓ Server running on port ' + PORT);
});
