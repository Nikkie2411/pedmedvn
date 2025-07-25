// Quick test for fixed aiChatbotManager
require('dotenv').config();

async function quickTest() {
    try {
        console.log('🔍 Testing fixed AI Chatbot Manager...\n');
        
        const AIChatbotManager = require('./services/aiChatbotManager');
        // Create instance if it's a class
        const aiManager = AIChatbotManager.constructor ? AIChatbotManager : new AIChatbotManager();
        
        console.log('📊 Initializing...');
        await aiManager.initialize();
        
        console.log('\n📋 Current provider:', aiManager.getCurrentProvider().name);
        
        console.log('\n🧪 Testing chat with tigecyclin...');
        const result = await aiManager.chat('Chống chỉ định của tigecyclin?', 'test-user');
        
        console.log('\n✅ Chat result:');
        console.log('- Success:', result.success);
        console.log('- AI Provider:', result.data?.aiProvider);
        console.log('- Message preview:', result.data?.message?.substring(0, 200) + '...');
        
        if (result.data?.fallbackReason) {
            console.log('- Fallback reason:', result.data.fallbackReason);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

quickTest();
