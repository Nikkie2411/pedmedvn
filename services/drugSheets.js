const { google } = require('googleapis');
const logger = require('../utils/logger');
const { SPREADSHEET_ID } = require('../config/config');
const NodeCache = require('node-cache');

// Cache for drug data - longer TTL since this data changes less frequently
const drugCache = new NodeCache({ stdTTL: 60 * 60 });

/**
 * Fallback drug data for testing when Google Sheets is not available
 * Structure matches actual Google Sheet: pedmedvnch
 */
function getFallbackDrugData() {
  const fallbackRows = [
    // Headers - Exact structure from pedmedvnch sheet
    ['HOẠT CHẤT', 'CẬP NHẬT', '1. PHÂN LOẠI DƯỢC LÝ', '2.1. LIỀU THÔNG THƯỜNG TRẺ SƠ SINH', '2.2. LIỀU THÔNG THƯỜNG TRẺ EM', '2.3. HIỆU CHỈNH LIỀU THEO CHỨC NĂNG THẬN', '2.4. HIỆU CHỈNH LIỀU THEO CHỨC NĂNG GAN', '3. CHỐNG CHỈ ĐỊNH', '4. TÁC DỤNG KHÔNG MONG MUỐN ĐIỂN HÌNH VÀ THẬN TRỌNG', '5. CÁCH DÙNG (Ngoài đường tĩnh mạch)', '6. TƯƠNG TÁC THUỐC', '7. QUÁ LIỀU', '8. THEO DÕI ĐIỀU TRỊ', '9. BẢO HIỂM Y TẾ THANH TOÁN'],
    
    // Tigecycline - Complete pediatric information following actual structure
    [
      'Tigecycline',
      '2023-12-01',
      'Kháng sinh Glycylcycline, kháng sinh phổ rộng thế hệ mới',
      'KHÔNG khuyến cáo dùng cho trẻ sơ sinh < 28 ngày do thiếu dữ liệu an toàn',
      'Trẻ ≥8 tuổi: Loading dose 1.2mg/kg IV (max 50mg), sau đó 0.6mg/kg q12h IV (max 25mg/dose). Trẻ <8 tuổi: CHỈ dùng khi không có lựa chọn khác, cùng liều',
      'Không cần điều chỉnh liều nếu CrCl >30ml/min. CrCl <30ml/min: giảm 50% liều duy trì',
      'Child-Pugh A,B: không cần điều chỉnh. Child-Pugh C: giảm 50% liều duy trì',
      'Trẻ <8 tuổi (trừ trường hợp đặc biệt), Thai phụ, Cho con bú, Dị ứng tetracycline group, Suy gan nặng',
      'Phổ biến: Nôn ói (21%), tiêu chảy (13%), đau bụng (7%). Nghiêm trọng: Tăng men gan, thrombocytopenia, photosensitivity. Đặc biệt ở trẻ <8 tuổi: ảnh hưởng phát triển răng và xương',
      'PO: Không có. Chỉ có đường IV',
      'Warfarin (tăng INR), Digoxin (giảm hấp thu), CYP3A4 substrates. Tránh dùng cùng thuốc chống đông',
      'Triệu chứng: nôn ói nhiều, tiêu chảy nặng. Xử trí: ngưng thuốc, hỗ trợ triệu chứng, không có thuốc giải độc đặc hiệu',
      'Monitor: Men gan (ALT, AST) hàng tuần, PT/INR nếu dùng anticoagulant, CBC, chức năng thận. Theo dõi photosensitivity',
      'Trong danh mục BHYT với điều kiện: chỉ thanh toán cho nhiễm trùng nặng kháng đa thuốc, có xét nghiệm vi sinh chứng minh'
    ],
    
    // Amoxicillin
    [
      'Amoxicillin',
      '2023-11-15',
      'Kháng sinh Beta-lactam, nhóm Penicillin',
      'An toàn cho trẻ sơ sinh: 20-30mg/kg/ngày chia 2-3 lần',
      'Nhiễm trùng nhẹ-vừa: 20-40mg/kg/ngày chia 3 lần PO. Nhiễm trùng nặng: 80-90mg/kg/ngày. Max: 500mg/dose',
      'CrCl >30ml/min: liều bình thường. CrCl 10-30: giảm 50%. CrCl <10: giảm 75%',
      'Không cần điều chỉnh liều',
      'Dị ứng penicillin, Mononucleosis (EBV) - nguy cơ phát ban cao',
      'Phổ biến: Tiêu chảy (9%), nôn, đau bụng. Hiếm: phát ban, dị ứng nghiêm trọng (anaphylaxis <0.01%)',
      'PO: Uống với hoặc không có thức ăn. Lắc đều trước khi dùng (dạng suspension)',
      'Warfarin (tăng INR), Methotrexate (tăng độc tính), OCP (giảm hiệu quả)',
      'Triệu chứng hiếm gặp do độc tính thấp. Chủ yếu là GI upset. Xử trí: ngưng thuốc, hỗ trợ triệu chứng',
      'Theo dõi dấu hiệu dị ứng, hiệu quả điều trị, GI symptoms. Không cần monitor đặc biệt',
      'Trong danh mục BHYT, thanh toán đầy đủ cho hầu hết chỉ định'
    ],
    
    // Paracetamol
    [
      'Paracetamol (Acetaminophen)',
      '2023-10-20',
      'Thuốc giảm đau hạ sốt không phải NSAID',
      'An toàn: 10-15mg/kg/dose q6-8h PO/PR. Max: 60mg/kg/ngày',
      'PO/PR: 10-15mg/kg/dose q4-6h (max 75mg/kg/ngày, không quá 4g/ngày). IV: 15mg/kg/dose q6h',
      'Không cần điều chỉnh liều nếu CrCl >50ml/min',
      'Suy gan: CHỐNG CHỈ ĐỊNH. Gan bù trừ: giảm 50% liều và tăng khoảng cách',
      'Suy gan nặng, Deficiency G6PD nặng, Dị ứng paracetamol',
      'Rất hiếm ở liều điều trị. Quá liều >150mg/kg: hepatotoxicity, methemoglobinemia (đặc biệt ở trẻ <2 tuổi)',
      'PO: Với hoặc không thức ăn. PR: Suppository sâu vào hậu môn',
      'Warfarin (liều cao >2g/ngày kéo dài), Isoniazid (tăng hepatotoxicity)',
      'Quá liều nghiêm trọng: N-acetylcysteine trong 8-24h đầu. Monitor ALT, PT/INR',
      'Liều điều trị: không cần monitor. Liều cao/kéo dài: theo dõi chức năng gan',
      'Trong danh mục BHYT, thanh toán đầy đủ'
    ]
  ];
  
  logger.info('📋 Using enhanced fallback drug data with actual sheet structure (3 comprehensive drugs)');
  return processDrugData(fallbackRows, 'FallbackData');
}

