// Simple test for Google Sheets connection
require('dotenv').config();
const { google } = require('googleapis');

async function testSheetsConnection() {
    try {
        console.log('🔍 Testing Google Sheets connection...');
        
        if (!process.env.GOOGLE_CREDENTIALS) {
            throw new Error('GOOGLE_CREDENTIALS not found in environment');
        }
        
        const auth = new google.auth.GoogleAuth({
            credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        
        const sheets = google.sheets({ version: 'v4', auth });
        const SPREADSHEET_ID = '1mDJIil1rmEXEl7tV5qq3j6HkbKe1padbPhlQMiYaq9U';
        
        console.log('📊 Fetching sheet info...');
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'pedmedvnch!A1:Z10', // First 10 rows, columns A-Z
        });
        
        if (!response?.data?.values) {
            console.log('❌ No data returned from sheets');
            return;
        }
        
        const rows = response.data.values;
        console.log(`✅ Successfully connected! Found ${rows.length} rows`);
        
        if (rows.length > 0) {
            console.log('📋 Headers:', rows[0]);
            
            // Look for tigecyclin in data
            console.log('\n🔍 Searching for tigecyclin...');
            let found = false;
            
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const rowText = row.join(' ').toLowerCase();
                
                if (rowText.includes('tigecyclin')) {
                    console.log(`✅ Found tigecyclin in row ${i + 1}:`);
                    console.log('   Data:', row.slice(0, 3)); // Show first 3 columns
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                console.log('❌ Tigecyclin not found in first 10 rows');
                console.log('📋 Sample data from row 2:', rows[1]?.slice(0, 3));
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testSheetsConnection();
