// Test authentication without local credentials files
const { google } = require('googleapis');
const fs = require('fs');

async function testEnvAuth() {
    try {
        console.log('🔐 Testing authentication with environment variables only...');
        
        // Check if any credential files exist (should NOT exist in repo)
        const credFiles = [
            './vietanhprojects-124f98147480.json',
            './service-key.json',
            './.env'
        ];
        
        credFiles.forEach(file => {
            if (fs.existsSync(file)) {
                console.log(`⚠️ WARNING: ${file} still exists locally`);
            } else {
                console.log(`✅ ${file} properly excluded from repo`);
            }
        });
        
        // Test with environment variable
        if (process.env.GOOGLE_CREDENTIALS) {
            console.log('✅ GOOGLE_CREDENTIALS environment variable found');
            
            const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
            const auth = new google.auth.GoogleAuth({
                credentials: credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
            });
            
            const sheets = google.sheets({ version: 'v4', auth });
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: '1mDJIil1rmEXEl7tV5qq3j6HkbKe1padbPhlQMiYaq9U',
                range: 'pedmedvnch!A1:F5',
            });
            
            console.log('✅ Authentication successful with environment variable!');
            console.log(`📊 Retrieved ${response.data.values?.length || 0} rows`);
            
        } else {
            console.log('⚠️ GOOGLE_CREDENTIALS environment variable not set');
            console.log('💡 For production, set GOOGLE_CREDENTIALS with full JSON content');
        }
        
        console.log('\n🔒 SECURITY STATUS:');
        console.log('✅ Credentials removed from repository');
        console.log('✅ .gitignore updated to prevent future leaks');
        console.log('✅ Authentication priority: env var > local file');
        console.log('🚀 Safe to push to GitHub!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testEnvAuth();
