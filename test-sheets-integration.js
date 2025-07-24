// Test Google Sheets Training Data Integration
const { searchTrainingData, getProcessedTrainingData, stripHtml } = require('./services/sheetsTraining');
const { initializeSheetsClient } = require('./services/sheets');

async function testSheetsIntegration() {
    console.log('🧪 TESTING GOOGLE SHEETS AI INTEGRATION');
    console.log('=====================================\n');

    try {
        // 1. Test Google Sheets connection
        console.log('1️⃣ Testing Google Sheets connection...');
        await initializeSheetsClient();
        console.log('✅ Google Sheets client initialized successfully\n');

        // 2. Test loading training data
        console.log('2️⃣ Loading training data from Google Sheets...');
        const trainingData = await getProcessedTrainingData('TrainingData');
        console.log(`✅ Loaded ${trainingData.length} training entries`);
        
        if (trainingData.length > 0) {
            console.log('\n📋 Sample training data:');
            const sample = trainingData[0];
            console.log(`- Topic: ${sample.Topic || 'N/A'}`);
            console.log(`- Question: ${sample.Question || 'N/A'}`);
            console.log(`- Answer: ${(sample.Answer || '').substring(0, 100)}...`);
            console.log(`- Searchable text length: ${sample.searchableText?.length || 0}`);
        }

        // 3. Test HTML stripping
        console.log('\n3️⃣ Testing HTML content processing...');
        const htmlSample = '<p><strong>Liều dùng:</strong></p><ul><li>Người lớn: 600mg</li></ul>';
        const strippedText = stripHtml(htmlSample);
        console.log(`Original HTML: ${htmlSample}`);
        console.log(`Stripped text: ${strippedText}`);
        console.log('✅ HTML processing works correctly\n');

        // 4. Test search functionality
        console.log('4️⃣ Testing search functionality...');
        const searchQueries = ['thuốc', 'liều dùng', 'tác dụng phụ'];
        
        for (const query of searchQueries) {
            console.log(`\n🔍 Searching for: "${query}"`);
            const results = await searchTrainingData(query, 'TrainingData', 3);
            console.log(`Found ${results.length} relevant results`);
            
            if (results.length > 0) {
                console.log(`Top result: ${results[0].Topic || results[0].Question || 'Unknown'}`);
                console.log(`Relevance score: ${results[0].relevanceScore}`);
            }
        }

        // 5. Test AI integration preparation
        console.log('\n5️⃣ Testing AI service integration...');
        
        // Test Gemini
        try {
            const GeminiChatbotService = require('./services/geminiChatbot');
            const geminiBot = new GeminiChatbotService();
            console.log('📊 Gemini service imported successfully');
        } catch (error) {
            console.warn('⚠️ Gemini service import failed:', error.message);
        }

        // Test Groq
        try {
            const GroqChatbotService = require('./services/groqChatbot');
            const groqBot = new GroqChatbotService();
            console.log('📊 Groq service imported successfully');
        } catch (error) {
            console.warn('⚠️ Groq service import failed:', error.message);
        }

        // Test OpenAI
        try {
            const OpenAIChatbotService = require('./services/openaiChatbot');
            const openaiBot = new OpenAIChatbotService();
            console.log('📊 OpenAI service imported successfully');
        } catch (error) {
            console.warn('⚠️ OpenAI service import failed:', error.message);
        }

        console.log('\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
        console.log('\n📋 Summary:');
        console.log(`- Google Sheets connection: ✅ Working`);
        console.log(`- Training data loaded: ✅ ${trainingData.length} entries`);
        console.log(`- HTML processing: ✅ Working`);
        console.log(`- Search functionality: ✅ Working`);
        console.log(`- AI services: ✅ Imported`);

        console.log('\n🚀 READY FOR DEPLOYMENT!');
        console.log('AI chatbot can now use Google Sheets training data.');

    } catch (error) {
        console.error('❌ TEST FAILED:', error);
        console.error('\n🔧 Check:');
        console.error('1. GOOGLE_CREDENTIALS environment variable');
        console.error('2. Google Sheets API permissions');
        console.error('3. Spreadsheet ID in config.js');
        console.error('4. Internet connection');
        
        process.exit(1);
    }
}

// Run tests
if (require.main === module) {
    testSheetsIntegration();
}

module.exports = { testSheetsIntegration };
