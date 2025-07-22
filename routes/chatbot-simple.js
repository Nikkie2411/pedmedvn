// Simplified chatbot routes for reliable deployment
const express = require('express');
const router = express.Router();

// Import with error handling
let chatbotService;
try {
    chatbotService = require('../services/chatbot');
} catch (error) {
    console.error('Failed to load chatbot service:', error.message);
    chatbotService = null;
}

// Basic rate limiting
const rateLimit = require('../middleware/rateLimit');
const chatRateLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // Max 10 requests per minute per IP
    message: { 
        success: false, 
        message: 'Quá nhiều câu hỏi. Vui lòng đợi 1 phút trước khi hỏi tiếp.' 
    }
});

// Health check for chatbot
router.get('/health', (req, res) => {
    res.json({
        success: true,
        data: {
            serviceLoaded: chatbotService !== null,
            isInitialized: chatbotService ? chatbotService.isInitialized : false,
            timestamp: new Date().toISOString()
        }
    });
});

// Chat endpoint with fallback
router.post('/chat', chatRateLimit, async (req, res) => {
    try {
        const { message, userId } = req.body;
        
        // Validate input
        if (!message || typeof message !== 'string' || message.trim().length < 3) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập câu hỏi hợp lệ (ít nhất 3 ký tự)'
            });
        }
        
        if (message.length > 500) {
            return res.status(400).json({
                success: false,
                message: 'Câu hỏi quá dài. Vui lòng nhập tối đa 500 ký tự.'
            });
        }
        
        // Check if chatbot service is available
        if (!chatbotService || !chatbotService.isInitialized) {
            return res.json({
                success: true,
                data: {
                    message: "Xin lỗi, hệ thống chatbot đang được khởi tạo. Vui lòng thử lại sau ít phút. Trong thời gian này, bạn có thể sử dụng chức năng tìm kiếm thuốc ở trang chính.",
                    sources: [],
                    confidence: 0,
                    responseTime: 0
                }
            });
        }
        
        // Process chat request
        const response = await chatbotService.chat(message, userId || 'anonymous');
        res.json(response);
        
    } catch (error) {
        console.error('Chat endpoint error:', error);
        res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra. Vui lòng thử lại sau.'
        });
    }
});

// Status endpoint
router.get('/status', (req, res) => {
    try {
        if (!chatbotService) {
            return res.json({
                success: false,
                message: 'Chatbot service not loaded'
            });
        }
        
        res.json({
            success: true,
            data: {
                documentsCount: chatbotService.documents ? chatbotService.documents.length : 0,
                isInitialized: chatbotService.isInitialized,
                lastUpdated: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error getting status: ' + error.message
        });
    }
});

// Fallback suggestions endpoint
router.get('/suggestions', (req, res) => {
    res.json({
        success: true,
        data: [
            "Liều paracetamol cho trẻ 2 tuổi?",
            "Tác dụng phụ của amoxicillin?", 
            "Khi nào dùng ibuprofen?",
            "Thuốc ho cho trẻ nhỏ?",
            "Bổ sung vitamin D như thế nào?"
        ]
    });
});

module.exports = router;
