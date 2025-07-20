const express = require('express');
const router = express.Router();
const { otpLimiter } = require('../middleware/rateLimit');
const { setOtp, getOtp, deleteOtp } = require('../services/otp');
const { sendEmailWithGmailAPI } = require('../services/email');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');
const { isValidEmail } = require('../utils/validation');

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
      const sheetsClient = req.app.locals.sheetsClient; // Lấy từ app.locals
      const SPREADSHEET_ID = req.app.locals.SPREADSHEET_ID; // Lấy từ app.locals
      if (!sheetsClient || !SPREADSHEET_ID) {
        return res.status(503).json({ success: false, message: 'Service unavailable, server not initialized' });
      }

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

//API cập nhật mật khẩu mới
router.post('/reset-password', async (req, res, next) => {
  logger.info('Request received for /api/reset-password', { body: req.body });
  const { username, newPassword } = req.body;

  if (!username || !newPassword) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin!" });
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || authHeader !== `Bearer ${username}`) { // Giả sử token đơn giản
    return res.status(403).json({ success: false, message: "Không có quyền truy cập!" });
  }

  try {
    const sheetsClient = req.app.locals.sheetsClient;
    const SPREADSHEET_ID = req.app.locals.SPREADSHEET_ID;
    if (!sheetsClient || !SPREADSHEET_ID) {
      return res.status(503).json({ success: false, message: 'Service unavailable, server not initialized' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await sheetsClient.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Accounts',
          signal: controller.signal
      });
      clearTimeout(timeout);

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        return res.status(500).json({ success: false, message: "Không tìm thấy dữ liệu tài khoản!" });
      }

      const headers = rows[0];
      const usernameIndex = headers.indexOf("Username");
      const passwordIndex = headers.indexOf("Password");
      const device1IdIndex = headers.indexOf("Device_1_ID");
      const device1NameIndex = headers.indexOf("Device_1_Name");
      const device2IdIndex = headers.indexOf("Device_2_ID");
      const device2NameIndex = headers.indexOf("Device_2_Name");

      if ([usernameIndex, passwordIndex, device1IdIndex, device1NameIndex, device2IdIndex, device2NameIndex].includes(-1)) {
          console.log("❌ Không tìm thấy cột cần thiết trong Google Sheets!");
          return res.status(500).json({ success: false, message: "Lỗi cấu trúc Google Sheets!" });
      }

      const userRowIndex = rows.findIndex(row => row[usernameIndex]?.trim() === username.trim());
      if (userRowIndex === -1) {
          console.log("❌ Tài khoản không tồn tại!");
          return res.status(404).json({ success: false, message: "Tài khoản không tồn tại!" });
      }

      const oldPasswordHash = rows[userRowIndex][passwordIndex];
    if (await bcrypt.compare(newPassword, oldPasswordHash)) {
      return res.status(400).json({ success: false, message: "Mật khẩu mới không được giống mật khẩu cũ!" });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Accounts!${String.fromCharCode(65 + passwordIndex)}${userRowIndex + 1}`, // Cột Password
      valueInputOption: "RAW",
      resource: { values: [[hashedNewPassword]] }
    });

    const startCol = String.fromCharCode(65 + device1IdIndex);
    const endCol = String.fromCharCode(65 + device2NameIndex);
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Accounts!${startCol}${userRowIndex + 1}:${endCol}${userRowIndex + 1}`,
      valueInputOption: "RAW",
      resource: { values: [["", "", "", ""]] }
    });

    // Gửi thông báo đăng xuất qua WebSocket (nếu có)
    const devices = [
      { id: rows[userRowIndex][device1IdIndex], name: rows[userRowIndex][device1NameIndex] },
      { id: rows[userRowIndex][device2IdIndex], name: rows[userRowIndex][device2NameIndex] }
    ].filter(d => d.id);

    devices.forEach(device => {
      const clientKey = `${username}_${device.id}`;
      const clients = req.app.locals.clients;
      const oldClient = clients.get(clientKey);
      if (oldClient && oldClient.readyState === WebSocket.OPEN) {
        oldClient.send(JSON.stringify({ action: 'logout', message: 'Mật khẩu đã được thay đổi, thiết bị của bạn đã bị đăng xuất!' }));
        logger.info(`Sent logout notification to ${clientKey}`);
      }
    });

    const allClients = req.app.locals.clients;
    allClients.forEach((client, clientKey) => {
      if (clientKey.startsWith(`${username}_`) && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ action: 'logout', message: 'Mật khẩu đã được thay đổi, tất cả thiết bị đã bị đăng xuất!' }));
        logger.info(`Sent logout notification to ${clientKey}`);
      }
    });

      return res.json({ success: true, message: "Đổi mật khẩu thành công! Hãy đăng nhập lại." });

  } catch (error) {
      clearTimeout(timeout);
      logger.error("❌ Lỗi khi cập nhật mật khẩu:", error);
      next(error);
  }
});

module.exports = router;