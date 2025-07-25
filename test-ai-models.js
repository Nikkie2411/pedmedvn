require('dotenv').config();

async function testAIModels() {
    try {
        console.log('🔍 Testing AI Models and Provider Switching...\n');
        
        // 1. Test AI ChatBot Manager
        console.log('1. Testing AI ChatBot Manager...');
        const aiManager = require('./services/aiChatbotManager');
        
        console.log('Manager initialized:', aiManager.isInitialized);
        console.log('Current provider:', aiManager.currentProvider);
        
        if (!aiManager.isInitialized) {
            console.log('Initializing AI manager...');
            await aiManager.initialize();
        }
        
        // 2. Test getting available providers
        console.log('\n2. Testing Available Providers...');
        const providers = aiManager.getAvailableProviders();
        console.log(`Found ${providers.length} providers:`);
        providers.forEach(provider => {
            console.log(`  - ${provider.displayName}: ${provider.status} ${provider.isActive ? '(ACTIVE)' : ''}`);
        });
        
        // 3. Test current provider
        console.log('\n3. Testing Current Provider...');
        const currentProvider = aiManager.getCurrentProvider();
        console.log('Current provider info:', currentProvider);
        
        // 4. Test provider switching
        console.log('\n4. Testing Provider Switching...');
        const availableProviders = providers.filter(p => p.status === 'available' && p.name !== aiManager.currentProvider);
        
        if (availableProviders.length > 0) {
            const targetProvider = availableProviders[0].name;
            console.log(`Switching to: ${targetProvider}`);
            
            try {
                const switchResult = await aiManager.switchProvider(targetProvider);
                console.log('Switch result:', switchResult);
                console.log('New current provider:', aiManager.currentProvider);
            } catch (error) {
                console.error('Switch failed:', error.message);
            }
        } else {
            console.log('No other available providers to switch to');
        }
        
        // 5. Test individual AI services
        console.log('\n5. Testing Individual AI Services...');
        
        // Test Groq
        try {
            console.log('\n📱 Testing Groq AI...');
            const GroqChatbot = require('./services/groqChatbotDrug');
            const groq = new GroqChatbot();
            const groqTest = await groq.generateResponse('Hello test', []);
            console.log('✅ Groq working:', groqTest.success);
        } catch (error) {
            console.log('❌ Groq failed:', error.message);
        }
        
        // Test OpenAI
        try {
            console.log('\n🤖 Testing OpenAI...');
            const OpenAIChatbot = require('./services/openaiChatbot');
            const openai = new OpenAIChatbot();
            const openaiTest = await openai.generateResponse('Hello test', []);
            console.log('✅ OpenAI working:', openaiTest.success);
        } catch (error) {
            console.log('❌ OpenAI failed:', error.message);
        }
        
        // Test Gemini
        try {
            console.log('\n💎 Testing Gemini AI...');
            const GeminiChatbot = require('./services/geminiChatbotDrug');
            const gemini = new GeminiChatbot();
            const geminiTest = await gemini.generateResponse('Hello test', []);
            console.log('✅ Gemini working:', geminiTest.success);
        } catch (error) {
            console.log('❌ Gemini failed:', error.message);
        }
        
        // 6. Test drug-specific query with AI
        console.log('\n6. Testing Drug Query with AI...');
        try {
            const response = await aiManager.generateResponse('tigecycline chống chỉ định gì', []);
            console.log('AI Response preview:', response.data.message.substring(0, 150) + '...');
            console.log('Model used:', response.data.modelUsed);
        } catch (error) {
            console.error('Drug query failed:', error.message);
        }
        
        // 7. Test API endpoints
        console.log('\n7. Testing API Endpoints...');
        const { spawn } = require('child_process');
        
        // Start server in background
        console.log('Starting server for endpoint testing...');
        const server = spawn('node', ['app.js'], { cwd: 'backend' });
        
        // Wait a bit for server to start
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Test providers endpoint
        try {
            const response = await fetch('http://localhost:3000/api/ai-chatbot/providers');
            const data = await response.json();
            console.log('✅ /providers endpoint working');
            console.log('Available providers from API:', data.data?.providers?.length || 0);
        } catch (error) {
            console.log('❌ /providers endpoint failed:', error.message);
        }
        
        // Test switch provider endpoint
        if (availableProviders.length > 0) {
            try {
                const response = await fetch('http://localhost:3000/api/ai-chatbot/switch-provider', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ provider: availableProviders[0].name })
                });
                const data = await response.json();
                console.log('✅ /switch-provider endpoint working');
            } catch (error) {
                console.log('❌ /switch-provider endpoint failed:', error.message);
            }
        }
        
        server.kill();
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

testAIModels().then(() => {
    console.log('\n🎉 AI Models test completed!');
    process.exit(0);
}).catch(error => {
    console.error('❌ Test error:', error);
    process.exit(1);
});
