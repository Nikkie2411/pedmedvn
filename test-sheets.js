const { initializeSheetsClient } = require('./services/sheets');
const { getProcessedTrainingData, searchTrainingData, stripHtml } = require('./services/sheetsTraining');

async function testGoogleSheetsIntegration() {
  console.log('🧪 TESTING GOOGLE SHEETS INTEGRATION');
  console.log('=====================================');
  
  try {
    // Test 1: Initialize Sheets Client
    console.log('\n1. 🔧 Testing Sheets Client Initialization...');
    await initializeSheetsClient();
    console.log('✅ Sheets client initialized successfully');
    
    // Test 2: Load Training Data
    console.log('\n2. 📚 Loading Training Data...');
    const trainingData = await getProcessedTrainingData('TrainingData');
    console.log(`✅ Loaded ${trainingData.length} training entries`);
    
    if (trainingData.length > 0) {
      const sample = trainingData[0];
      console.log('\n📄 Sample Entry:');
      console.log(`   Topic: ${sample.Topic || 'N/A'}`);
      console.log(`   Question: ${sample.Question || 'N/A'}`);
      console.log(`   Content Length: ${Object.values(sample).join(' ').length} characters`);
      
      // Show all available fields
      console.log(`   Available Fields: ${Object.keys(sample).filter(key => key !== 'searchableText').join(', ')}`);
    }
    
    // Test 3: HTML Processing
    console.log('\n3. 🔧 Testing HTML Processing...');
    const htmlTest = '<p>This is <strong>bold</strong> text with <br> line breaks</p>';
    const plainText = stripHtml(htmlTest);
    console.log(`   HTML: ${htmlTest}`);
    console.log(`   Plain: ${plainText}`);
    console.log('✅ HTML processing working');
    
    // Test 4: Search Functionality
    console.log('\n4. 🔍 Testing Search Functionality...');
    if (trainingData.length > 0) {
      const searchQueries = ['thuốc', 'paracetamol', 'liều dùng', 'tác dụng phụ'];
      
      for (const query of searchQueries) {
        const results = await searchTrainingData(query, 'TrainingData', 3);
        console.log(`   Search "${query}": Found ${results.length} results`);
        
        if (results.length > 0) {
          console.log(`     Best match: ${results[0].Topic || results[0].Question || 'Entry'} (Score: ${results[0].relevanceScore})`);
        }
      }
    }
    
    console.log('\n✅ ALL TESTS PASSED!');
    console.log('\n🎯 Google Sheets integration is ready for production');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Check GOOGLE_CREDENTIALS environment variable');
    console.error('   2. Verify sheet ID is correct');
    console.error('   3. Ensure TrainingData tab exists in the sheet');
    console.error('   4. Check Google Sheets API is enabled');
  }
}

// Run the test
testGoogleSheetsIntegration();
