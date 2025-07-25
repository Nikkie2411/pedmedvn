// OpenAI GPT Chatbot Service - Sử dụng drugSheets như các service khác
const OpenAI = require('openai');
const { searchDrugData, loadDrugData } = require('./drugSheets');

class OpenAIChatbotService {
    constructor() {
        this.documents = [];
        this.isInitialized = false;
        this.knownDrugs = new Set();
        
        // Initialize OpenAI
        this.openaiApiKey = process.env.OPENAI_API_KEY;
        if (this.openaiApiKey) {
            this.openai = new OpenAI({
                apiKey: this.openaiApiKey,
            });
            console.log('✅ OpenAI GPT initialized! Key found:', this.openaiApiKey ? 'Yes' : 'No');
        } else {
            console.warn('⚠️ OpenAI API key not found. Set OPENAI_API_KEY in environment variables.');
        }
    }

    // Initialize với Google Sheets drug data (giống như Groq và Gemini)
    async initialize() {
        try {
            console.log('🤖 Initializing OpenAI GPT chatbot service with drug data...');
            
            // Load drug database from Google Sheets 
            await this.loadDrugDataFromSheets();
            console.log(`💊 Loaded ${this.documents.length} drugs from Google Sheets`);
            
            if (this.documents.length === 0) {
                console.warn('⚠️ No drug data found in Google Sheets');
                throw new Error('No drug data available. Please add drug information to the Google Sheets.');
            }
            
            this.extractDrugNames();
            this.isInitialized = true;
            
            console.log(`✅ OpenAI GPT chatbot initialized with ${this.documents.length} drugs`);
            console.log(`💊 Known drugs: ${Array.from(this.knownDrugs).slice(0, 5).join(', ')}...`);
            
        } catch (error) {
            console.error('❌ Failed to initialize OpenAI GPT chatbot:', error);
            throw error;
        }
    }

    // Load drug data từ Google Sheets (copy từ groqChatbotDrug.js)
    async loadDrugDataFromSheets() {
        try {
            const drugData = await loadDrugData('pedmedvnch');
            
            console.log(`💊 Found ${drugData.length} drugs in Google Sheets`);
            
            this.documents = [];
            
            drugData.forEach((drug, index) => {
                const doc = {
                    id: drug.id,
                    title: drug.name,
                    content: drug.structuredContent,
                    source: drug.source,
                    lastUpdated: drug.lastUpdated,
                    type: drug.type,
                    rawData: drug.originalData
                };
                
                this.documents.push(doc);
                console.log(`💊 Processed: ${drug.name} (${drug.structuredContent.length} characters)`);
            });
            
        } catch (error) {
            console.error('❌ Error loading drug data from Google Sheets:', error);
            throw error;
        }
    }

    // Extract drug names từ database (copy từ groqChatbotDrug.js)
    extractDrugNames() {
        this.knownDrugs.clear();
        
        this.documents.forEach(doc => {
            if (doc.title) {
                this.knownDrugs.add(doc.title.toLowerCase());
                
                const drugWords = doc.title.split(/\s+/);
                drugWords.forEach(word => {
                    if (word.length > 3) {
                        this.knownDrugs.add(word.toLowerCase());
                    }
                });
            }
            
            if (doc.rawData) {
                const altNames = doc.rawData['Tên khác'] || doc.rawData['Alternative Names'] || '';
                if (altNames) {
                    const alternativeNames = altNames.split(/[,;\n]/);
                    alternativeNames.forEach(altName => {
                        const cleanName = altName.trim().toLowerCase();
                        if (cleanName.length > 2) {
                            this.knownDrugs.add(cleanName);
                        }
                    });
                }
            }
        });
    }

