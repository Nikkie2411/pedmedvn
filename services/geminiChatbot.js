// Google Gemini AI Chatbot Service với RAG từ Google Drive
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const path = require('path');
const GoogleDriveService = require('./googleDrive');
const EnhancedMedicalProcessor = require('../utils/enhancedMedicalProcessor');

class GeminiChatbotService {
    constructor() {
        this.documents = [];
        this.isInitialized = false;
        this.driveService = new GoogleDriveService();
        this.enhancedProcessor = new EnhancedMedicalProcessor();
        this.knownDrugs = new Set();
        
        // Initialize Gemini AI
        this.geminiApiKey = process.env.GEMINI_API_KEY; // Miễn phí tại ai.google.dev
        if (this.geminiApiKey) {
            this.genAI = new GoogleGenerativeAI(this.geminiApiKey);
            this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Miễn phí
        } else {
            console.warn('⚠️ Gemini API key not found. Set GEMINI_API_KEY in environment variables.');
        }
    }

    // Initialize với Google Drive data
    async initialize() {
        try {
            console.log('🤖 Initializing Gemini AI chatbot service...');
            
            // Load existing knowledge base
            await this.loadKnowledgeBase();
            console.log(`📚 Loaded ${this.documents.length} documents from existing knowledge base`);
            
            // Sync with Google Drive
            try {
                const synced = await this.driveService.syncDocuments();
                if (synced) {
                    console.log('✅ Documents synced from Google Drive - rebuilding knowledge base');
                    await this.rebuildKnowledgeBase();
                    await this.loadKnowledgeBase();
                }
            } catch (driveError) {
                console.warn('⚠️ Google Drive sync failed:', driveError.message);
            }
            
            if (this.documents.length === 0) {
                await this.createSampleKnowledgeBase();
            }
            
            this.extractDrugNames();
            this.isInitialized = true;
            
            console.log(`✅ Gemini AI chatbot initialized with ${this.documents.length} documents`);
            console.log(`💊 Known drugs: ${Array.from(this.knownDrugs).slice(0, 5).join(', ')}...`);
            
        } catch (error) {
            console.error('❌ Failed to initialize Gemini AI chatbot:', error);
            throw error;
        }
    }

    // Load knowledge base
    async loadKnowledgeBase() {
        try {
            const knowledgeBasePath = path.join(__dirname, '../data/knowledge_base.json');
            
            try {
                const data = await fs.readFile(knowledgeBasePath, 'utf8');
                this.documents = JSON.parse(data);
            } catch (fileError) {
                this.documents = [];
                await this.saveKnowledgeBase();
            }
        } catch (error) {
            console.error('❌ Error loading knowledge base:', error);
            throw error;
        }
    }

    // Save knowledge base
    async saveKnowledgeBase() {
        try {
            const knowledgeBasePath = path.join(__dirname, '../data/knowledge_base.json');
            const dataDir = path.dirname(knowledgeBasePath);
            
            await fs.mkdir(dataDir, { recursive: true });
            await fs.writeFile(knowledgeBasePath, JSON.stringify(this.documents, null, 2), 'utf8');
        } catch (error) {
            console.error('❌ Error saving knowledge base:', error);
        }
    }

    // Rebuild from documents folder
    async rebuildKnowledgeBase() {
        try {
            const DocumentProcessor = require('../utils/documentProcessor');
            const processor = new DocumentProcessor();
            
            const documentsDir = path.join(__dirname, '..', 'documents');
            const outputPath = path.join(__dirname, '..', 'data', 'knowledge_base.json');
            
            await processor.buildKnowledgeBase(documentsDir, outputPath);
        } catch (error) {
            console.error('❌ Error rebuilding knowledge base:', error);
        }
    }

    // Create sample knowledge base
    async createSampleKnowledgeBase() {
        console.log('🔨 Creating minimal sample knowledge base...');
        
        const sampleDocs = [
            {
                id: "no_data_notice",
                title: "Thông báo không có dữ liệu",
                content: "Hiện tại hệ thống chưa có dữ liệu từ Google Drive. Vui lòng liên hệ quản trị viên để cập nhật tài liệu y tế. Tôi chỉ có thể trả lời các câu hỏi khi có đầy đủ tài liệu chuyên môn.",
                source: "System Notice",
                lastUpdated: new Date().toISOString()
            }
        ];
        
        this.documents = sampleDocs;
        await this.saveKnowledgeBase();
    }

