// Chatbot service with Vietnamese text processing and RAG
const fs = require('fs').promises;
const path = require('path');

class ChatbotService {
    constructor() {
        this.documents = [];
        this.embeddings = new Map();
        this.isInitialized = false;
    }

    // Initialize chatbot with knowledge base
    async initialize() {
        try {
            console.log('🤖 Initializing chatbot service...');
            
            // Load processed documents from JSON (pre-processed from Word files)
            await this.loadKnowledgeBase();
            
            this.isInitialized = true;
            console.log(`✅ Chatbot initialized with ${this.documents.length} documents`);
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
                answer: "Xin lỗi, tôi không tìm thấy thông tin phù hợp trong cơ sở dữ liệu. Bạn có thể thử hỏi về thuốc nhi khoa, liều lượng, hoặc chống chỉ định không?",
                sources: [],
                confidence: 0
            };
        }

        // Simple response generation based on most relevant document
        const topDoc = relevantDocs[0];
        const confidence = Math.min(topDoc.score / 50, 1); // Normalize confidence
        
        // Extract relevant paragraph from document
        const sentences = topDoc.content.split(/[.!?]+/).filter(s => s.trim().length > 20);
        const queryLower = query.toLowerCase();
        
        let relevantSentences = sentences.filter(sentence => {
            const sentenceLower = sentence.toLowerCase();
            return query.split(' ').some(word => 
                word.length > 3 && sentenceLower.includes(word.toLowerCase())
            );
        });
        
        if (relevantSentences.length === 0) {
            relevantSentences = sentences.slice(0, 2); // Fallback to first 2 sentences
        }
        
        const answer = relevantSentences
            .slice(0, 3) // Max 3 sentences
            .map(s => s.trim())
            .join('. ') + '.';
        
        return {
            answer: answer || topDoc.content.substring(0, 300) + '...',
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
