// Enhanced Medical Query Processor for AI Models
// Implements 5-step systematic approach for drug information queries

class EnhancedMedicalQueryProcessor {
    constructor() {
        // Define medical content categories mapped to sheet headers
        this.contentCategories = {
            // Drug classification
            'phân loại': '1. PHÂN LOẠI DƯỢC LÝ',
            'classification': '1. PHÂN LOẠI DƯỢC LÝ',
            'nhóm thuốc': '1. PHÂN LOẠI DƯỢC LÝ',
            
            // Dosage information
            'liều': ['2.1. LIỀU THÔNG THƯỜNG TRẺ SƠ SINH', '2.2. LIỀU THÔNG THƯỜNG TRẺ EM'],
            'dose': ['2.1. LIỀU THÔNG THƯỜNG TRẺ SƠ SINH', '2.2. LIỀU THÔNG THƯỜNG TRẺ EM'],
            'liều dùng': ['2.1. LIỀU THÔNG THƯỜNG TRẺ SƠ SINH', '2.2. LIỀU THÔNG THƯỜNG TRẺ EM'],
            'liều lượng': ['2.1. LIỀU THÔNG THƯỜNG TRẺ SƠ SINH', '2.2. LIỀU THÔNG THƯỜNG TRẺ EM'],
            'sơ sinh': '2.1. LIỀU THÔNG THƯỜNG TRẺ SƠ SINH',
            'trẻ em': '2.2. LIỀU THÔNG THƯỜNG TRẺ EM',
            'newborn': '2.1. LIỀU THÔNG THƯỜNG TRẺ SƠ SINH',
            'pediatric': '2.2. LIỀU THÔNG THƯỜNG TRẺ EM',
            
            // Kidney/liver adjustments
            'thận': '2.3. HIỆU CHỈNH LIỀU THEO CHỨC NĂNG THẬN',
            'kidney': '2.3. HIỆU CHỈNH LIỀU THEO CHỨC NĂNG THẬN',
            'renal': '2.3. HIỆU CHỈNH LIỀU THEO CHỨC NĂNG THẬN',
            'gan': '2.4. HIỆU CHỈNH LIỀU THEO CHỨC NĂNG GAN',
            'liver': '2.4. HIỆU CHỈNH LIỀU THEO CHỨC NĂNG GAN',
            'hepatic': '2.4. HIỆU CHỈNH LIỀU THEO CHỨC NĂNG GAN',
            
            // Contraindications (highest priority)
            'chống chỉ định': '3. CHỐNG CHỈ ĐỊNH',
            'contraindication': '3. CHỐNG CHỈ ĐỊNH',
            'cấm': '3. CHỐNG CHỈ ĐỊNH',
            'không được': '3. CHỐNG CHỈ ĐỊNH',
            'forbidden': '3. CHỐNG CHỈ ĐỊNH',
            
            // Side effects
            'tác dụng phụ': '4. TÁC DỤNG KHÔNG MONG MUỐN ĐIỂN HÌNH VÀ THẬN TRỌNG',
            'side effect': '4. TÁC DỤNG KHÔNG MONG MUỐN ĐIỂN HÌNH VÀ THẬN TRỌNG',
            'phản ứng': '4. TÁC DỤNG KHÔNG MONG MUỐN ĐIỂN HÌNH VÀ THẬN TRỌNG',
            'adverse': '4. TÁC DỤNG KHÔNG MONG MUỐN ĐIỂN HÌNH VÀ THẬN TRỌNG',
            'thận trọng': '4. TÁC DỤNG KHÔNG MONG MUỐN ĐIỂN HÌNH VÀ THẬN TRỌNG',
            
            // Administration
            'cách dùng': '5. CÁCH DÙNG (Ngoài đường tĩnh mạch)',
            'administration': '5. CÁCH DÙNG (Ngoài đường tĩnh mạch)',
            'how to use': '5. CÁCH DÙNG (Ngoài đường tĩnh mạch)',
            
            // Drug interactions
            'tương tác': '6. TƯƠNG TÁC THUỐC',
            'interaction': '6. TƯƠNG TÁC THUỐC',
            'phối hợp': '6. TƯƠNG TÁC THUỐC',
            
            // Overdose
            'quá liều': '7. QUÁ LIỀU',
            'overdose': '7. QUÁ LIỀU',
            'poisoning': '7. QUÁ LIỀU',
            
            // Monitoring
            'theo dõi': '8. THEO DÕI ĐIỀU TRỊ',
            'monitoring': '8. THEO DÕI ĐIỀU TRỊ',
            'giám sát': '8. THEO DÕI ĐIỀU TRỊ',
            
            // Insurance
            'bảo hiểm': '9. BẢO HIỂM Y TẾ THANH TOÁN',
            'insurance': '9. BẢO HIỂM Y TẾ THANH TOÁN',
            'thanh toán': '9. BẢO HIỂM Y TẾ THANH TOÁN'
        };
        
        // Common drug name variations and aliases
        this.drugAliases = {
            'tigecycline': ['tigecycline', 'tygacil'],
            'amoxicillin': ['amoxicillin', 'amoxycillin', 'augmentin'],
            'paracetamol': ['paracetamol', 'acetaminophen', 'tylenol', 'efferalgan'],
            'ibuprofen': ['ibuprofen', 'brufen', 'advil'],
            'cephalexin': ['cephalexin', 'keflex', 'cefalexin']
        };
    }

