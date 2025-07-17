const express = require('express');
const router = express.Router();
const NodeCache = require('node-cache');
const { getSheetsClient, batchGetSheetData, safeSheetOperation } = require('../services/sheets');
const logger = require('../utils/logger');
const { ensureSheetsClient } = require('../middleware/auth');

// Enhanced caching system
const drugCache = new NodeCache({ 
  stdTTL: 1800, // 30 minutes for drug data
  checkperiod: 300, // cleanup every 5 minutes
  maxKeys: 200 
});

const searchCache = new NodeCache({ 
  stdTTL: 600, // 10 minutes for search results
  checkperiod: 120,
  maxKeys: 500 
});

// Performance monitoring
let requestCount = 0;
let cacheHits = 0;

router.get('/drugs', ensureSheetsClient, async (req, res) => {
    requestCount++;
    const startTime = Date.now();
    
    logger.info('Drug search request', { 
      query: req.query, 
      requestId: requestCount,
      userAgent: req.get('User-Agent')?.substring(0, 50)
    });
    
    const { query, page: pageRaw = 1, limit: limitRaw = 10 } = req.query;
  
    const page = Math.max(1, parseInt(pageRaw) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(limitRaw) || 10)); // Cap at 50
  
    const cacheKey = query ? `drugs_search_${query}_${page}_${limit}` : `drugs_all_${page}_${limit}`;

    try {
      // Check search cache first
      let result = searchCache.get(cacheKey);
      if (result) {
        cacheHits++;
        logger.debug('Search cache hit', { 
          cacheKey, 
          resultCount: result.data?.length,
          responseTime: Date.now() - startTime 
        });
        return res.json(result);
      }

      // Check if we have full drug data in cache
      let allDrugs = drugCache.get('all_drugs');
      if (!allDrugs) {
        logger.debug('Loading drugs from sheet...');
        
        // Use optimized sheet operation
        const response = await safeSheetOperation(async () => {
          const sheetsClient = req.app.locals.sheetsClient;
          const SPREADSHEET_ID = req.app.locals.SPREADSHEET_ID;
          
          if (!sheetsClient || !SPREADSHEET_ID) {
            throw new Error('Service not initialized');
          }
          
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000); // Reduced timeout
          
          try {
            return await sheetsClient.spreadsheets.values.get({
              spreadsheetId: SPREADSHEET_ID,
              range: 'pedmedvnch',
              signal: controller.signal,
              majorDimension: 'ROWS',
              valueRenderOption: 'UNFORMATTED_VALUE'
            });
          } finally {
            clearTimeout(timeout);
          }
        });

        const rows = response.data.values || [];
        logger.debug('Raw sheet data loaded', { rowCount: rows.length });

        // Optimized data processing
        allDrugs = rows.slice(1)
          .filter(row => row[2]) // Filter out empty active ingredient rows
          .map(row => ({
            'Hoạt chất': row[2]?.toString().trim(),
            'Cập nhật': row[3]?.toString().trim(),
            'Phân loại dược lý': row[4]?.toString().trim(),
            'Liều thông thường trẻ sơ sinh': row[5]?.toString().trim(),
            'Liều thông thường trẻ em': row[6]?.toString().trim(),
            'Hiệu chỉnh liều theo chức năng thận': row[7]?.toString().trim(),
            'Hiệu chỉnh liều theo chức năng gan': row[8]?.toString().trim(),
            'Chống chỉ định': row[9]?.toString().trim(),
            'Tác dụng không mong muốn': row[10]?.toString().trim(),
            'Cách dùng (ngoài IV)': row[11]?.toString().trim(),
            'Tương tác thuốc chống chỉ định': row[12]?.toString().trim(),
            'Ngộ độc/Quá liều': row[13]?.toString().trim(),
            'Các thông số cần theo dõi': row[14]?.toString().trim(),
            'Bảo hiểm y tế thanh toán': row[15]?.toString().trim(),
          }));

        // Cache all drugs for 30 minutes
        drugCache.set('all_drugs', allDrugs, 1800);
        logger.info('Drugs cached successfully', { 
          drugCount: allDrugs.length,
          loadTime: Date.now() - startTime 
        });
      }

      // Process search query with optimized filtering
      let filteredDrugs = allDrugs;
      if (query) {
        const searchTerm = query.toLowerCase().trim();
        filteredDrugs = allDrugs.filter(drug => {
          const activeIngredient = drug['Hoạt chất']?.toLowerCase() || '';
          return activeIngredient.includes(searchTerm);
        });
      }

      // Implement pagination
      const totalCount = filteredDrugs.length;
      const start = (page - 1) * limit;
      const paginatedDrugs = filteredDrugs.slice(start, start + limit);

      result = {
        success: true,
        data: paginatedDrugs,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: start + limit < totalCount,
          hasPrev: page > 1
        },
        meta: {
          cacheHit: false,
          responseTime: Date.now() - startTime,
          requestId: requestCount
        }
      };

      // Cache search results for 10 minutes
      searchCache.set(cacheKey, result, 600);
      
      logger.info('Drug search completed', {
        query,
        resultCount: paginatedDrugs.length,
        totalCount,
        responseTime: result.meta.responseTime,
        cached: false
      });

      return res.json(result);

    } catch (error) {
      logger.error('Drug search error:', error.message);
      
      // Return appropriate error response
      if (error.name === 'AbortError') {
        return res.status(408).json({ 
          success: false, 
          error: 'Request timeout - server quá chậm' 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        error: 'Không thể lấy dữ liệu thuốc',
        meta: {
          responseTime: Date.now() - startTime,
          requestId: requestCount
        }
      });
    }
});

// Cache management endpoints
router.get('/drugs/cache-stats', (req, res) => {
  res.json({
    success: true,
    stats: {
      drugCache: drugCache.getStats(),
      searchCache: searchCache.getStats(),
      performance: {
        totalRequests: requestCount,
        cacheHits,
        cacheHitRate: requestCount > 0 ? (cacheHits / requestCount * 100).toFixed(2) + '%' : '0%'
      }
    }
  });
});

router.post('/drugs/invalidate-cache', ensureSheetsClient, async (req, res) => {
    // Clear all caches
    drugCache.flushAll();
    searchCache.flushAll();
    
    const wss = req.app.locals.wss;
    if (wss) {
      wss.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(JSON.stringify({ 
            action: 'cache_invalidated',
            timestamp: new Date().toISOString()
          }));
        }
      });
    }
    
    logger.info('All drug caches invalidated');
    res.json({ 
      success: true, 
      message: 'Cache đã được làm mới',
      timestamp: new Date().toISOString()
    });
});

module.exports = router;