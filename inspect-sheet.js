const { google } = require('googleapis');
const logger = require('./utils/logger');

async function inspectGoogleSheet() {
    try {
        console.log('🔍 Inspecting Google Sheet structure...');
        
        // Try to connect and get sheet info
        const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1mDJIil1rmEXEl7tV5qq3j6HkbKe1padbPhlQMiYaq9U';
        
        let auth;
        if (process.env.GOOGLE_CREDENTIALS) {
            console.log('🔐 Using GOOGLE_CREDENTIALS from environment');
            const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
            auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
            });
        } else {
            throw new Error('No Google credentials found');
        }

        const sheets = google.sheets({ version: 'v4', auth });
        
        // 1. Get all sheet names
        console.log('\n📋 Getting sheet metadata...');
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID
        });
        
        console.log(`📊 Spreadsheet: ${spreadsheet.data.properties.title}`);
        console.log('📝 Available sheets:');
        spreadsheet.data.sheets.forEach(sheet => {
            console.log(`   - ${sheet.properties.title} (${sheet.properties.gridProperties.rowCount} rows × ${sheet.properties.gridProperties.columnCount} cols)`);
        });
        
        // 2. Try to read from 'pedmedvnch' sheet
        const sheetNames = ['pedmedvnch', 'PedMed2025', 'Sheet1', 'Data'];
        
        for (const sheetName of sheetNames) {
            try {
                console.log(`\n🔍 Inspecting sheet: ${sheetName}`);
                
                // Get first 10 rows to see structure
                const response = await sheets.spreadsheets.values.get({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `${sheetName}!A1:Z10`, // Get up to column Z, first 10 rows
                });
                
                const rows = response.data.values;
                if (!rows || rows.length === 0) {
                    console.log(`   ❌ No data in ${sheetName}`);
                    continue;
                }
                
                console.log(`   ✅ Found ${rows.length} rows in ${sheetName}`);
                console.log('   📑 Headers (Row 1):');
                if (rows[0]) {
                    rows[0].forEach((header, index) => {
                        console.log(`     ${String.fromCharCode(65 + index)}: ${header}`);
                    });
                }
                
                console.log('   📄 Sample data (Row 2):');
                if (rows[1]) {
                    rows[1].forEach((cell, index) => {
                        const header = rows[0][index] || `Col${index+1}`;
                        console.log(`     ${header}: ${cell}`);
                    });
                }
                
                // Count total rows
                const fullRange = await sheets.spreadsheets.values.get({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `${sheetName}!A:A`,
                });
                const totalRows = fullRange.data.values ? fullRange.data.values.length - 1 : 0; // -1 for header
                console.log(`   📊 Total drugs: ${totalRows}`);
                
                // Success - analyze this sheet
                await analyzeDrugData(sheets, SPREADSHEET_ID, sheetName, rows[0]);
                break;
                
            } catch (error) {
                console.log(`   ❌ Error reading ${sheetName}: ${error.message}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Sheet inspection failed:', error.message);
        console.log('\n💡 Suggested fixes:');
        console.log('1. Check Google credentials');
        console.log('2. Ensure sheet is shared with service account');
        console.log('3. Verify sheet names');
    }
}

async function analyzeDrugData(sheets, spreadsheetId, sheetName, headers) {
    console.log(`\n🧪 Analyzing drug data structure in ${sheetName}...`);
    
    // Get some sample data for analysis
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: `${sheetName}!A1:Z20`, // First 20 rows
    });
    
    const rows = response.data.values;
    if (!rows || rows.length < 2) return;
    
    console.log('\n📊 Data Structure Analysis:');
    
    // Analyze each column
    headers.forEach((header, index) => {
        const sampleValues = [];
        for (let i = 1; i < Math.min(rows.length, 6); i++) { // Get 5 samples
            if (rows[i] && rows[i][index]) {
                sampleValues.push(rows[i][index]);
            }
        }
        
        console.log(`\n📝 Column ${String.fromCharCode(65 + index)}: "${header}"`);
        console.log(`   📋 Sample values:`);
        sampleValues.forEach((value, i) => {
            const truncated = value.length > 50 ? value.substring(0, 50) + '...' : value;
            console.log(`     ${i+1}. ${truncated}`);
        });
    });
    
    // Suggest optimal mapping
    console.log('\n💡 Suggested Data Mapping for Chatbot:');
    suggestDataMapping(headers);
}

function suggestDataMapping(headers) {
    const mappings = [];
    
    headers.forEach((header, index) => {
        const col = String.fromCharCode(65 + index);
        const lowerHeader = header.toLowerCase();
        
        if (lowerHeader.includes('tên') || lowerHeader.includes('thuốc') || lowerHeader.includes('name') || lowerHeader.includes('drug')) {
            mappings.push(`${col}: ${header} → Drug Name (Primary identifier)`);
        } else if (lowerHeader.includes('liều') || lowerHeader.includes('dose') || lowerHeader.includes('dosage')) {
            mappings.push(`${col}: ${header} → Dosage Information`);
        } else if (lowerHeader.includes('chống chỉ định') || lowerHeader.includes('contraindication')) {
            mappings.push(`${col}: ${header} → Contraindications (IMPORTANT for safety)`);
        } else if (lowerHeader.includes('tác dụng phụ') || lowerHeader.includes('side effect') || lowerHeader.includes('adverse')) {
            mappings.push(`${col}: ${header} → Side Effects`);
        } else if (lowerHeader.includes('chỉ định') || lowerHeader.includes('indication') || lowerHeader.includes('dùng cho')) {
            mappings.push(`${col}: ${header} → Indications/Uses`);
        } else if (lowerHeader.includes('nhóm') || lowerHeader.includes('group') || lowerHeader.includes('class')) {
            mappings.push(`${col}: ${header} → Drug Class/Category`);
        } else if (lowerHeader.includes('ghi chú') || lowerHeader.includes('note') || lowerHeader.includes('comment')) {
            mappings.push(`${col}: ${header} → Additional Notes`);
        } else {
            mappings.push(`${col}: ${header} → General Information`);
        }
    });
    
    mappings.forEach(mapping => console.log(`   ${mapping}`));
    
    console.log('\n🎯 Optimization Recommendations:');
    console.log('1. ✅ Primary search: Drug name matching');
    console.log('2. ⚠️  Safety priority: Contraindications must be prominent');
    console.log('3. 📋 Content search: Full-text search across all columns');
    console.log('4. 🔍 Smart matching: Handle misspellings and synonyms');
    console.log('5. 📊 Structured response: Organize answer by importance');
}

// Run inspection
if (require.main === module) {
    require('dotenv').config();
    inspectGoogleSheet().then(() => {
        console.log('\n✅ Sheet inspection completed!');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Inspection failed:', error);
        process.exit(1);
    });
}

module.exports = { inspectGoogleSheet };
