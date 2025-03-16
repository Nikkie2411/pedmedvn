const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

router.get('/therapy', async (req, res, next) => {
  try {
    const sheetsClient = req.app.locals.sheetsClient;
    const SPREADSHEET_ID = req.app.locals.SPREADSHEET_ID;
    if (!sheetsClient || !SPREADSHEET_ID) {
      return res.status(503).json({ success: false, message: 'Service unavailable, server not initialized' });
    }

    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Therapy',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy dữ liệu trong sheet Therapy' });
    }

    const headers = rows[0];
    const data = rows.slice(1).map(row => ({
      STT: row[headers.indexOf('STT')] || '',
      Title: row[headers.indexOf('Title')] || '',
      Date: row[headers.indexOf('Date')] || '',
      Fulltext: row[headers.indexOf('Fulltext')] || ''
    }));

    res.json({ success: true, data });
  } catch (error) {
    logger.error('Lỗi khi lấy dữ liệu từ sheet Therapy:', error);
    next(error);
  }
});

module.exports = router;