// Chatbot service with Vietnamese text processing and RAG
const fs = require('fs').promises;
const path = require('path');
const GoogleDriveService = require('./googleDrive');

class ChatbotService {
    constructor() {
        this.documents = [];
        this.embeddings = new Map();
        this.isInitialized = false;
        this.driveService = new GoogleDriveService();
    }

    // Initialize chatbot with knowledge base
    async initialize() {
        try {
            console.log('🤖 Initializing chatbot service...');
            
            // First load existing knowledge base
            await this.loadKnowledgeBase();
            console.log(`📚 Loaded ${this.documents.length} documents from existing knowledge base`);
            
            // Try to sync documents from Google Drive
            console.log('🔄 Attempting to sync documents from Google Drive...');
            try {
                const synced = await this.driveService.syncDocuments();
                
                if (synced) {
                    console.log('✅ Documents synced from Google Drive - rebuilding knowledge base');
                    // Rebuild knowledge base with new documents
                    await this.rebuildKnowledgeBase();
                    // Reload the updated knowledge base
                    await this.loadKnowledgeBase();
                    console.log(`📚 Updated knowledge base now has ${this.documents.length} documents`);
                } else {
                    console.log('📝 No new documents from Google Drive - using existing knowledge base');
                }
            } catch (driveError) {
                console.warn('⚠️ Google Drive sync failed:', driveError.message);
                console.log('📝 Continuing with existing knowledge base');
            }
            
            // Validate knowledge base
            if (this.documents.length === 0) {
                console.warn('⚠️ No documents in knowledge base! Creating sample data...');
                await this.createSampleKnowledgeBase();
            }
            
            // Schedule periodic syncs (every 6 hours) only if Drive is working
            try {
                this.driveService.scheduleSync(6);
            } catch (error) {
                console.log('📝 Drive scheduling disabled - working offline only');
            }
            
            this.isInitialized = true;
            console.log(`✅ Chatbot initialized with ${this.documents.length} documents`);
            
            // Log knowledge base sources for debugging
            const sources = [...new Set(this.documents.map(doc => doc.source))];
            console.log('📊 Knowledge base sources:', sources.join(', '));
            
        } catch (error) {
            console.error('❌ Failed to initialize chatbot:', error);
            throw error;
        }
    }

    // Load knowledge base from preprocessed JSON
    async loadKnowledgeBase() {
        try {
            const knowledgeBasePath = path.join(__dirname, '../data/knowledge_base.json');
            
            // Check if knowledge base exists
            try {
                const data = await fs.readFile(knowledgeBasePath, 'utf8');
                this.documents = JSON.parse(data);
                console.log(`📚 Loaded ${this.documents.length} documents from knowledge base`);
            } catch (fileError) {
                // If no knowledge base exists, create empty one
                console.log('📝 No existing knowledge base found, creating empty one');
                this.documents = [];
                await this.saveKnowledgeBase();
            }
            
            // Build simple embeddings for search
            this.buildSimpleEmbeddings();
            
        } catch (error) {
            console.error('❌ Error loading knowledge base:', error);
            throw error;
        }
    }

    // Save knowledge base to JSON
    async saveKnowledgeBase() {
        try {
            const knowledgeBasePath = path.join(__dirname, '../data/knowledge_base.json');
            const dataDir = path.dirname(knowledgeBasePath);
            
            // Ensure data directory exists
            await fs.mkdir(dataDir, { recursive: true });
            
            await fs.writeFile(knowledgeBasePath, JSON.stringify(this.documents, null, 2), 'utf8');
            console.log('💾 Knowledge base saved successfully');
        } catch (error) {
            console.error('❌ Error saving knowledge base:', error);
            throw error;
        }
    }

    // Rebuild knowledge base from documents folder
    async rebuildKnowledgeBase() {
        try {
            console.log('🔨 Rebuilding knowledge base from documents...');
            
            const DocumentProcessor = require('../utils/documentProcessor');
            const processor = new DocumentProcessor();
            
            const documentsDir = path.join(__dirname, '..', 'documents');
            const outputPath = path.join(__dirname, '..', 'data', 'knowledge_base.json');
            
            await processor.buildKnowledgeBase(documentsDir, outputPath);
            console.log('✅ Knowledge base rebuilt successfully');
        } catch (error) {
            console.error('❌ Error rebuilding knowledge base:', error);
            // Don't throw - continue with existing knowledge base
        }
    }

