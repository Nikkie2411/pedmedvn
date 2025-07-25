require('dotenv').config();

async function testNewStructure() {
    try {
        console.log('🔍 Testing new drug sheet structure...');
        
        const { loadDrugData, searchDrugData } = require('./services/drugSheets');
        
        // Test loading data
        console.log('\n📊 Loading drug data...');
        const drugs = await loadDrugData('pedmedvnch');
        console.log(`✅ Loaded ${drugs.length} drugs`);
        
        if (drugs.length > 0) {
            console.log('\n📋 First drug structure:');
            console.log('Drug name:', drugs[0].name);
            console.log('Available fields in originalData:');
            Object.keys(drugs[0].originalData).forEach(key => {
                const value = drugs[0].originalData[key];
                console.log(`  - ${key}: ${value ? value.substring(0, 50) + '...' : 'empty'}`);
            });
        }
        
        // Test search for contraindications
        console.log('\n🔍 Testing contraindication search...');
        const contraindicationResults = await searchDrugData('tigecycline chống chỉ định', 'pedmedvnch', 5);
        console.log(`Found ${contraindicationResults.length} results for contraindication query`);
        
        if (contraindicationResults.length > 0) {
            const drug = contraindicationResults[0];
            console.log('\nTop result:');
            console.log('Name:', drug.name);
            console.log('Intent detected:', drug.queryIntent?.type);
            console.log('Relevance score:', drug.relevanceScore);
            
            // Check if contraindication field exists
            const contraindication = drug.originalData['3. CHỐNG CHỈ ĐỊNH'];
            console.log('Contraindication data:', contraindication ? 'Found ✅' : 'Missing ❌');
            if (contraindication) {
                console.log('Content preview:', contraindication.substring(0, 100) + '...');
            }
        }
        
        // Test chatbot service
        console.log('\n🤖 Testing chatbot service...');
        const ChatbotService = require('./services/chatbot');
        const chatbot = new ChatbotService();
        await chatbot.initialize();
        
        const response = await chatbot.generateResponse('tigecycline chống chỉ định gì');
        console.log('\nChatbot response:');
        console.log(response.data.message.substring(0, 200) + '...');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

testNewStructure().then(() => {
    console.log('\n✅ Test completed!');
}).catch(error => {
    console.error('❌ Test error:', error);
});