    // Step 1: Extract drug names and content keywords from query
    extractKeywords(query) {
        const normalizedQuery = query.toLowerCase();
        
        // Extract drug names
        const detectedDrugs = [];
        Object.keys(this.drugAliases).forEach(mainName => {
            this.drugAliases[mainName].forEach(alias => {
                if (normalizedQuery.includes(alias.toLowerCase())) {
                    detectedDrugs.push(mainName);
                }
            });
        });
        
        // Extract content categories
        const detectedCategories = [];
        Object.keys(this.contentCategories).forEach(keyword => {
            if (normalizedQuery.includes(keyword)) {
                const headers = this.contentCategories[keyword];
                if (Array.isArray(headers)) {
                    detectedCategories.push(...headers);
                } else {
                    detectedCategories.push(headers);
                }
            }
        });
        
        return {
            drugs: [...new Set(detectedDrugs)], // Remove duplicates
            categories: [...new Set(detectedCategories)],
            originalQuery: query,
            normalizedQuery: normalizedQuery
        };
    }

    // Step 2: Match drug names with HOẠT CHẤT column
    matchDrugInData(drugKeywords, drugData) {
        const matchedDrugs = [];
        
        drugKeywords.forEach(drugName => {
            drugData.forEach(drug => {
                const drugActiveIngredient = drug['HOẠT CHẤT'] || '';
                
                // Direct match
                if (drugActiveIngredient.toLowerCase().includes(drugName.toLowerCase())) {
                    matchedDrugs.push({
                        drug: drug,
                        matchedName: drugName,
                        confidence: 100
                    });
                    return;
                }
                
                // Alias match
                if (this.drugAliases[drugName]) {
                    this.drugAliases[drugName].forEach(alias => {
                        if (drugActiveIngredient.toLowerCase().includes(alias.toLowerCase())) {
                            matchedDrugs.push({
                                drug: drug,
                                matchedName: alias,
                                confidence: 90
                            });
                        }
                    });
                }
            });
        });
        
        return matchedDrugs;
    }

    // Step 3: Match content requirements with headers
    matchContentHeaders(contentCategories, availableHeaders) {
        const matchedHeaders = [];
        
        contentCategories.forEach(category => {
            if (availableHeaders.includes(category)) {
                matchedHeaders.push({
                    header: category,
                    confidence: 100
                });
            }
        });
        
        // If no exact match, try partial matching
        if (matchedHeaders.length === 0) {
            contentCategories.forEach(category => {
                availableHeaders.forEach(header => {
                    if (header.toLowerCase().includes(category.toLowerCase()) || 
                        category.toLowerCase().includes(header.toLowerCase())) {
                        matchedHeaders.push({
                            header: header,
                            confidence: 70
                        });
                    }
                });
            });
        }
        
        return matchedHeaders;
    }

    // Step 4: Extract intersection data (cell content)
    extractCellData(matchedDrug, matchedHeader) {
        const drug = matchedDrug.drug;
        const header = matchedHeader.header;
        
        const cellContent = drug[header];
        
        return {
            drugName: drug['HOẠT CHẤT'],
            header: header,
            content: cellContent || '',
            drugConfidence: matchedDrug.confidence,
            headerConfidence: matchedHeader.confidence,
            lastUpdated: drug['CẬP NHẬT'] || 'Not specified'
        };
    }

