require('dotenv').config();
const express = require('express');
const { PORT } = require('./config/config');
const { initializeSheetsClient, loadUsernames } = require('./services/sheets');
const { setupWebSocket } = require('./websocket/websocket');
const { ensureSheetsClient } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const drugRoutes = require('./routes/drugs');
const passwordRoutes = require('./routes/password');
const logger = require('./utils/logger');
const therapyRouter = require('./routes/therapy');

const app = express();

// Custom CORS Middleware - Force Railway redeploy
app.use((req, res, next) => {
  const allowedOrigins = ['https://pedmed-vnch.web.app', 'http://localhost:8080', 'http://127.0.0.1:5500'];
  const origin = req.headers.origin;
  
  console.log('CORS request from:', origin);

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle pre-flight request
  if (req.method === 'OPTIONS') {
    console.log('OPTIONS request handled');
    return res.sendStatus(204);
  }

  next();
});

app.locals.SPREADSHEET_ID = process.env.SPREADSHEET_ID;
app.locals.clients = new Map();

async function startServer() {
  await initializeSheetsClient();
  app.locals.sheetsClient = require('./services/sheets').getSheetsClient();
  await loadUsernames();

  app.use(express.json({ limit: '10kb' }));
  app.use(ensureSheetsClient);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api', authRoutes);
  app.use('/api', drugRoutes);
  app.use('/api', passwordRoutes);
  app.use('/api', therapyRouter);

  const server = app.listen(PORT, '0.0.0.0', () => logger.info(`Server running on port ${PORT}`));
  app.locals.wss = setupWebSocket(server);

  setInterval(loadUsernames, 5 * 60 * 1000);
}

startServer().catch(err => {
  logger.error('Server startup failed:', err);
  process.exit(1);
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.stack });
  res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
});

module.exports = app;