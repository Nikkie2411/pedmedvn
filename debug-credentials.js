// Debug Google Credentials
require('dotenv').config();

console.log('🔍 Debugging Google Credentials...\n');

// Check environment variable
const credString = process.env.GOOGLE_CREDENTIALS;
console.log('Environment variable length:', credString ? credString.length : 'undefined');

if (!credString) {
    console.log('❌ GOOGLE_CREDENTIALS not found in environment');
    process.exit(1);
}

// Try to parse JSON
try {
    const creds = JSON.parse(credString);
    console.log('✅ JSON parsing successful');
    console.log('- Project ID:', creds.project_id);
    console.log('- Client Email:', creds.client_email);
    console.log('- Private Key present:', creds.private_key ? 'Yes' : 'No');
    console.log('- Private Key length:', creds.private_key ? creds.private_key.length : 'N/A');
    
    // Check private key format
    if (creds.private_key) {
        const keyLines = creds.private_key.split('\n');
        console.log('- Private Key starts with:', keyLines[0]);
        console.log('- Private Key ends with:', keyLines[keyLines.length - 1]);
        
        // Check for proper format
        if (creds.private_key.includes('BEGIN PRIVATE KEY') && creds.private_key.includes('END PRIVATE KEY')) {
            console.log('✅ Private key format looks correct');
        } else {
            console.log('❌ Private key format may be incorrect');
        }
    }
    
} catch (error) {
    console.log('❌ JSON parsing failed:', error.message);
    console.log('First 100 characters:', credString.substring(0, 100));
    process.exit(1);
}

// Test Google Auth
console.log('\n🔍 Testing Google Authentication...');
try {
    const { google } = require('googleapis');
    
    const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(credString),
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    
    console.log('✅ GoogleAuth object created successfully');
    
    // Try to get auth client
    auth.getClient().then(client => {
        console.log('✅ Auth client obtained successfully');
        console.log('Client type:', client.constructor.name);
        
        // Test actual API call
        console.log('\n🔍 Testing API call...');
        const sheets = google.sheets({ version: 'v4', auth });
        
        return sheets.spreadsheets.values.get({
            spreadsheetId: '1mDJIil1rmEXEl7tV5qq3j6HkbKe1padbPhlQMiYaq9U',
            range: 'pedmedvnch!A1:A10',
        });
    }).then(response => {
        console.log('✅ API call successful!');
        console.log('Rows returned:', response.data.values ? response.data.values.length : 0);
        if (response.data.values && response.data.values.length > 0) {
            console.log('First row:', response.data.values[0]);
        }
    }).catch(error => {
        console.log('❌ API call failed:', error.message);
        
        if (error.message.includes('Invalid JWT Signature')) {
            console.log('\n🔧 JWT Signature issue - possible causes:');
            console.log('1. Private key has incorrect newlines');
            console.log('2. Service account email/key mismatch');
            console.log('3. Service account not enabled for Sheets API');
            console.log('4. Spreadsheet not shared with service account');
        }
    });
    
} catch (error) {
    console.log('❌ GoogleAuth creation failed:', error.message);
}
