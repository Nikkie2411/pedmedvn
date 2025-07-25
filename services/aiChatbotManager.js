// AI Chatbot Manager - Quản lý và chuyển đổi giữa các AI service
const fs = require('fs').promises;
const path = require('path');

class AIChatbotManager {
    constructor() {
        this.currentProvider = process.env.AI_PROVIDER || 'gemini'; // Default: Gemini (miễn phí)
        this.providers = {};
        this.isInitialized = false;
        
        console.log(`🤖 AI Chatbot Manager initializing with provider: ${this.currentProvider}`);
    }

    // Initialize tất cả AI providers có sẵn
    async initialize() {
        try {
            console.log('🚀 Initializing AI Chatbot Manager...');
            
            // Load available providers
            await this.loadProviders();
            
            // Initialize current provider
            if (this.providers[this.currentProvider]) {
                await this.providers[this.currentProvider].initialize();
                console.log(`✅ ${this.currentProvider.toUpperCase()} AI provider initialized successfully`);
            } else {
                console.warn(`⚠️ Provider ${this.currentProvider} not available, falling back to basic chatbot`);
                await this.initializeFallback();
            }
            
            this.isInitialized = true;
            
        } catch (error) {
            console.error('❌ Failed to initialize AI Chatbot Manager:', error);
            await this.initializeFallback();
        }
    }

    // Load các AI providers với Google Sheets support
    async loadProviders() {
        try {
            // 1. Google Gemini (MIỄN PHÍ - Tốt nhất cho tiếng Việt) - Drug focused
            try {
                const GeminiChatbot = require('./geminiChatbotDrug');
                this.providers.gemini = GeminiChatbot;
                console.log('✅ Gemini Drug AI provider loaded');
            } catch (error) {
                console.log('⚠️ Gemini Drug AI provider not available:', error.message);
                // Fallback to old Gemini
                try {
                    const GeminiChatbotOld = require('./geminiChatbot');
                    this.providers.gemini = GeminiChatbotOld;
                    console.log('✅ Gemini AI provider (old) loaded as fallback');
                } catch (fallbackError) {
                    console.log('⚠️ Gemini AI fallback also failed:', fallbackError.message);
                }
            }

            // 2. OpenAI GPT (Có free tier) - Updated for Google Sheets
            try {
                const OpenAIChatbot = require('./openaiChatbot');
                this.providers.openai = OpenAIChatbot;
                console.log('✅ OpenAI GPT provider loaded');
            } catch (error) {
                console.log('⚠️ OpenAI GPT provider not available:', error.message);
            }

            // 3. Groq AI (MIỄN PHÍ và siêu nhanh) - Drug focused with Google Sheets
            try {
                const GroqChatbotDrug = require('./groqChatbotDrug');
                this.providers.groq = GroqChatbotDrug;
                console.log('✅ Groq Drug AI provider loaded (14,400 requests/day FREE)');
            } catch (error) {
                console.log('⚠️ Groq Drug AI provider not available:', error.message);
                // Fallback to old Groq if exists
                try {
                    const GroqChatbot = require('./groqChatbot');
                    this.providers.groq = GroqChatbot;
                    console.log('✅ Groq AI provider (old) loaded as fallback');
                } catch (fallbackError) {
                    console.log('⚠️ Groq AI fallback also failed:', fallbackError.message);
                }
            }

            // 4. Fallback to original chatbot (local documents) - only as last resort
            try {
                const OriginalChatbot = require('./chatbot');
                this.providers.original = OriginalChatbot;
                console.log('⚠️ Original chatbot provider loaded (uses local documents - consider updating)');
            } catch (error) {
                console.log('⚠️ Original chatbot provider not available:', error.message);
            }

        } catch (error) {
            console.error('❌ Error loading providers:', error);
        }
    }

    // Initialize fallback nếu không có AI provider nào
    async initializeFallback() {
        try {
            if (this.providers.original) {
                await this.providers.original.initialize();
                this.currentProvider = 'original';
                console.log('📝 Fallback to original chatbot');
            } else {
                throw new Error('No chatbot providers available');
            }
        } catch (error) {
            console.error('❌ Fallback initialization failed:', error);
            throw error;
        }
    }

    // Switch AI provider
    async switchProvider(providerName) {
        try {
            if (!this.providers[providerName]) {
                throw new Error(`Provider ${providerName} not available`);
            }

            console.log(`🔄 Switching from ${this.currentProvider} to ${providerName}...`);
            
            // Initialize new provider
            await this.providers[providerName].initialize();
            
            this.currentProvider = providerName;
            
            // Update environment variable (optional)
            process.env.AI_PROVIDER = providerName;
            
            console.log(`✅ Successfully switched to ${providerName.toUpperCase()} AI provider`);
            
            return {
                success: true,
                message: `Đã chuyển sang ${providerName.toUpperCase()} AI thành công`,
                currentProvider: this.currentProvider
            };
            
        } catch (error) {
            console.error(`❌ Failed to switch to ${providerName}:`, error);
            return {
                success: false,
                message: `Không thể chuyển sang ${providerName}: ${error.message}`,
                currentProvider: this.currentProvider
            };
        }
    }

