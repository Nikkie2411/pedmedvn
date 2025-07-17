require('dotenv').config();
const express = require('express');
const { PORT } = require('./config/config');
const { initializeSheetsClient, loadUsernames } = require('./services/sheets');
const { setupWebSocket } = require('./websocket/websocket');
const { ensureSheetsClient } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const drugRoutes = require('./routes/drugs');
const passwordRoutes = require('./routes/password');
const monitoringRoutes = require('./routes/monitoring');
const logger = require('./utils/logger');
const cors = require('cors');
const NodeCache = require('node-cache');
const { apiLimiter } = require('./middleware/rateLimit');

const app = express();

// Performance optimizations
app.set('trust proxy', 1);
app.disable('x-powered-by');

// In-memory cache for responses (5 minutes default)
const responseCache = new NodeCache({ 
  stdTTL: 300, // 5 minutes
  checkperiod: 60, // cleanup every minute
  maxKeys: 1000 // limit cache size
});

// Compression middleware (install: npm install compression)
const compression = require('compression');
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  level: 6, // balance between speed and compression
  threshold: 1024 // only compress responses > 1KB
}));

// Request timeout middleware
app.use((req, res, next) => {
  res.setTimeout(25000, () => {
    logger.warn('Request timeout', { url: req.url, method: req.method });
    res.status(408).json({ success: false, message: 'Request timeout' });
  });
  next();
});

// Use official cors middleware with dynamic origin check
const allowedOrigins = ['https://pedmed-vnch.web.app', 'http://localhost:8080', 'http://127.0.0.1:5500'];
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  maxAge: 86400 // Cache preflight for 24 hours
}));

// Cache middleware for GET requests
function cacheMiddleware(duration = 300) {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();
    
    const key = `cache:${req.originalUrl}`;
    const cached = responseCache.get(key);
    
    if (cached) {
      logger.debug('Cache hit', { url: req.originalUrl });
      return res.json(cached);
    }
    
    res.sendResponse = res.json;
    res.json = (body) => {
      responseCache.set(key, body, duration);
      res.sendResponse(body);
    };
    
    next();
  };
}

app.locals.SPREADSHEET_ID = process.env.SPREADSHEET_ID;
app.locals.clients = new Map();
app.locals.responseCache = responseCache;

async function startServer() {
  try {
    // Initialize with connection pooling
    logger.info('🔧 Initializing server...');
    
    await initializeSheetsClient();
    app.locals.sheetsClient = require('./services/sheets').getSheetsClient();
    
    // Load usernames with error handling
    await loadUsernames();
    logger.info('✅ Usernames loaded successfully');

    // Optimized JSON parser with limits
    app.use(express.json({ 
      limit: '10kb',
      strict: true,
      reviver: null // no custom parsing
    }));
    
    app.use(ensureSheetsClient);

    // Health check endpoint with cache
    app.get('/health', cacheMiddleware(60), (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
      });
    });

    // Apply cache middleware to routes
    app.use('/api', apiLimiter); // General rate limiting
    app.use('/api', authRoutes);
    app.use('/api', drugRoutes);
    app.use('/api', passwordRoutes);
    app.use('/api/monitoring', monitoringRoutes);

    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📦 Cache enabled with ${responseCache.getStats().keys} keys`);
    });
    
    // Set server timeouts
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
    
    app.locals.wss = setupWebSocket(server);

    // Optimized username refresh (every 5 minutes)
    setInterval(async () => {
      try {
        await loadUsernames();
        logger.debug('🔄 Usernames refreshed');
      } catch (error) {
        logger.error('Failed to refresh usernames:', error);
      }
    }, 5 * 60 * 1000);
    
    // Cache cleanup every 10 minutes
    setInterval(() => {
      const stats = responseCache.getStats();
      responseCache.flushAll();
      logger.debug('🧹 Cache cleared', { previousKeys: stats.keys });
    }, 10 * 60 * 1000);
    
  } catch (error) {
    logger.error('❌ Server initialization failed:', error);
    throw error;
  }
}

startServer().catch(err => {
  logger.error('Server startup failed:', err);
  process.exit(1);
});

app.use((err, req, res, next) => {
  // Always set CORS headers on error responses
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  logger.error('Unhandled error', { error: err.stack });
  res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
});

module.exports = app;