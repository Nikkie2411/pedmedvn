const fs = require('fs');
const path = require('path');

// Simple chatbot setup without external dependencies
async function setupSimpleChatbot() {
    console.log('🤖 Setting up simple chatbot...');

    // Create directories
    const directories = [
        path.join(__dirname, 'data'),
        path.join(__dirname, 'documents'),
        path.join(__dirname, 'logs')
    ];

    directories.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`✅ Created: ${dir}`);
        }
    });

    // Create sample knowledge base with Vietnamese medical data
    const knowledgeBase = [
        {
            id: "paracetamol_lieuluong",
            title: "Liều lượng Paracetamol cho trẻ em",
            content: "Paracetamol là thuốc hạ sốt giảm đau an toàn cho trẻ em. Liều dùng: 10-15 mg/kg/lần, uống mỗi 4-6 giờ. Tối đa 60 mg/kg/ngày. Trẻ sơ sinh: 7.5-10 mg/kg/lần. Trẻ 1-3 tháng: 10-15 mg/kg/lần. Trẻ trên 3 tháng: 10-15 mg/kg/lần. Không dùng quá 5 ngày liên tiếp.",
            keywords: ["paracetamol", "acetaminophen", "hạ sốt", "giảm đau", "liều lượng", "trẻ em", "mg/kg", "sốt", "đau"],
            source: "Hướng dẫn sử dụng thuốc nhi khoa",
            lastUpdated: new Date().toISOString()
        },
        {
            id: "amoxicillin_khangsinh",
            title: "Amoxicillin - Kháng sinh beta-lactam",
            content: "Amoxicillin là kháng sinh nhóm penicillin, an toàn cho trẻ em. Liều dùng: 25-50 mg/kg/ngày chia 2-3 lần. Nhiễm khuẩn nặng: 80-90 mg/kg/ngày. Thời gian: 7-10 ngày. Chống chỉ định: dị ứng penicillin. Tác dụng phụ: tiêu chảy, nôn, phát ban da. Uống sau ăn để giảm kích ứng dạ dày.",
            keywords: ["amoxicillin", "kháng sinh", "penicillin", "beta-lactam", "nhiễm khuẩn", "viêm phổi", "viêm tai", "dị ứng"],
            source: "Sổ tay kháng sinh nhi khoa",
            lastUpdated: new Date().toISOString()
        },
        {
            id: "ibuprofen_hasot",
            title: "Ibuprofen hạ sốt chống viêm",
            content: "Ibuprofen là NSAID an toàn cho trẻ trên 6 tháng. Liều dùng: 5-10 mg/kg/lần, mỗi 6-8 giờ. Tối đa 40 mg/kg/ngày. Chỉ dùng cho trẻ trên 6 tháng tuổi. Chống chỉ định: hen phế quản, loét dạ dày, suy thận. Uống sau ăn, nhiều nước. Không dùng với paracetamol cùng lúc.",
            keywords: ["ibuprofen", "hạ sốt", "chống viêm", "NSAID", "6 tháng", "sốt", "đau", "viêm"],
            source: "WHO - Hướng dẫn hạ sốt trẻ em",
            lastUpdated: new Date().toISOString()
        },
        {
            id: "vitamin_d_bosung",
            title: "Bổ sung Vitamin D cho trẻ em",
            content: "Vitamin D quan trọng cho xương và răng. Liều dự phòng: 400 IU/ngày (0-1 tuổi), 600 IU/ngày (>1 tuổi). Thiếu hụt: 1000-2000 IU/ngày trong 6-8 tuần. Theo dõi 25(OH)D trong máu. Nguồn tự nhiên: ánh nắng mặt trời, cá béo, trứng. Uống cùng bữa ăn có chất béo.",
            keywords: ["vitamin D", "bổ sung", "xương", "răng", "IU", "thiếu hụt", "rachitis", "canxi"],
            source: "Khuyến cáo Hội Nhi khoa Việt Nam",
            lastUpdated: new Date().toISOString()
        },
        {
            id: "thuoc_ho_tre_em",
            title: "Thuốc ho cho trẻ em - Hướng dẫn an toàn",
            content: "Điều trị ho ở trẻ cần thận trọng. Trẻ <2 tuổi: KHÔNG dùng thuốc ho tổng hợp. Salbutamol syrup: 0.1-0.2 mg/kg/lần x3 lần/ngày cho hen suyễn. Dextromethorphan: 0.5 mg/kg/lần cho ho khan (>6 tuổi). Mật ong: 2.5-5ml cho trẻ >1 tuổi. Ưu tiên điều trị nguyên nhân, không triệu chứng.",
            keywords: ["thuốc ho", "ho", "salbutamol", "dextromethorphan", "mật ong", "ho khan", "hen suyễn"],
            source: "Hướng dẫn điều trị ho ở trẻ em",
            lastUpdated: new Date().toISOString()
        },
        {
            id: "zinc_tieuchay",
            title: "Zinc điều trị tiêu chảy cấp",
            content: "Zinc giúp giảm thời gian và mức độ tiêu chảy. Liều dùng: 10mg/ngày (2-6 tháng), 20mg/ngày (>6 tháng), uống trong 10-14 ngày. Có thể trộn với nước, sữa hoặc thức ăn. Tiếp tục cho con bú và ăn bình thường. Bù nước bằng ORS. Không dùng thuốc cầm tiêu chảy cho trẻ <2 tuổi.",
            keywords: ["zinc", "tiêu chảy", "ORS", "bù nước", "mg", "dinh dưỡng"],
            source: "WHO/UNICEF - Điều trị tiêu chảy",
            lastUpdated: new Date().toISOString()
        },
        {
            id: "cetirizine_diung",
            title: "Cetirizine điều trị dị ứng",
            content: "Cetirizine là thuốc kháng histamin thế hệ 2, ít gây buồn ngủ. Liều dùng: 2.5mg/ngày (6-12 tháng), 2.5mg x2 lần/ngày (1-2 tuổi), 5mg/ngày (2-6 tuổi), 10mg/ngày (>6 tuổi). Điều trị: viêm mũi dị ứng, mày đay, ngứa. Tác dụng phụ: buồn ngủ nhẹ, khô miệng.",
            keywords: ["cetirizine", "dị ứng", "kháng histamin", "viêm mũi", "mày đay", "ngứa"],
            source: "Hướng dẫn điều trị dị ứng nhi khoa",
            lastUpdated: new Date().toISOString()
        },
        {
            id: "ors_bunuoc",
            title: "ORS - Dung dịch bù nước điện giải",
            content: "ORS WHO/UNICEF công thức mới: Natri clorid 2.6g, Kali clorid 1.5g, Glucose 13.5g, Natri citrat 2.9g pha trong 1 lít nước sôi để nguội. Liều dùng: <2 tuổi: 50ml sau mỗi lần tiêu chảy. >2 tuổi: 100ml sau mỗi lần tiêu chảy. Uống từng ngụm nhỏ, thường xuyên.",
            keywords: ["ORS", "bù nước", "điện giải", "tiêu chảy", "natri", "kali", "glucose"],
            source: "WHO/UNICEF ORS formula",
            lastUpdated: new Date().toISOString()
        }
    ];

    // Save knowledge base
    const kbPath = path.join(__dirname, 'data', 'knowledge_base.json');
    fs.writeFileSync(kbPath, JSON.stringify(knowledgeBase, null, 2));
    console.log(`✅ Created knowledge base with ${knowledgeBase.length} documents`);

    // Create config file
    const config = {
        enabled: true,
        maxResponseLength: 500,
        confidenceThreshold: 0.3,
        maxSuggestions: 3,
        vietnamese: {
            stopWords: ["là", "của", "và", "có", "trong", "cho", "với", "được", "từ", "khi", "để"],
            medicalTerms: ["thuốc", "liều", "mg", "kg", "ngày", "lần", "trẻ", "em", "điều trị"]
        },
        suggestions: [
            "Liều paracetamol cho trẻ 2 tuổi?",
            "Tác dụng phụ của amoxicillin?", 
            "Khi nào dùng ibuprofen?",
            "Cách bổ sung vitamin D?",
            "Thuốc ho an toàn cho trẻ?"
        ]
    };

    const configPath = path.join(__dirname, 'data', 'chatbot_config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('✅ Created chatbot configuration');

    console.log('\n🎉 Simple chatbot setup completed!');
    console.log('📊 Statistics:');
    console.log(`- Documents: ${knowledgeBase.length}`);
    console.log(`- Keywords: ${knowledgeBase.reduce((sum, doc) => sum + doc.keywords.length, 0)}`);
    console.log(`- Config: Basic Vietnamese medical chatbot`);
}

// Run setup
if (require.main === module) {
    setupSimpleChatbot().catch(console.error);
}

module.exports = { setupSimpleChatbot };
