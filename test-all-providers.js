// Test all AI providers with new API keys
require('dotenv').config();

async function testAllProviders() {
    try {
        console.log('🧪 Testing All AI Providers with New API Keys\n');
        
        // Test environment variables
        console.log('🔍 Environment Variables Check:');
        const keys = ['GROQ_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY'];
        keys.forEach(key => {
            const value = process.env[key];
            if (value) {
                console.log(`✅ ${key}: ${value.substring(0, 15)}...`);
            } else {
                console.log(`❌ ${key}: Not set`);
            }
        });
        console.log(`✅ AI_PROVIDER: ${process.env.AI_PROVIDER || 'default'}`);
        
        // Import AI Manager
        const AIChatbotManager = require('./services/aiChatbotManager');
        
        console.log('\n🚀 Initializing AI Chatbot Manager...');
        await AIChatbotManager.initialize();
        
        const currentProvider = AIChatbotManager.getCurrentProvider();
        console.log(`\n📊 Current Provider: ${currentProvider.name.toUpperCase()}`);
        
        // Test question
        const testQuestion = 'Chống chỉ định của tigecyclin?';
        console.log(`\n💬 Testing question: "${testQuestion}"`);
        
        const result = await AIChatbotManager.chat(testQuestion, 'test-user');
        
        console.log('\n✅ Chat Result:');
        console.log(`- Success: ${result.success}`);
        console.log(`- AI Provider: ${result.data?.aiProvider || 'Unknown'}`);
        console.log(`- Response length: ${result.data?.message?.length || 0} characters`);
        console.log(`- Response preview: ${result.data?.message?.substring(0, 200)}...`);
        
        if (result.data?.fallbackReason) {
            console.log(`- Fallback reason: ${result.data.fallbackReason}`);
        }
        
        // Test provider switching
        console.log('\n🔄 Testing Provider Switching...');
        
        const providers = ['groq', 'openai', 'original'];
        for (const provider of providers) {
            console.log(`\n📋 Testing switch to: ${provider.toUpperCase()}`);
            
            const switchResult = await AIChatbotManager.switchProvider(provider);
            console.log(`- Switch success: ${switchResult.success}`);
            console.log(`- Message: ${switchResult.message}`);
            
            if (switchResult.success) {
                // Quick test chat
                try {
                    const quickTest = await AIChatbotManager.chat('Paracetamol là gì?', 'test');
                    console.log(`- Quick test: ${quickTest.success ? 'PASS' : 'FAIL'}`);
                    console.log(`- Provider used: ${quickTest.data?.aiProvider || 'Unknown'}`);
                } catch (testError) {
                    console.log(`- Quick test: FAIL (${testError.message})`);
                }
            }
        }
        
        // Get final stats
        console.log('\n📊 Final System Stats:');
        const stats = await AIChatbotManager.getStats();
        console.log('- Total providers loaded:', stats.totalProviders);
        console.log('- Available providers:', stats.availableProviders?.map(p => p.name).join(', '));
        console.log('- Current provider:', stats.currentProvider);
        console.log('- Is initialized:', stats.isInitialized);
        
        console.log('\n🎉 All tests completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testAllProviders();
