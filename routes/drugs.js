const express = require('express');
const router = express.Router();
const NodeCache = require('node-cache');
const { getSheetsClient } = require('../services/sheets');
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });
const logger = require('../utils/logger');

router.get('/drugs', async (req, res) => {
    logger.info('Request received for /api/drugs', { query: req.query });
    const { query, page: pageRaw = 1, limit: limitRaw = 10 } = req.query;
  
    const page = isNaN(parseInt(pageRaw)) || parseInt(pageRaw) < 1 ? 1 : parseInt(pageRaw);
    const limit = isNaN(parseInt(limitRaw)) || parseInt(limitRaw) < 1 ? 10 : parseInt(limitRaw);
  
    const cacheKey = query ? `drugs_${query}_${page}_${limit}` : 'all_drugs';
  
    try {
      // Kiểm tra cache trước
      let drugs = cache.get(cacheKey);
      if (!drugs) {
        console.log('Cache miss - Lấy dữ liệu từ Google Sheets');
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
        throw new Error('Request to Google Sheets timed out after 10 seconds');
      }, 10000);
  
        const response = await sheetsClient.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'pedmedvnch',
          signal: controller.signal
        });
        clearTimeout(timeout);
  
      const rows = response.data.values || [];
      console.log('Dữ liệu thô từ Google Sheets:', rows);
  
      drugs = rows.slice(1).map(row => ({
        'Hoạt chất': row[2], // Cột C
        'Cập nhật': row[3], // Cột D
        'Phân loại dược lý': row[4], // Cột E
        'Liều thông thường trẻ sơ sinh': row[5], // Cột F
        'Liều thông thường trẻ em': row[6], // Cột G
        'Hiệu chỉnh liều theo chức năng thận': row[7], // Cột H
        'Hiệu chỉnh liều theo chức năng gan': row[8], // Cột I
        'Chống chỉ định': row[9], // Cột J
        'Tác dụng không mong muốn': row[10], // Cột K
        'Cách dùng (ngoài IV)': row[11], // Cột L
        'Tương tác thuốc chống chỉ định': row[12], // Cột M
        'Ngộ độc/Quá liều': row[13], // Cột N
        'Các thông số cần theo dõi': row[14], // Cột O
        'Bảo hiểm y tế thanh toán': row[15], // Cột P
      }));
  
      // Lưu vào cache
      cache.set(cacheKey, drugs);
      console.log('Dữ liệu đã được lưu vào cache');
    } else {
      console.log('Cache hit - Lấy dữ liệu từ cache');
    }
  
      // Lọc dữ liệu nếu có query
      if (query) {
        const filteredDrugs = drugs.filter(drug =>
          drug['Hoạt chất']?.toLowerCase().includes(query.toLowerCase()));
          const start = (page - 1) * limit;
          return res.json({
            total: filteredDrugs.length,
            page,
            data: filteredDrugs.slice(start, start + parseInt(limit))
          });
      }
  
      console.log('Dữ liệu đã ánh xạ:', drugs);
      res.json(drugs);
    } catch (error) {
      clearTimeout(timeout);
      logger.error('Lỗi khi lấy dữ liệu từ Google Sheets:', error);
      res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    }
});

router.get('/drugs/invalidate-cache', async (req, res) => {
    cache.del('all_drugs');
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