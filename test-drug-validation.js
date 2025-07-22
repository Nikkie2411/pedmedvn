// Test drug validation system
const ChatbotService = require('./services/chatbot');

async function testDrugValidation() {
    console.log('🧪 Testing Drug Validation System\n');
    
    const chatbot = new ChatbotService();
    await chatbot.initialize();
    
    // Test cases
    const testQueries = [
        "Paracetamol dùng như thế nào?",
        "Thuốc aspirin có tác dụng gì?", // Should fail if aspirin not in knowledge base
        "Liều lượng ibuprofen cho trẻ em?",
        "Thời tiết hôm nay thế nào?", // Not drug question
        "Amoxicillin có tác dụng phụ gì?",
        "Thuốc XYZ123 có an toàn không?", // Unknown drug
        "Vitamin C dùng bao nhiều lần một ngày?",
        "Cách sử dụng thuốc ho?"
    ];
    
    console.log(`🔍 Known drugs in system: ${Array.from(chatbot.knownDrugs).slice(0, 10).join(', ')}\n`);
    
    for (const query of testQueries) {
        console.log(`❓ Query: "${query}"`);
        
        try {
            const response = await chatbot.chat(query, 'test-user');
            
            if (response.data.confidence === 0) {
                console.log(`❌ Rejected: ${response.data.answer}\n`);
            } else {
                console.log(`✅ Accepted (Confidence: ${response.data.confidence}%)`);
                console.log(`📝 Answer: ${response.data.answer.substring(0, 100)}...\n`);
            }
        } catch (error) {
            console.log(`💥 Error: ${error.message}\n`);
        }
    }
}

// Run test
testDrugValidation().catch(console.error);
