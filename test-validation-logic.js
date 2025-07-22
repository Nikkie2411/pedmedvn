// Simple test script for drug validation
console.log('🧪 Testing Enhanced Drug Validation System');

// Mock test to verify the logic
const testCases = [
    { query: "Paracetamol dùng như thế nào?", expectedValid: true },
    { query: "Thuốc không tồn tại xyz123", expectedValid: false },
    { query: "Thời tiết hôm nay", expectedValid: true }, // Not drug question
    { query: "Liều lượng vitamin C", expectedValid: true },
    { query: "Amoxicillin có tác dụng phụ gì?", expectedValid: true }
];

// Simple validation logic test
function testValidationLogic() {
    console.log('\n📋 Testing validation patterns:');
    
    testCases.forEach((test, index) => {
        const query = test.query.toLowerCase();
        
        // Drug question patterns
        const drugPatterns = [
            /thuoc|thuốc/i,
            /lieu\s*luong|liều\s*lượng/i,
            /tac\s*dung|tác\s*dụng/i,
            /dung|dùng/i,
            /viên|siro|gel|kem/i,
            /mg|ml|gram/i
        ];
        
        const isDrugQuery = drugPatterns.some(pattern => pattern.test(query));
        
        console.log(`${index + 1}. "${test.query}"`);
        console.log(`   Drug question: ${isDrugQuery ? 'YES' : 'NO'}`);
        
        if (isDrugQuery) {
            // Common drugs that should be recognized
            const commonDrugs = ['paracetamol', 'amoxicillin', 'vitamin', 'ibuprofen'];
            const hasDrug = commonDrugs.some(drug => query.includes(drug));
            console.log(`   Contains known drug: ${hasDrug ? 'YES' : 'NO'}`);
            
            if (!hasDrug) {
                console.log(`   ❌ Would be rejected: Unknown drug`);
            } else {
                console.log(`   ✅ Would be accepted: Known drug found`);
            }
        } else {
            console.log(`   ✅ Would be accepted: Not a drug question`);
        }
        console.log('');
    });
}

testValidationLogic();

console.log('✅ Validation logic test completed!');
console.log('\n🔧 To test with real chatbot:');
console.log('1. Start backend: npm start (in backend folder)');
console.log('2. Test via API: POST /api/chat with {"message": "your question"}');
console.log('3. Check console logs for drug validation results');
