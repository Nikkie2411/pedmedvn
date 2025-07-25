// Google Gemini AI Chatbot Service với drug data từ Google Sheets
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { searchDrugData, loadDrugData } = require('./drugSheets');

class GeminiChatbotService {
    constructor() {
        this.documents = [];
        this.isInitialized = false;
        this.knownDrugs = new Set();
        this.dailyRequestCount = 0; // Track daily requests
        this.quotaExceeded = false; // Track quota status
        
        // Initialize Gemini AI
        this.geminiApiKey = process.env.GEMINI_API_KEY; // Miễn phí tại ai.google.dev
        if (this.geminiApiKey) {
            this.genAI = new GoogleGenerativeAI(this.geminiApiKey);
            this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Miễn phí
            console.log('✅ Gemini AI initialized with API key found:', this.geminiApiKey ? 'Yes' : 'No');
        } else {
            console.warn('⚠️ Gemini API key not found. Set GEMINI_API_KEY in environment variables.');
        }
    }

    // Initialize với Google Sheets drug data
    async initialize() {
        try {
            console.log('🤖 Initializing Gemini AI chatbot service with drug data from Google Sheets...');
            
            // Load drug database from Google Sheets
            await this.loadDrugDataFromSheets();
            console.log(`💊 Loaded ${this.documents.length} drugs from Google Sheets`);
            
            if (this.documents.length === 0) {
                console.warn('⚠️ No drug data found in Google Sheets');
                throw new Error('No drug data available. Please add drug information to the Google Sheets.');
            }
            
            this.extractDrugNames();
            this.isInitialized = true;
            
            console.log(`✅ Gemini AI chatbot initialized with ${this.documents.length} drugs`);
            console.log(`💊 Known drugs: ${Array.from(this.knownDrugs).slice(0, 5).join(', ')}...`);
            
        } catch (error) {
            console.error('❌ Failed to initialize Gemini AI chatbot:', error);
            throw error;
        }
    }

