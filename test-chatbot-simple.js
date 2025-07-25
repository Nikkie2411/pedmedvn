// Test chatbot-simple với tigecyclin
require('dotenv').config();
const express = require('express');

async function testChatbotSimple() {
    try {
        console.log('🤖 Testing chatbot-simple with tigecyclin...\n');
        
        // Import chatbot routes
        const chatbotRoutes = require('./routes/chatbot-simple');
        
        const app = express();
        app.use(express.json());
        app.use('/api/chatbot', chatbotRoutes);
        
        // Simulate request
        const testMessages = [
            'Chống chỉ định của tigecyclin?',
            'Liều dùng tigecyclin cho trẻ em',
            'Tigecyclin có tác dụng gì?',
            'Thuốc paracetamol có an toàn không?'
        ];
        
        for (const message of testMessages) {
            console.log(`\n📨 Testing message: "${message}"`);
            
            // Create mock request/response
            const mockReq = {
                body: { message, userId: 'test-user' }
            };
            
            const mockRes = {
                json: (data) => {
                    console.log('✅ Response received:');
                    if (data.success) {
                        console.log('📄 Message:', data.data.message.substring(0, 200) + '...');
                        console.log('🏷️ Model:', data.data.model || 'Unknown');
                        console.log('📊 Sources:', data.data.sources?.length || 0);
                    } else {
                        console.log('❌ Error:', data.message);
                    }
                },
                status: (code) => ({
                    json: (data) => {
                        console.log(`❌ Error ${code}:`, data.message);
                    }
                })
            };
            
            // Find the chat handler
            const chatHandler = chatbotRoutes.stack.find(layer => 
                layer.route?.path === '/chat' && 
                layer.route?.methods?.post
            );
            
            if (chatHandler) {
                await chatHandler.route.stack[1].handle(mockReq, mockRes);
            } else {
                console.log('❌ Chat handler not found');
            }
        }
        
    } catch (error) {
        console.error('❌ Test error:', error.message);
    }
}

testChatbotSimple();
