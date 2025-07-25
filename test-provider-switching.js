// Test AI Provider Switching
require('dotenv').config();

async function testProviderSwitching() {
    console.log('🔄 Testing AI Provider Switching...\n');
    
    try {
        // Test 1: Load AI Manager
        console.log('1️⃣ Loading AI Chatbot Manager...');
        const AIChatbotManager = require('./services/aiChatbotManager');
        console.log('✅ AI Manager loaded successfully');
        
        // Test 2: Initialize AI Manager
        console.log('\n2️⃣ Initializing AI Manager...');
        await AIChatbotManager.initialize();
        console.log('✅ AI Manager initialized');
        
        // Test 3: Check available providers
        console.log('\n3️⃣ Checking available providers...');
        const providers = AIChatbotManager.getAvailableProviders();
        console.log(`📋 Available providers: ${providers.map(p => p.name).join(', ')}`);
        
        const currentProvider = AIChatbotManager.getCurrentProvider();
        console.log(`🎯 Current provider: ${currentProvider.name}`);
        
        // Test 4: Test Groq switching
        console.log('\n4️⃣ Testing Groq provider switch...');
        
        // Check if Groq is available
        const groqProvider = providers.find(p => p.name === 'groq');
        if (!groqProvider) {
            console.log('⚠️ Groq provider not found in available providers');
            return;
        }
        
        console.log(`📊 Groq Provider Status: ${groqProvider.status}`);
        console.log(`🔧 Groq Provider Ready: ${groqProvider.isReady}`);
        
        if (groqProvider.status !== 'ready') {
            console.log('⚠️ Groq provider not ready. Checking requirements...');
            if (!process.env.GROQ_API_KEY) {
                console.log('❌ GROQ_API_KEY not found in environment');
                console.log('💡 To fix: Add GROQ_API_KEY to .env file');
                console.log('   1. Visit: https://console.groq.com/keys');
                console.log('   2. Create API key');
                console.log('   3. Add to .env: GROQ_API_KEY=your_key_here');
                return;
            }
        }
        
        // Attempt to switch to Groq
        const switchResult = await AIChatbotManager.switchProvider('groq');
        
        if (switchResult.success) {
            console.log('✅ Successfully switched to Groq!');
            console.log(`📝 Message: ${switchResult.message}`);
            console.log(`🎯 Current provider: ${switchResult.currentProvider}`);
            
            // Test 5: Test chat with Groq
            console.log('\n5️⃣ Testing chat with Groq...');
            const chatResponse = await AIChatbotManager.chat('thuốc paracetamol liều dùng cho trẻ em', 'test_user');
            
            if (chatResponse.success) {
                console.log('✅ Groq chat test successful!');
                console.log(`📝 Response length: ${chatResponse.data.response.length} characters`);
                console.log(`🚀 Response preview: ${chatResponse.data.response.substring(0, 200)}...`);
                
                if (chatResponse.data.model) {
                    console.log(`🤖 Model used: ${chatResponse.data.model}`);
                }
                
                if (chatResponse.data.note) {
                    console.log(`💡 Note: ${chatResponse.data.note}`);
                }
            } else {
                console.log('❌ Groq chat test failed:', chatResponse.message);
            }
            
            // Test 6: Switch back to Gemini
            console.log('\n6️⃣ Switching back to Gemini...');
            const switchBackResult = await AIChatbotManager.switchProvider('gemini');
            
            if (switchBackResult.success) {
                console.log('✅ Successfully switched back to Gemini!');
                console.log(`🎯 Current provider: ${switchBackResult.currentProvider}`);
            } else {
                console.log('⚠️ Failed to switch back to Gemini:', switchBackResult.message);
            }
            
        } else {
            console.log('❌ Failed to switch to Groq:', switchResult.message);
        }
        
        console.log('\n🎉 Provider switching test completed!');
        
        // Test 7: Show final status
        console.log('\n7️⃣ Final status:');
        const finalProvider = AIChatbotManager.getCurrentProvider();
        console.log(`🎯 Current provider: ${finalProvider.name}`);
        console.log(`🔧 Is initialized: ${finalProvider.isInitialized}`);
        
        const stats = await AIChatbotManager.getStats();
        console.log(`📊 Total providers available: ${Object.keys(stats.availableProviders || {}).length}`);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('📍 Stack trace:', error.stack);
        
        // Provide helpful troubleshooting
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Check if all AI services are properly exported as instances');
        console.log('2. Verify GROQ_API_KEY is set in .env file');
        console.log('3. Ensure all dependencies are installed: npm install');
        console.log('4. Check services have initialize() method');
    }
}

// Run test
testProviderSwitching();
