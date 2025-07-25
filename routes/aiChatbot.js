// AI Chatbot Routes - Hỗ trợ multiple AI providers
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// Import AI Manager thay vì chatbot service cũ
const aiChatbotManager = require('../services/aiChatbotManager');

// Rate limiting cho AI chatbot (có thể tốn kém hơn)
const aiChatRateLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 phút
    max: 15, // Max 15 requests per minute per IP (cao hơn do AI nhanh hơn)
    message: { 
        success: false, 
        message: 'Quá nhiều câu hỏi AI. Vui lòng đợi 1 phút trước khi hỏi tiếp.' 
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Health check cho AI system
router.get('/health', async (req, res) => {
    try {
        const healthStatus = await aiChatbotManager.healthCheck();
        
        res.json({
            success: true,
            data: {
                ...healthStatus,
                serviceType: 'AI Chatbot Manager',
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'AI Health check failed',
            error: error.message
        });
    }
});

// Get available AI providers
router.get('/providers', async (req, res) => {
    try {
        const providers = aiChatbotManager.getAvailableProviders();
        const currentProvider = aiChatbotManager.getCurrentProvider();
        
        res.json({
            success: true,
            data: {
                currentProvider: currentProvider.name,
                providers: providers,
                setupInstructions: {
                    gemini: {
                        url: 'https://ai.google.dev',
                        steps: [
                            '1. Truy cập https://ai.google.dev',
                            '2. Đăng nhập với Google account',
                            '3. Click "Get API key" → "Create API key"',
                            '4. Thêm GEMINI_API_KEY vào file .env',
                            '5. Restart server'
                        ]
                    },
                    openai: {
                        url: 'https://platform.openai.com/api-keys',
                        steps: [
                            '1. Truy cập https://platform.openai.com/api-keys',
                            '2. Đăng ký tài khoản (có $5 free credit)',
                            '3. Tạo API key mới',
                            '4. Thêm OPENAI_API_KEY vào file .env',
                            '5. Restart server'
                        ]
                    },
                    groq: {
                        url: 'https://console.groq.com/keys',
                        steps: [
                            '1. Truy cập https://console.groq.com/keys',
                            '2. Đăng ký tài khoản (MIỄN PHÍ hoàn toàn)',
                            '3. Tạo API key mới',
                            '4. Thêm GROQ_API_KEY vào file .env',
                            '5. Restart server'
                        ]
                    }
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Không thể lấy thông tin providers',
            error: error.message
        });
    }
});

// Switch AI provider
router.post('/switch-provider', async (req, res) => {
    try {
        console.log('🔄 Switch provider request received');
        console.log('📦 Request body:', req.body);
        
        const { provider } = req.body;
        
        if (!provider) {
            console.log('❌ No provider specified in request');
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chỉ định provider (gemini, openai, groq, original)'
            });
        }
        
        console.log(`🔍 Attempting to switch to provider: ${provider}`);
        console.log('📊 Manager initialized:', aiChatbotManager.isInitialized);
        console.log('📋 Available providers:', Object.keys(aiChatbotManager.providers || {}));
        
        const result = await aiChatbotManager.switchProvider(provider);
        console.log('📦 Switch result:', result);
        
        if (result.success) {
            res.json({
                success: true,
                data: result
            });
        } else {
            console.log('❌ Switch failed:', result.message);
            res.status(400).json({
                success: false,
                message: result.message
            });
        }
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi chuyển đổi AI provider',
            error: error.message
        });
    }
});

