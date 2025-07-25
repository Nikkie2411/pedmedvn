// Test Groq AI Integration
require('dotenv').config();

async function testGroqIntegration() {
    console.log('🧪 Testing Groq AI Integration...\n');
    
    try {
        // Test 1: Check if Groq API key is available
        console.log('1️⃣ Checking GROQ_API_KEY...');
        if (!process.env.GROQ_API_KEY) {
            console.log('❌ GROQ_API_KEY not found in environment variables');
            console.log('💡 To get a FREE Groq API key:');
            console.log('   1. Visit: https://console.groq.com/keys');
            console.log('   2. Sign up (completely FREE)');
            console.log('   3. Create new API key');
            console.log('   4. Add to .env file: GROQ_API_KEY=your_key_here');
            console.log('   5. Restart server\n');
            return;
        }
        console.log('✅ GROQ_API_KEY found');
        
        // Test 2: Load Groq service
        console.log('\n2️⃣ Loading Groq Drug AI service...');
        const GroqChatbotDrug = require('./services/groqChatbotDrug');
        console.log('✅ Groq Drug AI service loaded');
        
        // Test 3: Initialize service
        console.log('\n3️⃣ Initializing Groq service...');
        await GroqChatbotDrug.initialize();
        console.log('✅ Groq service initialized');
        
        // Test 4: Test simple chat
        console.log('\n4️⃣ Testing AI chat...');
        const response = await GroqChatbotDrug.chat('thuốc paracetamol dùng như thế nào?');
        
        if (response.success) {
            console.log('✅ Chat test successful!');
            console.log('📝 Response preview:', response.data.response.substring(0, 100) + '...');
            
            if (response.data.note) {
                console.log('💡 Note:', response.data.note);
            }
        } else {
            console.log('❌ Chat test failed:', response.message);
        }
        
        // Test 5: Check AI Manager integration
        console.log('\n5️⃣ Testing AI Manager integration...');
        const AIChatbotManager = require('./services/aiChatbotManager');
        const aiManager = new AIChatbotManager();
        await aiManager.initialize();
        
        const switchResult = await aiManager.switchProvider('groq');
        if (switchResult.success) {
            console.log('✅ AI Manager can switch to Groq successfully');
            
            const managerResponse = await aiManager.chat('thuốc cảm cúm cho trẻ em');
            if (managerResponse.success) {
                console.log('✅ AI Manager + Groq chat works!');
                console.log('📝 Manager response preview:', managerResponse.data.response.substring(0, 100) + '...');
            }
        } else {
            console.log('❌ AI Manager switch failed:', switchResult.message);
        }
        
        console.log('\n🎉 All tests completed!');
        console.log('\n📊 Groq Benefits:');
        console.log('   • 14,400 FREE requests per day');
        console.log('   • Ultra-fast response (faster than Gemini)');
        console.log('   • Supports Llama 3.1 and Mixtral models');
        console.log('   • No quota limits like Gemini (50/day)');
        console.log('   • Perfect for Vietnamese language');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('📍 Stack trace:', error.stack);
    }
}

// Run test
testGroqIntegration();
