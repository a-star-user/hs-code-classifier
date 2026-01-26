import pdfParse from 'pdf-parse';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function extractPDF() {
    try {
        console.log('📄 Extracting PDF...');
        const pdfPath = path.join(__dirname, 'Customs Tariff of India.pdf');
        
        if (!fs.existsSync(pdfPath)) {
            console.error('❌ PDF not found:', pdfPath);
            process.exit(1);
        }

        const pdfBuffer = fs.readFileSync(pdfPath);
        const data = await pdfParse(pdfBuffer);
        
        console.log('✅ PDF parsed');
        console.log('📊 Pages:', data.numpages);
        console.log('📊 Total text length:', data.text.length);

        // Extract structured HS codes
        const lines = data.text.split('\n');
        const hsCodeMap = {};
        const hsCodeList = [];
        let currentCode = null;
        let currentDescription = '';

        for (let line of lines) {
            const trimmed = line.trim();
            
            // Look for 8-digit HS codes at the start of a line
            const codeMatch = trimmed.match(/^(\d{8})[\s\-–](.+)/);
            
            if (codeMatch) {
                // Save previous code if exists
                if (currentCode && currentDescription.trim()) {
                    hsCodeMap[currentCode] = currentDescription.trim();
                    hsCodeList.push({
                        code: currentCode,
                        description: currentDescription.trim()
                    });
                }
                
                // Start new code
                currentCode = codeMatch[1];
                currentDescription = codeMatch[2].trim();
            } else if (currentCode && trimmed && !trimmed.match(/^\d+$/)) {
                // Continue description if not empty and not just numbers
                if (currentDescription) {
                    currentDescription += ' ' + trimmed;
                } else {
                    currentDescription = trimmed;
                }
            }
        }

        // Save last code
        if (currentCode && currentDescription.trim()) {
            hsCodeMap[currentCode] = currentDescription.trim();
            hsCodeList.push({
                code: currentCode,
                description: currentDescription.trim()
            });
        }

        console.log('\n✅ Extracted HS Codes:', hsCodeList.length);
        
        if (hsCodeList.length === 0) {
            console.warn('⚠️ No HS codes found! Using full PDF text instead.');
        } else {
            console.log('📋 First 10 HS Codes:');
            hsCodeList.slice(0, 10).forEach(item => {
                console.log(`  ${item.code}: ${item.description.substring(0, 60)}...`);
            });
        }

        // Save as JSON for fast loading
        const jsonPath = path.join(__dirname, 'hs-codes.json');
        fs.writeFileSync(jsonPath, JSON.stringify({
            extractedAt: new Date().toISOString(),
            totalCodes: hsCodeList.length,
            codes: hsCodeList
        }, null, 2));
        console.log('\n✅ Saved to hs-codes.json');

        // Also save as plain text for reference
        const textPath = path.join(__dirname, 'hs-codes.txt');
        const textContent = hsCodeList.map(item => `${item.code} - ${item.description}`).join('\n');
        fs.writeFileSync(textPath, textContent);
        console.log('✅ Saved to hs-codes.txt');

        // Save raw PDF text for fallback
        const rawPath = path.join(__dirname, 'tariff-raw.txt');
        fs.writeFileSync(rawPath, data.text.substring(0, 100000)); // First 100KB
        console.log('✅ Saved raw text to tariff-raw.txt');

        console.log('\n🎉 Extraction complete!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

extractPDF();
