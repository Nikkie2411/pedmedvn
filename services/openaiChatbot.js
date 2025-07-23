// OpenAI GPT Chatbot Service với local documents
const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');

class OpenAIChatbotService {
    constructor() {
        this.documents = [];
        this.isInitialized = false;
        this.knownDrugs = new Set();
        
        // Initialize OpenAI
        this.openaiApiKey = process.env.OPENAI_API_KEY; // Free tier: $5 credit
        if (this.openaiApiKey) {
            this.openai = new OpenAI({
                apiKey: this.openaiApiKey,
            });
        } else {
            console.warn('⚠️ OpenAI API key not found. Set OPENAI_API_KEY in environment variables.');
        }
    }

    // Initialize với local documents
    async initialize() {
        try {
            console.log('🤖 Initializing OpenAI GPT chatbot service...');
            
            // Load documents from local folder
            await this.loadDocumentsFromFolder();
            console.log(`📚 Loaded ${this.documents.length} documents from local folder`);
            
            if (this.documents.length === 0) {
                console.warn('⚠️ No documents found in backend/documents folder');
                throw new Error('No documents available for training. Please add documents to backend/documents folder.');
            }
            
            this.extractDrugNames();
            this.isInitialized = true;
            
            console.log(`✅ OpenAI GPT chatbot initialized with ${this.documents.length} documents`);
            
        } catch (error) {
            console.error('❌ Failed to initialize OpenAI GPT chatbot:', error);
            throw error;
        }
    }

    // Load knowledge base
    // Load documents từ thư mục backend/documents
    async loadDocumentsFromFolder() {
        try {
            const documentsDir = path.join(__dirname, '..', 'documents');
            
            // Ensure documents directory exists
            try {
                await fs.access(documentsDir);
            } catch (error) {
                console.warn('⚠️ Documents directory not found, creating it...');
                await fs.mkdir(documentsDir, { recursive: true });
                return;
            }
            
            const files = await fs.readdir(documentsDir);
            const textFiles = files.filter(file => file.endsWith('.txt') || file.endsWith('.md'));
            
            console.log(`📁 Found ${textFiles.length} text files in documents folder`);
            
            this.documents = [];
            
            for (const file of textFiles) {
                const filePath = path.join(documentsDir, file);
                const content = await fs.readFile(filePath, 'utf8');
                
                if (content.trim()) {
                    const doc = {
                        id: file.replace(/\.(txt|md)$/i, ''),
                        title: file.replace(/\.(txt|md)$/i, '').replace(/_/g, ' '),
                        content: content.trim(),
                        source: `Local Document - ${file}`,
                        lastUpdated: new Date().toISOString(),
                        type: 'medical_document'
                    };
                    
                    this.documents.push(doc);
                    console.log(`📄 Loaded: ${file} (${content.length} characters)`);
                }
            }
            
        } catch (error) {
            console.error('❌ Error loading documents from folder:', error);
            throw error;
        }
    }

    // Extract drug names
    extractDrugNames() {
        this.knownDrugs.clear();
        
        this.documents.forEach(doc => {
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
            
            if (doc.drugName) {
                this.knownDrugs.add(doc.drugName.toLowerCase());
            }
        });
    }

