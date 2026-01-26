import Groq from 'groq-sdk';

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
    console.error('❌ No API key set');
    process.exit(1);
}

console.log('🔑 API Key:', apiKey.substring(0, 20) + '...');

const groq = new Groq({ apiKey });

(async () => {
    try {
        console.log('📞 Testing Groq API connection...');
        
        const response = await groq.chat.completions.create({
            messages: [
                {
                    role: 'user',
                    content: 'Return only this JSON: {"test": true, "message": "Groq is working!"}',
                }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.1,
            max_tokens: 100,
        });

        const responseText = response.choices[0]?.message?.content;
        console.log('✅ Response received:');
        console.log(responseText);
        
        // Try to parse JSON
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log('✅ JSON parsed successfully:', parsed);
        } else {
            console.warn('⚠️ Could not extract JSON from response');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
})();
