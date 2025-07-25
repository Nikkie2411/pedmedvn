// Groq AI Chatbot Service - Free & Ultra Fast
const Groq = require('groq-sdk');
const { searchDrugData, loadDrugData } = require('./drugSheets');

class GroqChatbotService {
    constructor() {
        this.documents = [];
        this.isInitialized = false;
        this.knownDrugs = new Set();
        this.dailyRequestCount = 0;
        this.quotaExceeded = false;
        
        // Initialize Groq AI - FREE với 14,400 requests/day
        this.groqApiKey = process.env.GROQ_API_KEY; // Free tại console.groq.com
        if (this.groqApiKey) {
            this.groq = new Groq({
                apiKey: this.groqApiKey
            });
            this.modelName = 'llama-3.1-70b-versatile'; // Hoặc 'mixtral-8x7b-32768'
            console.log('✅ Groq AI initialized - Free & Ultra Fast!');
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

    // Main chat function với Groq AI
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
            
            // Search relevant drugs from Google Sheets
            const relevantDrugs = await this.searchRelevantDrugs(message);
            
            if (relevantDrugs.length === 0) {
                return {
                    success: true,
                    data: {
                        message: "Không tìm thấy thông tin liên quan về thuốc trong cơ sở dữ liệu. Vui lòng kiểm tra lại tên thuốc hoặc từ khóa.",
                        isAiGenerated: false,
                        model: 'Groq Search'
                    }
                };
            }
            
            // Prepare context for Groq from Google Sheets drug data
            const context = relevantDrugs.map(drug => 
                `Thuốc: ${drug.title}
Nguồn: ${drug.source}
Độ liên quan: ${drug.relevanceScore || 'N/A'}
Thông tin chi tiết:
${drug.content.substring(0, 2000)}...`
            ).join('\n\n');
            
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

    // Generate fallback response when AI fails
    generateFallbackResponse(relevantDrugs, query) {
        if (!relevantDrugs || relevantDrugs.length === 0) {
            return "Xin lỗi, không tìm thấy thông tin về thuốc bạn hỏi trong cơ sở dữ liệu. Vui lòng thử lại với tên thuốc khác.";
        }

        const topDrug = relevantDrugs[0];
        const drugName = topDrug.title || topDrug.name;
        const content = topDrug.content || '';
        const queryLower = query.toLowerCase();
        
        let response = `**Thông tin về ${drugName}:**\n\n`;
        
        // Add relevant sections based on query
        if (queryLower.includes('liều') || queryLower.includes('dose')) {
            const doseInfo = this.extractSection(content, ['liều', 'dose', '2.1.', '2.2.', '2.3.', '2.4.']);
            if (doseInfo) response += `📊 **Liều dùng:**\n${doseInfo}\n\n`;
        }
        
        if (queryLower.includes('tác dụng phụ') || queryLower.includes('side effect')) {
            const sideEffects = this.extractSection(content, ['tác dụng phụ', 'side effect', '4.']);
            if (sideEffects) response += `⚠️ **Tác dụng phụ:**\n${sideEffects}\n\n`;
        }
        
        if (queryLower.includes('chống chỉ định')) {
            const contraindications = this.extractSection(content, ['chống chỉ định', '3.']);
            if (contraindications) response += `🚫 **Chống chỉ định:**\n${contraindications}\n\n`;
        }
        
        if (queryLower.includes('tương tác')) {
            const interactions = this.extractSection(content, ['tương tác', '6.']);
            if (interactions) response += `🔄 **Tương tác thuốc:**\n${interactions}\n\n`;
        }
        
        if (queryLower.includes('cách dùng')) {
            const usage = this.extractSection(content, ['cách dùng', '5.']);
            if (usage) response += `💊 **Cách dùng:**\n${usage}\n\n`;
        }
        
        // If no specific section found, show general info
        if (response === `**Thông tin về ${drugName}:**\n\n`) {
            response += content.substring(0, 500) + (content.length > 500 ? '...' : '') + '\n\n';
        }
        
        response += `\n⚠️ **Lưu ý quan trọng:** Đây là thông tin tham khảo từ cơ sở dữ liệu. Vui lòng tham khảo bác sĩ hoặc dược sĩ trước khi sử dụng thuốc.`;
        
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