    // Validate drug query
    validateDrugQuery(query) {
        const processedQuery = query.toLowerCase();
        
        const drugQuestionPatterns = [
            /thuoc|thuốc/i,
            /lieu\s*luong|liều\s*lượng/i,
            /tac\s*dung|tác\s*dụng/i,
            /chi\s*dinh|chỉ\s*định/i,
            /dung|dùng/i,
            /viên|siro|gel/i,
        ];
        
        const isDrugQuery = drugQuestionPatterns.some(pattern => pattern.test(query));
        
        if (!isDrugQuery) {
            return { isValid: true };
        }
        
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
                message: `Xin lỗi, tôi chỉ có thể trả lời về các thuốc có trong tài liệu đã được cập nhật từ Google Drive.

Các thuốc tôi có thông tin: ${knownDrugsList}${this.knownDrugs.size > 10 ? '...' : ''}

Vui lòng hỏi về một trong những thuốc này.`
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
            
            if (titleLower.includes(queryLower)) score += 50;
            if (contentLower.includes(queryLower)) score += 30;
            
            const queryWords = queryLower.split(/\s+/);
            queryWords.forEach(word => {
                if (word.length > 2) {
                    if (titleLower.includes(word)) score += 20;
                    if (contentLower.includes(word)) score += 10;
                }
            });
            
            if (score > 0) {
                scores.push({
                    index, score, title: doc.title,
                    content: doc.content, source: doc.source
                });
            }
        });
        
        return scores.sort((a, b) => b.score - a.score).slice(0, limit);
    }

    // Main chat function với OpenAI GPT
    async chat(message, userId = 'anonymous') {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            if (!this.openai) {
                return {
                    success: false,
                    message: 'OpenAI chưa được cấu hình. Vui lòng thêm OPENAI_API_KEY vào environment variables.'
                };
            }

            console.log(`💬 OpenAI GPT request from ${userId}: "${message}"`);
            
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
            const relevantDocs = this.searchRelevantDocuments(message);
            
            if (relevantDocs.length === 0) {
                return {
                    success: true,
                    data: {
                        message: "Không tìm thấy thông tin liên quan trong tài liệu hiện có.",
                        isAiGenerated: false
                    }
                };
            }
            
            // Prepare context for OpenAI
            const context = relevantDocs.map(doc => 
                `Tài liệu: ${doc.title}\nNguồn: ${doc.source}\nNội dung: ${doc.content.substring(0, 1000)}...`
            ).join('\n\n');
            
            // Create messages for OpenAI
            const completion = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo", // Free tier model
                messages: [
                    {
                        role: "system",
                        content: `Bạn là một chuyên gia y tế hỗ trợ thông tin về thuốc. Hãy trả lời câu hỏi dựa CHÍNH XÁC trên thông tin trong tài liệu được cung cấp.

QUAN TRỌNG:
- Chỉ sử dụng thông tin từ tài liệu được cung cấp
- Không bịa đặt thông tin
- Trả lời bằng tiếng Việt
- Nếu không có đủ thông tin, hãy nói rõ
- Đưa ra lời khuyên an toàn và khuyến nghị tham khảo bác sĩ

TÀI LIỆU THAM KHẢO:
${context}`
                    },
                    {
                        role: "user",
                        content: message
                    }
                ],
                max_tokens: 500,
                temperature: 0.3, // Lower temperature for more consistent responses
            });

            const aiAnswer = completion.choices[0].message.content;
            const responseTime = Date.now() - startTime;
            
            await this.logChatInteraction(userId, message, aiAnswer, responseTime);
            
            return {
                success: true,
                data: {
                    message: aiAnswer,
                    responseTime,
                    isAiGenerated: true,
                    aiModel: 'OpenAI GPT-3.5 Turbo'
                }
            };
            
        } catch (error) {
            console.error('❌ OpenAI GPT error:', error);
            return {
                success: false,
                message: 'Đã xảy ra lỗi khi xử lý với OpenAI GPT. Vui lòng thử lại sau.',
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
                aiModel: 'OpenAI GPT-3.5'
            };
            
            console.log('📊 OpenAI chat logged:', JSON.stringify(logEntry));
        } catch (error) {
            console.error('❌ Error logging chat:', error);
        }
    }

    // Add document
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
                qualityScore: processedContent.qualityScore
            };
            
            this.documents.push(newDoc);
            await this.saveKnowledgeBase();
            this.extractDrugNames();
            
            return { 
                success: true, 
                message: `Added document: ${title}`,
                drugName: processedContent.drugName
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
            aiModel: 'OpenAI GPT-3.5 Turbo',
            isAiEnabled: !!this.openai,
            lastUpdated: new Date().toISOString()
        };
    }
}

module.exports = new OpenAIChatbotService();
