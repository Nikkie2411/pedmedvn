const { google } = require('googleapis');
const logger = require('../utils/logger');
const { SPREADSHEET_ID } = require('../config/config');
const NodeCache = require('node-cache');

// Cache for drug data - longer TTL since this data changes less frequently
const drugCache = new NodeCache({ stdTTL: 60 * 60 }); // 1 hour cache

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
  logger.error('❌ Could not load data from any sheet. Available sheets might be:');
  logger.error('   - Check sheet names in your Google Sheets');
  logger.error('   - Common names: pedmedvnch, PedMed2025, Sheet1, Thuốc, Drugs, Data');
  return [];
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
    const drugName = drug['Tên thuốc'] || drug['Drug Name'] || drug['Name'] || drug['Thuốc'] || drug['HOẠT CHẤT'] || '';
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
  const drugName = drug['Tên thuốc'] || drug['Drug Name'] || drug['Name'] || drug['Thuốc'] || drug['HOẠT CHẤT'] || '';
  if (drugName) {
    contentParts.push(drugName);
    contentParts.push(drugName.toLowerCase());
  }

  // Add all other fields
  headers.forEach(header => {
    const value = drug[header];
    if (value && value.trim() && header !== 'Tên thuốc' && header !== 'Drug Name' && header !== 'Name') {
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
  const drugName = drug['Tên thuốc'] || drug['Drug Name'] || drug['Name'] || drug['Thuốc'] || drug['HOẠT CHẤT'] || '';
  if (drugName) {
    sections.push(`=== ${drugName.toUpperCase()} ===\n`);
  }

  // Organize content by importance
  const priorityFields = [
    'Tên thuốc', 'Drug Name', 'Name', 'Thuốc', 'HOẠT CHẤT',
    'Hoạt chất', 'Active Ingredient', 'Thành phần',
    'Công dụng', 'Indication', 'Chỉ định', 'Tác dụng',
    'Liều dùng', 'Dosage', 'Cách dùng', 'Liều lượng',
    '2.1. LIỀU THÔNG THƯỜNG TRẺ SƠ SINH',
    '2.2. LIỀU THÔNG THƯỜNG TRẺ EM',
    '2.3. HIỆU CHỈNH LIỀU THEO CHỨC NĂNG THẬN',
    '2.4. HIỆU CHỈNH LIỀU THEO CHỨC NĂNG GAN',
    'Tác dụng phụ', 'Side Effects', 'Phản ứng phụ', '4. TÁC DỤNG KHÔNG MONG MUỐN ĐIỂN HÌNH VÀ THẬN TRỌNG',
    'Chống chỉ định', 'Contraindication', 'Kiêng kỵ', '3. CHỐNG CHỈ ĐỊNH',
    '5. CÁCH DÙNG',
    'Tương tác thuốc', 'Drug Interactions', 'Tương tác', '6. TƯƠNG TÁC THUỐC',
    '7. QUÁ LIỀU',
    '8. THEO DÕI ĐIỀU TRỊ',
    '9. BẢO HIỂM Y TẾ THANH TOÁN',
    'Bảo quản', 'Storage', 'Cách bảo quản',
    'Ghi chú', 'Notes', 'Lưu ý'
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

    // Content exact phrase match
    if (searchText.includes(queryLower)) {
      score += 30;
    }

    // Individual word matches in content
    queryWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = (searchText.match(regex) || []).length;
      score += matches * 10;
    });

    // Partial word matches
    queryWords.forEach(word => {
      if (searchText.includes(word)) {
        score += 5;
      }
    });

    return { ...drug, relevanceScore: score };
  });

  // Filter and sort by relevance
  return scoredResults
    .filter(drug => drug.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);
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
