const { google } = require('googleapis');
const NodeCache = require('node-cache');
const logger = require('../utils/logger');
const { SPREADSHEET_ID, GOOGLE_CREDENTIALS } = require('../config/config');

let sheetsClient;
let cachedUsernames = [];
let isLoadingUsernames = false;

// Multi-level caching system
const fastCache = new NodeCache({ stdTTL: 2 * 60 }); // 2 minutes for fast access
const slowCache = new NodeCache({ stdTTL: 10 * 60 }); // 10 minutes for backup
const drugCache = new NodeCache({ stdTTL: 30 * 60 }); // 30 minutes for drug data

// Connection pooling for Google Sheets
let authClient;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function initializeSheetsClient(retries = MAX_RETRIES, delay = RETRY_DELAY) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const credentialsString = process.env.GOOGLE_CREDENTIALS;
      if (!credentialsString) {
        throw new Error('GOOGLE_CREDENTIALS environment variable is not set');
      }
      
      if (!authClient) {
        const auth = new google.auth.GoogleAuth({
          credentials: JSON.parse(credentialsString),
          scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        authClient = await auth.getClient();
      }
      
      sheetsClient = google.sheets({ version: 'v4', auth: authClient });
      logger.info('✅ Google Sheets client initialized successfully');
      return;
    } catch (error) {
      logger.error(`❌ Attempt ${attempt}/${retries} failed to initialize Google Sheets client:`, error);
      if (attempt === retries) {
        logger.error('🚨 All attempts failed. Server cannot start.');
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delay * attempt)); // Exponential backoff
    }
  }
}

async function loadUsernames() {
  if (isLoadingUsernames) return;
  
  // Check cache first
  const cacheKey = 'usernames_list';
  const cached = fastCache.get(cacheKey) || slowCache.get(cacheKey);
  if (cached) {
    cachedUsernames = cached;
    logger.info(`✅ Loaded ${cached.length} usernames from cache`);
    return;
  }
  
  isLoadingUsernames = true;
  try {
    const range = 'Accounts';
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });

    if (!response?.data?.values) {
      logger.warn("⚠️ No username data received from Sheets");
      return;
    }

    const rows = response.data.values;
    const headers = rows[0] || [];
    const usernameIndex = headers.indexOf("Username");

    if (usernameIndex === -1) {
      logger.error("⚠️ Username column not found in Sheets");
      return;
    }

    cachedUsernames = rows.slice(1)
      .map(row => row[usernameIndex]?.trim().toLowerCase())
      .filter(username => username); // Remove empty usernames
    
    // Cache in both fast and slow cache
    fastCache.set(cacheKey, cachedUsernames);
    slowCache.set(cacheKey, cachedUsernames);
    
    logger.info(`✅ Loaded ${cachedUsernames.length} usernames successfully`);
  } catch (error) {
    logger.error("❌ Error loading usernames:", error);
    
    // Try to use backup cache
    const backup = slowCache.get(cacheKey);
    if (backup) {
      cachedUsernames = backup;
      logger.info("🔄 Using backup cache for usernames");
    }
  } finally {
    isLoadingUsernames = false;
  }
}

// Enhanced Sheets API call with caching and retry logic
async function callSheetsAPI(operation, cacheKey = null, cacheTTL = 300) {
  // Check cache first
  if (cacheKey) {
    const cached = fastCache.get(cacheKey) || slowCache.get(cacheKey);
    if (cached) {
      logger.info(`📦 Cache hit for ${cacheKey}`);
      return cached;
    }
  }
  
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      logger.info(`🔄 Sheets API call attempt ${attempt}/${MAX_RETRIES}`);
      const result = await operation();
      
      // Cache successful results
      if (cacheKey && result) {
        fastCache.set(cacheKey, result, cacheTTL);
        if (cacheTTL > 300) { // Only cache in slow cache for longer TTL
          slowCache.set(cacheKey, result, cacheTTL);
        }
        logger.info(`💾 Cached result for ${cacheKey}`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      logger.warn(`⚠️ Attempt ${attempt} failed:`, error.message);
      
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY * Math.pow(2, attempt - 1); // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // If all retries failed, try to return cached data
  if (cacheKey) {
    const staleCache = slowCache.get(cacheKey);
    if (staleCache) {
      logger.warn("🔄 All retries failed, using stale cache");
      return staleCache;
    }
  }
  
  throw lastError;
}

module.exports = { 
  initializeSheetsClient, 
  loadUsernames, 
  callSheetsAPI,
  getSheetsClient: () => sheetsClient, 
  getCachedUsernames: () => cachedUsernames,
  clearCache: () => {
    fastCache.flushAll();
    slowCache.flushAll();
    drugCache.flushAll();
    logger.info('🧹 All caches cleared');
  },
  getCacheStats: () => ({
    fastCache: fastCache.getStats(),
    slowCache: slowCache.getStats(),
    drugCache: drugCache.getStats()
  })
};