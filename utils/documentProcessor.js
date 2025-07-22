// Utility to process Word documents and build knowledge base
const fs = require('fs').promises;
const path = require('path');

class DocumentProcessor {
    constructor() {
        this.documents = [];
        this.supportedExtensions = ['.txt', '.md'];
    }

    // Process text files (since we can't directly read .docx on Render free tier)
    async processTextFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const fileName = path.basename(filePath);
            const title = fileName.replace(/\.[^/.]+$/, ""); // Remove extension
            
            // Clean and normalize content
            const cleanContent = this.cleanText(content);
            
            return {
                title,
                content: cleanContent,
                source: fileName,
                processedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error(`❌ Error processing file ${filePath}:`, error);
            return null;
        }
    }

    // Clean and normalize Vietnamese text
    cleanText(text) {
        return text
            .replace(/\r\n/g, '\n') // Normalize line breaks
            .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
            .replace(/\s{2,}/g, ' ') // Remove excessive spaces
            .replace(/[""]/g, '"') // Normalize quotes
            .replace(/['']/g, "'") // Normalize apostrophes
            .trim();
    }

    // Process directory of documents
    async processDirectory(directoryPath) {
        try {
            const files = await fs.readdir(directoryPath);
            const processedDocs = [];
            
            for (const file of files) {
                const filePath = path.join(directoryPath, file);
                const stat = await fs.stat(filePath);
                
                if (stat.isFile() && this.isSupportedFile(file)) {
                    console.log(`📄 Processing: ${file}`);
                    const doc = await this.processTextFile(filePath);
                    if (doc) {
                        processedDocs.push(doc);
                    }
                }
            }
            
            console.log(`✅ Processed ${processedDocs.length} documents`);
            return processedDocs;
            
        } catch (error) {
            console.error('❌ Error processing directory:', error);
            return [];
        }
    }

    // Check if file is supported
    isSupportedFile(fileName) {
        const ext = path.extname(fileName).toLowerCase();
        return this.supportedExtensions.includes(ext);
    }

    // Build knowledge base from processed documents
    async buildKnowledgeBase(documentsDirectory, outputPath) {
        try {
            console.log('🔨 Building knowledge base...');
            
            // Process all documents in directory
            const documents = await this.processDirectory(documentsDirectory);
            
            if (documents.length === 0) {
                console.log('⚠️ No documents found to process');
                return false;
            }
            
            // Ensure output directory exists
            const outputDir = path.dirname(outputPath);
            await fs.mkdir(outputDir, { recursive: true });
            
            // Save knowledge base
            await fs.writeFile(outputPath, JSON.stringify(documents, null, 2), 'utf8');
            
            console.log(`✅ Knowledge base built with ${documents.length} documents`);
            console.log(`💾 Saved to: ${outputPath}`);
            
            return true;
            
        } catch (error) {
            console.error('❌ Error building knowledge base:', error);
            return false;
        }
    }

    // Add sample medical documents for testing
    async createSampleKnowledgeBase(outputPath) {
        const sampleDocuments = [
            {
                title: "Paracetamol trong nhi khoa",
                content: `Paracetamol (Acetaminophen) là thuốc hạ sốt và giảm đau thường được sử dụng trong nhi khoa.

LIỀU LƯỢNG:
- Trẻ sơ sinh: 10-15 mg/kg/lần, cách 4-6 giờ
- Trẻ em: 10-15 mg/kg/lần, cách 4-6 giờ  
- Liều tối đa: 90 mg/kg/ngày

CHỐNG CHỈ ĐỊNH:
- Dị ứng với paracetamol
- Suy gan nặng
- Thiếu hụt G6PD nặng

TÁC DỤNG PHỤ:
- Hiếm gặp ở liều thông thường
- Quá liều có thể gây độc gan

CÁCH DÙNG:
- Uống bằng đường miệng
- Có thể cho qua đường hậu môn nếu cần
- Không dùng quá 5 ngày liên tục`,
                source: "drug_paracetamol.txt",
                processedAt: new Date().toISOString()
            },
            {
                title: "Amoxicillin trong nhi khoa",
                content: `Amoxicillin là kháng sinh beta-lactam thuộc nhóm penicillin, thường được sử dụng trong điều trị nhiễm khuẩn ở trẻ em.

LIỀU LƯỢNG:
- Nhiễm khuẩn nhẹ đến vừa: 25-50 mg/kg/ngày, chia 2-3 lần
- Nhiễm khuẩn nặng: 75-100 mg/kg/ngày, chia 3 lần
- Otitis media: 80-90 mg/kg/ngày, chia 2 lần

CHỐNG CHỈ ĐỊNH:
- Dị ứng penicillin
- Dị ứng beta-lactam
- Tiền sử phản ứng quá mẫn với amoxicillin

TÁC DỤNG PHỤ:
- Tiêu chảy, buồn nôn
- Phát ban da
- Nhiễm khuẩn cơ hội (candida)

CHÚ Ý:
- Dùng trước khi ăn để tăng hấp thu
- Hoàn thành liệu trình điều trị
- Theo dõi dấu hiệu dị ứng`,
                source: "drug_amoxicillin.txt",
                processedAt: new Date().toISOString()
            },
            {
                title: "Ibuprofen trong nhi khoa",
                content: `Ibuprofen là thuốc chống viêm không steroid (NSAID) có tác dụng hạ sốt, giảm đau và chống viêm.

LIỀU LƯỢNG:
- Hạ sốt: 5-10 mg/kg/lần, cách 6-8 giờ
- Giảm đau: 4-10 mg/kg/lần, cách 6-8 giờ
- Liều tối đa: 40 mg/kg/ngày

CHỐNG CHỈ ĐỊNH:
- Trẻ dưới 6 tháng tuổi
- Dị ứng với NSAID
- Loét dạ dày tá tràng
- Suy thận, suy gan nặng
- Mất nước nặng

TÁC DỤNG PHỤ:
- Đau dạ dày
- Buồn nôn, nôn
- Ảnh hướng đến chức năng thận
- Phản ứng dị ứng

CHÚ Ý:
- Dùng sau khi ăn
- Đảm bảo trẻ không mất nước
- Không dùng đồng thời với aspirin`,
                source: "drug_ibuprofen.txt",
                processedAt: new Date().toISOString()
            }
        ];

        try {
            // Ensure output directory exists
            const outputDir = path.dirname(outputPath);
            await fs.mkdir(outputDir, { recursive: true });
            
            await fs.writeFile(outputPath, JSON.stringify(sampleDocuments, null, 2), 'utf8');
            
            console.log('✅ Sample knowledge base created');
            console.log(`💾 Saved to: ${outputPath}`);
            
            return true;
        } catch (error) {
            console.error('❌ Error creating sample knowledge base:', error);
            return false;
        }
    }
}

module.exports = new DocumentProcessor();
