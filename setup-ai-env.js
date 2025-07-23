// Quick environment setup for AI Chatbot
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Colors for console
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function setupEnvironment() {
    log('🤖 AI CHATBOT ENVIRONMENT SETUP', 'bright');
    log('=' .repeat(40), 'cyan');
    log('Hướng dẫn này sẽ giúp bạn cấu hình AI chatbot nhanh chóng.\n', 'blue');
    
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    let hasExistingEnv = false;
    
    // Check if .env exists
    if (fs.existsSync(envPath)) {
        log('📄 File .env đã tồn tại', 'yellow');
        const useExisting = await question('Bạn có muốn sử dụng file .env hiện có? (y/n): ');
        
        if (useExisting.toLowerCase() === 'y') {
            envContent = fs.readFileSync(envPath, 'utf8');
            hasExistingEnv = true;
            log('✅ Sử dụng file .env hiện có', 'green');
        } else {
            const backup = await question('Tạo backup file .env cũ? (y/n): ');
            if (backup.toLowerCase() === 'y') {
                fs.copyFileSync(envPath, `${envPath}.backup.${Date.now()}`);
                log('✅ Đã tạo backup', 'green');
            }
        }
    }
    
    log('\n🔧 CHỌN AI PROVIDERS:', 'yellow');
    log('1. Google Gemini - MIỄN PHÍ, tốt cho tiếng Việt', 'cyan');
    log('2. Groq AI - MIỄN PHÍ, siêu nhanh', 'cyan');
    log('3. OpenAI GPT - Chất lượng cao ($5 free credit)', 'cyan');
    log('4. Tất cả (khuyến nghị)', 'green');
    
    const providerChoice = await question('\nChọn option (1-4): ');
    
    const apiKeys = {};
    
    // Setup providers based on choice
    if (providerChoice === '1' || providerChoice === '4') {
        log('\n🟢 Setup Google Gemini:', 'green');
        log('1. Truy cập: https://ai.google.dev', 'blue');
        log('2. Đăng nhập và tạo API key', 'blue');
        const geminiKey = await question('Nhập Gemini API key (hoặc Enter để bỏ qua): ');
        if (geminiKey.trim()) {
            apiKeys.GEMINI_API_KEY = geminiKey.trim();
        }
    }
    
    if (providerChoice === '2' || providerChoice === '4') {
        log('\n⚡ Setup Groq AI:', 'yellow');
        log('1. Truy cập: https://console.groq.com/keys', 'blue');
        log('2. Đăng ký và tạo API key', 'blue');
        const groqKey = await question('Nhập Groq API key (hoặc Enter để bỏ qua): ');
        if (groqKey.trim()) {
            apiKeys.GROQ_API_KEY = groqKey.trim();
        }
    }
    
    if (providerChoice === '3' || providerChoice === '4') {
        log('\n🧠 Setup OpenAI GPT:', 'blue');
        log('1. Truy cập: https://platform.openai.com/api-keys', 'blue');
        log('2. Đăng ký và tạo API key', 'blue');
        const openaiKey = await question('Nhập OpenAI API key (hoặc Enter để bỏ qua): ');
        if (openaiKey.trim()) {
            apiKeys.OPENAI_API_KEY = openaiKey.trim();
        }
    }
    
    // Choose default provider
    const availableProviders = [];
    if (apiKeys.GEMINI_API_KEY) availableProviders.push('gemini');
    if (apiKeys.GROQ_API_KEY) availableProviders.push('groq');
    if (apiKeys.OPENAI_API_KEY) availableProviders.push('openai');
    
    let defaultProvider = 'original';
    if (availableProviders.length > 0) {
        log('\n🎯 Chọn AI provider mặc định:', 'yellow');
        availableProviders.forEach((provider, index) => {
            log(`${index + 1}. ${provider.toUpperCase()}`, 'cyan');
        });
        
        const defaultChoice = await question(`Chọn provider mặc định (1-${availableProviders.length}): `);
        const choiceIndex = parseInt(defaultChoice) - 1;
        if (choiceIndex >= 0 && choiceIndex < availableProviders.length) {
            defaultProvider = availableProviders[choiceIndex];
        }
    }
    
    // Google Drive setup
    let needsGoogleDrive = true;
    if (hasExistingEnv && envContent.includes('GOOGLE_SERVICE_ACCOUNT_EMAIL')) {
        const updateDrive = await question('\n📁 Cập nhật cấu hình Google Drive? (y/n): ');
        needsGoogleDrive = updateDrive.toLowerCase() === 'y';
    }
    
    const driveConfig = {};
    if (needsGoogleDrive) {
        log('\n📁 Setup Google Drive:', 'cyan');
        log('Cần thiết để đọc tài liệu thuốc từ Drive', 'blue');
        
        const serviceEmail = await question('Service Account Email: ');
        const privateKey = await question('Private Key (có thể paste nhiều dòng, kết thúc bằng dòng trống): ');
        const folderId = await question('Drive Folder ID: ');
        
        if (serviceEmail.trim()) driveConfig.GOOGLE_SERVICE_ACCOUNT_EMAIL = serviceEmail.trim();
        if (privateKey.trim()) driveConfig.GOOGLE_PRIVATE_KEY = privateKey.trim();
        if (folderId.trim()) driveConfig.GOOGLE_DRIVE_FOLDER_ID = folderId.trim();
    }
    
    // Generate .env content
    let newEnvContent = '';
    
    if (hasExistingEnv) {
        newEnvContent = envContent;
        
        // Update or add AI keys
        Object.entries(apiKeys).forEach(([key, value]) => {
            const regex = new RegExp(`^${key}=.*$`, 'm');
            if (regex.test(newEnvContent)) {
                newEnvContent = newEnvContent.replace(regex, `${key}=${value}`);
            } else {
                newEnvContent += `\n${key}=${value}`;
            }
        });
        
        // Update AI_PROVIDER
        const providerRegex = /^AI_PROVIDER=.*$/m;
        if (providerRegex.test(newEnvContent)) {
            newEnvContent = newEnvContent.replace(providerRegex, `AI_PROVIDER=${defaultProvider}`);
        } else {
            newEnvContent += `\nAI_PROVIDER=${defaultProvider}`;
        }
        
        // Update Google Drive if needed
        Object.entries(driveConfig).forEach(([key, value]) => {
            const regex = new RegExp(`^${key}=.*$`, 'm');
            if (regex.test(newEnvContent)) {
                newEnvContent = newEnvContent.replace(regex, `${key}=${value}`);
            } else {
                newEnvContent += `\n${key}=${value}`;
            }
        });
        
    } else {
        // Create new .env file
        newEnvContent = `# PedMedVN Environment Configuration
# Generated by AI Chatbot Setup on ${new Date().toISOString()}

# Google Drive Configuration (Required)
${driveConfig.GOOGLE_SERVICE_ACCOUNT_EMAIL ? `GOOGLE_SERVICE_ACCOUNT_EMAIL=${driveConfig.GOOGLE_SERVICE_ACCOUNT_EMAIL}` : 'GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com'}
${driveConfig.GOOGLE_PRIVATE_KEY ? `GOOGLE_PRIVATE_KEY="${driveConfig.GOOGLE_PRIVATE_KEY}"` : 'GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"'}
${driveConfig.GOOGLE_DRIVE_FOLDER_ID ? `GOOGLE_DRIVE_FOLDER_ID=${driveConfig.GOOGLE_DRIVE_FOLDER_ID}` : 'GOOGLE_DRIVE_FOLDER_ID=your_drive_folder_id'}

# AI Providers
${apiKeys.GEMINI_API_KEY ? `GEMINI_API_KEY=${apiKeys.GEMINI_API_KEY}` : '# GEMINI_API_KEY=your_gemini_key_here'}
${apiKeys.GROQ_API_KEY ? `GROQ_API_KEY=${apiKeys.GROQ_API_KEY}` : '# GROQ_API_KEY=your_groq_key_here'}
${apiKeys.OPENAI_API_KEY ? `OPENAI_API_KEY=${apiKeys.OPENAI_API_KEY}` : '# OPENAI_API_KEY=your_openai_key_here'}

# Default AI Provider
AI_PROVIDER=${defaultProvider}

# Server Configuration
PORT=3000
NODE_ENV=development

# Security
SESSION_SECRET=your-session-secret-change-this
JWT_SECRET=your-jwt-secret-change-this
`;
    }
    
    // Write .env file
    fs.writeFileSync(envPath, newEnvContent);
    
    log('\n✅ File .env đã được tạo/cập nhật!', 'green');
    
    // Summary
    log('\n📋 TỔNG KẾT SETUP:', 'yellow');
    log(`🎯 AI Provider mặc định: ${defaultProvider.toUpperCase()}`, 'blue');
    log(`🔑 Số API keys: ${Object.keys(apiKeys).length}`, 'blue');
    
    Object.keys(apiKeys).forEach(key => {
        log(`  ✅ ${key}: Configured`, 'green');
    });
    
    if (Object.keys(apiKeys).length === 0) {
        log('  ⚠️ Không có AI keys - sẽ dùng chatbot cơ bản', 'yellow');
    }
    
    // Next steps
    log('\n🚀 BƯỚC TIẾP THEO:', 'yellow');
    log('1. Khởi động server: npm run dev', 'cyan');
    log('2. Test AI services: node test-ai-services.js', 'cyan');
    log('3. Truy cập website và test chatbot', 'cyan');
    log('4. Chuyển đổi AI providers trong chat settings', 'cyan');
    
    // Test option
    const runTest = await question('\nChạy test ngay bây giờ? (y/n): ');
    if (runTest.toLowerCase() === 'y') {
        log('\n🧪 Chạy test suite...', 'blue');
        try {
            const testModule = require('./test-ai-services');
            await testModule.runAllTests();
        } catch (error) {
            log(`❌ Test failed: ${error.message}`, 'red');
        }
    }
    
    log('\n🎉 Setup hoàn thành!', 'green');
    rl.close();
}

// Run setup if script is executed directly
if (require.main === module) {
    setupEnvironment().catch(error => {
        log(`❌ Setup failed: ${error.message}`, 'red');
        console.error(error);
        rl.close();
        process.exit(1);
    });
}

module.exports = { setupEnvironment };
