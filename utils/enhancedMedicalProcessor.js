// Enhanced Medical Document Processor based on real Google Drive format
const fs = require('fs').promises;
const path = require('path');

class EnhancedMedicalDocumentProcessor {
    constructor() {
        // Real medical sections from Google Drive documents
        this.medicalSections = [
            'phân loại dược lý',
            'liều thông thường trẻ sơ sinh',
            'liều thông thường trẻ em', 
            'hiệu chỉnh liều theo chức năng thận',
            'hiệu chỉnh liều theo chức năng gan',
            'chống chỉ định',
            'tác dụng phụ',
            'tương tác thuốc',
            'chú ý đặc biệt',
            'bảo quản',
            'dạng bào chế',
            'cách dùng',
            'nhiễm khuẩn',
            'viêm phổi',
            'nhiễm khuẩn da',
            'nhiễm khuẩn huyết'
        ];
        
        // Drug classification keywords
        this.drugClasses = [
            'kháng sinh',
            'hạ sốt',
            'giảm đau',
            'chống viêm',
            'vitamin',
            'khoáng chất',
            'oxazolidinon',
            'beta-lactam',
            'quinolone',
            'macrolide'
        ];
    }

    // Process medical text based on real Google Drive format
    processRealMedicalDocument(content, fileName = '') {
        try {
            console.log(`🔄 Processing medical document: ${fileName}`);
            
            // Extract drug name from content structure
            const drugInfo = this.extractDrugFromRealFormat(content);
            
            // Parse sections based on real document structure
            const sections = this.parseRealMedicalSections(content);
            
            // Extract medical keywords and dosage info
            const medicalData = this.extractAdvancedMedicalData(content);
            
            // Calculate quality score
            const qualityScore = this.calculateAdvancedQuality(sections, medicalData);
            
            return {
                id: this.generateId(drugInfo.name),
                drugName: drugInfo.name,
                drugClass: drugInfo.class,
                title: `${drugInfo.name} - Thông tin thuốc nhi khoa`,
                sections: sections,
                medicalData: medicalData,
                content: this.cleanContent(content),
                keywords: this.extractMedicalKeywords(content),
                source: fileName,
                lastUpdated: new Date().toISOString(),
                qualityScore: qualityScore
            };
            
        } catch (error) {
            console.error(`❌ Error processing document:`, error);
            return null;
        }
    }

    // Extract drug info from real Google Drive format
    extractDrugFromRealFormat(content) {
        const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        let drugName = 'Unknown Drug';
        let drugClass = 'Unknown';
        
        for (const line of lines) {
            // Format: "Thẻ 1    Linezolid  1. Phân loại dược lý"
            const drugMatch = line.match(/thẻ\s+\d+\s+([a-zA-Z]+)/i);
            if (drugMatch) {
                drugName = drugMatch[1];
            }
            
            // Extract drug classification
            if (line.toLowerCase().includes('phân loại dược lý')) {
                const classMatch = line.match(/phân loại dược lý\s+(.+?)(?:\d+|$)/i);
                if (classMatch) {
                    drugClass = classMatch[1].trim();
                }
            }
            
            // Look for classification keywords
            for (const cls of this.drugClasses) {
                if (line.toLowerCase().includes(cls)) {
                    drugClass = cls;
                    break;
                }
            }
        }
        
        return { name: drugName, class: drugClass };
    }

    // Parse real medical document sections
    parseRealMedicalSections(content) {
        const sections = {};
        const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        let currentSection = 'general';
        let currentContent = [];
        
        for (const line of lines) {
            const lowerLine = line.toLowerCase();
            
            // Detect section headers based on real format
            let newSection = null;
            
            if (lowerLine.includes('phân loại dược lý') || lowerLine.match(/\d+\.\s*phân loại/)) {
                newSection = 'classification';
            } else if (lowerLine.includes('liều thông thường trẻ sơ sinh') || lowerLine.match(/\d+\.\d+\.\s*liều.*sơ sinh/)) {
                newSection = 'dosage_newborn';
            } else if (lowerLine.includes('liều thông thường trẻ em') || lowerLine.match(/\d+\.\d+\.\s*liều.*trẻ em/)) {
                newSection = 'dosage_children';
            } else if (lowerLine.includes('hiệu chỉnh liều theo chức năng thận') || lowerLine.match(/\d+\.\d+\.\s*hiệu chỉnh.*thận/)) {
                newSection = 'kidney_adjustment';
            } else if (lowerLine.includes('hiệu chỉnh liều theo chức năng gan') || lowerLine.match(/\d+\.\d+\.\s*hiệu chỉnh.*gan/)) {
                newSection = 'liver_adjustment';
            } else if (lowerLine.includes('chống chỉ định') || lowerLine.match(/\d+\.\s*chống chỉ định/)) {
                newSection = 'contraindications';
            } else if (lowerLine.includes('tác dụng phụ') || lowerLine.match(/\d+\.\s*tác dụng phụ/)) {
                newSection = 'side_effects';
            } else if (lowerLine.includes('tương tác thuốc') || lowerLine.match(/\d+\.\s*tương tác/)) {
                newSection = 'drug_interactions';
            } else if (lowerLine.includes('chú ý đặc biệt') || lowerLine.match(/\d+\.\s*chú ý/)) {
                newSection = 'special_warnings';
            }
            
            if (newSection) {
                // Save previous section
                if (currentContent.length > 0) {
                    sections[currentSection] = currentContent.join('\n');
                }
                
                // Start new section
                currentSection = newSection;
                currentContent = [line];
            } else {
                currentContent.push(line);
            }
        }
        
        // Save last section
        if (currentContent.length > 0) {
            sections[currentSection] = currentContent.join('\n');
        }
        
        return sections;
    }

