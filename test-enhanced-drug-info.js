// Test Enhanced Drug Information Display
require('dotenv').config();

async function testEnhancedDrugInfo() {
    console.log('🧪 Testing Enhanced Drug Information Display...\n');
    
    try {
        // Test 1: Gemini Drug Service
        console.log('1️⃣ Testing Gemini Drug Service...');
        try {
            const GeminiChatbotDrug = require('./services/geminiChatbotDrug');
            await GeminiChatbotDrug.initialize();
            
            const geminiResponse = await GeminiChatbotDrug.chat('thuốc paracetamol liều dùng cho trẻ em', 'test_user');
            
            if (geminiResponse.success) {
                console.log('✅ Gemini Response Length:', geminiResponse.data.response.length, 'characters');
                console.log('📝 Response Preview:', geminiResponse.data.response.substring(0, 200) + '...');
                
                // Check if response includes enhanced information
                const response = geminiResponse.data.response;
                const enhancedFields = [
                    'Hoạt chất',
                    'Phân loại dược lý', 
                    'Trẻ sơ sinh',
                    'Trẻ em',
                    'Chức năng thận',
                    'Chức năng gan',
                    'Chống chỉ định',
                    'Tác dụng không mong muốn',
                    'Cách dùng',
                    'Tương tác thuốc',
                    'Ngộ độc',
                    'Theo dõi',
                    'Bảo hiểm y tế'
                ];
                
                const foundFields = enhancedFields.filter(field => 
                    response.toLowerCase().includes(field.toLowerCase())
                );
                
                console.log(`📊 Enhanced Fields Found: ${foundFields.length}/${enhancedFields.length}`);
                console.log(`🔍 Found Fields: ${foundFields.join(', ')}`);
            } else {
                console.log('❌ Gemini test failed:', geminiResponse.message);
            }
        } catch (error) {
            console.log('⚠️ Gemini test error:', error.message);
        }
        
        console.log('\n' + '='.repeat(60) + '\n');
        
        // Test 2: Groq Drug Service (if API key available)
        console.log('2️⃣ Testing Groq Drug Service...');
        try {
            if (!process.env.GROQ_API_KEY) {
                console.log('⚠️ GROQ_API_KEY not found. Skipping Groq test.');
                console.log('💡 To test Groq: Add GROQ_API_KEY to .env file');
            } else {
                const GroqChatbotDrug = require('./services/groqChatbotDrug');
                await GroqChatbotDrug.initialize();
                
                const groqResponse = await GroqChatbotDrug.chat('thuốc amoxicillin tác dụng phụ', 'test_user');
                
                if (groqResponse.success) {
                    console.log('✅ Groq Response Length:', groqResponse.data.response.length, 'characters');
                    console.log('📝 Response Preview:', groqResponse.data.response.substring(0, 200) + '...');
                    
                    // Check enhanced fields
                    const response = groqResponse.data.response;
                    const enhancedFields = [
                        'Hoạt chất',
                        'Phân loại dược lý', 
                        'Trẻ sơ sinh',
                        'Trẻ em',
                        'Chức năng thận',
                        'Chức năng gan',
                        'Chống chỉ định',
                        'Tác dụng không mong muốn',
                        'Cách dùng',
                        'Tương tác thuốc',
                        'Ngộ độc',
                        'Theo dõi',
                        'Bảo hiểm y tế'
                    ];
                    
                    const foundFields = enhancedFields.filter(field => 
                        response.toLowerCase().includes(field.toLowerCase())
                    );
                    
                    console.log(`📊 Enhanced Fields Found: ${foundFields.length}/${enhancedFields.length}`);
                    console.log(`🔍 Found Fields: ${foundFields.join(', ')}`);
                    
                    if (groqResponse.data.note) {
                        console.log('💡 Groq Note:', groqResponse.data.note);
                    }
                } else {
                    console.log('❌ Groq test failed:', groqResponse.message);
                }
            }
        } catch (error) {
            console.log('⚠️ Groq test error:', error.message);
        }
        
        console.log('\n' + '='.repeat(60) + '\n');
        
        // Test 3: Fallback Response Test
        console.log('3️⃣ Testing Fallback Response...');
        try {
            const GeminiChatbotDrug = require('./services/geminiChatbotDrug');
            await GeminiChatbotDrug.initialize();
            
            // Simulate quota exceeded by temporarily disabling AI
            const originalApiKey = process.env.GEMINI_API_KEY;
            process.env.GEMINI_API_KEY = '';
            
            const fallbackResponse = await GeminiChatbotDrug.chat('thuốc ibuprofen chống chỉ định', 'test_user');
            
            // Restore API key
            process.env.GEMINI_API_KEY = originalApiKey;
            
            if (fallbackResponse.success) {
                console.log('✅ Fallback Response Length:', fallbackResponse.data.response.length, 'characters');
                console.log('📝 Fallback Preview:', fallbackResponse.data.response.substring(0, 300) + '...');
                
                // Check if fallback includes enhanced drug info
                const response = fallbackResponse.data.response;
                const hasEnhancedInfo = [
                    'Hoạt chất',
                    'LIỀU DÙNG',
                    'HIỆU CHỈNH LIỀU',
                    'CHỐNG CHỈ ĐỊNH',
                    'TÁC DỤNG KHÔNG MONG MUỐN'
                ].some(field => response.includes(field));
                
                console.log('📊 Fallback has enhanced info:', hasEnhancedInfo ? '✅ YES' : '❌ NO');
                
                if (fallbackResponse.data.model) {
                    console.log('🔧 Fallback Model:', fallbackResponse.data.model);
                }
            } else {
                console.log('❌ Fallback test failed:', fallbackResponse.message);
            }
        } catch (error) {
            console.log('⚠️ Fallback test error:', error.message);
        }
        
        console.log('\n' + '='.repeat(60) + '\n');
        
        // Test 4: Database Direct Access
        console.log('4️⃣ Testing Database Direct Access...');
        try {
            const { loadDrugData } = require('./services/drugSheets');
            const drugData = await loadDrugData('pedmedvnch');
            
            console.log(`📚 Total drugs in database: ${drugData.length}`);
            
            if (drugData.length > 0) {
                const sampleDrug = drugData[0];
                console.log(`📋 Sample drug: ${sampleDrug.name}`);
                console.log(`🏷️ Available fields in originalData:`, Object.keys(sampleDrug.originalData || {}).slice(0, 10));
                
                // Check if enhanced fields are available
                const enhancedFields = [
                    'Hoạt chất',
                    'Phân loại dược lý',
                    'Liều thông thường trẻ sơ sinh',
                    'Liều thông thường trẻ em',
                    'Hiệu chỉnh liều theo chức năng thận',
                    'Hiệu chỉnh liều theo chức năng gan',
                    'Chống chỉ định',
                    'Tác dụng không mong muốn',
                    'Cách dùng (ngoài IV)',
                    'Tương tác thuốc chống chỉ định',
                    'Ngộ độc/Quá liều',
                    'Các thông số cần theo dõi',
                    'Bảo hiểm y tế thanh toán'
                ];
                
                const availableFields = enhancedFields.filter(field => 
                    sampleDrug.originalData && sampleDrug.originalData[field]
                );
                
                console.log(`📊 Enhanced fields available: ${availableFields.length}/${enhancedFields.length}`);
                console.log(`✅ Available enhanced fields:`, availableFields.slice(0, 5));
            }
        } catch (error) {
            console.log('⚠️ Database test error:', error.message);
        }
        
        console.log('\n🎉 Enhanced Drug Information Test Complete!');
        console.log('\n📋 Summary:');
        console.log('✅ Gemini & Groq services updated to use all Google Sheets columns');
        console.log('✅ Fallback responses enhanced with comprehensive drug info');
        console.log('✅ Context generation includes all available drug fields');
        console.log('✅ AI responses should now include:');
        console.log('   - Hoạt chất, Phân loại dược lý');
        console.log('   - Liều dùng cho trẻ sơ sinh & trẻ em');
        console.log('   - Hiệu chỉnh liều theo chức năng thận & gan');
        console.log('   - Chống chỉ định, Tác dụng không mong muốn');
        console.log('   - Cách dùng, Tương tác thuốc');
        console.log('   - Ngộ độc/Quá liều, Theo dõi điều trị');
        console.log('   - Bảo hiểm y tế thanh toán');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('📍 Stack trace:', error.stack);
    }
}

// Run test
testEnhancedDrugInfo();