    // Create sample knowledge base if no documents exist
    async createSampleKnowledgeBase() {
        console.log('🔨 Creating minimal sample knowledge base...');
        
        const sampleDocs = [
            {
                id: "no_data_notice",
                title: "Thông báo không có dữ liệu",
                content: "Hiện tại hệ thống chưa có dữ liệu từ Google Drive. Vui lòng liên hệ quản trị viên để cập nhật tài liệu y tế. Tôi chỉ có thể trả lời các câu hỏi khi có đầy đủ tài liệu chuyên môn.",
                keywords: ["không có dữ liệu", "liên hệ", "quản trị viên", "cập nhật"],
                source: "System Notice",
                lastUpdated: new Date().toISOString()
            }
        ];
        
        this.documents = sampleDocs;
        await this.saveKnowledgeBase();
        this.buildSimpleEmbeddings();
        
        console.log('⚠️ Created minimal knowledge base with system notice');
    }

    // Process Vietnamese text for better search
    preprocessVietnameseText(text) {
        if (!text) return '';
        
        return text
            .toLowerCase()
            .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
            .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
            .replace(/[ìíịỉĩ]/g, 'i')
            .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
            .replace(/[ùúụủũưừứựửữ]/g, 'u')
            .replace(/[ỳýỵỷỹ]/g, 'y')
            .replace(/[đ]/g, 'd')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Build simple embeddings using keyword extraction
    buildSimpleEmbeddings() {
        console.log('🔍 Building search embeddings...');
        
        this.embeddings.clear();
        
        this.documents.forEach((doc, index) => {
            const text = this.preprocessVietnameseText(doc.content);
            const keywords = this.extractKeywords(text);
            
            this.embeddings.set(index, {
                keywords: keywords,
                originalText: doc.content,
                title: doc.title || `Document ${index + 1}`,
                source: doc.source || 'Unknown'
            });
        });
        
        console.log(`✅ Built embeddings for ${this.embeddings.size} documents`);
    }

    // Extract keywords from Vietnamese text
    extractKeywords(text) {
        const stopWords = new Set([
            'và', 'của', 'có', 'được', 'là', 'để', 'trong', 'với', 'các', 'một', 'này', 'đó', 'khi', 'sẽ', 'từ', 'về', 'cho', 'như', 'sau', 'trước', 'đã', 'hay', 'hoặc', 'nhưng', 'mà', 'nếu', 'vì', 'do', 'theo', 'bằng', 'qua', 'giữa', 'trên', 'dưới', 'ngoài', 'trong'
        ]);
        
        return text
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.has(word))
            .reduce((acc, word) => {
                acc[word] = (acc[word] || 0) + 1;
                return acc;
            }, {});
    }

