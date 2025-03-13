const WebSocket = require('ws');
const logger = require('../utils/logger');

const clients = new Map();

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });
  wss.on('connection', (ws, req) => {
        const urlParams = new URLSearchParams(req.url.split('?')[1]);
        const username = urlParams.get('username');
        const deviceId = urlParams.get('deviceId');
      
        if (!username || !deviceId) {
          ws.close(1008, 'Missing username or deviceId');
          return;
        }
      
        const clientKey = `${username}_${deviceId}`;
        // Đóng kết nối cũ nếu tồn tại
        const existingClient = clients.get(clientKey);
        if (existingClient && existingClient.readyState === WebSocket.OPEN) {
          existingClient.close(1000, 'New connection established');
          logger.info(`Closed old WebSocket connection for ${clientKey}`);
        }
      
        clients.set(clientKey, ws);
        logger.info(`WebSocket connected: ${clientKey}`);
      
        ws.on('close', () => {
          clients.delete(clientKey);
          logger.info(`WebSocket disconnected: ${clientKey}`);
        });
      
        ws.on('error', (error) => {
          logger.error(`WebSocket error for ${clientKey}:`, error);
        });
      });
}

module.exports = { setupWebSocket, getClients: () => clients };