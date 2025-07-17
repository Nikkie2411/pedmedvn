const express = require('express');
const router = express.Router();
const NodeCache = require('node-cache');
const { getSheetsClient, callSheetsAPI } = require('../services/sheets');
const logger = require('../utils/logger');
const { ensureSheetsClient } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');

// Multi-tier caching for drug data
const quickCache = new NodeCache({ stdTTL: 5 * 60, checkperiod: 60 }); // 5 minutes
const longCache = new NodeCache({ stdTTL: 30 * 60, checkperiod: 300 }); // 30 minutes

// Apply API rate limiting
router.use(apiLimiter);

router.get('/drugs', ensureSheetsClient, async (req, res) => {
    const startTime = Date.now();
    logger.info('🔍 Drug search request', { query: req.query, ip: req.ip });
    
    const { query, page: pageRaw = 1, limit: limitRaw = 10 } = req.query;
  
    const page = Math.max(1, parseInt(pageRaw) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(limitRaw) || 10)); // Max 50 results
  
    const cacheKey = query ? `drugs_search_${query.toLowerCase()}_${page}_${limit}` : `drugs_all_${page}_${limit}`;

    try {
      // Multi-tier cache check
      let drugs = quickCache.get(cacheKey) || longCache.get(cacheKey);
      
      if (!drugs) {
        logger.info('📦 Cache miss - fetching from Sheets');
        
        const sheetsClient = req.app.locals.sheetsClient;
        const SPREADSHEET_ID = req.app.locals.SPREADSHEET_ID;
        
        if (!sheetsClient || !SPREADSHEET_ID) {
          return res.status(503).json({ 
            success: false, 
            message: 'Service temporarily unavailable',
            code: 'SERVICE_UNAVAILABLE'
          });
        }

        // Use enhanced Sheets API call with caching
        const sheetsOperation = () => sheetsClient.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'pedmedvnch'
        });

        const response = await callSheetsAPI(sheetsOperation, `sheets_data_pedmedvnch`, 15 * 60); // 15 min cache
        const rows = response?.data?.values || [];
        
        if (rows.length === 0) {
          return res.status(404).json({ 
            success: false, 
            message: 'No drug data available',
            data: []
          });
        }
  
        // Process and structure the drug data
        drugs = rows.slice(1)
          .map(row => ({
            'Hoạt chất': row[2] || '',
            'Cập nhật': row[3] || '',
            'Phân loại dược lý': row[4] || '',
            'Liều thông thường trẻ sơ sinh': row[5] || '',
            'Liều thông thường trẻ em': row[6] || '',
            'Hiệu chỉnh liều theo chức năng thận': row[7] || '',
            'Hiệu chỉnh liều theo chức năng gan': row[8] || '',
            'Chống chỉ định': row[9] || '',
            'Tác dụng không mong muốn': row[10] || '',
            'Cách dùng (ngoài IV)': row[11] || '',
            'Tương tác thuốc chống chỉ định': row[12] || '',
            'Ngộ độc/Quá liều': row[13] || '',
            'Các thông số cần theo dõi': row[14] || '',
            'Bảo hiểm y tế thanh toán': row[15] || ''
          }))
          .filter(drug => drug['Hoạt chất']); // Remove empty entries

        // Cache in both tiers
        quickCache.set(cacheKey, drugs);
        longCache.set(cacheKey, drugs);
        
        logger.info(`💾 Cached ${drugs.length} drugs for key: ${cacheKey}`);
      } else {
        logger.info('✅ Cache hit - using cached data');
      }

      // Filter data if query provided
      let resultDrugs = drugs;
      if (query) {
        const searchTerm = query.toLowerCase().trim();
        resultDrugs = drugs.filter(drug =>
          drug['Hoạt chất']?.toLowerCase().includes(searchTerm)
        );
      }

      // Pagination
      const start = (page - 1) * limit;
      const paginatedResults = resultDrugs.slice(start, start + limit);
      
      const responseTime = Date.now() - startTime;
      logger.info(`🏁 Drug search completed in ${responseTime}ms`, {
        query,
        total: resultDrugs.length,
        returned: paginatedResults.length,
        page,
        cached: drugs === quickCache.get(cacheKey) || drugs === longCache.get(cacheKey)
      });

      res.json({
        success: true,
        total: resultDrugs.length,
        page,
        limit,
        data: paginatedResults,
        responseTime: `${responseTime}ms`
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('❌ Error fetching drug data:', error);
      
      // Try to return stale cache data
      const staleData = longCache.get(cacheKey);
      if (staleData) {
        logger.warn('🔄 Returning stale cache data due to error');
        return res.json({
          success: true,
          total: staleData.length,
          page,
          limit,
          data: staleData.slice((page - 1) * limit, page * limit),
          warning: 'Data may be outdated',
          responseTime: `${responseTime}ms`
        });
      }
      
      res.status(500).json({ 
        success: false,
        error: 'Unable to fetch drug data',
        message: 'Temporary server error. Please try again.',
        responseTime: `${responseTime}ms`
      });
    }
});

router.get('/drugs/invalidate-cache', ensureSheetsClient, async (req, res) => {
    cache.del('all_drugs');
    const wss = req.app.locals.wss;
  if (wss) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ action: 'cache_invalidated' }));
    }
  });
  }
  res.json({ success: true, message: 'Cache đã được làm mới' });
});

module.exports = router;