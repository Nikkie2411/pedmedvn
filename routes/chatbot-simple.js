// Simplified chatbot routes for reliable deployment
const express = require('express');
const router = express.Router();

// Import with error handling
let chatbotService;
try {
    chatbotService = require('../services/chatbot');
} catch (error) {
    console.error('Failed to load chatbot service:', error.message);
    chatbotService = null;
}

// Fallback drug database khi Google Sheets không available
const fallbackDrugs = {
    'tigecyclin': {
        name: 'Tigecyclin',
        contraindications: `CHỐNG CHỈ ĐỊNH:
• Dị ứng với tigecyclin hoặc bất kỳ thành phần nào trong thuốc
• Trẻ em dưới 8 tuổi (trừ trường hợp đặc biệt)
• Phụ nữ có thai và cho con bú (trừ khi lợi ích vượt trội rủi ro)
• Bệnh nhân có tiền sử dị ứng với tetracycline

THẬN TRỌNG:
• Giảm liều ở bệnh nhân suy gan nặng
• Theo dõi chức năng gan trong quá trình điều trị
• Có thể gây buồn nôn, nôn - cần theo dõi tình trạng dinh dưỡng
• Nguy cơ nhiễm trùng thứ phát do Clostridium difficile`,
        dosage: `LIỀU DÙNG:
• Người lớn: Liều tải 100mg, sau đó 50mg mỗi 12 giờ qua đường tĩnh mạch
• Trẻ em ≥8 tuổi: 1.2mg/kg mỗi 12 giờ (tối đa 50mg/liều)
• Điều chỉnh liều ở suy gan: Giảm 50% liều duy trì ở suy gan nặng`,
        indications: `CHỈ ĐỊNH:
• Nhiễm khuẩn da và mô mềm phức tạp
• Nhiễm khuẩn ổ bụng phức tạp
• Viêm phổi mắc phải tại cộng đồng
• Nhiễm khuẩn do vi khuẩn đa kháng thuốc`
    },
    'paracetamol': {
        name: 'Paracetamol',
        contraindications: `CHỐNG CHỈ ĐỊNH:
• Dị ứng với paracetamol
• Suy gan nặng
• Thiếu hụt enzyme G6PD nặng`,
        dosage: `LIỀU DÙNG:
• Trẻ em: 10-15mg/kg/lần, 4-6 giờ/lần
• Người lớn: 500-1000mg/lần, tối đa 4g/ngày`,
        indications: `CHỈ ĐỊNH:
• Hạ sốt
• Giảm đau nhẹ đến trung bình`
    },
    'ibuprofen': {
        name: 'Ibuprofen', 
        contraindications: `CHỐNG CHỈ ĐỊNH:
• Dị ứng với ibuprofen hoặc NSAID khác
• Loét dạ dày tá tràng đang hoạt động
• Suy tim nặng
• Suy thận nặng
• Tam cá nguyệt cuối của thai kỳ`,
        dosage: `LIỀU DÙNG:
• Trẻ em: 20-30mg/kg/ngày chia 3-4 lần
• Người lớn: 1200-1800mg/ngày chia 3-4 lần`,
        indications: `CHỈ ĐỊNH:
• Hạ sốt, giảm đau
• Viêm khớp
• Đau do viêm`
    }
};