    // Extract drug names từ knowledge base
    extractDrugNames() {
        this.knownDrugs.clear();
        
        this.documents.forEach(doc => {
            // Extract from title
            if (doc.title) {
                const drugMatch = doc.title.match(/([A-Za-z]+)/g);
                if (drugMatch) {
                    drugMatch.forEach(drug => {
                        if (drug.length > 3) {
                            this.knownDrugs.add(drug.toLowerCase());
                        }
                    });
                }
            }
            
            // Extract from enhanced processor data
            if (doc.drugName) {
                this.knownDrugs.add(doc.drugName.toLowerCase());
            }
        });
        
        console.log(`💊 Extracted ${this.knownDrugs.size} known drugs`);
    }

    // Validate nếu câu hỏi về thuốc có trong knowledge base
    validateDrugQuery(query) {
        const processedQuery = query.toLowerCase();
        
        // Check if asking about drugs
        const drugQuestionPatterns = [
            /thuoc|thuốc/i,
            /lieu\s*luong|liều\s*lượng/i,
            /tac\s*dung|tác\s*dụng/i,
            /chi\s*dinh|chỉ\s*định/i,
            /dung|dùng/i,
            /viên|siro|gel/i,
            /mg|ml/i
        ];
        
        const isDrugQuery = drugQuestionPatterns.some(pattern => pattern.test(query));
        
        if (!isDrugQuery) {
            return { isValid: true, reason: 'not_drug_question' };
        }
        
        // Check if mentions known drugs
        const mentionedDrugs = [];
        this.knownDrugs.forEach(drug => {
            if (processedQuery.includes(drug)) {
                mentionedDrugs.push(drug);
            }
        });
        
        if (mentionedDrugs.length === 0) {
            const knownDrugsList = Array.from(this.knownDrugs).slice(0, 10).join(', ');
            return { 
                isValid: false, 
                reason: 'unknown_drug',
                message: `Xin lỗi, tôi chỉ có thể trả lời về các thuốc có trong tài liệu đã được cập nhật từ Google Drive. 

Các thuốc tôi có thông tin: ${knownDrugsList}${this.knownDrugs.size > 10 ? '...' : ''}

Vui lòng hỏi về một trong những thuốc này hoặc liên hệ quản trị viên để cập nhật thêm tài liệu.`
            };
        }
        
        return { isValid: true, mentionedDrugs };
    }