/**
 * Get drug cache statistics
 */
function getDrugCacheStats() {
  return drugCache.getStats();
}

module.exports = {
  loadDrugData,
  searchDrugData,
  getDrugByName,
  stripHtml,
  clearDrugCache,
  getDrugCacheStats,
  createSearchableContent,
  createStructuredContent
};

/**
 * Load drug data from Google Sheets with automatic sheet detection
 * Structure: Each row = one drug, columns = drug properties
 * Supports HTML content in cells
 */
async function loadDrugData(sheetName = null) {
  // Try multiple common sheet names if none specified
  const sheetNames = sheetName ? [sheetName] : [
    'pedmedvnch',     // Tên sheet thực tế
  ];

  for (const trySheetName of sheetNames) {
    const cacheKey = `drugs_${trySheetName}`;
    
    // Check cache first
    const cached = drugCache.get(cacheKey);
    if (cached) {
      logger.info(`📦 Using cached drug data for ${trySheetName}: ${cached.length} drugs`);
      return cached;
    }

    try {
      logger.info(`💊 Trying to load drug data from sheet: ${trySheetName}`);
      
      // Direct Google Sheets API call
      let auth;
      if (process.env.GOOGLE_CREDENTIALS) {
        // Production: use environment variable
        auth = new google.auth.GoogleAuth({
          credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
          scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
      } else if (require('fs').existsSync('./vietanhprojects-124f98147480.json')) {
        // Development: use local file
        auth = new google.auth.GoogleAuth({
          keyFile: './vietanhprojects-124f98147480.json',
          scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
      } else {
        throw new Error('No Google credentials found. Set GOOGLE_CREDENTIALS environment variable or add service account file.');
      }

      const sheets = google.sheets({ version: 'v4', auth });
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: trySheetName,
      });

      if (!response?.data?.values) {
        logger.warn(`⚠️ No data found in sheet: ${trySheetName}`);
        continue; // Try next sheet name
      }

      const rows = response.data.values;
      if (rows.length === 0) {
        logger.warn(`⚠️ Empty sheet: ${trySheetName}`);
        continue; // Try next sheet name
      }

      // Success! Process the data
      logger.info(`✅ Found data in sheet: ${trySheetName}`);
      return await processDrugData(rows, trySheetName);

    } catch (error) {
      logger.warn(`⚠️ Failed to load from sheet ${trySheetName}: ${error.message}`);
      // Continue to try next sheet name
    }
  }

  // If we get here, no sheet worked
  logger.error('❌ Could not load data from any sheet. Using fallback data.');
  logger.error('   - Check sheet names in your Google Sheets');
  logger.error('   - Common names: pedmedvnch, PedMed2025, Sheet1, Thuốc, Drugs, Data');
  return getFallbackDrugData();
}

/**
 * Process drug data from sheet rows
 */
async function processDrugData(rows, sheetName) {
  const cacheKey = `drugs_${sheetName}`;

  // First row contains headers (column names)
  const headers = rows[0].map(header => header.trim());
  logger.info(`📋 Drug data columns: ${headers.join(', ')}`);

  // Process each drug (each row after header)
  const drugData = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    // Create drug object from row data
    const drug = {};
    headers.forEach((header, index) => {
      const cellValue = row[index] || '';
      drug[header] = stripHtml(cellValue); // Clean HTML content
    });

    // Skip empty drugs (no name or main identifier)
    const drugName = drug['HOẠT CHẤT'] || drug['Tên thuốc'] || drug['Drug Name'] || drug['Name'] || drug['Thuốc'] || '';
    if (!drugName.trim()) {
      console.log(`⚠️ Skipping row ${i}: No drug name found. Available fields:`, Object.keys(drug).slice(0, 5));
      continue;
    }

    // Create comprehensive drug entry for AI training
    const drugEntry = {
      id: `drug_${i}`,
      name: drugName.trim(),
      originalData: drug,
      searchableContent: createSearchableContent(drug, headers),
      structuredContent: createStructuredContent(drug, headers),
      source: `Google Sheets - ${sheetName}`,
      lastUpdated: new Date().toISOString(),
      type: 'drug_information'
    };

    drugData.push(drugEntry);
    logger.info(`💊 Processed: ${drugName} (${drugEntry.searchableContent.length} chars)`);
  }

  // Cache the processed data
  drugCache.set(cacheKey, drugData);
  
  logger.info(`✅ Loaded ${drugData.length} drugs from ${sheetName}`);
  return drugData;
}

/**
 * Create searchable content by combining all drug information
 */
function createSearchableContent(drug, headers) {
  const contentParts = [];
  
  // Add drug name multiple times for better matching
  const drugName = drug['HOẠT CHẤT'] || drug['Tên thuốc'] || drug['Drug Name'] || drug['Name'] || drug['Thuốc'] || '';
  if (drugName) {
    contentParts.push(drugName);
    contentParts.push(drugName.toLowerCase());
  }

  // Add all other fields
  headers.forEach(header => {
    const value = drug[header];
    if (value && value.trim() && header !== 'HOẠT CHẤT' && header !== 'Tên thuốc' && header !== 'Drug Name' && header !== 'Name') {
      contentParts.push(`${header}: ${value}`);
    }
  });

  return contentParts.join(' ').toLowerCase();
}

/**
 * Create structured content for AI with clear field labels
 */
function createStructuredContent(drug, headers) {
  const sections = [];
  
  // Drug name section
  const drugName = drug['HOẠT CHẤT'] || drug['Tên thuốc'] || drug['Drug Name'] || drug['Name'] || drug['Thuốc'] || '';
  if (drugName) {
    sections.push(`=== ${drugName.toUpperCase()} ===\n`);
  }

  // Organize content by importance - using actual sheet headers
  const priorityFields = [
    'HOẠT CHẤT',
    '1. PHÂN LOẠI DƯỢC LÝ',
    '2.1. LIỀU THÔNG THƯỜNG TRẺ SƠ SINH',
    '2.2. LIỀU THÔNG THƯỜNG TRẺ EM',
    '2.3. HIỆU CHỈNH LIỀU THEO CHỨC NĂNG THẬN',
    '2.4. HIỆU CHỈNH LIỀU THEO CHỨC NĂNG GAN',
    '3. CHỐNG CHỈ ĐỊNH',
    '4. TÁC DỤNG KHÔNG MONG MUỐN ĐIỂN HÌNH VÀ THẬN TRỌNG',
    '5. CÁCH DÙNG (Ngoài đường tĩnh mạch)',
    '6. TƯƠNG TÁC THUỐC',
    '7. QUÁ LIỀU',
    '8. THEO DÕI ĐIỀU TRỊ',
    '9. BẢO HIỂM Y TẾ THANH TOÁN',
    'CẬP NHẬT'
  ];

  // Add priority fields first
  priorityFields.forEach(field => {
    if (drug[field] && drug[field].trim()) {
      sections.push(`${field}: ${drug[field]}\n`);
    }
  });

  // Add remaining fields
  headers.forEach(header => {
    if (!priorityFields.includes(header) && drug[header] && drug[header].trim()) {
      sections.push(`${header}: ${drug[header]}\n`);
    }
  });

  return sections.join('\n');
}

/**
 * Convert HTML content to plain text for better AI processing
 */
function stripHtml(html) {
  if (!html) return '';
  
  return html
    .replace(/<br\s*\/?>/gi, '\n')  // Convert <br> to newlines
    .replace(/<p[^>]*>/gi, '\n')    // Convert <p> to newlines
    .replace(/<\/p>/gi, '')         // Remove closing </p>
    .replace(/<li[^>]*>/gi, '• ')   // Convert <li> to bullet points
    .replace(/<\/li>/gi, '\n')      // End list items with newline
    .replace(/<ul[^>]*>|<\/ul>/gi, '\n') // List containers
    .replace(/<ol[^>]*>|<\/ol>/gi, '\n') // Ordered list containers
    .replace(/<strong[^>]*>|<\/strong>/gi, '') // Remove strong tags but keep content
    .replace(/<b[^>]*>|<\/b>/gi, '')           // Remove bold tags
    .replace(/<em[^>]*>|<\/em>/gi, '')         // Remove emphasis tags
    .replace(/<i[^>]*>|<\/i>/gi, '')           // Remove italic tags
    .replace(/<[^>]*>/g, '')        // Remove all other HTML tags
    .replace(/&nbsp;/g, ' ')        // Convert &nbsp; to spaces
    .replace(/&amp;/g, '&')         // Convert &amp; to &
    .replace(/&lt;/g, '<')          // Convert &lt; to <
    .replace(/&gt;/g, '>')          // Convert &gt; to >
    .replace(/&quot;/g, '"')        // Convert &quot; to "
    .replace(/&#39;/g, "'")         // Convert &#39; to '
    .replace(/\n\s*\n/g, '\n')      // Remove multiple newlines
    .trim();
}

/**
 * Search drugs based on query with advanced matching
 */
async function searchDrugData(query, sheetName = 'pedmedvnch', limit = 10) {
  const drugData = await loadDrugData(sheetName);
  
  if (!query || drugData.length === 0) {
    return [];
  }

  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(word => word.length > 1);

  // Detect query intent for better matching
  const intent = detectQueryIntent(queryLower);
  
  // Score each drug based on relevance
  const scoredResults = drugData.map(drug => {
    let score = 0;
    const searchText = drug.searchableContent;
    const drugName = drug.name.toLowerCase();

    // Drug name exact match gets highest score
    if (drugName.includes(queryLower)) {
      score += 100;
    }

    // Drug name partial match
    queryWords.forEach(word => {
      if (drugName.includes(word)) {
        score += 50;
      }
    });

    // Alternative names match
    const originalData = drug.originalData || {};
    const altNames = originalData['Tên khác'] || originalData['Alternative Names'] || '';
    if (altNames.toLowerCase().includes(queryLower)) {
      score += 80;
    }

    // Content exact phrase match
    if (searchText.includes(queryLower)) {
      score += 30;
    }

    // Content word match
    queryWords.forEach(word => {
      if (searchText.includes(word)) {
        score += 10;
      }
    });

    // Intent-specific scoring boost
    if (intent.type && originalData[intent.field]) {
      const fieldContent = originalData[intent.field].toLowerCase();
      if (fieldContent.includes(queryLower)) {
        score += 40; // Boost if query matches specific field user is asking about
      }
    }

    return { drug, score };
  });

  // Filter and sort by score
  const results = scoredResults
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(result => ({
      ...result.drug,
      queryIntent: intent,
      relevanceScore: result.score
    }));

  return results;
}

/**
 * Detect user's query intent to provide more relevant responses
 */
function detectQueryIntent(query) {
  const intents = {
    contraindication: {
      keywords: ['chống chỉ định', 'không được dùng', 'cấm', 'không nên', 'tránh', 'contraindication'],
      field: '3. CHỐNG CHỈ ĐỊNH'
    },
    dosage: {
      keywords: ['liều', 'dose', 'dosage', 'bao nhiêu', 'dùng thế nào', 'uống', 'tiêm', 'trẻ lớn', 'trẻ em'],
      field: '2.2. LIỀU THÔNG THƯỜNG TRẺ EM'
    },
    dosage_newborn: {
      keywords: ['trẻ sơ sinh', 'sơ sinh', 'newborn', 'neonate'],
      field: '2.1. LIỀU THÔNG THƯỜNG TRẺ SƠ SINH'
    },
    sideEffect: {
      keywords: ['tác dụng phụ', 'side effect', 'phản ứng', 'biến chứng', 'adverse', 'không mong muốn', 'thận trọng'],
      field: '4. TÁC DỤNG KHÔNG MONG MUỐN ĐIỂN HÌNH VÀ THẬN TRỌNG'
    },
    indication: {
      keywords: ['chỉ định', 'dùng cho', 'điều trị', 'indication', 'dùng khi nào', 'bệnh gì', 'phân loại'],
      field: '1. PHÂN LOẠI DƯỢC LÝ'
    },
    interaction: {
      keywords: ['tương tác', 'interaction', 'kết hợp', 'dùng chung'],
      field: '6. TƯƠNG TÁC THUỐC'
    },
    administration: {
      keywords: ['cách dùng', 'administration', 'đường dùng', 'uống', 'tiêm'],
      field: '5. CÁCH DÙNG (Ngoài đường tĩnh mạch)'
    },
    overdose: {
      keywords: ['quá liều', 'overdose', 'intoxication', 'ngộ độc'],
      field: '7. QUÁ LIỀU'
    },
    monitoring: {
      keywords: ['theo dõi', 'monitor', 'kiểm tra', 'xét nghiệm'],
      field: '8. THEO DÕI ĐIỀU TRỊ'
    },
    bhyt: {
      keywords: ['bảo hiểm y tế', 'bhyt', 'thẻ bhyt'],
      field: '9. BẢO HIỂM Y TẾ THANH TOÁN'
    }
  };

  for (const [intentType, config] of Object.entries(intents)) {
    for (const keyword of config.keywords) {
      if (query.includes(keyword)) {
        return {
          type: intentType,
          field: config.field,
          keyword: keyword
        };
      }
    }
  }

  return { type: 'general', field: null };
}

/**
 * Get drug information by name
 */
async function getDrugByName(drugName, sheetName = 'pedmedvnch') {
  const results = await searchDrugData(drugName, sheetName, 1);
  return results.length > 0 ? results[0] : null;
}

/**
 * Clear drug data cache
 */
function clearDrugCache() {
  drugCache.flushAll();
  logger.info('🧹 Drug data cache cleared');
}

/**
 * Get cache statistics
 */
function getDrugCacheStats() {
  return drugCache.getStats();
}

module.exports = {
  loadDrugData,
  searchDrugData,
  getDrugByName,
  stripHtml,
  clearDrugCache,
  getDrugCacheStats,
  createSearchableContent,
  createStructuredContent
};