    // Extract advanced medical data
    extractAdvancedMedicalData(content) {
        const medicalData = {
            dosages: [],
            indications: [],
            contraindications: [],
            sideEffects: [],
            drugInteractions: [],
            ageGroups: [],
            routes: []
        };
        
        const lines = content.split('\n');
        
        for (const line of lines) {
            const lowerLine = line.toLowerCase();
            
            // Extract dosage information
            const dosageMatch = line.match(/(\d+(?:\.\d+)?)\s*(mg|ml|g|μg|mcg)/gi);
            if (dosageMatch) {
                medicalData.dosages.push(...dosageMatch);
            }
            
            // Extract age groups
            if (lowerLine.includes('trẻ sơ sinh') || lowerLine.includes('newborn')) {
                medicalData.ageGroups.push('newborn');
            }
            if (lowerLine.includes('trẻ em') || lowerLine.includes('children') || lowerLine.includes('pediatric')) {
                medicalData.ageGroups.push('children');
            }
            
            // Extract administration routes
            const routes = ['tiêm', 'uống', 'nhỏ', 'bôi', 'xịt', 'oral', 'iv', 'im'];
            for (const route of routes) {
                if (lowerLine.includes(route)) {
                    medicalData.routes.push(route);
                }
            }
            
            // Extract specific indications
            const indications = [
                'viêm phổi', 'nhiễm khuẩn', 'nhiễm trùng', 'viêm', 'sốt',
                'đau', 'ho', 'khó thở', 'tiêu chảy', 'nôn'
            ];
            for (const indication of indications) {
                if (lowerLine.includes(indication) && !medicalData.indications.includes(indication)) {
                    medicalData.indications.push(indication);
                }
            }
        }
        
        return medicalData;
    }

    // Calculate advanced quality score
    calculateAdvancedQuality(sections, medicalData) {
        let score = 0;
        
        // Section completeness (40 points)
        const essentialSections = ['classification', 'dosage_children', 'contraindications', 'side_effects'];
        const presentSections = essentialSections.filter(section => sections[section]);
        score += (presentSections.length / essentialSections.length) * 40;
        
        // Medical data richness (30 points)
        if (medicalData.dosages.length > 0) score += 10;
        if (medicalData.indications.length > 0) score += 10;
        if (medicalData.ageGroups.length > 0) score += 10;
        
        // Content quality (30 points)
        const totalContent = Object.values(sections).join(' ');
        if (totalContent.length > 500) score += 10;
        if (totalContent.length > 1000) score += 10;
        if (totalContent.length > 2000) score += 10;
        
        return Math.round(score);
    }

    // Clean and normalize content
    cleanContent(content) {
        return content
            .replace(/\s+/g, ' ')
            .replace(/\n\s*\n/g, '\n')
            .trim();
    }

    // Extract medical keywords
    extractMedicalKeywords(content) {
        const keywords = new Set();
        const lowerContent = content.toLowerCase();
        
        // Medical terms
        const medicalTerms = [
            'liều', 'mg', 'ml', 'viêm', 'nhiễm khuẩn', 'kháng sinh',
            'tác dụng phụ', 'chống chỉ định', 'sốt', 'đau', 'trẻ em'
        ];
        
        medicalTerms.forEach(term => {
            if (lowerContent.includes(term)) {
                keywords.add(term);
            }
        });
        
        return Array.from(keywords);
    }

    // Generate unique ID
    generateId(drugName) {
        return `drug_${drugName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    }

    // Normalize Vietnamese text
    normalizeVietnameseText(text) {
        return text
            .toLowerCase()
            .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
            .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
            .replace(/[ìíịỉĩ]/g, 'i')
            .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
            .replace(/[ùúụủũưừứựửữ]/g, 'u')
            .replace(/[ỳýỵỷỹ]/g, 'y')
            .replace(/[đ]/g, 'd')
            .trim();
    }
}

module.exports = EnhancedMedicalDocumentProcessor;
