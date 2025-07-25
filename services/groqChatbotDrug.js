// Groq AI Chatbot Service - Free & Ultra Fast
const Groq = require('groq-sdk');
const { searchDrugData, loadDrugData } = require('./drugSheets');
const EnhancedMedicalQueryProcessor = require('../utils/enhancedMedicalQueryProcessor');

class GroqChatbotService {
    constructor() {
        this.documents = [];
        this.isInitialized = false;
        this.knownDrugs = new Set();
        this.dailyRequestCount = 0;
        this.quotaExceeded = false;
        
        // Initialize Enhanced Medical Query Processor
        this.queryProcessor = new EnhancedMedicalQueryProcessor();
        
        // Initialize Groq AI - FREE với 14,400 requests/day
        this.groqApiKey = process.env.GROQ_API_KEY; // Free tại console.groq.com
        if (this.groqApiKey) {
            this.groq = new Groq({
                apiKey: this.groqApiKey
            });
            this.modelName = 'llama-3.1-8b-instant'; // Updated model - faster và vẫn free
            console.log('✅ Groq AI initialized - Free & Ultra Fast! Key found:', this.groqApiKey ? 'Yes' : 'No');
        } else {
            console.warn('⚠️ Groq API key not found. Get free key at console.groq.com');
        }
    }

    // Initialize với Google Sheets drug data
    async initialize() {
        try {
            console.log('🚀 Initializing Groq AI chatbot service with drug data...');
            
            // Load drug database from Google Sheets
            await this.loadDrugDataFromSheets();
            console.log(`💊 Loaded ${this.documents.length} drugs from Google Sheets`);
            
            if (this.documents.length === 0) {
                console.warn('⚠️ No drug data found in Google Sheets');
                throw new Error('No drug data available. Please add drug information to the Google Sheets.');
            }
            
            this.extractDrugNames();
            this.isInitialized = true;
            
            console.log(`✅ Groq AI chatbot initialized with ${this.documents.length} drugs`);
            console.log(`💊 Known drugs: ${Array.from(this.knownDrugs).slice(0, 5).join(', ')}...`);
            
        } catch (error) {
            console.error('❌ Failed to initialize Groq AI chatbot:', error);
            throw error;
        }
    }

    // Load drug data từ Google Sheets
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

