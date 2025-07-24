const { getSheetsClient } = require('./sheets');
const logger = require('../utils/logger');
const { SPREADSHEET_ID } = require('../config/config');
const NodeCache = require('node-cache');

// Cache for training data - longer TTL since this data changes less frequently
const trainingCache = new NodeCache({ stdTTL: 60 * 60 }); // 1 hour cache

/**
 * Load training data from Google Sheets
 * Assumes the sheet has columns like: Topic, Question, Answer, etc.
 * Content can contain HTML formatting
 */
async function loadTrainingData(sheetName = 'TrainingData') {
  const cacheKey = `training_${sheetName}`;
  
  // Check cache first
  const cached = trainingCache.get(cacheKey);
  if (cached) {
    logger.info(`📦 Using cached training data for ${sheetName}: ${cached.length} entries`);
    return cached;
  }

  try {
    logger.info(`📚 Loading training data from sheet: ${sheetName}`);
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

    // First row contains headers
    const headers = rows[0].map(header => header.trim());
    logger.info(`📋 Sheet headers: ${headers.join(', ')}`);

    // Process data rows
    const trainingData = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      // Create object from row data
      const entry = {};
      headers.forEach((header, index) => {
        entry[header] = row[index] || '';
      });

      // Skip empty entries
      if (Object.values(entry).every(value => !value.trim())) {
        continue;
      }

      trainingData.push(entry);
    }

    // Cache the processed data
    trainingCache.set(cacheKey, trainingData);
    
    logger.info(`✅ Loaded ${trainingData.length} training entries from ${sheetName}`);
    return trainingData;

  } catch (error) {
    logger.error(`❌ Error loading training data from ${sheetName}:`, error);
    
    // Try to return cached data if available
    const staleCache = trainingCache.get(cacheKey);
    if (staleCache) {
      logger.warn(`🔄 Using stale cached data for ${sheetName}`);
      return staleCache;
    }
    
    return [];
  }
}

/**
 * Convert HTML content to plain text for better processing
 */
function stripHtml(html) {
  if (!html) return '';
  
  return html
    .replace(/<br\s*\/?>/gi, '\n')  // Convert <br> to newlines
    .replace(/<p[^>]*>/gi, '\n')    // Convert <p> to newlines
    .replace(/<\/p>/gi, '')         // Remove closing </p>
    .replace(/<[^>]*>/g, '')        // Remove all other HTML tags
    .replace(/&nbsp;/g, ' ')        // Convert &nbsp; to spaces
    .replace(/&amp;/g, '&')         // Convert &amp; to &
    .replace(/&lt;/g, '<')          // Convert &lt; to <
    .replace(/&gt;/g, '>')          // Convert &gt; to >
    .replace(/&quot;/g, '"')        // Convert &quot; to "
    .replace(/&#39;/g, "'")         // Convert &#39; to '
    .trim();
}

/**
 * Process training data for chatbot consumption
 * Converts HTML content to plain text and formats for RAG
 */
async function getProcessedTrainingData(sheetName = 'TrainingData') {
  const rawData = await loadTrainingData(sheetName);
  
  if (rawData.length === 0) {
    return [];
  }

  return rawData.map(entry => {
    const processed = {};
    
    // Process each field and strip HTML
    Object.keys(entry).forEach(key => {
      processed[key] = stripHtml(entry[key]);
    });

    // Create a searchable text field combining all content
    const searchableFields = Object.values(processed).filter(value => value.trim());
    processed.searchableText = searchableFields.join(' ').toLowerCase();

    return processed;
  });
}

/**
 * Search training data based on query
 */
async function searchTrainingData(query, sheetName = 'TrainingData', limit = 10) {
  const trainingData = await getProcessedTrainingData(sheetName);
  
  if (!query || trainingData.length === 0) {
    return [];
  }

  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);

  // Score each entry based on relevance
  const scoredResults = trainingData.map(entry => {
    let score = 0;
    const searchText = entry.searchableText;

    // Exact phrase match gets highest score
    if (searchText.includes(queryLower)) {
      score += 10;
    }

    // Individual word matches
    queryWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = (searchText.match(regex) || []).length;
      score += matches * 2;
    });

    // Partial word matches
    queryWords.forEach(word => {
      if (searchText.includes(word)) {
        score += 1;
      }
    });

    return { ...entry, relevanceScore: score };
  });

  // Filter and sort by relevance
  return scoredResults
    .filter(entry => entry.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);
}

/**
 * Clear training data cache
 */
function clearTrainingCache() {
  trainingCache.flushAll();
  logger.info('🧹 Training data cache cleared');
}

/**
 * Get cache statistics
 */
function getTrainingCacheStats() {
  return trainingCache.getStats();
}

module.exports = {
  loadTrainingData,
  getProcessedTrainingData,
  searchTrainingData,
  stripHtml,
  clearTrainingCache,
  getTrainingCacheStats
};
