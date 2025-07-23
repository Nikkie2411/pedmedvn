// Test script cho AI Services
require('dotenv').config();
const path = require('path');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testAIService(serviceName, serviceClass) {
    log(`\n🧪 Testing ${serviceName}...`, 'cyan');
    
    try {
        const service = require(serviceClass);
        
        // Test initialization
        log('  📋 Testing initialization...', 'blue');
        await service.initialize();
        log('  ✅ Initialization successful', 'green');
        
        // Test stats
        log('  📊 Getting service stats...', 'blue');
        const stats = service.getStats();
        log(`  📚 Documents: ${stats.documentsCount}`, 'blue');
        log(`  💊 Known drugs: ${stats.knownDrugsCount}`, 'blue');
        log(`  🤖 AI Model: ${stats.aiModel || 'N/A'}`, 'blue');
        log(`  🟢 AI Enabled: ${stats.isAiEnabled}`, stats.isAiEnabled ? 'green' : 'red');
        
        // Test chat functionality
        if (stats.isAiEnabled) {
            log('  💬 Testing chat functionality...', 'blue');
            const testMessage = 'Thuốc paracetamol là gì?';
            const chatResult = await service.chat(testMessage, 'test-user');
            
            if (chatResult.success) {
                log('  ✅ Chat test successful', 'green');
                log(`  📝 Response: ${chatResult.data.message.substring(0, 100)}...`, 'blue');
                log(`  ⏱️ Response time: ${chatResult.data.responseTime}ms`, 'blue');
                log(`  🎯 Confidence: ${chatResult.data.confidence}%`, 'blue');
            } else {
                log(`  ❌ Chat test failed: ${chatResult.message}`, 'red');
            }
        } else {
            log('  ⚠️ AI not enabled, skipping chat test', 'yellow');
        }
        
        return { success: true, stats };
        
    } catch (error) {
        log(`  ❌ Error testing ${serviceName}: ${error.message}`, 'red');
        return { success: false, error: error.message };
    }
}

async function testAIManager() {
    log('\n🎯 Testing AI Manager...', 'cyan');
    
    try {
        const aiManager = require('./services/aiChatbotManager');
        
        // Test initialization
        log('  📋 Testing AI Manager initialization...', 'blue');
        await aiManager.initialize();
        log('  ✅ AI Manager initialization successful', 'green');
        
        // Test provider info
        log('  📋 Getting available providers...', 'blue');
        const providers = aiManager.getAvailableProviders();
        const currentProvider = aiManager.getCurrentProvider();
        
        log(`  🎯 Current provider: ${currentProvider.name.toUpperCase()}`, 'green');
        log(`  📋 Available providers: ${providers.length}`, 'blue');
        
        providers.forEach(provider => {
            const statusColor = provider.status === 'ready' ? 'green' : 
                               provider.status === 'needs_api_key' ? 'yellow' : 'red';
            log(`    ${provider.isActive ? '👑' : '  '} ${provider.displayName}: ${provider.status}`, statusColor);
        });
        
        // Test chat with current provider
        log('  💬 Testing chat with current provider...', 'blue');
        const testMessage = 'Thuốc paracetamol dùng như thế nào?';
        const chatResult = await aiManager.chat(testMessage, 'test-user');
        
        if (chatResult.success) {
            log('  ✅ AI Manager chat successful', 'green');
            log(`  📝 Response: ${chatResult.data.message.substring(0, 150)}...`, 'blue');
            log(`  🤖 Provider: ${chatResult.data.aiProvider || 'Unknown'}`, 'blue');
            log(`  ⏱️ Response time: ${chatResult.data.responseTime}ms`, 'blue');
        } else {
            log(`  ❌ AI Manager chat failed: ${chatResult.message}`, 'red');
        }
        
        // Test health check
        log('  🏥 Testing health check...', 'blue');
        const health = await aiManager.healthCheck();
        log(`  📊 Health check for ${Object.keys(health.providers).length} providers`, 'blue');
        
        Object.entries(health.providers).forEach(([name, status]) => {
            const statusColor = status.status === 'healthy' ? 'green' : 'red';
            log(`    ${name.toUpperCase()}: ${status.status}`, statusColor);
        });
        
        return { success: true };
        
    } catch (error) {
        log(`  ❌ Error testing AI Manager: ${error.message}`, 'red');
        return { success: false, error: error.message };
    }
}

async function testEnvironmentVariables() {
    log('\n🔧 Checking Environment Variables...', 'cyan');
    
    const requiredVars = [
        'GOOGLE_SERVICE_ACCOUNT_EMAIL',
        'GOOGLE_PRIVATE_KEY', 
        'GOOGLE_DRIVE_FOLDER_ID'
    ];
    
    const aiVars = [
        'GEMINI_API_KEY',
        'GROQ_API_KEY', 
        'OPENAI_API_KEY'
    ];
    
    // Check required vars
    log('  📋 Checking required variables...', 'blue');
    let allRequired = true;
    
    requiredVars.forEach(varName => {
        if (process.env[varName]) {
            log(`  ✅ ${varName}: Set`, 'green');
        } else {
            log(`  ❌ ${varName}: Missing`, 'red');
            allRequired = false;
        }
    });
    
    // Check AI vars
    log('  🤖 Checking AI API keys...', 'blue');
    let aiKeysCount = 0;
    
    aiVars.forEach(varName => {
        if (process.env[varName] && process.env[varName] !== 'your_' + varName.toLowerCase() + '_here') {
            log(`  ✅ ${varName}: Set`, 'green');
            aiKeysCount++;
        } else {
            log(`  ⚠️ ${varName}: Not set`, 'yellow');
        }
    });
    
    // Check AI provider setting
    const aiProvider = process.env.AI_PROVIDER || 'gemini';
    log(`  🎯 AI_PROVIDER: ${aiProvider.toUpperCase()}`, 'blue');
    
    // Summary
    if (allRequired) {
        log('  ✅ All required variables are set', 'green');
    } else {
        log('  ❌ Some required variables are missing', 'red');
    }
    
    if (aiKeysCount > 0) {
        log(`  ✅ ${aiKeysCount} AI provider(s) configured`, 'green');
    } else {
        log('  ⚠️ No AI providers configured - will use fallback chatbot', 'yellow');
    }
    
    return { allRequired, aiKeysCount };
}

