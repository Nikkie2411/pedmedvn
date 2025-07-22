require('dotenv').config();
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const responseTime = require('response-time');
const { PORT } = require('./config/config');
const { initializeSheetsClient, loadUsernames } = require('./services/sheets');
const { setupWebSocket } = require('./websocket/websocket');
const { ensureSheetsClient } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const drugRoutes = require('./routes/drugs');
const passwordRoutes = require('./routes/password');
const monitoringRoutes = require('./routes/monitoring');
const chatbotRoutes = require('./routes/chatbot');
const logger = require('./utils/logger');
const cors = require('cors');

const app = express();

// Performance monitoring
app.use(responseTime((req, res, time) => {
  const url = req.originalUrl || req.url;
  logger.info(`${req.method} ${url} - ${time.toFixed(2)}ms`);
}));

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false // Disable for Google Sheets integration
}));

// Compression middleware
app.use(compression({
  level: 6, // Good balance between compression ratio and speed
  threshold: 1024, // Only compress files larger than 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

app.use(compression());

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
  preflightContinue: false,
  optionsSuccessStatus: 200
}));

// Explicit OPTIONS handler for all routes
app.options('*', cors());

app.locals.SPREADSHEET_ID = process.env.SPREADSHEET_ID;
app.locals.clients = new Map();

async function startServer() {
  await initializeSheetsClient();
  app.locals.sheetsClient = require('./services/sheets').getSheetsClient();
  await loadUsernames();

  app.use(express.json({ limit: '10kb' }));
  app.use(ensureSheetsClient);

  // Enhanced health check endpoint
  app.get('/health', (req, res) => {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
      memory: {
        used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`
      }
    });
  });

  app.use('/api', authRoutes);
  app.use('/api', drugRoutes);
  app.use('/api', passwordRoutes);
  app.use('/api/monitoring', monitoringRoutes);
  app.use('/api/chatbot', chatbotRoutes);

  const server = app.listen(PORT, '0.0.0.0', () => logger.info(`Server running on port ${PORT}`));
  app.locals.wss = setupWebSocket(server);

  setInterval(loadUsernames, 5 * 60 * 1000);
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