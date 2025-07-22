// Chatbot API routes
const express = require('express');
const router = express.Router();
const chatbotService = require('../services/chatbot');
const rateLimit = require('express-rate-limit');

// Rate limiting for chatbot (more restrictive due to processing cost)
const chatRateLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // Max 10 requests per minute per IP
    message: { 
        success: false, 
        message: 'Quá nhiều câu hỏi. Vui lòng đợi 1 phút trước khi hỏi tiếp.' 
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Test Google Drive connection
router.get('/drive-test', async (req, res) => {
    try {
        const result = await chatbotService.driveService.testAccess();
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi kiểm tra Google Drive: ' + error.message
        });
    }
});

// Sync documents from Google Drive (admin only)
router.post('/sync-drive', async (req, res) => {
    try {
        const { adminKey } = req.body;
        
        if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
            return res.status(403).json({
                success: false,
                message: 'Không có quyền truy cập'
            });
        }
        
        const synced = await chatbotService.driveService.syncDocuments();
        
        if (synced) {
            await chatbotService.rebuildKnowledgeBase();
            await chatbotService.loadKnowledgeBase();
        }
        
        res.json({
            success: true,
            message: synced ? 'Đã đồng bộ tài liệu từ Google Drive' : 'Không có tài liệu mới để đồng bộ'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi đồng bộ: ' + error.message
        });
    }
});

// Chat endpoint
router.post('/chat', chatRateLimit, async (req, res) => {
    try {
        const { message, userId } = req.body;
        
        // Validate input
        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập câu hỏi hợp lệ'
            });
        }
        
        if (message.trim().length < 3) {
            return res.status(400).json({
                success: false,
                message: 'Câu hỏi quá ngắn. Vui lòng nhập ít nhất 3 ký tự.'
            });
        }
        
        if (message.length > 500) {
            return res.status(400).json({
                success: false,
                message: 'Câu hỏi quá dài. Vui lòng nhập tối đa 500 ký tự.'
            });
        }
        
        // Process chat request
        const response = await chatbotService.chat(message, userId || 'anonymous');
        
        res.json(response);
        
    } catch (error) {
        console.error('❌ Chat API error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống. Vui lòng thử lại sau.'
        });
    }
});

// Get chatbot status with detailed info
router.get('/status', async (req, res) => {
    try {
        const stats = chatbotService.getStats();
        
        // Get knowledge base sources
        const sources = [...new Set(chatbotService.documents.map(doc => doc.source))];
        const hasRealData = !sources.every(source => source === 'System Notice');
        
        res.json({
            success: true,
            data: {
                ...stats,
                hasRealData: hasRealData,
                sources: sources,
                driveConnected: chatbotService.driveService ? true : false
            }
        });
    } catch (error) {
        console.error('❌ Status API error:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể lấy trạng thái chatbot'
        });
    }
});

// Debug endpoint to show knowledge base content (admin only)
router.get('/debug', (req, res) => {
    try {
        const { adminKey } = req.query;
        
        if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
            return res.status(403).json({
                success: false,
                message: 'Không có quyền truy cập'
            });
        }
        
        const documents = chatbotService.documents.map(doc => ({
            id: doc.id,
            title: doc.title,
            source: doc.source,
            contentPreview: doc.content ? doc.content.substring(0, 200) + '...' : 'No content',
            keywords: doc.keywords ? doc.keywords.slice(0, 10) : []
        }));
        
        res.json({
            success: true,
            data: {
                totalDocuments: documents.length,
                documents: documents,
                sources: [...new Set(documents.map(d => d.source))]
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Debug error: ' + error.message
        });
    }
});

// Add document endpoint (for admin use)
router.post('/documents', async (req, res) => {
    try {
        // Basic authentication check (you might want to implement proper admin auth)
        const { adminKey, title, content, source } = req.body;
        
        if (adminKey !== process.env.ADMIN_KEY) {
            return res.status(401).json({
                success: false,
                message: 'Không có quyền truy cập'
            });
        }
        
        if (!title || !content) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu tiêu đề hoặc nội dung'
            });
        }
        
        const result = await chatbotService.addDocument(title, content, source);
        res.json(result);
        
    } catch (error) {
        console.error('❌ Add document API error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi thêm tài liệu'
        });
    }
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Chatbot service is running',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