    // Search relevant documents based on query
    searchRelevantDocuments(query, limit = 3) {
        if (!this.isInitialized || this.documents.length === 0) {
            return [];
        }

        const processedQuery = this.preprocessVietnameseText(query);
        const queryKeywords = this.extractKeywords(processedQuery);
        
        const scores = [];
        
        this.embeddings.forEach((embedding, index) => {
            let score = 0;
            
            // Calculate similarity based on keyword overlap
            Object.keys(queryKeywords).forEach(keyword => {
                if (embedding.keywords[keyword]) {
                    score += queryKeywords[keyword] * embedding.keywords[keyword];
                }
            });
            
            // Boost score if query terms appear in original text
            const lowerOriginal = embedding.originalText.toLowerCase();
            processedQuery.split(' ').forEach(term => {
                if (lowerOriginal.includes(term)) {
                    score += 10;
                }
            });
            
            if (score > 0) {
                scores.push({
                    index,
                    score,
                    title: embedding.title,
                    content: embedding.originalText,
                    source: embedding.source
                });
            }
        });
        
        // Sort by score and return top results
        return scores
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    // Generate response using retrieved documents
    generateResponse(query, relevantDocs) {
        if (relevantDocs.length === 0) {
            return {
                answer: "Xin lỗi, tôi không tìm thấy thông tin về câu hỏi này trong cơ sở dữ liệu y tế. Vui lòng hỏi về các thuốc nhi khoa cụ thể như paracetamol, amoxicillin, ibuprofen, hoặc các thông tin có trong tài liệu.",
                sources: [],
                confidence: 0
            };
        }

        // Calculate minimum confidence threshold
        const topDoc = relevantDocs[0];
        const confidence = Math.min(topDoc.score / 50, 1);
        
        // Set strict confidence threshold - only answer if confidence > 30%
        const CONFIDENCE_THRESHOLD = 0.3;
        
        if (confidence < CONFIDENCE_THRESHOLD) {
            return {
                answer: "Tôi không có đủ thông tin chính xác để trả lời câu hỏi này. Vui lòng hỏi cụ thể hơn về thuốc nhi khoa, liều lượng, tác dụng phụ hoặc chống chỉ định có trong tài liệu.",
                sources: [],
                confidence: Math.round(confidence * 100)
            };
        }
        
        // Extract relevant information from documents
        const queryLower = this.preprocessVietnameseText(query);
        const queryTerms = queryLower.split(' ').filter(term => term.length > 2);
        
        // Find most relevant sentences
        let relevantSentences = [];
        
        relevantDocs.forEach(doc => {
            const sentences = doc.content.split(/[.!?]+/).filter(s => s.trim().length > 15);
            
            sentences.forEach(sentence => {
                const sentenceLower = this.preprocessVietnameseText(sentence);
                let matchScore = 0;
                
                queryTerms.forEach(term => {
                    if (sentenceLower.includes(term)) {
                        matchScore += 1;
                    }
                });
                
                if (matchScore > 0) {
                    relevantSentences.push({
                        text: sentence.trim(),
                        score: matchScore,
                        source: doc.source,
                        title: doc.title
                    });
                }
            });
        });
        
        // Sort by relevance and take top sentences
        relevantSentences.sort((a, b) => b.score - a.score);
        
        if (relevantSentences.length === 0) {
            return {
                answer: "Mặc dù tôi tìm thấy tài liệu liên quan, nhưng không có thông tin cụ thể cho câu hỏi này. Vui lòng hỏi chi tiết hơn hoặc kiểm tra lại từ khóa.",
                sources: relevantDocs.slice(0, 1).map(doc => ({
                    title: doc.title,
                    source: doc.source,
                    confidence: Math.round(doc.score / relevantDocs[0].score * 100)
                })),
                confidence: Math.round(confidence * 100)
            };
        }
        
        // Build comprehensive answer from relevant sentences
        const answer = relevantSentences
            .slice(0, 3) // Take top 3 most relevant sentences
            .map(s => s.text)
            .join('. ') + '.';
        
        // Clean up answer
        const cleanAnswer = answer
            .replace(/\.\s*\./g, '.')
            .replace(/\s+/g, ' ')
            .trim();
        
        return {
            answer: cleanAnswer,
            sources: relevantDocs.slice(0, 2).map(doc => ({
                title: doc.title,
                source: doc.source,
                confidence: Math.round(doc.score / relevantDocs[0].score * 100)
            })),
            confidence: Math.round(confidence * 100)
        };
    }

    // Main chat function
    async chat(message, userId = 'anonymous') {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            console.log(`💬 Chat request from ${userId}: "${message}"`);
            
            const startTime = Date.now();
            
            // Search for relevant documents
            const relevantDocs = this.searchRelevantDocuments(message);
            
            // Generate response
            const response = this.generateResponse(message, relevantDocs);
            
            const responseTime = Date.now() - startTime;
            console.log(`⚡ Response generated in ${responseTime}ms`);
            
            // Log chat interaction
            await this.logChatInteraction(userId, message, response, responseTime);
            
            return {
                success: true,
                data: {
                    message: response.answer,
                    sources: response.sources,
                    confidence: response.confidence,
                    responseTime: responseTime
                }
            };
            
        } catch (error) {
            console.error('❌ Chat error:', error);
            return {
                success: false,
                message: 'Đã xảy ra lỗi khi xử lý câu hỏi. Vui lòng thử lại.',
                error: error.message
            };
        }
    }

    // Log chat interactions for analytics
    async logChatInteraction(userId, message, response, responseTime) {
        try {
            const logEntry = {
                timestamp: new Date().toISOString(),
                userId,
                message,
                response: response.answer,
                confidence: response.confidence,
                responseTime,
                sources: response.sources.length
            };
            
            // In a production environment, you might want to store this in a database
            console.log('📊 Chat interaction logged:', JSON.stringify(logEntry));
        } catch (error) {
            console.error('❌ Error logging chat interaction:', error);
        }
    }

    // Add document to knowledge base (for admin use)
    async addDocument(title, content, source = 'Manual Upload') {
        try {
            const newDoc = {
                id: Date.now().toString(),
                title,
                content,
                source,
                addedAt: new Date().toISOString()
            };
            
            this.documents.push(newDoc);
            await this.saveKnowledgeBase();
            this.buildSimpleEmbeddings();
            
            console.log(`📄 Added new document: "${title}"`);
            return { success: true, documentId: newDoc.id };
            
        } catch (error) {
            console.error('❌ Error adding document:', error);
            return { success: false, error: error.message };
        }
    }

    // Get chatbot statistics
    getStats() {
        return {
            documentsCount: this.documents.length,
            isInitialized: this.isInitialized,
            lastUpdated: new Date().toISOString()
        };
    }
}

module.exports = new ChatbotService();
