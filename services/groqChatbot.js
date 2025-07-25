// Groq AI Chatbot Service - MIỄN PHÍ và SIÊU NHANH với Google Sheets
const Groq = require('groq-sdk');
const { searchTrainingData, getProcessedTrainingData } = require('./sheetsTraining');

class GroqChatbotService {
    constructor() {
        this.documents = [];
        this.isInitialized = false;
        this.knownDrugs = new Set();
        
        // Initialize Groq AI (MIỄN PHÍ hoàn toàn tại console.groq.com)
        this.groqApiKey = process.env.GROQ_API_KEY;
        if (this.groqApiKey) {
            this.groq = new Groq({
                apiKey: this.groqApiKey,
            });
        } else {
            console.warn('⚠️ Groq API key not found. Set GROQ_API_KEY in environment variables.');
            console.log('📝 Get free API key at: https://console.groq.com/keys');
        }
    }

    // Initialize với Google Sheets training data
    async initialize() {
        try {
            console.log('🚀 Initializing Groq AI chatbot service with Google Sheets (FREE & FAST)...');
            
            // Load training data from Google Sheets
            await this.loadTrainingDataFromSheets();
            console.log(`📚 Loaded ${this.documents.length} training entries from Google Sheets`);
            
            if (this.documents.length === 0) {
                console.warn('⚠️ No training data found in Google Sheets');
                throw new Error('No training data available. Please add data to the Google Sheets.');
            }
            
            this.extractDrugNames();
            this.isInitialized = true;
            
            console.log(`✅ Groq AI chatbot initialized with ${this.documents.length} training entries`);
            
        } catch (error) {
            console.error('❌ Failed to initialize Groq AI chatbot:', error);
            throw error;
        }
    }

    // Load knowledge base
    // Load documents từ thư mục backend/documents
    // Load training data từ Google Sheets
    async loadTrainingDataFromSheets() {
        try {
            const trainingData = await getProcessedTrainingData('pedmedvnch');
            
            console.log(`� Found ${trainingData.length} training entries in Google Sheets`);
            
            this.documents = [];
            
            trainingData.forEach((entry, index) => {
                // Create a document structure from sheet data
                const doc = {
                    id: `sheet_entry_${index + 1}`,
                    title: entry.Topic || entry.Question || `Entry ${index + 1}`,
                    content: this.combineSheetContent(entry),
                    source: 'Google Sheets - PedMed Training Data',
                    lastUpdated: new Date().toISOString(),
                    type: 'medical_training_data',
                    rawData: entry // Keep original sheet data for reference
                };
                
                this.documents.push(doc);
                console.log(`📄 Processed: ${doc.title} (${doc.content.length} characters)`);
            });
            
        } catch (error) {
            console.error('❌ Error loading training data from Google Sheets:', error);
            throw error;
        }
    }

    // Combine multiple fields from sheet into searchable content
    combineSheetContent(entry) {
        const contentParts = [];
        
        // Add all non-empty fields to content
        Object.keys(entry).forEach(key => {
            if (key !== 'searchableText' && entry[key] && entry[key].trim()) {
                contentParts.push(`${key}: ${entry[key]}`);
            }
        });
        
        return contentParts.join('\n\n');
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

    // Search relevant documents using Google Sheets
    async searchRelevantDocuments(query, limit = 3) {
        try {
            // Use the sheets training search for more accurate results
            const searchResults = await searchTrainingData(query, 'pedmedvnch', limit);
            
            if (searchResults.length > 0) {
                console.log(`🔍 Found ${searchResults.length} relevant training entries from Sheets`);
                return searchResults.map(result => ({
                    title: result.Topic || result.Question || 'Training Entry',
                    content: this.combineSheetContent(result),
                    source: 'Google Sheets Training Data',
                    relevanceScore: result.relevanceScore,
                    rawData: result
                }));
            }

            // Fallback to local document search if available
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
            
        } catch (error) {
            console.error('❌ Error searching relevant documents:', error);
            return [];
        }
    }

    // Main chat function với Groq AI (SIÊU NHANH)
    async chat(message, userId = 'anonymous') {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            if (!this.groq) {
                return {
                    success: false,
                    message: 'Groq AI chưa được cấu hình. Vui lòng thêm GROQ_API_KEY vào environment variables. Get free key at: https://console.groq.com/keys'
                };
            }

            console.log(`🚀 Groq AI request from ${userId}: "${message}"`);
            
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
            const relevantDocs = await this.searchRelevantDocuments(message);
            
            if (relevantDocs.length === 0) {
                return {
                    success: true,
                    data: {
                        message: "Không tìm thấy thông tin liên quan trong dữ liệu huấn luyện Google Sheets.",
                        isAiGenerated: false
                    }
                };
            }
            
            // Prepare context for Groq
            const context = relevantDocs.map(doc => 
                `Tài liệu: ${doc.title}\nNguồn: ${doc.source}\nNội dung: ${doc.content.substring(0, 1000)}...`
            ).join('\n\n');
            
            // Create completion with Groq (SIÊU NHANH - thường dưới 1 giây)
            const chatCompletion = await this.groq.chat.completions.create({
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
                model: "mixtral-8x7b-32768", // Groq's fastest free model
                max_tokens: 500,
                temperature: 0.3,
            });

            const aiAnswer = chatCompletion.choices[0]?.message?.content || 'Không thể tạo phản hồi.';
            const responseTime = Date.now() - startTime;
            
            await this.logChatInteraction(userId, message, aiAnswer, responseTime);
            
            return {
                success: true,
                data: {
                    message: aiAnswer,
                    responseTime,
                    isAiGenerated: true,
                    aiModel: 'Groq Mixtral-8x7B (FREE & FAST)'
                }
            };
            
        } catch (error) {
            console.error('❌ Groq AI error:', error);
            return {
                success: false,
                message: 'Đã xảy ra lỗi khi xử lý với Groq AI. Vui lòng thử lại sau.',
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
                aiModel: 'Groq Mixtral-8x7B'
            };
            
            console.log('📊 Groq chat logged:', JSON.stringify(logEntry));
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
            aiModel: 'Groq Mixtral-8x7B (FREE)',
            isAiEnabled: !!this.groq,
            speed: 'Ultra Fast (< 1 second)',
            lastUpdated: new Date().toISOString()
        };
    }
}

module.exports = GroqChatbotService;
