// OpenAI GPT Chatbot Service với Google Sheets
const OpenAI = require('openai');
const { searchTrainingData, getProcessedTrainingData } = require('./sheetsTraining');

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

    // Initialize với Google Sheets training data
    async initialize() {
        try {
            console.log('🤖 Initializing OpenAI GPT chatbot service with Google Sheets...');
            
            // Load training data from Google Sheets
            await this.loadTrainingDataFromSheets();
            console.log(`📚 Loaded ${this.documents.length} training entries from Google Sheets`);
            
            if (this.documents.length === 0) {
                console.warn('⚠️ No training data found in Google Sheets');
                throw new Error('No training data available. Please add data to the Google Sheets.');
            }
            
            this.extractDrugNames();
            this.isInitialized = true;
            
            console.log(`✅ OpenAI GPT chatbot initialized with ${this.documents.length} training entries`);
            
        } catch (error) {
            console.error('❌ Failed to initialize OpenAI GPT chatbot:', error);
            throw error;
        }
    }

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
            
            // Prepare context for OpenAI
            const context = relevantDocs.map(doc => 
                `Tài liệu: ${doc.title}\nNguồn: ${doc.source}\nNội dung: ${doc.content.substring(0, 1000)}...`
            ).join('\n\n');
            
            // Create messages for OpenAI với prompt cải tiến
            const completion = await this.openai.chat.completions.create({
                model: "gpt-4o-mini", // Model tốt hơn, cost-effective
                messages: [
                    {
                        role: "system",
                        content: `Bạn là một chuyên gia y tế nhi khoa chuyên nghiệp với kiến thức sâu về dược lý nhi khoa.

🎯 VAI TRÒ: Cung cấp thông tin chính xác, chi tiết và an toàn về thuốc trong điều trị nhi khoa.

📋 NGUYÊN TẮC QUAN TRỌNG:
- Chỉ sử dụng thông tin từ cơ sở dữ liệu được cung cấp
- Không bịa đặt hay suy đoán thông tin không có trong tài liệu
- Trả lời chi tiết, có cấu trúc và dễ hiểu
- Sử dụng emoji phù hợp để làm rõ thông tin
- Luôn nhấn mạnh tầm quan trọng của việc tham khảo bác sĩ

✅ CÁCH TRẢ LỜI TỐT:
- Bắt đầu với tên thuốc và hoạt chất chính
- Phân chia thông tin theo từng mục rõ ràng (liều dùng, chống chỉ định, tác dụng phụ...)
- Cung cấp thông tin liều dùng cụ thể cho từng lứa tuổi
- Nêu rõ các cảnh báo và lưu ý quan trọng
- Kết thúc với khuyến nghị tham khảo bác sĩ

🚫 TRÁNH:
- Đưa ra lời khuyên chẩn đoán hoặc điều trị
- Thông tin không có trong tài liệu
- Trả lời mơ hồ hoặc thiếu chi tiết

🔍 DỮ LIỆU THAM KHẢO:
${context}`
                    },
                    {
                        role: "user",
                        content: message
                    }
                ],
                max_tokens: 800, // Tăng để có câu trả lời chi tiết hơn
                temperature: 0.2, // Giảm để có câu trả lời chính xác hơn
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
