const { getSheetsClient } = require('./sheets');
const logger = require('../utils/logger');
const { SPREADSHEET_ID } = require('../config/config');
const NodeCache = require('node-cache');

// Cache for drug data - longer TTL since this data changes less frequently
const drugCache = new NodeCache({ stdTTL: 60 * 60 }); // 1 hour cache

/**
 * Load drug data from Google Sheets
 * Structure: Each row = one drug, columns = drug properties
 * Supports HTML content in cells
 */
async function loadDrugData(sheetName = 'Sheet1') {
  const cacheKey = `drugs_${sheetName}`;
  
  // Check cache first
  const cached = drugCache.get(cacheKey);
  if (cached) {
    logger.info(`📦 Using cached drug data for ${sheetName}: ${cached.length} drugs`);
    return cached;
  }

  try {
    logger.info(`💊 Loading drug data from sheet: ${sheetName}`);
    const sheetsClient = getSheetsClient();
    
    if (!sheetsClient) {
      throw new Error('Google Sheets client not initialized');
    }

    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: sheetName,
    });

    if (!response?.data?.values) {
      logger.warn(`⚠️ No data found in sheet: ${sheetName}`);
      return [];
    }

    const rows = response.data.values;
    if (rows.length === 0) {
      logger.warn(`⚠️ Empty sheet: ${sheetName}`);
      return [];
    }

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
      const drugName = drug['Tên thuốc'] || drug['Drug Name'] || drug['Name'] || drug['Thuốc'] || '';
      if (!drugName.trim()) {
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

  } catch (error) {
    logger.error(`❌ Error loading drug data from ${sheetName}:`, error);
    
    // Try to return cached data if available
    const staleCache = drugCache.get(cacheKey);
    if (staleCache) {
      logger.warn(`🔄 Using stale cached data for ${sheetName}`);
      return staleCache;
    }
    
    return [];
  }
}

/**
 * Create searchable content by combining all drug information
 */
function createSearchableContent(drug, headers) {
  const contentParts = [];
  
  // Add drug name multiple times for better matching
  const drugName = drug['Tên thuốc'] || drug['Drug Name'] || drug['Name'] || drug['Thuốc'] || '';
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
  const drugName = drug['Tên thuốc'] || drug['Drug Name'] || drug['Name'] || drug['Thuốc'] || '';
  if (drugName) {
    sections.push(`=== ${drugName.toUpperCase()} ===\n`);
  }

  // Organize content by importance
  const priorityFields = [
    'Tên thuốc', 'Drug Name', 'Name', 'Thuốc',
    'Hoạt chất', 'Active Ingredient', 'Thành phần',
    'Công dụng', 'Indication', 'Chỉ định', 'Tác dụng',
    'Liều dùng', 'Dosage', 'Cách dùng', 'Liều lượng',
    'Tác dụng phụ', 'Side Effects', 'Phản ứng phụ',
    'Chống chỉ định', 'Contraindication', 'Kiêng kỵ',
    'Tương tác thuốc', 'Drug Interactions', 'Tương tác',
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
async function searchDrugData(query, sheetName = 'Sheet1', limit = 10) {
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
async function getDrugByName(drugName, sheetName = 'Sheet1') {
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
