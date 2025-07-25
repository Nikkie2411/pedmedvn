require('dotenv').config();

async function quickAITest() {
    try {
        console.log('🔍 Quick AI Test...\n');
        
        // Test AI Manager basic functionality
        const aiManager = require('./services/aiChatbotManager');
        console.log('1. AI Manager loaded successfully ✅');
        
        // Check initialization
        console.log('2. Manager initialized:', aiManager.isInitialized);
        console.log('3. Current provider:', aiManager.currentProvider);
        
        // Try to initialize
        try {
            await aiManager.initialize();
            console.log('4. Manager initialization completed ✅');
        } catch (error) {
            console.log('4. Manager initialization failed:', error.message);
        }
        
        // Get available providers
        try {
            const providers = aiManager.getAvailableProviders();
            console.log('5. Available providers:', providers.length);
            providers.forEach(p => {
                console.log(`   - ${p.name}: ${p.status} (${p.displayName})`);
            });
        } catch (error) {
            console.log('5. Get providers failed:', error.message);
        }
        
        // Test original chatbot
        try {
            console.log('\n6. Testing original chatbot...');
            const response = await aiManager.generateResponse('tigecycline chống chỉ định', []);
            console.log('✅ Original chatbot response:');
            console.log('Success:', response.success);
            console.log('Message preview:', response.data?.message?.substring(0, 100) + '...');
        } catch (error) {
            console.log('❌ Original chatbot failed:', error.message);
        }
        
        // Test provider switching (even if no external APIs)
        try {
            console.log('\n7. Testing provider switching logic...');
            const switchResult = await aiManager.switchProvider('groq');
            console.log('Switch result:', switchResult);
        } catch (error) {
            console.log('Switch failed (expected):', error.message);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

quickAITest();