// Main AI chat endpoint
router.post('/chat', aiChatRateLimit, async (req, res) => {
    try {
        const { message, userId } = req.body;
        
        // Validate input
        if (!message || typeof message !== 'string' || message.trim().length < 3) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập câu hỏi hợp lệ (ít nhất 3 ký tự)'
            });
        }
        
        if (message.length > 1000) {
            return res.status(400).json({
                success: false,
                message: 'Câu hỏi quá dài. Vui lòng nhập tối đa 1000 ký tự.'
            });
        }
        
        // Check if AI manager is initialized
        if (!aiChatbotManager.isInitialized) {
            console.log('🔧 AI Manager not initialized, initializing now...');
            await aiChatbotManager.initialize();
        }
        
        // Process with AI
        const response = await aiChatbotManager.chat(message, userId || 'anonymous');
        
        // Add metadata
        if (response.success && response.data) {
            response.data.timestamp = new Date().toISOString();
            response.data.currentProvider = aiChatbotManager.getCurrentProvider().name;
        }
        
        res.json(response);
        
    } catch (error) {
        console.error('❌ AI Chat API error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống AI. Vui lòng thử lại sau.',
            error: error.message
        });
    }
});

// Get AI chatbot status và statistics
router.get('/status', async (req, res) => {
    try {
        const stats = await aiChatbotManager.getStats();
        const currentProvider = aiChatbotManager.getCurrentProvider();
        
        res.json({
            success: true,
            data: {
                ...stats,
                currentProviderDetails: {
                    name: currentProvider.name,
                    isInitialized: currentProvider.isInitialized
                },
                systemInfo: {
                    nodeVersion: process.version,
                    platform: process.platform,
                    uptime: process.uptime(),
                    memoryUsage: process.memoryUsage()
                }
            }
        });
    } catch (error) {
        console.error('❌ AI Status API error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy thông tin AI system',
            error: error.message
        });
    }
});

// Add document to current AI provider
router.post('/add-document', async (req, res) => {
    try {
        const { title, content, source } = req.body;
        
        if (!title || !content) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp title và content'
            });
        }
        
        const result = await aiChatbotManager.addDocument(title, content, source);
        
        res.json({
            success: result.success,
            data: result.success ? result : null,
            message: result.success ? 'Đã thêm tài liệu thành công' : result.error
        });
        
    } catch (error) {
        console.error('❌ Add document API error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi thêm tài liệu vào AI system',
            error: error.message
        });
    }
});

// Test specific AI provider
router.post('/test-provider', async (req, res) => {
    try {
        const { provider, testMessage } = req.body;
        
        if (!provider) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chỉ định provider để test'
            });
        }
        
        const message = testMessage || 'Thuốc paracetamol là gì?';
        
        // Temporarily switch to test provider
        const originalProvider = aiChatbotManager.getCurrentProvider().name;
        
        try {
            await aiChatbotManager.switchProvider(provider);
            const testResult = await aiChatbotManager.chat(message, 'test-user');
            
            // Switch back to original
            await aiChatbotManager.switchProvider(originalProvider);
            
            res.json({
                success: true,
                data: {
                    testProvider: provider,
                    testMessage: message,
                    testResult: testResult,
                    restoredProvider: originalProvider
                }
            });
            
        } catch (testError) {
            // Ensure we switch back even if test fails
            try {
                await aiChatbotManager.switchProvider(originalProvider);
            } catch (restoreError) {
                console.error('❌ Failed to restore provider:', restoreError);
            }
            
            throw testError;
        }
        
    } catch (error) {
        console.error('❌ Test provider API error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi test AI provider',
            error: error.message
        });
    }
});

// Debug endpoint to check environment and providers
router.get('/debug', async (req, res) => {
    try {
        const envInfo = {
            GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'Set' : 'Missing',
            GROQ_API_KEY: process.env.GROQ_API_KEY ? 'Set' : 'Missing',
            OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'Set' : 'Missing',
        };
        
        const managerInfo = {
            isInitialized: aiChatbotManager.isInitialized,
            currentProvider: aiChatbotManager.currentProvider,
            availableProviders: Object.keys(aiChatbotManager.providers || {}),
        };
        
        const providerStatuses = {};
        if (aiChatbotManager.providers) {
            for (const providerName of Object.keys(aiChatbotManager.providers)) {
                providerStatuses[providerName] = aiChatbotManager.getProviderStatus(providerName);
            }
        }
        
        res.json({
            success: true,
            data: {
                environment: envInfo,
                manager: managerInfo,
                providerStatuses: providerStatuses,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