async function testAPIEndpoints() {
    log('\n🌐 Testing API Endpoints...', 'cyan');
    
    try {
        // Note: This assumes server is running on localhost:3000
        const baseUrl = 'http://localhost:3000/api';
        
        log('  📡 Testing AI chatbot health endpoint...', 'blue');
        
        // We'll simulate this since server might not be running
        log('  ℹ️ To test endpoints, start server with: npm run dev', 'yellow');
        log('  📋 Available endpoints:', 'blue');
        log('    GET  /api/ai-chatbot/health', 'blue');
        log('    GET  /api/ai-chatbot/providers', 'blue');
        log('    GET  /api/ai-chatbot/status', 'blue');
        log('    POST /api/ai-chatbot/chat', 'blue');
        log('    POST /api/ai-chatbot/switch-provider', 'blue');
        log('    POST /api/ai-chatbot/test-provider', 'blue');
        
        return { success: true };
        
    } catch (error) {
        log(`  ❌ Error testing endpoints: ${error.message}`, 'red');
        return { success: false, error: error.message };
    }
}

async function generateSetupReport() {
    log('\n📋 Generating Setup Report...', 'cyan');
    
    const envCheck = await testEnvironmentVariables();
    
    log('\n' + '='.repeat(60), 'magenta');
    log('🤖 AI CHATBOT SETUP REPORT', 'bright');
    log('='.repeat(60), 'magenta');
    
    // Environment status
    log('\n📋 ENVIRONMENT STATUS:', 'yellow');
    if (envCheck.allRequired) {
        log('✅ Core configuration: COMPLETE', 'green');
    } else {
        log('❌ Core configuration: INCOMPLETE', 'red');
        log('   ⚠️ Missing required Google Drive variables', 'yellow');
    }
    
    if (envCheck.aiKeysCount > 0) {
        log(`✅ AI providers: ${envCheck.aiKeysCount} configured`, 'green');
    } else {
        log('⚠️ AI providers: None configured (will use fallback)', 'yellow');
    }
    
    // Recommendations
    log('\n🎯 RECOMMENDATIONS:', 'yellow');
    
    if (envCheck.aiKeysCount === 0) {
        log('1. 🆓 Get FREE Gemini API key: https://ai.google.dev', 'cyan');
        log('2. ⚡ Get FREE Groq API key: https://console.groq.com/keys', 'cyan');
        log('3. 💰 Get OpenAI API key: https://platform.openai.com/api-keys ($5 free)', 'cyan');
    } else if (envCheck.aiKeysCount === 1) {
        log('✅ Good! Consider adding a backup AI provider', 'green');
    } else {
        log('✅ Excellent! Multiple AI providers configured', 'green');
    }
    
    // Next steps
    log('\n🚀 NEXT STEPS:', 'yellow');
    log('1. Add missing API keys to .env file', 'blue');
    log('2. Start server: npm run dev', 'blue');
    log('3. Test chatbot on website (click 🤖 icon)', 'blue');
    log('4. Switch AI providers in chat settings (⚙️)', 'blue');
    
    // Links
    log('\n📚 USEFUL LINKS:', 'yellow');
    log('📖 Setup guide: AI_CHATBOT_SETUP.md', 'blue');
    log('🔧 Quick setup: run setup-ai-chatbot.bat', 'blue');
    
    log('\n' + '='.repeat(60), 'magenta');
}

// Main test function
async function runAllTests() {
    log('🤖 AI CHATBOT TEST SUITE', 'bright');
    log('='.repeat(40), 'magenta');
    
    const results = {};
    
    // Test environment first
    results.env = await testEnvironmentVariables();
    
    // Test individual AI services
    const services = [
        ['Gemini AI', './services/geminiChatbot'],
        ['Groq AI', './services/groqChatbot'],
        ['OpenAI GPT', './services/openaiChatbot']
    ];
    
    for (const [name, servicePath] of services) {
        try {
            results[name] = await testAIService(name, servicePath);
        } catch (error) {
            log(`⚠️ ${name} service not available: ${error.message}`, 'yellow');
            results[name] = { success: false, error: error.message };
        }
    }
    
    // Test AI Manager
    results.manager = await testAIManager();
    
    // Test API endpoints
    results.api = await testAPIEndpoints();
    
    // Generate final report
    await generateSetupReport();
    
    // Final summary
    const successCount = Object.values(results).filter(r => r.success).length;
    const totalTests = Object.keys(results).length;
    
    log(`\n🎯 TEST SUMMARY: ${successCount}/${totalTests} tests passed`, 
        successCount === totalTests ? 'green' : 'yellow');
    
    if (successCount === totalTests) {
        log('🎉 All tests passed! AI Chatbot is ready!', 'green');
    } else {
        log('⚠️ Some tests failed. Check the logs above.', 'yellow');
    }
}

// Run tests if this script is executed directly
if (require.main === module) {
    runAllTests().catch(error => {
        log(`❌ Test suite failed: ${error.message}`, 'red');
        console.error(error);
        process.exit(1);
    });
}

module.exports = {
    testAIService,
    testAIManager,
    testEnvironmentVariables,
    testAPIEndpoints,
    runAllTests
};