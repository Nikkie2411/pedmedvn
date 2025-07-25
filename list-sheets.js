// Test để list tất cả sheets và tìm sheet chính xác
require('dotenv').config();
const { google } = require('googleapis');

async function listAllSheets() {
    try {
        console.log('🔍 Listing all sheets in the spreadsheet...\n');
        
        const auth = new google.auth.GoogleAuth({
            credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        
        const sheets = google.sheets({ version: 'v4', auth });
        const SPREADSHEET_ID = '1mDJIil1rmEXEl7tV5qq3j6HkbKe1padbPhlQMiYaq9U';
        
        // Get spreadsheet metadata to see all sheets
        console.log('📊 Getting spreadsheet metadata...');
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
        });
        
        const sheetsList = spreadsheet.data.sheets;
        console.log(`✅ Found ${sheetsList.length} sheets:\n`);
        
        sheetsList.forEach((sheet, index) => {
            const sheetTitle = sheet.properties.title;
            const sheetId = sheet.properties.sheetId;
            const rowCount = sheet.properties.gridProperties.rowCount;
            const colCount = sheet.properties.gridProperties.columnCount;
            
            console.log(`${index + 1}. "${sheetTitle}"`);
            console.log(`   - Sheet ID: ${sheetId}`);
            console.log(`   - Size: ${rowCount} rows x ${colCount} columns`);
            console.log('');
        });
        
        // Try to read from each sheet to find data
        console.log('🔍 Testing data access from each sheet...\n');
        
        for (const sheet of sheetsList) {
            const sheetName = sheet.properties.title;
            try {
                console.log(`📋 Testing sheet: "${sheetName}"`);
                
                const response = await sheets.spreadsheets.values.get({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `${sheetName}!A1:E5`, // First 5 rows, 5 columns
                });
                
                if (response.data.values && response.data.values.length > 0) {
                    console.log(`   ✅ Data found: ${response.data.values.length} rows`);
                    console.log(`   📋 Headers: ${response.data.values[0].join(', ')}`);
                    
                    // Check for drug-related content
                    const headers = response.data.values[0].join(' ').toLowerCase();
                    if (headers.includes('thuốc') || headers.includes('drug') || 
                        headers.includes('tên') || headers.includes('name') ||
                        headers.includes('hoạt chất') || headers.includes('liều')) {
                        console.log(`   🎯 This looks like a drug data sheet!`);
                        
                        // Look for tigecyclin in this sheet
                        try {
                            const fullResponse = await sheets.spreadsheets.values.get({
                                spreadsheetId: SPREADSHEET_ID,
                                range: sheetName,
                            });
                            
                            const allRows = fullResponse.data.values || [];
                            let foundTigecyclin = false;
                            
                            allRows.forEach((row, rowIndex) => {
                                const rowText = row.join(' ').toLowerCase();
                                if (rowText.includes('tigecyclin')) {
                                    console.log(`   ✅ Found tigecyclin in row ${rowIndex + 1}!`);
                                    console.log(`   📄 Data: ${row.slice(0, 3).join(' | ')}`);
                                    foundTigecyclin = true;
                                }
                            });
                            
                            if (!foundTigecyclin) {
                                console.log(`   ❌ Tigecyclin not found in ${allRows.length} rows`);
                            }
                            
                        } catch (error) {
                            console.log(`   ⚠️ Error reading full sheet: ${error.message}`);
                        }
                    }
                } else {
                    console.log(`   ❌ No data or empty sheet`);
                }
                
            } catch (error) {
                console.log(`   ❌ Error accessing sheet: ${error.message}`);
            }
            
            console.log('');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        
        if (error.message.includes('Invalid JWT Signature')) {
            console.log('\n🔧 Possible solutions:');
            console.log('1. Regenerate service account key');
            console.log('2. Check if service account has access to this spreadsheet');
            console.log('3. Verify the service account email in the credentials');
        }
    }
}

listAllSheets();
