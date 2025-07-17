const express = require('express');
const router = express.Router();
const { rateLimitStore } = require('../middleware/rateLimit');

// Performance monitoring endpoint
router.get('/stats', (req, res) => {
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  // Cache statistics
  const responseCache = req.app.locals.responseCache;
  const cacheStats = responseCache ? responseCache.getStats() : { keys: 0, hits: 0, misses: 0 };
  
  // Rate limit statistics  
  const rateLimitStats = rateLimitStore.getStats();
  
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    server: {
      uptime: Math.floor(uptime),
      uptimeFormatted: formatUptime(uptime),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    },
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
      external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB',
      heapUsagePercent: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100) + '%'
    },
    cache: {
      response: {
        keys: cacheStats.keys || 0,
        hits: cacheStats.hits || 0,
        misses: cacheStats.misses || 0,
        hitRate: cacheStats.keys > 0 ? 
          Math.round((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100) + '%' : '0%'
      },
      rateLimit: {
        keys: rateLimitStats.keys || 0,
        hits: rateLimitStats.hits || 0,
        misses: rateLimitStats.misses || 0
      }
    },
    clients: {
      websocketConnections: req.app.locals.wss ? req.app.locals.wss.clients.size : 0
    }
  });
});

// Health check with detailed info
router.get('/health', (req, res) => {
  const memoryUsage = process.memoryUsage();
  const heapUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  
  const status = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      heapUsagePercent: Math.round(heapUsagePercent),
      status: heapUsagePercent > 90 ? 'critical' : heapUsagePercent > 70 ? 'warning' : 'ok'
    },
    services: {
      sheets: req.app.locals.sheetsClient ? 'connected' : 'disconnected',
      websocket: req.app.locals.wss ? 'active' : 'inactive'
    }
  };
  
  // Set appropriate status code
  const statusCode = status.memory.status === 'critical' || 
                     status.services.sheets === 'disconnected' ? 503 : 200;
  
  res.status(statusCode).json(status);
});

// Cache management endpoints
router.post('/cache/clear', (req, res) => {
  const responseCache = req.app.locals.responseCache;
  if (responseCache) {
    const stats = responseCache.getStats();
    responseCache.flushAll();
    res.json({
      success: true,
      message: 'Cache cleared successfully',
      previousStats: stats,
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(404).json({
      success: false,
      message: 'Cache not available'
    });
  }
});

// Memory cleanup endpoint (use with caution)
router.post('/memory/gc', (req, res) => {
  if (global.gc) {
    const beforeMemory = process.memoryUsage();
    global.gc();
    const afterMemory = process.memoryUsage();
    
    res.json({
      success: true,
      message: 'Garbage collection completed',
      before: {
        heapUsed: Math.round(beforeMemory.heapUsed / 1024 / 1024) + ' MB',
        heapTotal: Math.round(beforeMemory.heapTotal / 1024 / 1024) + ' MB'
      },
      after: {
        heapUsed: Math.round(afterMemory.heapUsed / 1024 / 1024) + ' MB',
        heapTotal: Math.round(afterMemory.heapTotal / 1024 / 1024) + ' MB'
      },
      freed: Math.round((beforeMemory.heapUsed - afterMemory.heapUsed) / 1024 / 1024) + ' MB'
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'Garbage collection not available. Start with --expose-gc flag.'
    });
  }
});

function formatUptime(uptime) {
  const days = Math.floor(uptime / (24 * 60 * 60));
  const hours = Math.floor((uptime % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((uptime % (60 * 60)) / 60);
  const seconds = Math.floor(uptime % 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

module.exports = router;