    // Search relevant documents
    searchRelevantDocuments(query, limit = 3) {
        if (this.documents.length === 0) return [];
        
        const queryLower = query.toLowerCase();
        const scores = [];
        
        this.documents.forEach((doc, index) => {
            let score = 0;
            const contentLower = doc.content.toLowerCase();
            const titleLower = (doc.title || '').toLowerCase();
            
            // Title match (highest priority)
            if (titleLower.includes(queryLower)) score += 50;
            
            // Content match
            if (contentLower.includes(queryLower)) score += 30;
            
            // Word-based matching
            const queryWords = queryLower.split(/\s+/);
            queryWords.forEach(word => {
                if (word.length > 2) {
                    if (titleLower.includes(word)) score += 20;
                    if (contentLower.includes(word)) score += 10;
                }
            });
            
            if (score > 0) {
                scores.push({
                    index,
                    score,
                    title: doc.title,
                    content: doc.content,
                    source: doc.source
                });
            }
        });
        
        return scores
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    // Main chat function với Gemini AI
    async chat(message, userId = 'anonymous') {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            if (!this.model) {
                return {
                    success: false,
                    message: 'Gemini AI chưa được cấu hình. Vui lòng thêm GEMINI_API_KEY vào environment variables.'
                };
            }

            console.log(`💬 Gemini AI request from ${userId}: "${message}"`);
            
            // Validate drug query
            const validation = this.validateDrugQuery(message);
            if (!validation.isValid) {
                return {
                    success: true,
                    data: {
                        message: validation.message,
                        isAiGenerated: false
                    }
                };
            }
            
            const startTime = Date.now();
            
            // Search relevant documents
            const relevantDocs = this.searchRelevantDocuments(message);
            
            if (relevantDocs.length === 0) {
                return {
                    success: true,
                    data: {
                        message: "Không tìm thấy thông tin liên quan trong tài liệu hiện có. Vui lòng hỏi về các thuốc khác hoặc liên hệ quản trị viên.",
                        isAiGenerated: false
                    }
                };
            }
            
            // Prepare context for Gemini
            const context = relevantDocs.map(doc => 
                `Tài liệu: ${doc.title}
Nguồn: ${doc.source}
Nội dung: ${doc.content.substring(0, 1000)}...`
            ).join('\n\n');
            
            // Create prompt for Gemini
            const prompt = `Bạn là một chuyên gia y tế hỗ trợ thông tin về thuốc. Hãy trả lời câu hỏi dựa CHÍNH XÁC trên thông tin trong tài liệu được cung cấp.

QUAN TRỌNG:
- Chỉ sử dụng thông tin từ tài liệu được cung cấp
- Không bịa đặt thông tin
- Trả lời bằng tiếng Việt
- Nếu không có đủ thông tin, hãy nói rõ
- Đưa ra lời khuyên an toàn và khuyến nghị tham khảo bác sĩ

TÀI LIỆU THAM KHẢO:
${context}

CÂU HỎI: ${message}

Hãy trả lời một cách chi tiết, chính xác và dễ hiểu:`;

            // Call Gemini AI
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const aiAnswer = response.text();
            
            const responseTime = Date.now() - startTime;
            
            // Log interaction
            await this.logChatInteraction(userId, message, aiAnswer, responseTime);
            
            return {
                success: true,
                data: {
                    message: aiAnswer,
                    responseTime,
                    isAiGenerated: true,
                    aiModel: 'Google Gemini 1.5 Flash'
                }
            };
            
        } catch (error) {
            console.error('❌ Gemini AI error:', error);
            return {
                success: false,
                message: 'Đã xảy ra lỗi khi xử lý với Gemini AI. Vui lòng thử lại sau.',
                error: error.message
            };
        }
    }

    // Log chat interactions
    async logChatInteraction(userId, message, response, responseTime) {
        try {
            const logEntry = {
                timestamp: new Date().toISOString(),
                userId,
                message,
                response: response.substring(0, 200) + '...',
                responseTime,
                aiModel: 'Gemini 1.5 Flash'
            };
            
            console.log('📊 Gemini chat logged:', JSON.stringify(logEntry));
        } catch (error) {
            console.error('❌ Error logging chat:', error);
        }
    }

    // Add document (for admin)
    async addDocument(title, content, source = 'Manual Upload') {
        try {
            const processedContent = this.enhancedProcessor.processRealMedicalDocument(content, title);
            
            if (!processedContent) {
                return { success: false, error: 'Document processing failed' };
            }
            
            const newDoc = {
                id: Date.now().toString(),
                title,
                content: processedContent.content,
                source,
                addedAt: new Date().toISOString(),
                drugName: processedContent.drugName,
                drugClass: processedContent.drugClass,
                sections: processedContent.sections,
                qualityScore: processedContent.qualityScore
            };
            
            this.documents.push(newDoc);
            await this.saveKnowledgeBase();
            this.extractDrugNames();
            
            return { 
                success: true, 
                message: `Added document: ${title}`,
                drugName: processedContent.drugName,
                qualityScore: processedContent.qualityScore
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Get statistics
    getStats() {
        return {
            documentsCount: this.documents.length,
            knownDrugsCount: this.knownDrugs.size,
            isInitialized: this.isInitialized,
            aiModel: 'Google Gemini 1.5 Flash',
            isAiEnabled: !!this.model,
            lastUpdated: new Date().toISOString()
        };
    }
}

module.exports = new GeminiChatbotService();
