// Security check - ensure no credentials in codebase
const fs = require('fs');
const path = require('path');

function scanForCredentials(dir = '.', level = 0) {
    const items = fs.readdirSync(dir);
    let foundCredentials = false;
    
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            // Skip node_modules and .git
            if (item === 'node_modules' || item === '.git') continue;
            
            if (scanForCredentials(fullPath, level + 1)) {
                foundCredentials = true;
            }
        } else if (stat.isFile()) {
            // Check for credential files (but ignore examples)
            const suspiciousFiles = [
                /^\.env$/,  // Only .env, not .env.example
                /service-key\.json/,
                /vietanhprojects-.*\.json/,
                /-credentials\.json/,
                /google-.*\.json/
            ];
            
            if (suspiciousFiles.some(pattern => pattern.test(item))) {
                console.log(`🚨 CREDENTIAL FILE FOUND: ${fullPath}`);
                foundCredentials = true;
                continue;
            }
            
            // Check file content for secrets (only small files, skip security check itself)
            if (stat.size < 50000 && (item.endsWith('.js') || item.endsWith('.json') || item.endsWith('.env')) && item !== 'security-check.js') {
                try {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    const suspiciousPatterns = [
                        /private_key.*BEGIN PRIVATE KEY/,
                        /service_account.*project_id/,
                        /client_email.*\.iam\.gserviceaccount\.com/
                    ];
                    
                    if (suspiciousPatterns.some(pattern => pattern.test(content))) {
                        console.log(`🚨 CREDENTIAL CONTENT FOUND: ${fullPath}`);
                        foundCredentials = true;
                    }
                } catch (e) {
                    // Ignore read errors
                }
            }
        }
    }
    
    return foundCredentials;
}

console.log('🔍 Scanning for credentials in codebase...');
const hasCredentials = scanForCredentials();

if (hasCredentials) {
    console.log('\n❌ SECURITY ISSUE: Credentials found in codebase!');
    console.log('🔧 Please remove all credential files before pushing to GitHub');
} else {
    console.log('\n✅ SECURITY CHECK PASSED: No credentials found in codebase');
    console.log('🚀 Safe to push to GitHub!');
}

// Check .gitignore
if (fs.existsSync('.gitignore')) {
    const gitignore = fs.readFileSync('.gitignore', 'utf8');
    const hasCredentialIgnores = [
        '*.json',
        '.env',
        'vietanhprojects-*.json',
        'service-key.json'
    ].some(pattern => gitignore.includes(pattern));
    
    if (hasCredentialIgnores) {
        console.log('✅ .gitignore properly configured for credentials');
    } else {
        console.log('⚠️ .gitignore may need credential patterns');
    }
} else {
    console.log('⚠️ No .gitignore found');
}