// Basic rate limiting using express-rate-limit directly
const rateLimit = require('express-rate-limit');
const chatRateLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // Max 10 requests per minute per IP
    message: { 
        success: false, 
        message: 'Quá nhiều câu hỏi. Vui lòng đợi 1 phút trước khi hỏi tiếp.' 
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Health check for chatbot
router.get('/health', (req, res) => {
    res.json({
        success: true,
        data: {
            serviceLoaded: chatbotService !== null,
            isInitialized: chatbotService ? chatbotService.isInitialized : false,
            timestamp: new Date().toISOString()
        }
    });
});

// Chat endpoint with fallback
router.post('/chat', chatRateLimit, async (req, res) => {
    try {
        const { message, userId } = req.body;
        
        // Validate input
        if (!message || typeof message !== 'string' || message.trim().length < 3) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập câu hỏi hợp lệ (ít nhất 3 ký tự)'
            });
        }
        
        if (message.length > 500) {
            return res.status(400).json({
                success: false,
                message: 'Câu hỏi quá dài. Vui lòng nhập tối đa 500 ký tự.'
            });
        }
        
        // Check if chatbot service is available
        if (!chatbotService || !chatbotService.isInitialized) {
            console.log('🔄 Chatbot service not available, using fallback database');
            
            // Use fallback drug database
            const normalizedMessage = message.toLowerCase().trim();
            let response = null;
            
            // Search in fallback database
            for (const [drugKey, drugInfo] of Object.entries(fallbackDrugs)) {
                if (normalizedMessage.includes(drugKey) || normalizedMessage.includes(drugInfo.name.toLowerCase())) {
                    console.log(`✅ Found ${drugInfo.name} in fallback database`);
                    
                    let responseText = `Thông tin về **${drugInfo.name}**:\n\n`;
                    
                    // Check what user is asking for
                    if (normalizedMessage.includes('chống chỉ định') || normalizedMessage.includes('contraindication') || normalizedMessage.includes('kiêng kỵ')) {
                        responseText += drugInfo.contraindications;
                    } else if (normalizedMessage.includes('liều') || normalizedMessage.includes('dose') || normalizedMessage.includes('dùng')) {
                        responseText += drugInfo.dosage;
                    } else if (normalizedMessage.includes('công dụng') || normalizedMessage.includes('chỉ định') || normalizedMessage.includes('indication')) {
                        responseText += drugInfo.indications;
                    } else {
                        // Provide comprehensive info
                        responseText += drugInfo.indications + '\n\n' + drugInfo.dosage + '\n\n' + drugInfo.contraindications;
                    }
                    
                    responseText += '\n\n⚠️ **Lưu ý quan trọng**: Thông tin này chỉ mang tính chất tham khảo. Vui lòng tham khảo ý kiến bác sĩ hoặc dược sĩ trước khi sử dụng thuốc.';
                    
                    response = {
                        success: true,
                        data: {
                            message: responseText,
                            sources: [{
                                title: drugInfo.name,
                                source: 'PedMed Knowledge Base',
                                confidence: 90
                            }],
                            isAiGenerated: false,
                            model: 'Fallback Database'
                        }
                    };
                    break;
                }
            }
            
            // If no specific drug found, provide general response
            if (!response) {
                response = {
                    success: true,
                    data: {
                        message: `Xin lỗi, tôi đang tạm thời không thể truy cập được cơ sở dữ liệu thuốc đầy đủ. 

Hiện tại tôi có thể cung cấp thông tin về một số thuốc phổ biến như:
• **Tigecyclin** - kháng sinh đa năng
• **Paracetamol** - hạ sốt, giảm đau  
• **Ibuprofen** - chống viêm, giảm đau

Bạn có thể hỏi về: "Chống chỉ định của tigecyclin?" hoặc "Liều paracetamol cho trẻ em?"

Để có thông tin đầy đủ và chính xác nhất, vui lòng sử dụng chức năng tìm kiếm thuốc ở trang chính hoặc tham khảo ý kiến bác sĩ/dược sĩ.`,
                        sources: [],
                        isAiGenerated: false,
                        model: 'Fallback System'
                    }
                };
            }
            
            return res.json(response);
        }
        
        // Process chat request
        const response = await chatbotService.chat(message, userId || 'anonymous');
        res.json(response);
        
    } catch (error) {
        console.error('Chat endpoint error:', error);
        res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra. Vui lòng thử lại sau.'
        });
    }
});

// Status endpoint
router.get('/status', (req, res) => {
    try {
        if (!chatbotService) {
            return res.json({
                success: false,
                message: 'Chatbot service not loaded'
            });
        }
        
        res.json({
            success: true,
            data: {
                documentsCount: chatbotService.documents ? chatbotService.documents.length : 0,
                isInitialized: chatbotService.isInitialized,
                lastUpdated: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error getting status: ' + error.message
        });
    }
});

// Fallback suggestions endpoint
router.get('/suggestions', (req, res) => {
    res.json({
        success: true,
        data: [
            "Liều paracetamol cho trẻ 2 tuổi?",
            "Tác dụng phụ của amoxicillin?", 
            "Khi nào dùng ibuprofen?",
            "Thuốc ho cho trẻ nhỏ?",
            "Bổ sung vitamin D như thế nào?"
        ]
    });
});

module.exports = router;
