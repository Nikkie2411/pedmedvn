const express = require('express');
const router = express.Router();
const NodeCache = require('node-cache');
const logger = require('../utils/logger');

// Performance stats cache
const statsCache = new NodeCache({ stdTTL: 60 }); // 1 minute cache

// Performance monitoring endpoint
router.get('/stats', (req, res) => {
  try {
    const cached = statsCache.get('performance_stats');
    if (cached) {
      return res.json(cached);
    }

    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    const stats = {
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: Math.floor(uptime),
        formatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`
      },
      memory: {
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`
      },
      process: {
        pid: process.pid,
        platform: process.platform,
        nodeVersion: process.version,
        cpuUsage: process.cpuUsage()
      }
    };

    // Cache for 1 minute
    statsCache.set('performance_stats', stats);
    
    res.json(stats);
  } catch (error) {
    logger.error('Error getting performance stats:', error);
    res.status(500).json({ error: 'Failed to get performance stats' });
  }
});

// Health check with detailed info
router.get('/health', (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    // Simple health indicators
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
    const isHealthy = heapUsedMB < 200 && uptime > 0; // Less than 200MB memory usage
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      memoryUsedMB: Math.round(heapUsedMB),
      checks: {
        memory: heapUsedMB < 200 ? 'pass' : 'fail',
        uptime: uptime > 0 ? 'pass' : 'fail'
      }
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({ 
      status: 'unhealthy', 
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Cache statistics
router.get('/cache', (req, res) => {
  try {
    const cacheStats = {
      timestamp: new Date().toISOString(),
      stats: statsCache.getStats(),
      keys: statsCache.keys().length
    };
    
    res.json(cacheStats);
  } catch (error) {
    logger.error('Error getting cache stats:', error);
    res.status(500).json({ error: 'Failed to get cache stats' });
  }
});

// Clear cache endpoint (for debugging)
router.delete('/cache', (req, res) => {
  try {
    const keyCount = statsCache.keys().length;
    statsCache.flushAll();
    
    logger.info(`Cleared ${keyCount} cache entries`);
    res.json({ 
      message: 'Cache cleared successfully',
      clearedKeys: keyCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

module.exports = router;
