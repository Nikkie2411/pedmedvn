// Chatbot service với knowledge base từ Google Sheets
const { searchDrugData, loadDrugData } = require('./drugSheets');

class ChatbotService {
    constructor() {
        this.documents = [];
        this.embeddings = new Map();
        this.isInitialized = false;
    }

    // Initialize chatbot với Google Sheets drug data
    async initialize() {
        try {
            console.log('🤖 Initializing original chatbot service with Google Sheets...');
            
            // Load drug data from Google Sheets
            await this.loadDrugDataFromSheets();
            console.log(`💊 Loaded ${this.documents.length} drugs from Google Sheets`);
            
            if (this.documents.length === 0) {
                console.warn('⚠️ No drug data found in Google Sheets');
                throw new Error('No drug data available in Google Sheets. Please add drug information to the sheet.');
            }
            
            // Build simple embeddings for search
            this.buildSimpleEmbeddings();
            
            this.isInitialized = true;
            console.log(`✅ Original chatbot initialized with ${this.documents.length} drugs from Google Sheets`);
            
            // Log knowledge base sources for debugging
            const sources = [...new Set(this.documents.map(doc => doc.source))];
            console.log('📊 Knowledge base sources:', sources.join(', '));
            
        } catch (error) {
            console.error('❌ Failed to initialize original chatbot:', error);
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

    // Extract drug names for validation
    extractDrugNames() {
        const knownDrugs = new Set();
        
        this.documents.forEach(doc => {
            // Extract from title (drug name)
            if (doc.title) {
                knownDrugs.add(doc.title.toLowerCase());
                
                // Also add individual words from drug name
                const drugWords = doc.title.split(/\s+/);
                drugWords.forEach(word => {
                    if (word.length > 3) {
                        knownDrugs.add(word.toLowerCase());
                    }
                });
            }
        });
        
        console.log(`💊 Extracted ${knownDrugs.size} known drugs`);
        return knownDrugs;
    }

    // Build simple embeddings for search (fallback when no AI available)
    buildSimpleEmbeddings() {
        console.log('🔍 Building search embeddings...');
        
        this.documents.forEach(doc => {
            const words = this.preprocessVietnameseText(doc.content + ' ' + doc.title).split(' ');
            const wordFreq = {};
            
            words.forEach(word => {
                if (word.length > 2) {
                    wordFreq[word] = (wordFreq[word] || 0) + 1;
                }
            });
            
            this.embeddings.set(doc.id, wordFreq);
        });
        
        console.log(`✅ Built embeddings for ${this.documents.length} documents`);
    }

    // Simple search using word frequency
    searchDocuments(query, limit = 3) {
        if (!this.isInitialized || this.documents.length === 0) {
            return [];
        }

        const queryWords = this.preprocessVietnameseText(query).split(' ').filter(word => word.length > 2);
        const scores = [];

        this.documents.forEach(doc => {
            let score = 0;
            const embedding = this.embeddings.get(doc.id) || {};
            
            // Title matching (higher priority)
            const titleWords = this.preprocessVietnameseText(doc.title).split(' ');
            queryWords.forEach(qWord => {
                titleWords.forEach(tWord => {
                    if (tWord.includes(qWord) || qWord.includes(tWord)) {
                        score += 10;
                    }
                });
            });
            
            // Content matching
            queryWords.forEach(word => {
                if (embedding[word]) {
                    score += embedding[word] * 2;
                }
            });
            
            if (score > 0) {
                scores.push({
                    ...doc,
                    score
                });
            }
        });

        return scores
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    // Main chat function (simple fallback)
    async chat(message, userId = 'anonymous') {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            console.log(`🤖 Original chatbot request from ${userId}: "${message}"`);

            // Search for relevant documents
            const relevantDocs = this.searchDocuments(message);
            
            if (relevantDocs.length === 0) {
                return {
                    success: true,
                    data: {
                        message: "Tôi không tìm thấy thông tin liên quan trong cơ sở dữ liệu. Vui lòng thử lại với từ khóa khác hoặc tên thuốc cụ thể.",
                        isAiGenerated: false
                    }
                };
            }

            // Generate enhanced response based on query intent and drug data
            const topDoc = relevantDocs[0];
            let response = '';
            
            // Check if this is a contraindication query
            const isContraindicationQuery = message.toLowerCase().includes('chống chỉ định') || 
                                          message.toLowerCase().includes('không được dùng') ||
                                          message.toLowerCase().includes('cấm') ||
                                          message.toLowerCase().includes('tránh');
            
            const isDosageQuery = message.toLowerCase().includes('liều') || 
                                message.toLowerCase().includes('dose') ||
                                message.toLowerCase().includes('bao nhiêu');
            
            const isSideEffectQuery = message.toLowerCase().includes('tác dụng phụ') ||
                                    message.toLowerCase().includes('side effect') ||
                                    message.toLowerCase().includes('phản ứng');

            // Extract structured information from content
            const lines = topDoc.content.split('\n');
            const drugInfo = {};
            
            lines.forEach(line => {
                const lowerLine = line.toLowerCase();
                if (lowerLine.includes('3. chống chỉ định:')) {
                    drugInfo.contraindications = line.split(':')[1]?.trim();
                } else if (lowerLine.includes('2.2. liều thông thường trẻ em:')) {
                    drugInfo.dosage = line.split(':')[1]?.trim();
                } else if (lowerLine.includes('2.1. liều thông thường trẻ sơ sinh:')) {
                    drugInfo.newbornDosage = line.split(':')[1]?.trim();
                } else if (lowerLine.includes('4. tác dụng không mong muốn')) {
                    drugInfo.sideEffects = line.split(':')[1]?.trim();
                } else if (lowerLine.includes('1. phân loại dược lý:')) {
                    drugInfo.classification = line.split(':')[1]?.trim();
                } else if (lowerLine.includes('6. tương tác thuốc:')) {
                    drugInfo.interactions = line.split(':')[1]?.trim();
                } else if (lowerLine.includes('5. cách dùng')) {
                    drugInfo.administration = line.split(':')[1]?.trim();
                } else if (lowerLine.includes('8. theo dõi điều trị:')) {
                    drugInfo.monitoring = line.split(':')[1]?.trim();
                }
            });

            // Generate targeted response based on query
            if (isContraindicationQuery && drugInfo.contraindications) {
                response = `🚨 **CHỐNG CHỈ ĐỊNH ${topDoc.title.toUpperCase()}:**\n\n`;
                response += `⛔ ${drugInfo.contraindications}\n\n`;
                
                if (drugInfo.monitoring) {
                    response += `📊 **THEO DÕI ĐIỀU TRỊ:**\n${drugInfo.monitoring}\n\n`;
                }
                
                response += `💡 **Lý do quan trọng:** Chống chỉ định là những tình huống tuyệt đối KHÔNG được sử dụng thuốc vì có thể gây nguy hiểm nghiêm trọng cho bệnh nhân.`;
                
            } else if (isDosageQuery) {
                response = `💊 **LIỀU DÙNG ${topDoc.title.toUpperCase()}:**\n\n`;
                
                if (drugInfo.newbornDosage) {
                    response += `� **Trẻ sơ sinh:** ${drugInfo.newbornDosage}\n\n`;
                }
                
                if (drugInfo.dosage) {
                    response += `🧒 **Trẻ em:** ${drugInfo.dosage}\n\n`;
                }
                
                if (drugInfo.contraindications) {
                    response += `⚠️ **Chống chỉ định:** ${drugInfo.contraindications}\n\n`;
                }
                
                if (drugInfo.administration) {
                    response += `📋 **Cách dùng:** ${drugInfo.administration}\n\n`;
                }
                
            } else if (isSideEffectQuery && drugInfo.sideEffects) {
                response = `⚡ **TÁC DỤNG KHÔNG MONG MUỐN ${topDoc.title.toUpperCase()}:**\n\n`;
                response += `🔍 ${drugInfo.sideEffects}\n\n`;
                
                if (drugInfo.monitoring) {
                    response += `📊 **Theo dõi:** ${drugInfo.monitoring}\n\n`;
                }
                
            } else {
                // General response with key information
                response = `📋 **THÔNG TIN ${topDoc.title.toUpperCase()}:**\n\n`;
                
                if (drugInfo.classification) {
                    response += `🏷️ **Phân loại:** ${drugInfo.classification}\n\n`;
                }
                
                // Always show contraindications first for safety
                if (drugInfo.contraindications) {
                    response += `🚨 **Chống chỉ định:** ${drugInfo.contraindications}\n\n`;
                }
                
                if (drugInfo.dosage) {
                    response += `💊 **Liều dùng trẻ em:** ${drugInfo.dosage}\n\n`;
                }
                
                if (drugInfo.newbornDosage) {
                    response += `👶 **Liều dùng trẻ sơ sinh:** ${drugInfo.newbornDosage}\n\n`;
                }
                
                if (drugInfo.sideEffects) {
                    response += `⚡ **Tác dụng không mong muốn:** ${drugInfo.sideEffects}\n\n`;
                }
                
                if (drugInfo.interactions) {
                    response += `🔄 **Tương tác thuốc:** ${drugInfo.interactions}\n\n`;
                }
            }
            
            response += '\n⚠️ **QUAN TRỌNG:** Thông tin này chỉ mang tính chất tham khảo. Luôn tham khảo ý kiến bác sĩ hoặc dược sĩ trước khi sử dụng thuốc, đặc biệt với trẻ em.';

            return {
                success: true,
                data: {
                    message: response,
                    isAiGenerated: false,
                    model: 'Simple Search',
                    sources: relevantDocs.map(d => ({
                        title: d.title || 'Unknown document',
                        source: d.source || 'Knowledge Base', 
                        confidence: 85 // Medium confidence for simple search
                    }))
                }
            };

        } catch (error) {
            console.error('❌ Original chatbot error:', error);
            return {
                success: false,
                message: `Lỗi chatbot: ${error.message}`
            };
        }
    }

    // Get chatbot stats
    getStats() {
        return {
            totalDocuments: this.documents.length,
            isInitialized: this.isInitialized,
            modelUsed: 'Simple Search',
            dataSource: 'Google Sheets'
        };
    }
}

module.exports = ChatbotService;
