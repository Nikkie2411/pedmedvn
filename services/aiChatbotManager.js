// AI Chatbot Manager - Quản lý v

class AIChatbotManager {
    constructor() {
        this.providers = {};
        this.currentProvider = process.env.AI_PROVIDER || 'gemini';
        this.isInitialized = false;
    }

    // Helper function to create and initialize provider instance
    async createProviderInstance(providerName) {
        const ProviderClass = this.providers[providerName];
        if (!ProviderClass) {
            throw new Error(`Provider ${providerName} not found`);
        }
        
        const instance = new ProviderClass();
        await instance.initialize();
        
        // Replace class with instance
        this.providers[providerName] = instance;
        
        return instance;
    }

    // Initialize tất cả AI providers có sẵn
    async initialize() {
        try {
            console.log('🚀 Initializing AI Chatbot Manager...');
            
            // Debug environment variables
            console.log('🔍 Checking environment variables...');
            const envKeys = ['GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENAI_API_KEY'];
            envKeys.forEach(key => {
                const value = process.env[key];
                if (value) {
                    console.log(`✅ ${key}: ${value.substring(0, 10)}...`);
                } else {
                    console.log(`❌ ${key}: not found`);
                }
            });
            
            // Load available providers
            await this.loadProviders();
            
            // Initialize current provider với error handling
            if (this.providers[this.currentProvider]) {
                try {
                    await this.createProviderInstance(this.currentProvider);
                    console.log(`✅ ${this.currentProvider.toUpperCase()} AI provider initialized successfully`);
                } catch (initError) {
                    console.error(`❌ Failed to initialize ${this.currentProvider}:`, initError.message);
                    
                    // Check if it's API key related error
                    if (initError.message && (
                        initError.message.includes('Invalid API Key') || 
                        initError.message.includes('401') ||
                        initError.message.includes('AuthenticationError') ||
                        initError.message.includes('invalid_api_key') ||
                        initError.message.includes('No API key')
                    )) {
                        console.log(`🔑 API Key error detected for ${this.currentProvider}, switching to original...`);
                        
                        // Force switch to original
                        if (this.providers.original) {
                            this.currentProvider = 'original';
                            await this.createProviderInstance('original');
                            console.log('✅ Auto-switched to original chatbot due to API key error');
                        } else {
                            throw new Error('No fallback chatbot available');
                        }
                    } else {
                        // For other errors, still try to switch to original
                        if (this.providers.original) {
                            console.log('🔄 Switching to original chatbot as fallback...');
                            this.currentProvider = 'original';
                            await this.providers.original.initialize();
                            console.log('✅ Switched to original chatbot as fallback');
                        } else {
                            throw initError;
                        }
                    }
                }
            } else {
                console.warn(`⚠️ Provider ${this.currentProvider} not available, falling back to original chatbot`);
                await this.initializeFallback();
            }
            
            this.isInitialized = true;
            console.log(`🤖 AI Chatbot Manager initializing with provider: ${this.currentProvider}`);
        } catch (error) {
            console.error('❌ Failed to initialize AI Chatbot Manager:', error);
            await this.initializeFallback();
        }
    }