    // Step 5: Analyze and format cell content for precise answer
    analyzeAndFormatResponse(cellData, originalQuery) {
        const { drugName, header, content, drugConfidence, headerConfidence } = cellData;
        
        if (!content || content.trim() === '') {
            return {
                success: false,
                message: `⚠️ Không tìm thấy thông tin về "${header}" cho thuốc ${drugName}`,
                confidence: 0
            };
        }

        // Format content based on header type
        let formattedContent = this.formatContentByType(header, content);
        
        // Add safety warnings for contraindications
        if (header.includes('CHỐNG CHỈ ĐỊNH')) {
            formattedContent = `🚨 **${header.toUpperCase()}:**\n\n⛔ ${formattedContent}\n\n💡 **Lý do quan trọng:** Chống chỉ định là những tình huống tuyệt đối KHÔNG được sử dụng thuốc vì có thể gây nguy hiểm nghiêm trọng cho bệnh nhân.`;
        }
        
        // Add dosage warnings
        if (header.includes('LIỀU')) {
            formattedContent = `💊 **${header}:**\n\n${formattedContent}\n\n⚠️ **Lưu ý:** Liều dùng phải được điều chỉnh theo tình trạng bệnh nhân và theo chỉ định của bác sĩ.`;
        }
        
        return {
            success: true,
            message: formattedContent,
            drugName: drugName,
            category: header,
            confidence: Math.min(drugConfidence, headerConfidence),
            rawContent: content,
            lastUpdated: cellData.lastUpdated
        };
    }

    // Format content based on medical category
    formatContentByType(header, content) {
        // Remove HTML tags for now, can be enhanced later
        let cleanContent = content.replace(/<[^>]*>/g, '');
        
        if (header.includes('CHỐNG CHỈ ĐỊNH')) {
            return cleanContent;
        }
        
        if (header.includes('LIỀU')) {
            return cleanContent;
        }
        
        if (header.includes('TÁC DỤNG KHÔNG MONG MUỐN')) {
            return `${cleanContent}\n\n⚠️ **Nếu gặp bất kỳ triệu chứng nào, hãy ngưng thuốc và tham khảo ý kiến bác sĩ ngay lập tức.**`;
        }
        
        return cleanContent;
    }

    // Main processing function implementing all 5 steps
    async processQuery(query, drugData) {
        try {
            console.log(`🔍 Processing query: "${query}"`);
            
            // Step 1: Extract keywords
            const keywords = this.extractKeywords(query);
            console.log(`📝 Step 1 - Keywords:`, keywords);
            
            if (keywords.drugs.length === 0) {
                return {
                    success: false,
                    message: "⚠️ Không thể xác định tên thuốc trong câu hỏi. Vui lòng cung cấp tên hoạt chất hoặc tên thương mại của thuốc.",
                    step: 1
                };
            }
            
            if (keywords.categories.length === 0) {
                return {
                    success: false,
                    message: "⚠️ Không thể xác định loại thông tin cần tìm. Vui lòng chỉ rõ bạn muốn hỏi về: liều dùng, chống chỉ định, tác dụng phụ, v.v.",
                    step: 1
                };
            }
            
            // Step 2: Match drugs in data
            const matchedDrugs = this.matchDrugInData(keywords.drugs, drugData);
            console.log(`💊 Step 2 - Matched drugs:`, matchedDrugs.length);
            
            if (matchedDrugs.length === 0) {
                return {
                    success: false,
                    message: `⚠️ Không tìm thấy thông tin về thuốc "${keywords.drugs.join(', ')}" trong cơ sở dữ liệu.`,
                    step: 2
                };
            }
            
            // Step 3: Match content headers
            const availableHeaders = Object.keys(drugData[0] || {});
            const matchedHeaders = this.matchContentHeaders(keywords.categories, availableHeaders);
            console.log(`📋 Step 3 - Matched headers:`, matchedHeaders.length);
            
            if (matchedHeaders.length === 0) {
                return {
                    success: false,
                    message: `⚠️ Không tìm thấy thông tin về "${keywords.categories.join(', ')}" trong dữ liệu.`,
                    step: 3
                };
            }
            
            // Step 4: Extract cell data (best match)
            const bestDrug = matchedDrugs.sort((a, b) => b.confidence - a.confidence)[0];
            const bestHeader = matchedHeaders.sort((a, b) => b.confidence - a.confidence)[0];
            
            const cellData = this.extractCellData(bestDrug, bestHeader);
            console.log(`🎯 Step 4 - Cell data extracted for ${cellData.drugName} - ${cellData.header}`);
            
            // Step 5: Analyze and format response
            const finalResponse = this.analyzeAndFormatResponse(cellData, query);
            console.log(`✅ Step 5 - Final response confidence: ${finalResponse.confidence}%`);
            
            return finalResponse;
            
        } catch (error) {
            console.error('❌ Error in query processing:', error);
            return {
                success: false,
                message: `❌ Lỗi xử lý câu hỏi: ${error.message}`,
                step: 0
            };
        }
    }
}

module.exports = EnhancedMedicalQueryProcessor;
