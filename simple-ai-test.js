require('dotenv').config();

async function simpleTest() {
    try {
        console.log('=== SIMPLE AI TEST ===\n');
        
        // 1. Test AI Manager basic loading
        console.log('1. Loading AI Manager...');
        const aiManager = require('./services/aiChatbotManager');
        console.log('   ✅ AI Manager loaded');
        
        // 2. Check initialization status
        console.log('2. Checking initialization...');
        console.log('   Manager initialized:', aiManager.isInitialized);
        console.log('   Current provider:', aiManager.currentProvider);
        
        // 3. Force initialization
        console.log('3. Initializing manager...');
        await aiManager.initialize();
        console.log('   ✅ Manager initialized');
        console.log('   New current provider:', aiManager.currentProvider);
        
        // 4. Test getAvailableProviders
        console.log('4. Getting available providers...');
        const providers = aiManager.getAvailableProviders();
        console.log('   ✅ Found providers:', providers.length);
        providers.forEach(p => {
            console.log(`     - ${p.name}: ${p.status} (${p.displayName})`);
        });
        
        // 5. Test getCurrentProvider
        console.log('5. Getting current provider info...');
        const current = aiManager.getCurrentProvider();
        console.log('   ✅ Current provider:', current.name);
        
        // 6. Test chat with original provider
        console.log('6. Testing chat with original provider...');
        const response = await aiManager.chat('tigecycline chống chỉ định gì');
        console.log('   ✅ Chat response received');
        console.log('   Success:', response.success);
        if (response.success) {
            console.log('   Message preview:', response.data.message.substring(0, 100) + '...');
            console.log('   AI Provider:', response.data.aiProvider);
        } else {
            console.log('   Error:', response.error || response.message);
        }
        
        console.log('\n=== TEST COMPLETED ===');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

simpleTest().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
