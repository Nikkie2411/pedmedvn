// Test Enhanced Medical Processor with real Google Drive data
const EnhancedMedicalProcessor = require('./utils/enhancedMedicalProcessor');

async function testRealGoogleDriveFormat() {
    console.log('🧪 Testing Enhanced Medical Processor with Real Google Drive Data\n');
    
    // Real data sample from the Google Drive document
    const realGoogleDriveContent = `
Thẻ 1    Linezolid  1. Phân loại dược lý  Kháng sinh nhóm oxazolidinon

2.1. Liều thông thường trẻ sơ sinh  
Liều chung: 
Viêm phổi bệnh viện
Viêm phổi cộng đồng, gồm cả những trường hợp có nhiễm khuẩn huyết
Nhiễm khuẩn da và cấu trúc da có biến chứng
Nhiễm khuẩn da và cấu trúc da không có biến chứng
Nhiễm khuẩn do Enterococcus faecium đã kháng vancomycin, gồm cả những trường hợp có nhiễm khuẩn huyết

2.2. Liều thông thường trẻ em  
Liều chung:
Viêm phổi bệnh viện
Viêm phổi cộng đồng, gồm cả những trường hợp có nhiễm khuẩn huyết
Nhiễm khuẩn da và cấu trúc da có biến chứng
Nhiễm khuẩn da và cấu trúc da không có biến chứng
Nhiễm khuẩn do Enterococcus faecium đã kháng vancomycin, gồm cả những trường hợp có nhiễm khuẩn huyết
Nhiễm khuẩn huyết, viêm nội tâm mạc nhiễm khuẩn, nhiễm khuẩn do vi khuẩn gram dương đã kháng thuốc (Enterococcus faecium kháng vancomycin, Staphylococcus aureus kháng methicillin)
Viêm phúc mạc (thẩm phân phúc mạc)
Nhiễm trùng liên quan đến ống thông trong thẩm phân phúc mạc
Viêm màng não, gồm cả những trường hợp liên quan đến chăm sóc y tế
Nhiễm khuẩn xương khớp
Bệnh lao kháng thuốc
Nhiễm khuẩn do vi khuẩn Mycobacteria không phải lao

2.3. Hiệu chỉnh liều theo chức năng thận  

2.4. Hiệu chỉnh liều theo chức năng gan  

3. Chống chỉ định  

4. Tác dụng phụ

5. Tương tác thuốc

6. Chú ý đặc biệt
`;

    const processor = new EnhancedMedicalProcessor();
    
    console.log('📄 Processing real Google Drive content...\n');
    
    try {
        const result = processor.processRealMedicalDocument(realGoogleDriveContent, 'Linezolid.docx');
        
        if (result) {
            console.log('✅ Processing successful!\n');
            
            console.log(`🏷️  Drug Name: ${result.drugName}`);
            console.log(`📊 Drug Class: ${result.drugClass}`);
            console.log(`⭐ Quality Score: ${result.qualityScore}%`);
            console.log(`📋 Sections found: ${Object.keys(result.sections).length}`);
            console.log(`🔑 Keywords: ${result.keywords.join(', ')}\n`);
            
            console.log('📑 Sections detected:');
            Object.keys(result.sections).forEach(section => {
                console.log(`  - ${section}: ${result.sections[section].substring(0, 100)}...`);
            });
            
            console.log('\n💊 Medical Data extracted:');
            console.log(`  - Dosages: ${result.medicalData.dosages.join(', ')}`);
            console.log(`  - Age Groups: ${result.medicalData.ageGroups.join(', ')}`);
            console.log(`  - Indications: ${result.medicalData.indications.join(', ')}`);
            console.log(`  - Routes: ${result.medicalData.routes.join(', ')}`);
            
        } else {
            console.log('❌ Processing failed');
        }
        
    } catch (error) {
        console.error('💥 Error during processing:', error);
    }
}

// Test different query patterns
async function testQueryValidation() {
    console.log('\n🔍 Testing Query Validation with Real Drug...\n');
    
    const testQueries = [
        "Linezolid dùng như thế nào?",
        "Liều lượng Linezolid cho trẻ em?",
        "Linezolid có tác dụng phụ gì?",
        "Chống chỉ định của thuốc Linezolid?",
        "Thuốc XYZ không tồn tại có an toàn không?",
        "Thời tiết hôm nay thế nào?"
    ];
    
    testQueries.forEach((query, index) => {
        console.log(`${index + 1}. "${query}"`);
        
        const lowerQuery = query.toLowerCase();
        const isLinezolid = lowerQuery.includes('linezolid');
        const isDrugQuery = /thuốc|liều|tác dụng|chống chỉ định/i.test(query);
        
        if (isDrugQuery && isLinezolid) {
            console.log('   ✅ Would be ACCEPTED: Known drug (Linezolid)');
        } else if (isDrugQuery && !isLinezolid) {
            console.log('   ❌ Would be REJECTED: Unknown drug');
        } else {
            console.log('   ✅ Would be ACCEPTED: Not a drug question');
        }
        console.log('');
    });
}

// Run tests
testRealGoogleDriveFormat()
    .then(() => testQueryValidation())
    .catch(console.error);
