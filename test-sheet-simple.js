// Simple test to check Google Sheets structure
require('dotenv').config();

async function testSheetAccess() {
    try {
        const { loadDrugData } = require('./services/drugSheets');
        console.log('🔍 Testing Google Sheets access...');
        
        const data = await loadDrugData('pedmedvnch');
        console.log(`📊 Found ${data.length} drugs`);
        
        if (data.length > 0) {
            console.log('\n📋 First drug sample:');
            console.log(JSON.stringify(data[0], null, 2));
            
            console.log('\n📝 Available data fields:');
            Object.keys(data[0].originalData || {}).forEach(key => {
                console.log(`   - ${key}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testSheetAccess();
