const ensureSheetsClient = (req, res, next) => {
    if (!req.app.locals.sheetsClient) {
      return res.status(503).json({ success: false, message: 'Service unavailable, server not fully initialized' });
    }
    next();
  };
  module.exports = { ensureSheetsClient };