    // Validate drug query (copy từ groqChatbotDrug.js)
    validateDrugQuery(query) {
        const processedQuery = query.toLowerCase();
        
        const drugQuestionPatterns = [
            /thuoc|thuốc/i,
            /lieu\s*luong|liều\s*lượng/i,
            /lieu\s*dung|liều\s*dùng/i,
            /chi\s*dinh|chỉ\s*định/i,
            /chong\s*chi\s*dinh|chống\s*chỉ\s*định/i,
            /tac\s*dung|tác\s*dụng/i,
            /phu\s*tac\s*dung|phụ\s*tác\s*dụng/i,
            /cach\s*dung|cách\s*dùng/i,
            /dieu\s*tri|điều\s*trị/i,
            /than\s*trong|thận\s*trọng/i,
            /tuong\s*tac|tương\s*tác/i,
            /ngo\s*doc|ngộ\s*độc/i,
            /qua\s*lieu|quá\s*liều/i
        ];
        
        const containsDrugQuestion = drugQuestionPatterns.some(pattern => pattern.test(processedQuery));
        
        if (!containsDrugQuestion) {
            return {
                isValid: false,
                message: "Xin chào! Tôi là hệ thống hỗ trợ thông tin về thuốc nhi khoa. Vui lòng hỏi về thuốc, liều dùng, chỉ định, chống chỉ định, tác dụng phụ, hoặc các thông tin y tế liên quan."
            };
        }
        
        return { isValid: true };
    }

    // Search relevant drugs (copy từ groqChatbotDrug.js)
    async searchRelevantDrugs(query, limit = 5) {
        try {
            const searchTerms = query.toLowerCase().split(/\s+/);
            const scores = [];
            
            this.documents.forEach(doc => {
                let score = 0;
                const docText = (doc.title + ' ' + doc.content).toLowerCase();
                
                searchTerms.forEach(term => {
                    if (term.length > 2) {
                        const termCount = (docText.match(new RegExp(term, 'g')) || []).length;
                        score += termCount * (term.length > 4 ? 2 : 1);
                        
                        if (doc.title.toLowerCase().includes(term)) {
                            score += 10;
                        }
                    }
                });
                
                if (score > 0) {
                    scores.push({ ...doc, score });
                }
            });
            
            return scores.sort((a, b) => b.score - a.score).slice(0, limit);
            
        } catch (error) {
            console.error('❌ Error searching relevant drugs:', error);
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
            
            // Search relevant drugs from Google Sheets
            const relevantDrugs = await this.searchRelevantDrugs(message);
            
            if (relevantDrugs.length === 0) {
                return {
                    success: true,
                    data: {
                        message: "Không tìm thấy thông tin liên quan về thuốc trong cơ sở dữ liệu. Vui lòng kiểm tra lại tên thuốc hoặc từ khóa.",
                        isAiGenerated: false
                    }
                };
            }
            
            // Prepare context for OpenAI from Google Sheets drug data
            const context = relevantDrugs.map(drug => {
                return `Thuốc: ${drug.title}\nThông tin chi tiết:\n${drug.content}`;
            }).join('\n\n---\n\n');
            
            // Create messages for OpenAI với prompt cải tiến như Gemini
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
                max_tokens: 800,
                temperature: 0.2
            });

            const aiAnswer = completion.choices[0].message.content;
            const responseTime = Date.now() - startTime;
            
            await this.logChatInteraction(userId, message, aiAnswer, responseTime);
            
            return {
                success: true,
                data: {
                    message: aiAnswer,
                    isAiGenerated: true,
                    responseTime: responseTime,
                    modelUsed: 'OpenAI GPT-4o-mini',
                    relevantDrugsCount: relevantDrugs.length,
                    relevantDrugs: relevantDrugs.map(d => d.title)
                }
            };
            
        } catch (error) {
            console.error('❌ OpenAI GPT chat error:', error);
            
            return {
                success: false,
                message: 'Có lỗi xảy ra với OpenAI GPT. Vui lòng thử lại sau.',
                error: error.message
            };
        }
    }

    // Log chat interaction
    async logChatInteraction(userId, question, answer, responseTime) {
        try {
            console.log(`📊 OpenAI Chat Log - User: ${userId}, Response Time: ${responseTime}ms`);
        } catch (error) {
            console.error('❌ Error logging chat interaction:', error);
        }
    }

    // Health check
    async healthCheck() {
        return {
            service: 'OpenAI GPT Chatbot',
            status: this.isInitialized ? 'ready' : 'initializing',
            documentsLoaded: this.documents.length,
            knownDrugsCount: this.knownDrugs.size,
            hasApiKey: !!this.openaiApiKey
        };
    }
}

module.exports = OpenAIChatbotService;
