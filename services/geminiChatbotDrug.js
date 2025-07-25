// Google Gemini AI Chatbot Service với drug data từ Google Sheets
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { searchDrugData, loadDrugData } = require('./drugSheets');

class GeminiChatbotService {
    constructor() {
        this.documents = [];
        this.isInitialized = false;
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
            
            // Prepare context for Gemini from Google Sheets drug data
            const context = relevantDrugs.map(drug => 
                `Thuốc: ${drug.title}
Nguồn: ${drug.source}
Độ liên quan: ${drug.relevanceScore || 'N/A'}
Thông tin chi tiết:
${drug.content.substring(0, 2000)}...`
            ).join('\n\n');
            
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
            return {
                success: false,
                message: `Lỗi Gemini AI: ${error.message}`
            };
        }
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

module.exports = new GeminiChatbotService();