    // Initialize tất cả AI providers có sẵn
    async initialize() {
        try {
            console.log('🚀 Initializing AI Chatbot Manager...');
            
            // Debug environment variables
            console.log('🔍 Checking environment variables...');
            const envKeys = ['GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENAI_API_KEY'];
            envKeys.forEach(key => {
                const value = process.env[key];
                if (value) {
                    console.log(`✅ ${key}: ${value.substring(0, 10)}...`);
                } else {
                    console.log(`❌ ${key}: not found`);
                }
            });
            
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
            console.log(`🔍 Checking if provider ${providerName} is available...`);
            
            if (!this.providers[providerName]) {
                console.error(`❌ Provider ${providerName} not loaded in providers list`);
                console.log('📋 Available providers:', Object.keys(this.providers));
                throw new Error(`Provider ${providerName} not available`);
            }

            // Check if provider is actually ready
            const providerStatus = this.getProviderStatus(providerName);
            console.log(`📊 Provider ${providerName} status:`, providerStatus);
            
            if (providerStatus !== 'ready') {
                throw new Error(`Provider ${providerName} is not ready. Status: ${providerStatus}`);
            }

            console.log(`🔄 Switching from ${this.currentProvider} to ${providerName}...`);
            
            // Create and initialize new provider instance
            await this.createProviderInstance(providerName);
            
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

    // Get status of a specific provider
    getProviderStatus(providerName) {
        const provider = this.providers[providerName];
        if (!provider) {
            return 'not_available';
        }
        
        switch(providerName) {
            case 'gemini':
                // Check if Gemini has any API key (env or fallback)
                if (provider.geminiApiKey) {
                    console.log('✅ Gemini provider has API key');
                    return 'ready';
                } else {
                    console.log('⚠️ Gemini provider has no API key');
                    return 'needs_api_key';
                }
                
            case 'openai':
                // Check if OpenAI API key exists
                if (!process.env.OPENAI_API_KEY) {
                    console.log('⚠️ OPENAI_API_KEY not found in environment');
                    return 'needs_api_key';
                }
                return 'ready';
                
            case 'groq':
                // Check if Groq has any API key (env or fallback)
                if (provider.groqApiKey) {
                    console.log('✅ Groq provider has API key');
                    return 'ready';
                } else {
                    console.log('⚠️ Groq provider has no API key');
                    return 'needs_api_key';
                }
                
            case 'original':
                return 'ready';
                
            default:
                return 'unknown';
        }
    }

    // Main chat function - route to current provider với error handling
    async chat(message, userId = 'anonymous') {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            const currentService = this.providers[this.currentProvider];
            if (!currentService) {
                throw new Error(`Current provider ${this.currentProvider} not available`);
            }

            console.log(`💬 ${this.currentProvider.toUpperCase()} AI request from ${userId}: "${message.substring(0, 50)}..."`);
            
            const result = await currentService.chat(message, userId);
            
            // Add provider info to response
            if (result.success && result.data) {
                result.data.aiProvider = this.currentProvider.toUpperCase();
            }
            
            return result;
            
        } catch (error) {
            console.error(`❌ ${this.currentProvider.toUpperCase()} AI chat error:`, error);
            
            // Check if it's an API key error
            if (error.message && (
                error.message.includes('Invalid API Key') || 
                error.message.includes('401') ||
                error.message.includes('AuthenticationError') ||
                error.message.includes('invalid_api_key')
            )) {
                console.log(`🔑 API Key error detected for ${this.currentProvider}, switching to original chatbot...`);
                
                // Force switch to original chatbot
                if (this.providers.original) {
                    try {
                        console.log('🔄 Auto-switching to original chatbot due to API key error...');
                        this.currentProvider = 'original';
                        await this.providers.original.initialize();
                        
                        const fallbackResult = await this.providers.original.chat(message, userId);
                        
                        // Add note about fallback
                        if (fallbackResult.success && fallbackResult.data) {
                            fallbackResult.data.aiProvider = 'ORIGINAL (Fallback)';
                            fallbackResult.data.fallbackReason = 'AI API key invalid';
                        }
                        
                        return fallbackResult;
                        
                    } catch (fallbackError) {
                        console.error('❌ Original chatbot fallback also failed:', fallbackError);
                        return this.createErrorResponse('Cả AI service và fallback đều gặp lỗi. Vui lòng thử lại sau.');
                    }
                } else {
                    return this.createErrorResponse('AI service không khả dụng. Vui lòng liên hệ admin để cấu hình API keys.');
                }
            }
            
            // Try fallback to original chatbot for other errors
            if (this.currentProvider !== 'original' && this.providers.original) {
                console.log('🔄 Falling back to original chatbot...');
                try {
                    const fallbackResult = await this.providers.original.chat(message, userId);
                    if (fallbackResult.success && fallbackResult.data) {
                        fallbackResult.data.aiProvider = 'ORIGINAL (Fallback)';
                        fallbackResult.data.fallbackReason = 'Primary AI failed';
                    }
                    return fallbackResult;
                } catch (fallbackError) {
                    console.error('❌ Fallback also failed:', fallbackError);
                }
            }
            
            return this.createErrorResponse('Đã xảy ra lỗi với tất cả AI providers. Vui lòng thử lại sau.');
        }
    }

    // Create error response helper
    createErrorResponse(message) {
        return {
            success: false,
            message: message,
            data: {
                message: message,
                aiProvider: 'ERROR',
                isAiGenerated: false
            }
        };
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
            let description = '';
            let displayName = '';
            
            switch(key) {
                case 'gemini':
                    displayName = 'Google Gemini AI';
                    description = 'AI miễn phí từ Google với 50 requests/day - tốt cho tiếng Việt';
                    break;
                case 'openai':
                    displayName = 'OpenAI GPT';
                    description = 'AI chất lượng cao với $5 free credit';
                    break;
                case 'groq':
                    displayName = 'Groq AI';
                    description = 'AI siêu nhanh với 14,400 requests/day MIỄN PHÍ';
                    break;
                case 'original':
                    displayName = 'Original Chatbot';
                    description = 'Chatbot gốc sử dụng documents cục bộ';
                    break;
                default:
                    displayName = key.toUpperCase();
                    description = `AI Provider: ${key}`;
            }
            
            const status = this.getProviderStatus(key);
            
            providers.push({
                name: key,
                displayName,
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
