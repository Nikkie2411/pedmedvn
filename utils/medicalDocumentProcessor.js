const fs = require('fs');
const path = require('path');

/**
 * Enhanced Document Processor for Medical Content
 * Optimized for Vietnamese medical documents with proper structure recognition
 */
class MedicalDocumentProcessor {
    constructor() {
        this.medicalKeywords = [
            'liều', 'mg/kg', 'lần/ngày', 'tuổi', 'tháng', 'năm',
            'chỉ định', 'chống chỉ định', 'tác dụng phụ', 
            'phân loại dược lý', 'cách dùng', 'lưu ý',
            'sơ sinh', 'trẻ em', 'nhi khoa', 'thuốc',
            'điều trị', 'phòng ngừa', 'liệu trình'
        ];
        
        this.medicalSections = [
            'phân loại dược lý',
            'liều lượng', 
            'chỉ định',
            'chống chỉ định',
            'tác dụng phụ',
            'cách dùng',
            'lưu ý đặc biệt',
            'tương tác thuốc',
            'bảo quản'
        ];
        
        this.vietnameseStopWords = [
            'là', 'của', 'và', 'có', 'trong', 'cho', 'với', 'được', 'từ', 'khi', 'để',
            'này', 'đó', 'các', 'một', 'những', 'cần', 'phải', 'sẽ', 'đã', 'không',
            'tại', 'trên', 'dưới', 'về', 'sau', 'trước', 'ngoài', 'giữa'
        ];
    }