    // Load drug data từ Google Sheets
    async loadDrugDataFromSheets() {
        try {
            const drugData = await loadDrugData('pedmedvnch'); // Tên sheet chứa dữ liệu thuốc
            
            console.log(`💊 Found ${drugData.length} drugs in Google Sheets`);
            
            this.documents = [];
            
            drugData.forEach((drug, index) => {
                // Create a document structure from drug data
                const doc = {
                    id: drug.id,
                    title: drug.name,
                    content: drug.structuredContent,
                    source: drug.source,
                    lastUpdated: drug.lastUpdated,
                    type: drug.type,
                    rawData: drug.originalData // Keep original sheet data for reference
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
            // Extract from title (drug name)
            if (doc.title) {
                this.knownDrugs.add(doc.title.toLowerCase());
                
                // Also add individual words from drug name
                const drugWords = doc.title.split(/\s+/);
                drugWords.forEach(word => {
                    if (word.length > 3) {
                        this.knownDrugs.add(word.toLowerCase());
                    }
                });
            }
            
            // Extract from raw data if available
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

    // Validate nếu câu hỏi về thuốc có trong database
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

        // Check if query mentions any known drugs
        for (const drug of this.knownDrugs) {
            if (queryLower.includes(drug)) {
                mentionedDrugs.push(drug);
            }
        }

        // If no known drugs mentioned, check for general medical terms
        const medicalTerms = [
            'thuốc', 'medication', 'medicine', 'drug', 'treatment', 'liều', 'dose', 'dosage',
            'tác dụng', 'effect', 'side effect', 'phản ứng', 'chống chỉ định', 'contraindication',
            'uống', 'take', 'sử dụng', 'use', 'cách dùng', 'how to use', 'bảo quản', 'storage',
            // Bổ sung thêm từ khóa từ headers mới
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

Vui lòng hỏi về một trong những thuốc này hoặc sử dụng các từ khóa y tế như "thuốc", "liều dùng", "tác dụng phụ", v.v.`
            };
        }
        
        return { isValid: true, mentionedDrugs };
    }

    // Search relevant drugs using Google Sheets
    async searchRelevantDrugs(query, limit = 3) {
        try {
            // Use the drug search for more accurate results
            const searchResults = await searchDrugData(query, 'pedmedvnch', limit);
            
            if (searchResults.length > 0) {
                console.log(`🔍 Found ${searchResults.length} relevant drugs from Sheets`);
                return searchResults.map(result => ({
                    title: result.name,
                    content: result.structuredContent,
                    source: result.source,
                    relevanceScore: result.relevanceScore,
                    rawData: result.originalData
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
                
                // Drug name exact match (highest priority)
                if (titleLower.includes(queryLower)) score += 100;
                
                // Content exact phrase match
                if (contentLower.includes(queryLower)) score += 50;
                
                // Word-based matching
                const queryWords = queryLower.split(/\s+/);
                queryWords.forEach(word => {
                    if (word.length > 2) {
                        if (titleLower.includes(word)) score += 30;
                        if (contentLower.includes(word)) score += 15;
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
                
        } catch (error) {
            console.error('❌ Error searching relevant drugs:', error);
            return [];
        }
    }

    // Main chat function với Gemini AI
    async chat(message, userId = 'anonymous') {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            if (!this.geminiApiKey || !this.model) {
                return {
                    success: false,
                    message: 'Gemini AI chưa được cấu hình. Vui lòng thêm GEMINI_API_KEY vào environment variables.'
                };
            }

            console.log(`🤖 Gemini AI request from ${userId}: "${message}"`);
            
            // Validate drug-related query
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
            
            // Prepare context for Gemini from Google Sheets drug data với đầy đủ thông tin
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
            
            // Create enhanced prompt for Gemini with drug data
            const prompt = `Bạn là một dược sĩ chuyên nghiệp hỗ trợ tư vấn thông tin về thuốc. Hãy trả lời câu hỏi dựa CHÍNH XÁC trên thông tin thuốc được cung cấp từ cơ sở dữ liệu.

QUAN TRỌNG:
- Chỉ sử dụng thông tin từ cơ sở dữ liệu thuốc được cung cấp
- Không bịa đặt thông tin về thuốc
- Trả lời bằng tiếng Việt chuyên nghiệp
- Nếu không có đủ thông tin, hãy nói rõ và khuyên bạn tham khảo bác sĩ/dược sĩ
- Luôn nhấn mạnh tầm quan trọng của việc tham khảo chuyên gia y tế
- Nội dung HTML đã được xử lý thành văn bản thuần

CƠ SỞ DỮ LIỆU THUỐC:
${context}

CÂU HỎI: ${message}

Hãy trả lời một cách chi tiết, chính xác và an toàn. Luôn kết thúc bằng lời khuyên tham khảo bác sĩ/dược sĩ:`;

            // Call Gemini AI
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const aiAnswer = response.text();
            
            const responseTime = Date.now() - startTime;
            
            // Log interaction
            await this.logChatInteraction(userId, message, aiAnswer, responseTime);
            
            console.log(`✅ Gemini AI response generated in ${responseTime}ms`);
            
                return {
                success: true,
                data: {
                    message: aiAnswer,
                    isAiGenerated: true,
                    model: 'Gemini 1.5 Flash',
                    responseTime: responseTime,
                    relevantDrugs: relevantDrugs.length,
                    sources: relevantDrugs.map(d => ({
                        title: d.name || d.title || 'Unknown drug',
                        source: d.source || 'Google Sheets',
                        confidence: 95 // High confidence since it's from our drug database
                    }))
                }
            };        } catch (error) {
            console.error('❌ Gemini AI chat error:', error);
            
            // Check if it's a quota exceeded error
            if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('Too Many Requests')) {
                console.warn('⚠️ Gemini AI quota exceeded. Switching to fallback mode.');
                this.quotaExceeded = true;
                
                // Fallback to simple database response when quota exceeded
                const fallbackResponse = this.generateFallbackResponse(relevantDrugs, message);
                return {
                    success: true,
                    data: {
                        message: fallbackResponse,
                        isAiGenerated: false,
                        model: 'Fallback (Quota exceeded)',
                        note: 'AI đã vượt quá giới hạn miễn phí hôm nay (50 câu hỏi/ngày). Đây là phản hồi từ cơ sở dữ liệu thuốc.',
                        relevantDrugs: relevantDrugs.length,
                        sources: relevantDrugs.map(d => ({
                            title: d.name || d.title || 'Unknown drug',
                            source: d.source || 'Google Sheets',
                            confidence: 90
                        }))
                    }
                };
            }
            
            return {
                success: false,
                message: `Lỗi Gemini AI: ${error.message}`
            };
        }
    }

    // Generate fallback response when AI quota exceeded - với đầy đủ thông tin từ Google Sheets
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
            response += `� **BẢO HIỂM Y TẾ THANH TOÁN:**\n${data['Bảo hiểm y tế thanh toán']}\n\n`;
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
            
            // Check if this line starts a relevant section
            if (keywords.some(keyword => lineLower.includes(keyword.toLowerCase()))) {
                capturing = true;
                relevantLines.push(line);
                continue;
            }
            
            // If we're capturing and hit another section header, stop
            if (capturing && line.match(/^[0-9]+\.|^[A-Z][^:]*:/) && !keywords.some(k => lineLower.includes(k.toLowerCase()))) {
                break;
            }
            
            // Continue capturing if we're in a relevant section
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
            maxDailyRequests: 50, // Gemini free tier limit
            remaining: Math.max(0, 50 - this.dailyRequestCount)
        };
    }

    // Reset quota (call this daily or when needed)
    resetQuota() {
        this.quotaExceeded = false;
        this.dailyRequestCount = 0;
        console.log('🔄 Gemini AI quota reset');
    }

    // Log chat interaction
    async logChatInteraction(userId, message, response, responseTime) {
        try {
            const logEntry = {
                timestamp: new Date().toISOString(),
                userId,
                model: 'Gemini',
                message: message.substring(0, 500),
                response: response.substring(0, 1000),
                responseTime,
                success: true
            };
            
            console.log(`📝 Chat logged: ${userId} - ${responseTime}ms`);
        } catch (error) {
            console.error('❌ Error logging chat interaction:', error);
        }
    }

    // Add new drug to the knowledge base
    async addDrug(drugData) {
        try {
            // This would typically update the Google Sheet
            // For now, we'll just refresh the cache
            console.log(`➕ Adding new drug: ${drugData.name}`);
            
            // Clear cache to force reload
            const { clearDrugCache } = require('./drugSheets');
            clearDrugCache();
            
            // Reinitialize to load new data
            await this.initialize();
            
            return { success: true, message: 'Drug added successfully' };
        } catch (error) {
            console.error('❌ Error adding drug:', error);
            return { success: false, message: `Error adding drug: ${error.message}` };
        }
    }

    // Get statistics
    getStats() {
        return {
            totalDrugs: this.documents.length,
            knownDrugNames: this.knownDrugs.size,
            isInitialized: this.isInitialized,
            modelUsed: 'Gemini 1.5 Flash',
            lastInitialized: new Date().toISOString()
        };
    }
}

module.exports = GeminiChatbotService;
