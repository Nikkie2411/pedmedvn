require('dotenv').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

async function testConnection() {
  try {
    console.log('🔍 Testing Google Sheets connection...');
    
    // Sử dụng environment variables
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}');
    
    if (!credentials.client_email) {
      throw new Error('GOOGLE_CREDENTIALS not found in environment variables');
    }
    
    console.log('✅ Credentials loaded successfully');
    console.log('📧 Service account email:', credentials.client_email);
    
    // Tạo JWT auth
    const serviceAccountAuth = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
      ],
    });
    
    const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID, serviceAccountAuth);
    
    await doc.loadInfo();
    
    console.log('✅ Connection successful!');
    console.log('📊 Spreadsheet title:', doc.title);
    console.log('📋 Number of sheets:', doc.sheetCount);
    
    // List all sheets
    console.log('📄 Sheets:');
    Object.keys(doc.sheetsById).forEach(sheetId => {
      const sheet = doc.sheetsById[sheetId];
      console.log(`  - ${sheet.title} (ID: ${sheetId})`);
    });
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  }
}

testConnection();
