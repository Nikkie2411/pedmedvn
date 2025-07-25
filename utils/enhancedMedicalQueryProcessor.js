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
            'ampicillin': ['ampicillin', 'penbritin', 'principen'],
            'meropenem': ['meropenem', 'meronem', 'merrem'],
            'vancomycin': ['vancomycin', 'vancocin'],
            'ceftriaxone': ['ceftriaxone', 'rocephin'],
            'paracetamol': ['paracetamol', 'acetaminophen', 'tylenol', 'efferalgan'],
            'ibuprofen': ['ibuprofen', 'brufen', 'advil'],
            'cephalexin': ['cephalexin', 'keflex', 'cefalexin'],
            'cefazolin': ['cefazolin', 'ancef', 'kefzol'],
            'gentamicin': ['gentamicin', 'garamycin'],
            'metronidazole': ['metronidazole', 'flagyl'],
            'azithromycin': ['azithromycin', 'zithromax'],
            'clarithromycin': ['clarithromycin', 'biaxin'],
            'erythromycin': ['erythromycin', 'erythrocin'],
            'ciprofloxacin': ['ciprofloxacin', 'cipro'],
            'doxycycline': ['doxycycline', 'vibramycin'],
            'clindamycin': ['clindamycin', 'cleocin'],
            'trimethoprim': ['trimethoprim', 'bactrim', 'co-trimoxazole'],
            'fluconazole': ['fluconazole', 'diflucan'],
            'nystatin': ['nystatin', 'mycostatin'],
            'cefotaxime': ['cefotaxime', 'claforan'],
            'imipenem': ['imipenem', 'primaxin'],
            'piperacillin': ['piperacillin', 'tazocin', 'zosyn'],
            'lincomycin': ['lincomycin', 'lincocin']
        };
    }

    // Step 1: Extract drug names and content keywords from query
    extractKeywords(query) {
        const normalizedQuery = query.toLowerCase();
        
        // Extract drug names
        const detectedDrugs = [];
        
        // First, check known aliases
        Object.keys(this.drugAliases).forEach(mainName => {
            this.drugAliases[mainName].forEach(alias => {
                if (normalizedQuery.includes(alias.toLowerCase())) {
                    detectedDrugs.push(mainName);
                }
            });
        });
        
        // If no drugs found via aliases, try to find potential drug names
        // Look for words that might be drug names (typically longer than 4 chars and not common words)
        if (detectedDrugs.length === 0) {
            const words = normalizedQuery.split(/\s+/);
            const commonWords = ['liều', 'dùng', 'cho', 'trẻ', 'em', 'sơ', 'sinh', 'chống', 'chỉ', 'định', 
                                'tác', 'dụng', 'phụ', 'cách', 'tương', 'tác', 'quá', 'theo', 'dõi', 'bảo', 'hiểm',
                                'dose', 'for', 'children', 'newborn', 'contraindication', 'side', 'effect', 'how', 'to'];
            
            words.forEach(word => {
                if (word.length > 4 && !commonWords.includes(word)) {
                    // This might be a drug name
                    detectedDrugs.push(word);
                }
            });
        }
        
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
                // Handle both structures: direct load vs AI provider format
                const drugActiveIngredient = drug.originalData?.['HOẠT CHẤT'] || 
                                            drug.rawData?.['HOẠT CHẤT'] || 
                                            drug.name || 
                                            drug.title || 
                                            '';
                
                // Direct match
                if (drugActiveIngredient.toLowerCase().includes(drugName.toLowerCase())) {
                    matchedDrugs.push({
                        drug: drug,
                        matchedName: drugName,
                        confidence: 100
                    });
                    return;
                }
                
                // Reverse match (drug name contains active ingredient)
                if (drugName.toLowerCase().includes(drugActiveIngredient.toLowerCase()) && drugActiveIngredient.length > 3) {
                    matchedDrugs.push({
                        drug: drug,
                        matchedName: drugActiveIngredient,
                        confidence: 95
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
                
                // Fuzzy match for similar names (basic similarity)
                if (this.calculateSimilarity(drugName.toLowerCase(), drugActiveIngredient.toLowerCase()) > 0.7) {
                    matchedDrugs.push({
                        drug: drug,
                        matchedName: drugActiveIngredient,
                        confidence: 80
                    });
                }
            });
        });
        
        // Remove duplicates and sort by confidence
        const uniqueMatches = [];
        const seen = new Set();
        
        matchedDrugs
            .sort((a, b) => b.confidence - a.confidence)
            .forEach(match => {
                const key = match.drug.originalData?.['HOẠT CHẤT'] || 
                           match.drug.rawData?.['HOẠT CHẤT'] || 
                           match.drug.name || 
                           match.drug.title;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueMatches.push(match);
                }
            });
        
        return uniqueMatches;
    }

    // Helper function to calculate string similarity
    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    // Calculate Levenshtein distance
    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    // Step 3: Enhanced content header matching with context awareness
    matchContentHeaders(contentCategories, availableHeaders, originalQuery = '') {
        const matchedHeaders = [];
        
        contentCategories.forEach(category => {
            if (availableHeaders.includes(category)) {
                // Calculate context-aware confidence
                let confidence = 100;
                const contextScore = this.calculateHeaderContextScore(category, originalQuery);
                confidence += contextScore;
                
                matchedHeaders.push({
                    header: category,
                    confidence: Math.min(confidence, 150) // Cap at 150
                });
            }
        });
        
        // If no exact match, try partial matching
        if (matchedHeaders.length === 0) {
            contentCategories.forEach(category => {
                availableHeaders.forEach(header => {
                    if (header.toLowerCase().includes(category.toLowerCase()) || 
                        category.toLowerCase().includes(header.toLowerCase())) {
                        
                        let confidence = 70;
                        const contextScore = this.calculateHeaderContextScore(header, originalQuery);
                        confidence += contextScore;
                        
                        matchedHeaders.push({
                            header: header,
                            confidence: Math.min(confidence, 120) // Cap at 120
                        });
                    }
                });
            });
        }
        
        // Sort by confidence (highest first)
        return matchedHeaders.sort((a, b) => b.confidence - a.confidence);
    }

    // Calculate context score for header selection
    calculateHeaderContextScore(header, query) {
        if (!query) return 0;
        
        const queryLower = query.toLowerCase();
        const headerLower = header.toLowerCase();
        let score = 0;
        
        // Patient type matching
        if (headerLower.includes('trẻ em') && queryLower.includes('trẻ em')) {
            score += 30;
        }
        if (headerLower.includes('sơ sinh') && queryLower.includes('sơ sinh')) {
            score += 30;
        }
        if (headerLower.includes('adult') && queryLower.includes('adult')) {
            score += 30;
        }
        
        // Condition-specific matching
        if (queryLower.includes('viêm màng não') || queryLower.includes('meningitis')) {
            // For meningitis, prefer pediatric dosing which usually has higher doses
            if (headerLower.includes('trẻ em')) {
                score += 20;
            }
        }
        
        if (queryLower.includes('nhiễm trùng nặng') || queryLower.includes('severe infection')) {
            if (headerLower.includes('trẻ em')) {
                score += 15;
            }
        }
        
        // Age-specific prioritization
        if (queryLower.includes('dưới') || queryLower.includes('<') || queryLower.includes('nhỏ hơn')) {
            if (headerLower.includes('sơ sinh')) {
                score += 25;
            }
        }
        
        // Contraindication specific
        if (queryLower.includes('chống chỉ định') || queryLower.includes('contraindic')) {
            if (headerLower.includes('chống chỉ định')) {
                score += 40;
            }
        }
        
        return score;
    }

    // Step 4: Extract intersection data (cell content)
    extractCellData(matchedDrug, matchedHeader) {
        const drug = matchedDrug.drug;
        const header = matchedHeader.header;
        
        // Handle both data structures
        const cellContent = drug.originalData?.[header] || drug.rawData?.[header] || '';
        
        return {
            drugName: drug.originalData?.['HOẠT CHẤT'] || drug.rawData?.['HOẠT CHẤT'] || drug.name || drug.title,
            header: header,
            content: cellContent || '',
            drugConfidence: matchedDrug.confidence,
            headerConfidence: matchedHeader.confidence,
            lastUpdated: drug.originalData?.['CẬP NHẬT'] || drug.rawData?.['CẬP NHẬT'] || 'Not specified'
        };
    }

    // Step 5: Enhanced Smart Content Extraction
    analyzeAndFormatResponse(cellData, originalQuery) {
        const { drugName, header, content, drugConfidence, headerConfidence } = cellData;
        
        if (!content || content.trim() === '') {
            return {
                success: false,
                message: `⚠️ Không tìm thấy thông tin về "${header}" cho thuốc ${drugName}`,
                confidence: 0
            };
        }

        // Step 5.1: Extract specific context from query
        const specificContext = this.extractSpecificContext(originalQuery);
        console.log(`🎯 Step 5.1 - Specific context:`, specificContext);
        
        // Step 5.2: Smart content extraction based on context
        let extractedContent = this.smartExtractContent(content, specificContext, header);
        console.log(`🧠 Step 5.2 - Smart extraction result:`, extractedContent ? 'Found specific info' : 'Using full content');
        
        // Step 5.3: Format content based on header type
        let formattedContent = this.formatContentByType(header, extractedContent || content, specificContext);
        
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
            extractedContent: extractedContent,
            specificContext: specificContext,
            lastUpdated: cellData.lastUpdated
        };
    }

    // Extract specific medical context from query
    extractSpecificContext(query) {
        const context = {
            conditions: [],
            severity: [],
            patientType: [],
            administration: [],
            other: []
        };
        
        const queryLower = query.toLowerCase();
        
        // Medical conditions
        const conditions = [
            'viêm màng não', 'meningitis', 'nhiễm trùng máu', 'sepsis', 'bacteremia',
            'viêm phổi', 'pneumonia', 'viêm đường tiết niệu', 'uti', 'viêm da',
            'cellulitis', 'viêm xương khớp', 'osteomyelitis', 'viêm nội tâm mạc',
            'endocarditis', 'viêm phúc mạc', 'peritonitis', 'viêm ruột thừa',
            'appendicitis', 'viêm túi mật', 'cholangitis', 'abcess', 'áp xe'
        ];
        
        conditions.forEach(condition => {
            if (queryLower.includes(condition)) {
                context.conditions.push(condition);
            }
        });
        
        // Severity levels
        const severityLevels = [
            'nặng', 'severe', 'nghiêm trọng', 'critical', 'nguy kịch',
            'nhẹ', 'mild', 'vừa', 'moderate', 'trung bình'
        ];
        
        severityLevels.forEach(severity => {
            if (queryLower.includes(severity)) {
                context.severity.push(severity);
            }
        });
        
        // Patient types
        const patientTypes = [
            'trẻ sơ sinh', 'newborn', 'neonatal', 'trẻ em', 'pediatric', 'children',
            'người lớn', 'adult', 'elderly', 'cao tuổi', 'thai phụ', 'pregnant',
            'cho con bú', 'lactating', 'breastfeeding'
        ];
        
        patientTypes.forEach(type => {
            if (queryLower.includes(type)) {
                context.patientType.push(type);
            }
        });
        
        // Administration routes
        const routes = [
            'tĩnh mạch', 'iv', 'intravenous', 'uống', 'oral', 'po',
            'tiêm bắp', 'im', 'intramuscular', 'bôi', 'topical'
        ];
        
        routes.forEach(route => {
            if (queryLower.includes(route)) {
                context.administration.push(route);
            }
        });
        
        return context;
    }

    // Smart content extraction based on specific context
    smartExtractContent(content, context, header) {
        if (!context || Object.values(context).every(arr => arr.length === 0)) {
            return null; // No specific context, return full content
        }
        
        const contentLower = content.toLowerCase();
        let extractedParts = [];
        
        // For dosage headers, look for specific conditions/severity
        if (header.includes('LIỀU')) {
            // Look for specific conditions
            context.conditions.forEach(condition => {
                const sentences = this.extractSentencesContaining(content, condition);
                if (sentences.length > 0) {
                    extractedParts.push(...sentences);
                    console.log(`🎯 Found condition "${condition}":`, sentences);
                }
            });
            
            // Look for severity mentions
            context.severity.forEach(severity => {
                const sentences = this.extractSentencesContaining(content, severity);
                if (sentences.length > 0) {
                    extractedParts.push(...sentences);
                    console.log(`⚡ Found severity "${severity}":`, sentences);
                }
            });
            
            // Look for patient type specific info
            context.patientType.forEach(type => {
                const sentences = this.extractSentencesContaining(content, type);
                if (sentences.length > 0) {
                    extractedParts.push(...sentences);
                    console.log(`👥 Found patient type "${type}":`, sentences);
                }
            });
        }
        
        // For contraindications, look for specific conditions
        if (header.includes('CHỐNG CHỈ ĐỊNH')) {
            context.conditions.forEach(condition => {
                const sentences = this.extractSentencesContaining(content, condition);
                if (sentences.length > 0) {
                    extractedParts.push(...sentences);
                    console.log(`🚨 Found contraindication condition "${condition}":`, sentences);
                }
            });
            
            context.patientType.forEach(type => {
                const sentences = this.extractSentencesContaining(content, type);
                if (sentences.length > 0) {
                    extractedParts.push(...sentences);
                    console.log(`🚨 Found contraindication patient type "${type}":`, sentences);
                }
            });
        }
        
        // Remove duplicates and return
        const uniqueParts = [...new Set(extractedParts)];
        console.log(`📝 Total extracted parts: ${uniqueParts.length}`);
        return uniqueParts.length > 0 ? uniqueParts.join('. ') : null;
    }

    // Enhanced sentence extraction with better parsing
    extractSentencesContaining(content, keyword) {
        // Split by multiple delimiters including periods, semicolons, line breaks, and colons
        const sentences = content.split(/[.!?;:\n]/).filter(s => s.trim().length > 5);
        const keywordLower = keyword.toLowerCase();
        
        const matchingSentences = sentences.filter(sentence => {
            const sentenceLower = sentence.toLowerCase();
            return sentenceLower.includes(keywordLower);
        }).map(s => s.trim());
        
        // Also search for phrases/clauses separated by commas or slashes
        const phrases = content.split(/[,/]/).filter(p => p.trim().length > 5);
        const matchingPhrases = phrases.filter(phrase => {
            const phraseLower = phrase.toLowerCase();
            return phraseLower.includes(keywordLower);
        }).map(p => p.trim());
        
        // Combine both
        matchingSentences.push(...matchingPhrases);
        
        // Also try to extract dosage ranges that mention the keyword
        if (keyword.includes('sơ sinh') || keyword.includes('newborn')) {
            const dosagePatterns = content.match(/[^.!?;:]*(?:sơ sinh|newborn)[^.!?;:]*/gi);
            if (dosagePatterns) {
                matchingSentences.push(...dosagePatterns.map(p => p.trim()));
            }
        }
        
        if (keyword.includes('nặng') || keyword.includes('severe')) {
            const severityPatterns = content.match(/[^.!?;:,]*(?:nặng|severe|nghiêm trọng)[^.!?;:,]*/gi);
            if (severityPatterns) {
                matchingSentences.push(...severityPatterns.map(p => p.trim()));
            }
        }
        
        if (keyword.includes('viêm màng não') || keyword.includes('meningitis')) {
            const meningitisPatterns = content.match(/[^.!?;:,]*(?:viêm màng não|meningitis)[^.!?;:,]*/gi);
            if (meningitisPatterns) {
                matchingSentences.push(...meningitisPatterns.map(p => p.trim()));
            }
        }
        
        // Remove duplicates and empty strings
        return [...new Set(matchingSentences)].filter(s => s.length > 0);
    }

    // Step 6: AI-Powered Analysis & Response Enhancement
    async enhanceWithAIAnalysis(step5Result, originalQuery, aiProvider = null) {
        if (!step5Result.success) {
            return step5Result; // No enhancement needed for failed results
        }

        console.log(`🤖 Step 6 - AI Analysis starting...`);
        
        try {
            // Prepare structured data for AI analysis
            const analysisData = {
                originalQuery: originalQuery,
                drugName: step5Result.drugName,
                category: step5Result.category,
                extractedContent: step5Result.extractedContent || step5Result.rawContent,
                specificContext: step5Result.specificContext,
                confidence: step5Result.confidence
            };

            // Create AI prompt for medical analysis
            const aiPrompt = this.createMedicalAnalysisPrompt(analysisData);
            console.log(`🧠 Step 6.1 - AI prompt prepared (${aiPrompt.length} chars)`);

            // Get AI analysis (if provider available)
            let aiAnalysis = null;
            if (aiProvider && typeof aiProvider.generateResponse === 'function') {
                try {
                    aiAnalysis = await aiProvider.generateResponse(aiPrompt);
                    console.log(`🤖 Step 6.2 - AI analysis received (${aiAnalysis?.length || 0} chars)`);
                } catch (aiError) {
                    console.log(`⚠️ Step 6.2 - AI analysis failed, using structured response:`, aiError.message);
                }
            } else {
                console.log(`💡 Step 6.2 - No AI provider, using enhanced structured response`);
            }

            // Combine structured data with AI insights
            const enhancedResponse = this.combineStructuredAndAIResponse(step5Result, aiAnalysis, analysisData);
            console.log(`✅ Step 6.3 - Enhanced response created (${enhancedResponse.message.length} chars)`);

            return enhancedResponse;

        } catch (error) {
            console.error(`❌ Step 6 - AI enhancement error:`, error.message);
            // Return original Step 5 result if AI enhancement fails
            return step5Result;
        }
    }

    // Create specialized medical analysis prompt
    createMedicalAnalysisPrompt(analysisData) {
        const { originalQuery, drugName, category, extractedContent, specificContext } = analysisData;
        
        let contextInfo = '';
        if (specificContext) {
            const contexts = [];
            if (specificContext.conditions.length > 0) {
                contexts.push(`Điều kiện: ${specificContext.conditions.join(', ')}`);
            }
            if (specificContext.severity.length > 0) {
                contexts.push(`Mức độ: ${specificContext.severity.join(', ')}`);
            }
            if (specificContext.patientType.length > 0) {
                contexts.push(`Đối tượng: ${specificContext.patientType.join(', ')}`);
            }
            contextInfo = contexts.join(' | ');
        }

        return `Bạn là chuyên gia dược lâm sàng. Phân tích và trả lời câu hỏi y khoa sau dựa trên dữ liệu đã được trích xuất chính xác:

**Câu hỏi:** ${originalQuery}

**Thông tin đã trích xuất:**
- Thuốc: ${drugName}
- Danh mục: ${category}
- Nội dung cụ thể: ${extractedContent}
- Bối cảnh: ${contextInfo || 'Không có bối cảnh cụ thể'}

**Yêu cầu:**
1. Trả lời trực tiếp và chính xác câu hỏi
2. Sử dụng CHÍNH XÁC thông tin đã trích xuất, không thêm thông tin bên ngoài
3. Nếu là liều dùng: nêu rõ liều, tần suất, đường dùng
4. Nếu là chống chỉ định: giải thích nguy cơ
5. Thêm lưu ý an toàn nếu cần thiết
6. Trả lời bằng tiếng Việt, ngắn gọn (tối đa 150 từ)

**Trả lời chuyên nghiệp:**`;
    }

    // Combine structured data with AI analysis
    combineStructuredAndAIResponse(step5Result, aiAnalysis, analysisData) {
        let enhancedMessage = step5Result.message;
        
        if (aiAnalysis && aiAnalysis.trim().length > 0) {
            // AI analysis available - use it as primary response
            enhancedMessage = `🤖 **Phân tích chuyên sâu:**\n\n${aiAnalysis.trim()}\n\n---\n\n📋 **Dữ liệu gốc:**\n${step5Result.extractedContent || step5Result.rawContent}`;
        } else {
            // No AI analysis - enhance structured response
            enhancedMessage = this.createEnhancedStructuredResponse(step5Result, analysisData);
        }

        return {
            ...step5Result,
            message: enhancedMessage,
            aiEnhanced: !!aiAnalysis,
            analysisMethod: aiAnalysis ? 'AI + Structured' : 'Enhanced Structured',
            step6Applied: true
        };
    }

    // Create enhanced structured response without AI
    createEnhancedStructuredResponse(step5Result, analysisData) {
        const { drugName, category, specificContext, extractedContent } = analysisData;
        
        let response = `💊 **${drugName}** - Thông tin chuyên sâu\n\n`;
        
        // Add context if available
        if (specificContext && Object.values(specificContext).some(arr => arr.length > 0)) {
            response += `🎯 **Bối cảnh cụ thể:**\n`;
            if (specificContext.conditions.length > 0) {
                response += `• Tình trạng: ${specificContext.conditions.join(', ')}\n`;
            }
            if (specificContext.patientType.length > 0) {
                response += `• Đối tượng: ${specificContext.patientType.join(', ')}\n`;
            }
            if (specificContext.severity.length > 0) {
                response += `• Mức độ: ${specificContext.severity.join(', ')}\n`;
            }
            response += `\n`;
        }

        // Add extracted content with smart formatting
        response += `📋 **${category}:**\n`;
        if (extractedContent && extractedContent !== step5Result.rawContent) {
            response += `${extractedContent}\n\n`;
            response += `📖 **Chi tiết đầy đủ:** ${step5Result.rawContent}`;
        } else {
            response += `${step5Result.rawContent}`;
        }

        // Add safety warnings based on category
        if (category.includes('LIỀU')) {
            response += `\n\n⚠️ **Quan trọng:** Liều dùng cần được bác sĩ điều chỉnh theo tình trạng cụ thể của bệnh nhân.`;
        }
        
        if (category.includes('CHỐNG CHỈ ĐỊNH')) {
            response += `\n\n🚨 **Cảnh báo:** Các chống chỉ định phải được tuân thủ nghiêm ngặt để đảm bảo an toàn bệnh nhân.`;
        }

        return response;
    }

    // Format content based on medical category and specific context
    formatContentByType(header, content, specificContext = null) {
        // Remove HTML tags for now, can be enhanced later
        let cleanContent = content.replace(/<[^>]*>/g, '');
        
        // If we have specific context, add contextual formatting
        if (specificContext && Object.values(specificContext).some(arr => arr.length > 0)) {
            const contextInfo = [];
            
            if (specificContext.conditions.length > 0) {
                contextInfo.push(`🎯 **Điều kiện cụ thể:** ${specificContext.conditions.join(', ')}`);
            }
            
            if (specificContext.severity.length > 0) {
                contextInfo.push(`⚡ **Mức độ:** ${specificContext.severity.join(', ')}`);
            }
            
            if (specificContext.patientType.length > 0) {
                contextInfo.push(`👥 **Đối tượng:** ${specificContext.patientType.join(', ')}`);
            }
            
            if (contextInfo.length > 0) {
                cleanContent = `${contextInfo.join('\n')}\n\n📋 **Thông tin chi tiết:**\n${cleanContent}`;
            }
        }
        
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

    // Main processing function implementing all 6 steps
    async processQuery(query, drugData, aiProvider = null) {
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
            
            // Step 3: Match content headers with context awareness
            const availableHeaders = Object.keys(drugData[0]?.originalData || drugData[0]?.rawData || {});
            const matchedHeaders = this.matchContentHeaders(keywords.categories, availableHeaders, query);
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
            const step5Result = this.analyzeAndFormatResponse(cellData, query);
            console.log(`✅ Step 5 - Final response confidence: ${step5Result.confidence}%`);
            
            // Step 6: AI-Powered Enhancement (optional, improves response quality)
            const finalResponse = await this.enhanceWithAIAnalysis(step5Result, query, aiProvider);
            console.log(`🚀 Step 6 - AI enhancement: ${finalResponse.aiEnhanced ? 'Applied' : 'Structured only'}`);
            
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
