const express = require('express');
const router = express.Router();
const { otpLimiter } = require('../middleware/rateLimit');
const { setOtp, getOtp, deleteOtp } = require('../services/otp');
const { sendEmailWithGmailAPI } = require('../services/email');

router.post('/send-otp', otpLimiter, async (req, res, next) => {
    logger.info('Request received for /api/send-otp', { body: req.body });
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ success: false, message: 'Yêu cầu không hợp lệ: Thiếu body hoặc định dạng sai!' });
    }
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ success: false, message: "Thiếu thông tin tài khoản!" });
    }
  
    try {
      logger.info(`Fetching user data for ${username}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await sheetsClient.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Accounts',
        signal: controller.signal
      });
      clearTimeout(timeout);
  
      const rows = response.data.values || [];
      if (!rows.length) {
        logger.warn('No data found in Accounts sheet');
        return res.status(404).json({ success: false, message: "Không tìm thấy dữ liệu tài khoản!" });
      }
      const headers = rows[0];
      const usernameIndex = headers.indexOf("Username");
      const emailIndex = headers.indexOf("Email");
  
      const user = rows.find(row => row[usernameIndex]?.trim() === username.trim());
      if (!user) {
        logger.warn(`User ${username} not found`);
        return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản!" });
      }
  
      const userEmail = user[emailIndex];
      if (!isValidEmail(userEmail)) {
        logger.warn(`Invalid email for ${username}: ${userEmail}`);
        return res.status(400).json({ success: false, message: "Email không hợp lệ!" });
      }
  
      const otpCode = Math.floor(100000 + Math.random() * 900000);
      setOtp(username, otpCode.toString(), 300); // Lưu OTP với TTL 300 giây
  
      await sendEmailWithGmailAPI(userEmail, "MÃ XÁC NHẬN ĐỔI MẬT KHẨU", `
        <h2 style="color: #4CAF50;">Xin chào ${username}!</h2>
        <p style="font-weight: bold">Mã xác nhận đổi mật khẩu của bạn là: 
        <h3 style="font-weight: bold">${otpCode}</h3></p>
        <p>Vui lòng nhập ngay mã này vào trang web để tiếp tục đổi mật khẩu.</p>
      `);
  
      return res.json({ success: true, message: "Mã xác nhận đã được gửi đến email của bạn!" });
    } catch (error) {
      logger.error("❌ Lỗi máy chủ khi gửi OTP:", error);
      next(error);
    }
});

router.post('/verify-otp', async (req, res, next) => {
    logger.info('Request received for /api/verify-otp', { body: req.body });

    const { username, otp } = req.body;
    if (!username || !otp) return res.status(400).json({ success: false, message: "Thiếu thông tin xác minh!" });
  
    try {
      const isValid = await getOtp(username, otp);
      if (!isValid) return res.status(400).json({ success: false, message: "OTP không hợp lệ hoặc đã hết hạn!" });
  
      deleteOtp(username);
      return res.json({ success: true, message: "Xác minh thành công, hãy đặt lại mật khẩu mới!" });
    } catch (error) {
      logger.error("❌ Lỗi khi xác minh OTP:", error);
      next(error);
    }
});

module.exports = router;