    /**
     * Process a medical document with enhanced structure recognition
     */
    async processDocument(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const fileName = path.basename(filePath, path.extname(filePath));
            
            // Extract drug name from filename or content
            const drugName = this.extractDrugName(fileName, content);
            
            // Parse structured content
            const sections = this.parseStructuredContent(content);
            
            // Create comprehensive document object
            const processedDoc = {
                id: this.generateId(drugName),
                drugName: drugName,
                title: drugName + ' - Thông tin thuốc nhi khoa',
                sections: sections,
                content: content,
                keywords: this.extractMedicalKeywords(content),
                source: fileName,
                lastUpdated: new Date().toISOString(),
                confidence: this.calculateContentQuality(sections)
            };
            
            console.log(`✅ Processed ${drugName}: ${sections.length} sections found`);
            return processedDoc;
            
        } catch (error) {
            console.error(`❌ Error processing ${filePath}:`, error);
            return null;
        }
    }

    /**
     * Extract drug name from filename or content
     */
    extractDrugName(fileName, content) {
        // Clean filename
        let drugName = fileName.replace(/[-_]/g, ' ').trim();
        
        // Try to extract from first line of content
        const firstLine = content.split('\n')[0].trim();
        if (firstLine && firstLine.length < 50 && !firstLine.includes('.')) {
            drugName = firstLine;
        }
        
        return drugName;
    }

    /**
     * Parse structured medical content
     */
    parseStructuredContent(content) {
        const sections = [];
        const lines = content.split('\n');
        let currentSection = null;
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            if (!trimmedLine) continue;
            
            // Check if line is a medical section header
            const sectionType = this.identifyMedicalSection(trimmedLine);
            
            if (sectionType) {
                // Save previous section
                if (currentSection && currentSection.content.trim()) {
                    sections.push(currentSection);
                }
                
                // Start new section
                currentSection = {
                    type: sectionType,
                    title: trimmedLine,
                    content: '',
                    subsections: []
                };
            } else if (currentSection) {
                // Add content to current section
                currentSection.content += line + '\n';
                
                // Check for subsections (numbered items, bullets)
                if (this.isSubsection(trimmedLine)) {
                    currentSection.subsections.push({
                        title: trimmedLine,
                        content: ''
                    });
                }
            }
        }
        
        // Add last section
        if (currentSection && currentSection.content.trim()) {
            sections.push(currentSection);
        }
        
        return sections;
    }

    /**
     * Identify medical section types
     */
    identifyMedicalSection(line) {
        const lowerLine = line.toLowerCase();
        
        // Direct matches
        for (const section of this.medicalSections) {
            if (lowerLine.includes(section)) {
                return section;
            }
        }
        
        // Pattern matches
        if (/^\d+\.?\s*(phân loại|dược lý)/i.test(line)) return 'phân loại dược lý';
        if (/^\d+\.?\s*liều/i.test(line)) return 'liều lượng';
        if (/^\d+\.?\s*chỉ định/i.test(line)) return 'chỉ định';
        if (/^\d+\.?\s*chống chỉ định/i.test(line)) return 'chống chỉ định';
        if (/^\d+\.?\s*tác dụng phụ/i.test(line)) return 'tác dụng phụ';
        if (/^\d+\.?\s*cách dùng/i.test(line)) return 'cách dùng';
        if (/^\d+\.?\s*lưu ý/i.test(line)) return 'lưu ý đặc biệt';
        
        return null;
    }

    /**
     * Check if line is a subsection
     */
    isSubsection(line) {
        return /^\d+\.\d+/.test(line) || // 2.1, 2.2, etc.
               /^[a-z]\)/.test(line) ||   // a), b), etc.
               /^[-•]/.test(line);        // bullet points
    }

    /**
     * Extract medical keywords with enhanced recognition
     */
    extractMedicalKeywords(content) {
        const normalizedContent = this.normalizeVietnamese(content.toLowerCase());
        const words = normalizedContent.split(/\s+/)
            .filter(word => word.length > 2)
            .filter(word => !this.vietnameseStopWords.includes(word))
            .filter(word => !word.match(/^\d+$/));

        // Count frequencies
        const wordCount = {};
        words.forEach(word => {
            wordCount[word] = (wordCount[word] || 0) + 1;
        });

        // Prioritize medical terms
        const keywords = [];
        
        // Add medical keywords found in content
        this.medicalKeywords.forEach(keyword => {
            if (normalizedContent.includes(keyword)) {
                keywords.push(keyword);
            }
        });
        
        // Add high-frequency words
        const sortedWords = Object.entries(wordCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([word]) => word);
            
        keywords.push(...sortedWords);
        
        return [...new Set(keywords)]; // Remove duplicates
    }

    /**
     * Normalize Vietnamese text
     */
    normalizeVietnamese(text) {
        return text
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

    /**
     * Calculate content quality score
     */
    calculateContentQuality(sections) {
        let score = 0;
        const requiredSections = ['liều lượng', 'chỉ định', 'chống chỉ định'];
        
        // Check for required sections
        requiredSections.forEach(required => {
            if (sections.some(section => section.type === required)) {
                score += 30;
            }
        });
        
        // Bonus for additional sections
        if (sections.length > 3) score += 10;
        if (sections.some(s => s.subsections.length > 0)) score += 10;
        
        return Math.min(score, 100);
    }

    /**
     * Generate unique ID for document
     */
    generateId(drugName) {
        return drugName.toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    }

    /**
     * Build knowledge base from processed documents
     */
    async buildKnowledgeBase(documentsDir, outputPath) {
        console.log('🔨 Building enhanced medical knowledge base...');
        
        if (!fs.existsSync(documentsDir)) {
            throw new Error(`Documents directory not found: ${documentsDir}`);
        }

        const knowledgeBase = [];
        const files = fs.readdirSync(documentsDir)
            .filter(file => file.endsWith('.txt'));

        console.log(`📄 Found ${files.length} text files`);

        for (const file of files) {
            const filePath = path.join(documentsDir, file);
            console.log(`Processing: ${file}`);
            
            const processedDoc = await this.processDocument(filePath);
            if (processedDoc && processedDoc.confidence > 30) {
                knowledgeBase.push(processedDoc);
            } else {
                console.warn(`⚠️ Skipped ${file} - quality score too low or processing failed`);
            }
        }

        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Save enhanced knowledge base
        fs.writeFileSync(outputPath, JSON.stringify(knowledgeBase, null, 2));
        
        console.log(`✅ Enhanced knowledge base built with ${knowledgeBase.length} documents`);
        console.log(`💾 Saved to: ${outputPath}`);
        
        // Show statistics
        const avgQuality = knowledgeBase.reduce((sum, doc) => sum + doc.confidence, 0) / knowledgeBase.length;
        console.log(`📊 Average quality score: ${avgQuality.toFixed(1)}`);
        
        return knowledgeBase;
    }
}

module.exports = MedicalDocumentProcessor;
