// Chatbot service với knowledge base từ local documents
const fs = require('fs').promises;
const path = require('path');

class ChatbotService {
    constructor() {
        this.documents = [];
        this.embeddings = new Map();
        this.isInitialized = false;
    }

    // Initialize chatbot với local documents
    async initialize() {
        try {
            console.log('🤖 Initializing original chatbot service...');
            
            // Load documents from local folder
            await this.loadDocumentsFromFolder();
            console.log(`📚 Loaded ${this.documents.length} documents from local folder`);
            
            if (this.documents.length === 0) {
                console.warn('⚠️ No documents found in backend/documents folder');
                throw new Error('No documents available for training. Please add documents to backend/documents folder.');
            }
            
            // Build simple embeddings for search
            this.buildSimpleEmbeddings();
            
            this.isInitialized = true;
            console.log(`✅ Original chatbot initialized with ${this.documents.length} documents`);
            
            // Log knowledge base sources for debugging
            const sources = [...new Set(this.documents.map(doc => doc.source))];
            console.log('📊 Knowledge base sources:', sources.join(', '));
            
        } catch (error) {
            console.error('❌ Failed to initialize original chatbot:', error);
            throw error;
        }
    }

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
                    console.log(`� Loaded: ${file} (${content.length} characters)`);
                }
            }
            
        } catch (error) {
            console.error('❌ Error loading documents from folder:', error);
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
        
        // Extract drug names from knowledge base
        this.extractDrugNames();
        
        console.log(`✅ Built embeddings for ${this.embeddings.size} documents`);
    }

    // Extract drug names from knowledge base
    extractDrugNames() {
        this.knownDrugs = new Set();
        
        this.documents.forEach(doc => {
            const content = this.preprocessVietnameseText(doc.content);
            
            // Enhanced drug name patterns based on real Google Drive format
            const drugPatterns = [
                // Direct drug names from document titles/headers
                /^([a-zA-Z]+)\s*\.?docx?/gm,
                /the\s+\d+\s+([a-zA-Z]+)/g,
                
                // Common pediatric drugs from real medical documents
                /linezolid/g,
                /paracetamol|acetaminophen/g,
                /amoxicillin|amoxicilin/g,
                /ibuprofen/g,
                /cetirizine/g,
                /salbutamol/g,
                /prednisolone|prednisone/g,
                /azithromycin/g,
                /cefixime|cephalexin|cefuroxime/g,
                /omeprazole|lansoprazole|esomeprazole/g,
                /domperidone/g,
                /oresol|oralit/g,
                /zinc|kem/g,
                /vitamin\s*[a-z0-9]+/g,
                /ferro\w*|sat|iron/g,
                /calcium|canxi/g,
                /clarithromycin/g,
                /erythromycin/g,
                /cotrimoxazole|bactrim/g,
                /metronidazole/g,
                /ciprofloxacin/g,
                /fluconazole/g,
                /ketoconazole/g,
                /clotrimazole/g,
                /betamethasone/g,
                /hydrocortisone/g,
                /dexamethasone/g,
                /loratadine/g,
                /chlorpheniramine/g,
                /montelukast/g,
                /theophylline/g,
                /aminophylline/g,
                /vancomycin/g,
                /gentamicin/g,
                /ceftriaxone/g,
                /ceftazidime/g,
                /meropenem/g,
                /imipenem/g,
                /piperacillin/g,
                /tazobactam/g,
                
                // Vietnamese drug context patterns
                /thuốc\s+([a-zA-Z]+)/g,
                /viên\s+([a-zA-Z]+)/g,
                /siro\s+([a-zA-Z]+)/g,
                /gel\s+([a-zA-Z]+)/g,
                /kem\s+([a-zA-Z]+)/g,
                /tiêm\s+([a-zA-Z]+)/g,
                /nhỏ\s+([a-zA-Z]+)/g
            ];
            
            [...drugPatterns].forEach(pattern => {
                const matches = content.match(pattern);
                if (matches) {
                    matches.forEach(match => {
                        let drugName = match
                            .replace(/thuốc\s+|viên\s+|siro\s+|gel\s+|kem\s+|tiêm\s+|nhỏ\s+/g, '')
                            .replace(/\.?docx?$/i, '')
                            .replace(/^the\s+\d+\s+/g, '')
                            .trim()
                            .toLowerCase();
                        
                        if (drugName.length > 2 && /^[a-z]+$/i.test(drugName)) {
                            this.knownDrugs.add(drugName);
                        }
                    });
                }
            });
        });
        
        console.log(`💊 Extracted ${this.knownDrugs.size} known drugs from knowledge base`);
        console.log(`📝 Known drugs: ${Array.from(this.knownDrugs).slice(0, 15).join(', ')}`);
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

    // Validate if query is about drugs in knowledge base
    validateDrugQuery(query) {
        const processedQuery = this.preprocessVietnameseText(query);
        
        // Check if query is asking about drugs
        const drugQuestionPatterns = [
            /thuoc|thuốc/i,
            /lieu\s*luong|liều\s*lượng/i,
            /tac\s*dung|tác\s*dụng/i,
            /phu|phụ/i,
            /chi\s*dinh|chỉ\s*định/i,
            /chong\s*chi\s*dinh|chống\s*chỉ\s*định/i,
            /dung|dùng/i,
            /uong|uống/i,
            /su\s*dung|sử\s*dụng/i,
            /viên|siro|gel|kem|nước/i,
            /mg|ml|gram|gam/i,
            /ngày|lần|buổi/i
        ];
        
        const isDrugQuery = drugQuestionPatterns.some(pattern => pattern.test(query));
        
        if (!isDrugQuery) {
            return { isValid: true, reason: 'not_drug_question' };
        }
        
        // Extract mentioned drug names from query
        const mentionedDrugs = [];
        this.knownDrugs.forEach(drug => {
            const drugPattern = new RegExp(drug, 'i');
            if (drugPattern.test(query)) {
                mentionedDrugs.push(drug);
            }
        });
        
        if (mentionedDrugs.length === 0) {
            const knownDrugsList = Array.from(this.knownDrugs).slice(0, 15).join(', ');
            return { 
                isValid: false, 
                reason: 'unknown_drug',
                message: `Xin lỗi, tôi không tìm thấy thông tin về thuốc này trong cơ sở dữ liệu y tế. Tôi chỉ có thể trả lời về các thuốc đã được lưu trong hệ thống như: ${knownDrugsList}. Vui lòng hỏi về một trong những thuốc này hoặc kiểm tra lại tên thuốc.`
            };
        }
        
        return { isValid: true, mentionedDrugs };
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
        
        // Set strict confidence threshold - only answer if confidence > 40%
        const CONFIDENCE_THRESHOLD = 0.4;
        
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
            
            // Validate drug query first
            const validation = this.validateDrugQuery(message);
            if (!validation.isValid) {
                return {
                    success: true,
                    data: {
                        answer: validation.message,
                        confidence: 0,
                        responseTime: 0
                    }
                };
            }
            
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
                responseTime
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
            // Process medical content with enhanced processor for real Google Drive format
            const processedContent = this.enhancedProcessor.processRealMedicalDocument(content, title);
            
            if (!processedContent) {
                console.log(`⚠️ Could not process document: ${title}`);
                return { success: false, error: 'Document processing failed' };
            }
            
            const newDoc = {
                id: Date.now().toString(),
                title,
                content: processedContent.content,
                source,
                addedAt: new Date().toISOString(),
                drugName: processedContent.drugName,
                drugClass: processedContent.drugClass,
                sections: processedContent.sections,
                medicalData: processedContent.medicalData,
                qualityScore: processedContent.qualityScore
            };
            
            this.documents.push(newDoc);
            await this.saveKnowledgeBase();
            this.buildSimpleEmbeddings();
            
            console.log(`📄 Added new document: "${processedContent.drugName}" (Quality: ${processedContent.qualityScore}%)`);
            console.log(`💊 Drug class: ${processedContent.drugClass}`);
            console.log(`📋 Sections: ${Object.keys(processedContent.sections).join(', ')}`);
            
            return { 
                success: true, 
                documentId: newDoc.id,
                drugName: processedContent.drugName,
                qualityScore: processedContent.qualityScore
            };
            
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