    // Extract drug names từ database
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
                    altNames.split(/[,;]/).forEach(name => {
                        if (name.trim().length > 3) {
                            this.knownDrugs.add(name.trim().toLowerCase());
                        }
                    });
                }
            }
        });
        
        console.log(`💊 Extracted ${this.knownDrugs.size} known drug names`);
    }

    // Validate drug query
    validateDrugQuery(query) {
        if (!query || query.length < 3) {
            return { 
                isValid: false, 
                reason: 'query_too_short',
                message: 'Vui lòng nhập câu hỏi dài hơn 3 ký tự.'
            };
        }

        const queryLower = query.toLowerCase();
        const mentionedDrugs = [];

        for (const drug of this.knownDrugs) {
            if (queryLower.includes(drug)) {
                mentionedDrugs.push(drug);
            }
        }

        const medicalTerms = [
            'thuốc', 'medication', 'medicine', 'drug', 'treatment', 'liều', 'dose', 'dosage',
            'tác dụng', 'effect', 'side effect', 'phản ứng', 'chống chỉ định', 'contraindication',
            'uống', 'take', 'sử dụng', 'use', 'cách dùng', 'how to use', 'bảo quản', 'storage',
            'sơ sinh', 'trẻ em', 'thận', 'gan', 'quá liều', 'theo dõi', 'bảo hiểm', 'y tế',
            'tương tác', 'cách dùng', 'điều trị', 'thanh toán', 'chức năng', 'hiệu chỉnh',
            'mong muốn', 'thận trọng', 'không mong muốn', 'thông thường'
        ];

        const hasMedicalTerms = medicalTerms.some(term => queryLower.includes(term));

        if (mentionedDrugs.length === 0 && !hasMedicalTerms) {
            const knownDrugsList = Array.from(this.knownDrugs)
                .slice(0, 10)
                .map(drug => drug.charAt(0).toUpperCase() + drug.slice(1))
                .join(', ');

            return { 
                isValid: false, 
                reason: 'unknown_drug',
                message: `Xin lỗi, tôi chỉ có thể trả lời về các thuốc có trong cơ sở dữ liệu. 

Một số thuốc tôi có thông tin: ${knownDrugsList}${this.knownDrugs.size > 10 ? '...' : ''}

Vui lòng hỏi về một trong những thuốc này hoặc sử dụng các từ khóa y tế.`
            };
        }
        
        return { isValid: true, mentionedDrugs };
    }

    // Search relevant drugs
    async searchRelevantDrugs(query, limit = 3) {
        try {
            const searchResults = await searchDrugData(query, 'pedmedvnch', limit);
            
            const scores = [];
            searchResults.forEach((drug, index) => {
                const score = drug.relevanceScore || 0;
                
                if (score > 0) {
                    scores.push({
                        index,
                        score,
                        title: drug.name,
                        content: drug.structuredContent,
                        source: drug.source,
                        relevanceScore: score
                    });
                }
            });
            
            return scores.sort((a, b) => b.score - a.score);
                
        } catch (error) {
            console.error('❌ Error searching relevant drugs:', error);
            return [];
        }
    }

    // Main chat function với Enhanced 5-Step Query Processing
    async chat(message, userId = 'anonymous') {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            if (!this.groqApiKey) {
                return {
                    success: false,
                    message: 'Groq AI chưa được cấu hình. Vui lòng thêm GROQ_API_KEY vào environment variables. Đăng ký miễn phí tại console.groq.com'
                };
            }

            console.log(`🚀 Groq AI request from ${userId}: "${message}"`);
            
            // Validate drug-related query
            const validation = this.validateDrugQuery(message);
            if (!validation.isValid) {
                return {
                    success: true,
                    data: {
                        message: validation.message,
                        isAiGenerated: false,
                        model: 'Groq Validation'
                    }
                };
            }
            
            const startTime = Date.now();
            
            // ENHANCED 5-STEP PROCESSING
            console.log('🔍 Using Enhanced 5-Step Medical Query Processing...');
            const processingResult = await this.queryProcessor.processQuery(message, this.documents);
            
            if (processingResult.success) {
                // Direct answer from 5-step processing
                console.log(`✅ Direct answer found with ${processingResult.confidence}% confidence`);
                
                const responseTime = Date.now() - startTime;
                
                return {
                    success: true,
                    data: {
                        message: `${processingResult.message}\n\n⚠️ **QUAN TRỌNG:** Thông tin này chỉ mang tính chất tham khảo. Luôn tham khảo ý kiến bác sĩ hoặc dược sĩ trước khi sử dụng thuốc, đặc biệt với trẻ em.`,
                        isAiGenerated: false,
                        model: "Enhanced 5-Step Processing",
                        sources: [{
                            title: processingResult.drugName,
                            source: `Google Sheets - ${processingResult.category}`,
                            confidence: processingResult.confidence,
                            lastUpdated: processingResult.lastUpdated
                        }],
                        aiProvider: "GROQ",
                        modelUsed: "llama-3.1-8b-instant-enhanced",
                        responseTime: responseTime,
                        processingSteps: 5,
                        directMatch: true
                    }
                };
            }
            
            // Fallback to AI if direct processing fails
            console.log(`⚠️ 5-step processing failed at step ${processingResult.step}, falling back to AI processing...`);
            
            // Search relevant drugs from Google Sheets for AI context
            const relevantDrugs = await this.searchRelevantDrugs(message);
            
            if (relevantDrugs.length === 0) {
                return {
                    success: true,
                    data: {
                        message: `${processingResult.message}\n\nKhông tìm thấy thông tin liên quan về thuốc trong cơ sở dữ liệu. Vui lòng kiểm tra lại tên thuốc hoặc từ khóa.`,
                        isAiGenerated: false,
                        model: 'Groq Search',
                        processingError: processingResult.message
                    }
                };
            }
            
            // Prepare context for Groq from Google Sheets drug data với đầy đủ thông tin
            const context = relevantDrugs.map(drug => {
                const data = drug.rawData || drug.originalData || {};
                
                // Xây dựng thông tin chi tiết từ tất cả các cột
                const drugInfo = [
                    `=== ${drug.title.toUpperCase()} ===`,
                    data['Hoạt chất'] ? `🔬 Hoạt chất: ${data['Hoạt chất']}` : '',
                    data['Phân loại dược lý'] ? `📋 Phân loại dược lý: ${data['Phân loại dược lý']}` : '',
                    '',
                    '💊 LIỀU DÙNG:',
                    data['Liều thông thường trẻ sơ sinh'] ? `👶 Trẻ sơ sinh: ${data['Liều thông thường trẻ sơ sinh']}` : '',
                    data['Liều thông thường trẻ em'] ? `🧒 Trẻ em: ${data['Liều thông thường trẻ em']}` : '',
                    '',
                    '⚕️ HIỆU CHỈNH LIỀU:',
                    data['Hiệu chỉnh liều theo chức năng thận'] ? `🫘 Chức năng thận: ${data['Hiệu chỉnh liều theo chức năng thận']}` : '',
                    data['Hiệu chỉnh liều theo chức năng gan'] ? `🫀 Chức năng gan: ${data['Hiệu chỉnh liều theo chức năng gan']}` : '',
                    '',
                    data['Chống chỉ định'] ? `🚫 CHỐNG CHỈ ĐỊNH: ${data['Chống chỉ định']}` : '',
                    data['Tác dụng không mong muốn'] ? `⚠️ TÁC DỤNG KHÔNG MONG MUỐN: ${data['Tác dụng không mong muốn']}` : '',
                    data['Cách dùng (ngoài IV)'] ? `💉 CÁCH DÙNG: ${data['Cách dùng (ngoài IV)']}` : '',
                    data['Tương tác thuốc chống chỉ định'] ? `⚡ TƯƠNG TÁC THUỐC: ${data['Tương tác thuốc chống chỉ định']}` : '',
                    data['Ngộ độc/Quá liều'] ? `🆘 NGỘ ĐỘC/QUÁ LIỀU: ${data['Ngộ độc/Quá liều']}` : '',
                    data['Các thông số cần theo dõi'] ? `📊 THEO DÕI: ${data['Các thông số cần theo dõi']}` : '',
                    data['Bảo hiểm y tế thanh toán'] ? `💳 BẢO HIỂM Y TẾ: ${data['Bảo hiểm y tế thanh toán']}` : '',
                    data['Cập nhật'] ? `📅 Cập nhật: ${data['Cập nhật']}` : '',
                    `📍 Nguồn: ${drug.source}`,
                    `📈 Độ liên quan: ${drug.relevanceScore || 'N/A'}`
                ].filter(line => line.trim()).join('\n');
                
                return drugInfo;
            }).join('\n\n' + '='.repeat(80) + '\n\n');
            
            // Create enhanced prompt for Groq with drug data
            const prompt = `Bạn là một dược sĩ chuyên nghiệp hỗ trợ tư vấn thông tin về thuốc. Hãy trả lời câu hỏi dựa CHÍNH XÁC trên thông tin thuốc được cung cấp từ cơ sở dữ liệu.

QUAN TRỌNG:
- Chỉ sử dụng thông tin từ cơ sở dữ liệu thuốc được cung cấp
- Không bịa đặt thông tin về thuốc
- Trả lời bằng tiếng Việt chuyên nghiệp
- Nếu không có đủ thông tin, hãy nói rõ và khuyên bạn tham khảo bác sĩ/dược sĩ
- Luôn nhấn mạnh tầm quan trọng của việc tham khảo chuyên gia y tế

CƠ SỞ DỮ LIỆU THUỐC:
${context}

CÂU HỎI: ${message}

Hãy trả lời một cách chi tiết, chính xác và an toàn. Luôn kết thúc bằng lời khuyên tham khảo bác sĩ/dược sĩ:`;

            // Call Groq AI - Ultra Fast & Free!
            const chatCompletion = await this.groq.chat.completions.create({
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                model: this.modelName,
                temperature: 0.3,
                max_tokens: 1000,
                top_p: 1,
                stream: false
            });
            
            const aiAnswer = chatCompletion.choices[0]?.message?.content || 'Không thể tạo phản hồi.';
            const responseTime = Date.now() - startTime;
            
            this.dailyRequestCount++;
            
            // Log interaction
            await this.logChatInteraction(userId, message, aiAnswer, responseTime);
            
            console.log(`✅ Groq AI response generated in ${responseTime}ms (Ultra Fast!)`);
            
            return {
                success: true,
                data: {
                    message: aiAnswer,
                    isAiGenerated: true,
                    model: `Groq ${this.modelName}`,
                    responseTime: responseTime,
                    relevantDrugs: relevantDrugs.length,
                    sources: relevantDrugs.map(d => ({
                        title: d.title || 'Unknown drug',
                        source: d.source || 'Google Sheets',
                        confidence: d.relevanceScore || 90
                    })),
                    note: this.dailyRequestCount > 13000 ? 'Sắp đến giới hạn hàng ngày (14,400 requests)' : null
                }
            };
            
        } catch (error) {
            console.error('❌ Groq AI chat error:', error);
            
            // Fallback to database response when error
            const relevantDrugs = await this.searchRelevantDrugs(message);
            const fallbackResponse = this.generateFallbackResponse(relevantDrugs, message);
            
            return {
                success: true,
                data: {
                    message: fallbackResponse,
                    isAiGenerated: false,
                    model: 'Fallback (Groq Error)',
                    note: `Groq AI tạm thời không khả dụng: ${error.message}. Đây là phản hồi từ cơ sở dữ liệu thuốc.`,
                    relevantDrugs: relevantDrugs.length,
                    sources: relevantDrugs.map(d => ({
                        title: d.title || 'Unknown drug',
                        source: d.source || 'Google Sheets',
                        confidence: 85
                    }))
                }
            };
        }
    }

    // Generate fallback response when AI fails - với đầy đủ thông tin từ Google Sheets
    generateFallbackResponse(relevantDrugs, query) {
        if (!relevantDrugs || relevantDrugs.length === 0) {
            return "Xin lỗi, không tìm thấy thông tin về thuốc bạn hỏi trong cơ sở dữ liệu. Vui lòng thử lại với tên thuốc khác.";
        }

        const topDrug = relevantDrugs[0];
        const drugName = topDrug.title || topDrug.name;
        const data = topDrug.rawData || topDrug.originalData || {};
        
        let response = `📋 **THÔNG TIN THUỐC: ${drugName.toUpperCase()}**\n\n`;
        
        // Hiển thị tất cả thông tin có sẵn từ Google Sheets
        if (data['Hoạt chất']) {
            response += `🔬 **Hoạt chất:** ${data['Hoạt chất']}\n\n`;
        }
        
        if (data['Phân loại dược lý']) {
            response += `� **Phân loại dược lý:** ${data['Phân loại dược lý']}\n\n`;
        }
        
        // Thông tin liều dùng
        response += `💊 **LIỀU DÙNG:**\n`;
        if (data['Liều thông thường trẻ sơ sinh']) {
            response += `👶 **Trẻ sơ sinh:** ${data['Liều thông thường trẻ sơ sinh']}\n`;
        }
        if (data['Liều thông thường trẻ em']) {
            response += `🧒 **Trẻ em:** ${data['Liều thông thường trẻ em']}\n`;
        }
        response += '\n';
        
        // Hiệu chỉnh liều
        response += `⚕️ **HIỆU CHỈNH LIỀU:**\n`;
        if (data['Hiệu chỉnh liều theo chức năng thận']) {
            response += `🫘 **Chức năng thận:** ${data['Hiệu chỉnh liều theo chức năng thận']}\n`;
        }
        if (data['Hiệu chỉnh liều theo chức năng gan']) {
            response += `🫀 **Chức năng gan:** ${data['Hiệu chỉnh liều theo chức năng gan']}\n`;
        }
        response += '\n';
        
        // Chống chỉ định
        if (data['Chống chỉ định']) {
            response += `🚫 **CHỐNG CHỈ ĐỊNH:**\n${data['Chống chỉ định']}\n\n`;
        }
        
        // Tác dụng không mong muốn
        if (data['Tác dụng không mong muốn']) {
            response += `⚠️ **TÁC DỤNG KHÔNG MONG MUỐN:**\n${data['Tác dụng không mong muốn']}\n\n`;
        }
        
        // Cách dùng
        if (data['Cách dùng (ngoài IV)']) {
            response += `💉 **CÁCH DÙNG:**\n${data['Cách dùng (ngoài IV)']}\n\n`;
        }
        
        // Tương tác thuốc
        if (data['Tương tác thuốc chống chỉ định']) {
            response += `⚡ **TƯƠNG TÁC THUỐC CHỐNG CHỈ ĐỊNH:**\n${data['Tương tác thuốc chống chỉ định']}\n\n`;
        }
        
        // Ngộ độc/Quá liều
        if (data['Ngộ độc/Quá liều']) {
            response += `🆘 **NGỘ ĐỘC/QUÁ LIỀU:**\n${data['Ngộ độc/Quá liều']}\n\n`;
        }
        
        // Theo dõi điều trị
        if (data['Các thông số cần theo dõi']) {
            response += `📊 **CÁC THÔNG SỐ CẦN THEO DÕI:**\n${data['Các thông số cần theo dõi']}\n\n`;
        }
        
        // Bảo hiểm y tế
        if (data['Bảo hiểm y tế thanh toán']) {
            response += `💳 **BẢO HIỂM Y TẾ THANH TOÁN:**\n${data['Bảo hiểm y tế thanh toán']}\n\n`;
        }
        
        // Thông tin cập nhật
        if (data['Cập nhật']) {
            response += `📅 **Cập nhật:** ${data['Cập nhật']}\n\n`;
        }
        
        response += `\n🔍 **Nguồn:** ${topDrug.source || 'Google Sheets Database'}\n`;
        response += `📈 **Độ liên quan:** ${topDrug.relevanceScore || 90}%\n\n`;
        response += `⚠️ **LƯU Ý QUAN TRỌNG:** Đây là thông tin tham khảo từ cơ sở dữ liệu chuyên khoa. Vui lòng tham khảo bác sĩ hoặc dược sĩ trước khi sử dụng thuốc.`;
        
        return response;
    }
    
    // Extract specific section from content
    extractSection(content, keywords) {
        const lines = content.split('\n');
        let relevantLines = [];
        let capturing = false;
        
        for (const line of lines) {
            const lineLower = line.toLowerCase();
            
            if (keywords.some(keyword => lineLower.includes(keyword.toLowerCase()))) {
                capturing = true;
                relevantLines.push(line);
                continue;
            }
            
            if (capturing && line.match(/^[0-9]+\.|^[A-Z][^:]*:/) && !keywords.some(k => lineLower.includes(k.toLowerCase()))) {
                break;
            }
            
            if (capturing) {
                relevantLines.push(line);
            }
        }
        
        return relevantLines.length > 1 ? relevantLines.join('\n').trim() : null;
    }

    // Get quota status
    getQuotaStatus() {
        return {
            quotaExceeded: this.quotaExceeded,
            dailyRequestCount: this.dailyRequestCount,
            maxDailyRequests: 14400, // Groq free tier limit
            remaining: Math.max(0, 14400 - this.dailyRequestCount)
        };
    }

    // Reset quota (call this daily)
    resetQuota() {
        this.quotaExceeded = false;
        this.dailyRequestCount = 0;
        console.log('🔄 Groq AI quota reset');
    }

    // Log chat interaction
    async logChatInteraction(userId, message, response, responseTime) {
        try {
            const logEntry = {
                timestamp: new Date().toISOString(),
                userId,
                model: `Groq ${this.modelName}`,
                message: message.substring(0, 500),
                response: response.substring(0, 1000),
                responseTime,
                success: true
            };
            
            console.log(`📝 Groq chat logged: ${userId} - ${responseTime}ms`);
        } catch (error) {
            console.error('❌ Error logging Groq chat interaction:', error);
        }
    }
}

module.exports = GroqChatbotService;