    // Main chat function - route to current provider
    async chat(message, userId = 'anonymous') {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            const currentService = this.providers[this.currentProvider];
            if (!currentService) {
                throw new Error(`Current provider ${this.currentProvider} not available`);
            }

            console.log(`💬 Routing chat to ${this.currentProvider.toUpperCase()} AI: "${message.substring(0, 50)}..."`);
            
            const result = await currentService.chat(message, userId);
            
            // Add provider info to response
            if (result.success && result.data) {
                result.data.aiProvider = this.currentProvider.toUpperCase();
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ AI Manager chat error:', error);
            
            // Try fallback to original chatbot
            if (this.currentProvider !== 'original' && this.providers.original) {
                console.log('🔄 Falling back to original chatbot...');
                try {
                    return await this.providers.original.chat(message, userId);
                } catch (fallbackError) {
                    console.error('❌ Fallback also failed:', fallbackError);
                }
            }
            
            return {
                success: false,
                message: 'Đã xảy ra lỗi với tất cả AI providers. Vui lòng thử lại sau.',
                error: error.message
            };
        }
    }

    // Get current provider info
    getCurrentProvider() {
        return {
            name: this.currentProvider,
            service: this.providers[this.currentProvider],
            isInitialized: this.isInitialized
        };
    }

    // Get all available providers
    getAvailableProviders() {
        const providers = [];
        
        Object.keys(this.providers).forEach(key => {
            const provider = this.providers[key];
            let status = 'available';
            let description = '';
            
            switch(key) {
                case 'gemini':
                    description = 'Google Gemini AI - MIỄN PHÍ, tốt cho tiếng Việt';
                    status = provider && process.env.GEMINI_API_KEY ? 'ready' : 'needs_api_key';
                    break;
                case 'openai':
                    description = 'OpenAI GPT - Có free tier, chất lượng cao';
                    status = provider && process.env.OPENAI_API_KEY ? 'ready' : 'needs_api_key';
                    break;
                case 'groq':
                    description = 'Groq AI - MIỄN PHÍ, siêu nhanh';
                    status = provider && process.env.GROQ_API_KEY ? 'ready' : 'needs_api_key';
                    break;
                case 'original':
                    description = 'Chatbot gốc - Không cần API key';
                    status = provider ? 'ready' : 'not_available';
                    break;
            }
            
            providers.push({
                name: key,
                displayName: key.toUpperCase(),
                description,
                status,
                isActive: key === this.currentProvider
            });
        });
        
        return providers;
    }

    // Get comprehensive statistics
    async getStats() {
        try {
            const currentService = this.providers[this.currentProvider];
            const baseStats = currentService ? await currentService.getStats() : {};
            
            return {
                ...baseStats,
                currentProvider: this.currentProvider,
                availableProviders: Object.keys(this.providers),
                totalProviders: Object.keys(this.providers).length,
                managerInitialized: this.isInitialized,
                lastUpdated: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Error getting stats:', error);
            return {
                error: error.message,
                currentProvider: this.currentProvider,
                lastUpdated: new Date().toISOString()
            };
        }
    }

    // Add document to current provider
    async addDocument(title, content, source = 'Manual Upload') {
        try {
            const currentService = this.providers[this.currentProvider];
            if (!currentService || !currentService.addDocument) {
                throw new Error(`Current provider ${this.currentProvider} does not support document addition`);
            }
            
            return await currentService.addDocument(title, content, source);
        } catch (error) {
            console.error('❌ Error adding document:', error);
            return { success: false, error: error.message };
        }
    }

    // Health check cho tất cả providers
    async healthCheck() {
        const results = {};
        
        for (const [name, provider] of Object.entries(this.providers)) {
            try {
                const stats = provider.getStats ? await provider.getStats() : { status: 'unknown' };
                results[name] = {
                    status: 'healthy',
                    isInitialized: stats.isInitialized || false,
                    documentsCount: stats.documentsCount || 0,
                    aiModel: stats.aiModel || 'Unknown'
                };
            } catch (error) {
                results[name] = {
                    status: 'error',
                    error: error.message
                };
            }
        }
        
        return {
            currentProvider: this.currentProvider,
            providers: results,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = new AIChatbotManager();
