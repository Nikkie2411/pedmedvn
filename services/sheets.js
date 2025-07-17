const { google } = require('googleapis');
const logger = require('../utils/logger');
const { SPREADSHEET_ID, GOOGLE_CREDENTIALS } = require('../config/config');
const NodeCache = require('node-cache');

let sheetsClient;
let authClient; // Reuse auth client
let cachedUsernames = [];
let isLoadingUsernames = false;

// Cache for sheet data (5 minutes)
const sheetCache = new NodeCache({ 
  stdTTL: 300, // 5 minutes
  checkperiod: 60, // cleanup every minute
  maxKeys: 100
});

// Connection pool configuration
const connectionPool = {
  maxRetries: 3,
  retryDelay: 2000,
  timeout: 15000
};

async function initializeSheetsClient(retries = connectionPool.maxRetries, delay = connectionPool.retryDelay) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const credentialsString = process.env.GOOGLE_CREDENTIALS;
      if (!credentialsString) {
        throw new Error('GOOGLE_CREDENTIALS environment variable is not set');
      }
      
      // Reuse auth client if available
      if (!authClient) {
        const auth = new google.auth.GoogleAuth({
          credentials: JSON.parse(credentialsString),
          scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        authClient = await auth.getClient();
      }
      
      sheetsClient = google.sheets({ 
        version: 'v4', 
        auth: authClient,
        timeout: connectionPool.timeout,
        retryConfig: {
          retry: retries,
          retryDelay: delay
        }
      });
      
      logger.info(`✅ Google Sheets client initialized (attempt ${attempt})`);
      return;
    } catch (error) {
      logger.error(`❌ Attempt ${attempt}/${retries} failed:`, error.message);
      if (attempt === retries) {
        logger.error('All attempts failed. Server cannot start.');
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function loadUsernames() {
  if (isLoadingUsernames) {
    logger.debug('Username loading already in progress');
    return;
  }
  
  // Check cache first
  const cached = sheetCache.get('usernames');
  if (cached) {
    cachedUsernames = cached;
    logger.debug('✅ Using cached usernames');
    return;
  }
  
  isLoadingUsernames = true;
  try {
    const range = 'Accounts';
    logger.debug('📡 Fetching usernames from sheet...');
    
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
      majorDimension: 'ROWS',
      valueRenderOption: 'UNFORMATTED_VALUE'
    });

    if (!response?.data?.values) {
      logger.warn("⚠️ No username data received from sheet");
      return;
    }

    const rows = response.data.values;
    const headers = rows[0] || [];
    const usernameIndex = headers.indexOf("Username");

    if (usernameIndex === -1) {
      logger.error("⚠️ Username column not found in sheet");
      return;
    }

    // Optimized processing
    const usernames = rows.slice(1)
      .map(row => row[usernameIndex]?.toString().trim().toLowerCase())
      .filter(username => username && username.length > 0);
    
    cachedUsernames = usernames;
    
    // Cache for 5 minutes
    sheetCache.set('usernames', usernames, 300);
    
    logger.info(`✅ Loaded ${usernames.length} usernames and cached`);
  } catch (error) {
    logger.error("❌ Error loading usernames:", error.message);
    
    // Keep old data if available
    if (cachedUsernames.length > 0) {
      logger.info('📦 Using previously cached usernames');
    }
  } finally {
    isLoadingUsernames = false;
  }
}
// Optimized sheet operations with caching
async function batchGetSheetData(ranges, useCache = true) {
  const cacheKey = `batch:${ranges.join(',')}`;
  
  if (useCache) {
    const cached = sheetCache.get(cacheKey);
    if (cached) {
      logger.debug('✅ Using cached batch data');
      return cached;
    }
  }
  
  try {
    const response = await sheetsClient.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges,
      majorDimension: 'ROWS',
      valueRenderOption: 'UNFORMATTED_VALUE'
    });
    
    if (useCache) {
      sheetCache.set(cacheKey, response.data, 180); // 3 minutes cache
    }
    
    return response.data;
  } catch (error) {
    logger.error('❌ Batch get sheet data failed:', error.message);
    throw error;
  }
}

// Enhanced error handling for sheet operations
async function safeSheetOperation(operation, fallbackValue = null) {
  try {
    return await operation();
  } catch (error) {
    logger.error('Sheet operation failed:', error.message);
    
    // Return cached data if available
    if (fallbackValue !== null) {
      return fallbackValue;
    }
    
    throw error;
  }
}

module.exports = { 
  initializeSheetsClient, 
  loadUsernames, 
  getSheetsClient: () => sheetsClient, 
  getCachedUsernames: () => cachedUsernames,
  batchGetSheetData,
  safeSheetOperation,
  sheetCache
};