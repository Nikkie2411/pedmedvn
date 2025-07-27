// AI Chatbot Manager - Quản lý v

class AIChatbotManager {
    constructor() {
        this.providerClasses = {}; // Store classes
        this.providers = {}; // Store instances
        this.currentProvider = process.env.AI_PROVIDER || 'groq';
        this.isInitialized = false;
    }

    // Helper function to create and initialize provider instance
    async createProviderInstance(providerName) {
        const ProviderClass = this.providerClasses[providerName];
        if (!ProviderClass) {
            throw new Error(`Provider ${providerName} not found`);
        }
        
        const instance = new ProviderClass();
        await instance.initialize();
        
        // Store instance separately from class
        this.providers[providerName] = instance;
        
        return instance;
    }

    // Initialize tất cả AI providers có sẵn
    async initialize() {
        try {
            console.log('🚀 Initializing AI Chatbot Manager...');
            
            // Debug environment variables
            console.log('🔍 Checking environment variables...');
            const envKeys = ['GEMINI_API_KEY', 'GROQ_API_KEY'];
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

    // Load các AI providers với Google Sheets support
    async loadProviders() {
        try {
            // 1. Google Gemini (MIỄN PHÍ - Tốt nhất cho tiếng Việt) - Drug focused
            try {
                const GeminiChatbot = require('./geminiChatbotDrug');
                this.providerClasses.gemini = GeminiChatbot;
                console.log('✅ Gemini Drug AI provider loaded');
            } catch (error) {
                console.log('⚠️ Gemini Drug AI provider not available:', error.message);
                // Fallback to old Gemini
                try {
                    const GeminiChatbotOld = require('./geminiChatbot');
                    this.providerClasses.gemini = GeminiChatbotOld;
                    console.log('✅ Gemini AI provider (old) loaded as fallback');
                } catch (fallbackError) {
                    console.log('⚠️ Gemini AI fallback also failed:', fallbackError.message);
                }
            }

            // 2. Groq AI (MIỄN PHÍ và siêu nhanh) - Drug focused with Google Sheets
            try {
                const GroqChatbotDrug = require('./groqChatbotDrug');
                this.providerClasses.groq = GroqChatbotDrug;
                console.log('✅ Groq Drug AI provider loaded (14,400 requests/day FREE)');
            } catch (error) {
                console.log('⚠️ Groq Drug AI provider not available:', error.message);
                // Fallback to old Groq if exists
                try {
                    const GroqChatbot = require('./groqChatbot');
                    this.providerClasses.groq = GroqChatbot;
                    console.log('✅ Groq AI provider (old) loaded as fallback');
                } catch (fallbackError) {
                    console.log('⚠️ Groq AI fallback also failed:', fallbackError.message);
                }
            }

            // 3. Original chatbot với Google Sheets (đã updated)
            try {
                const OriginalChatbot = require('./chatbotUpdated');
                this.providerClasses.original = OriginalChatbot;
                console.log('✅ Original chatbot provider loaded (uses Google Sheets)');
            } catch (error) {
                console.log('⚠️ Original chatbot provider not available:', error.message);
                // Fallback to old chatbot if new one fails
                try {
                    const OldChatbot = require('./chatbot');
                    this.providerClasses.original = OldChatbot;
                    console.log('⚠️ Original chatbot provider loaded (fallback to local documents)');
                } catch (fallbackError) {
                    console.log('⚠️ Original chatbot fallback also failed:', fallbackError.message);
                }
            }

        } catch (error) {
            console.error('❌ Error loading providers:', error);
        }
    }

    // Initialize fallback nếu không có AI provider nào
    async initializeFallback() {
        try {
            if (this.providerClasses.original) {
                await this.createProviderInstance('original');
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
            
            if (!this.providerClasses[providerName]) {
                console.error(`❌ Provider ${providerName} not loaded in providers list`);
                console.log('📋 Available providers:', Object.keys(this.providerClasses));
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
        const providerClass = this.providerClasses[providerName];
        if (!providerClass) {
            return 'not_available';
        }
        
        switch(providerName) {
            case 'gemini':
                // Check if Gemini has any API key (env or fallback)
                if (process.env.GEMINI_API_KEY) {
                    console.log('✅ Gemini provider has API key');
                    return 'ready';
                } else {
                    console.log('⚠️ Gemini provider has no API key');
                    return 'needs_api_key';
                }
                
            case 'groq':
                // Check if Groq has any API key (env or fallback)
                if (process.env.GROQ_API_KEY) {
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
                result.data.modelUsed = result.data.modelUsed || this.currentProvider;
            }

            return result;
            
        } catch (error) {
            console.error(`❌ AI chat error with ${this.currentProvider}:`, error);
            
            // Try fallback to original if current provider fails
            if (this.currentProvider !== 'original') {
                console.log('🔄 Falling back to original chatbot...');
                try {
                    this.currentProvider = 'original';
                    return await this.chat(message, userId);
                } catch (fallbackError) {
                    console.error('❌ Fallback also failed:', fallbackError);
                }
            }
            
            // Return error response
            return {
                success: false,
                message: 'AI service temporarily unavailable',
                error: error.message
            };
        }
    }

    // Alias for generateResponse to maintain compatibility
    async generateResponse(message, drugData = [], userId = 'anonymous') {
        return await this.chat(message, userId);
    }

    // Get current provider info
    getCurrentProvider() {
        try {
            const provider = this.providers[this.currentProvider];
            if (!provider) {
                console.log('⚠️  Current provider not found, using fallback to original');
                this.currentProvider = 'original';
                return {
                    name: 'original',
                    service: this.providers['original'] || null,
                    isInitialized: this.isInitialized
                };
            }
            return {
                name: this.currentProvider,
                service: provider,
                isInitialized: this.isInitialized
            };
        } catch (error) {
            console.error('❌ Error getting current provider:', error);
            return {
                name: 'original',
                service: null,
                isInitialized: this.isInitialized
            };
        }
    }

    // Get all available providers
    getAvailableProviders() {
        try {
            const providers = [];
            
            if (!this.providerClasses || Object.keys(this.providerClasses).length === 0) {
                console.log('⚠️  No provider classes available, returning original only');
                return [{
                    name: 'original',
                    displayName: 'Original Chatbot',
                    description: 'Chatbot gốc sử dụng documents cục bộ',
                    status: 'available',
                    isActive: true
                }];
            }
            
            Object.keys(this.providerClasses).forEach(key => {
                const providerClass = this.providerClasses[key];
                let description = '';
                let displayName = '';
                
                switch(key) {
                    case 'gemini':
                        displayName = 'Google Gemini AI';
                        description = 'AI miễn phí từ Google với 50 requests/day - tốt cho tiếng Việt';
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
        } catch (error) {
            console.error('❌ Error getting available providers:', error);
            return [{
                name: 'original',
                displayName: 'Original Chatbot',
                description: 'Chatbot gốc sử dụng documents cục bộ',
                status: 'available',
                isActive: true
            }];
        }
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

// Export singleton instance for production use
module.exports = new AIChatbotManager();
