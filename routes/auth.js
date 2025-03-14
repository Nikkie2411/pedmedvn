const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { loginLimiter } = require('../middleware/rateLimit');
const { getSheetsClient } = require('../services/sheets');
const { sendEmailWithGmailAPI } = require('../services/email');
const logger = require('../utils/logger');

router.post('/login', loginLimiter, async (req, res, next) => {
  const { username, password, deviceId, deviceName } = req.body;
    logger.info('Login request received', { username, deviceId, deviceName });
  
    if (!username || !password || !deviceId) {
      return res.status(400).json({ success: false, message: "Thiếu thông tin đăng nhập!" });
    }

    const sheetsClient = req.app.locals.sheetsClient; // Lấy từ app.locals
    if (!sheetsClient) {
      return res.status(503).json({ success: false, message: 'Service unavailable, server not initialized' });
    }
  
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await sheetsClient.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Accounts',
        signal: controller.signal
      });
      clearTimeout(timeout);
  
      const rows = response.data.values;
      const headers = rows[0];
      const usernameIndex = headers.indexOf("Username");
      const passwordIndex = headers.indexOf("Password");
      const approvedIndex = headers.indexOf("Approved");
      const device1IdIndex = headers.indexOf("Device_1_ID");
      const device1NameIndex = headers.indexOf("Device_1_Name");
      const device2IdIndex = headers.indexOf("Device_2_ID");
      const device2NameIndex = headers.indexOf("Device_2_Name");
  
      if ([usernameIndex, passwordIndex, approvedIndex, device1IdIndex, device1NameIndex, device2IdIndex, device2NameIndex].includes(-1)) {
        return res.status(500).json({ success: false, message: "Lỗi cấu trúc Google Sheets!" });
      }
  
      const userRowIndex = rows.findIndex(row => row[usernameIndex] === username);
      if (userRowIndex === -1) {
        return res.status(401).json({ success: false, message: "Tài khoản hoặc mật khẩu chưa đúng!" });
      }
  
      const user = rows[userRowIndex];
      const isPasswordValid = await bcrypt.compare(password.trim(), user[passwordIndex]?.trim() || '');
      if (!isPasswordValid) {
        return res.status(401).json({ success: false, message: "Tài khoản hoặc mật khẩu chưa đúng!" });
      }
  
      if (user[approvedIndex]?.trim().toLowerCase() !== "đã duyệt") {
        return res.status(403).json({ success: false, message: "Tài khoản chưa được phê duyệt bởi quản trị viên." });
      }
  
      let currentDevices = [
        { id: user[device1IdIndex], name: user[device1NameIndex] },
        { id: user[device2IdIndex], name: user[device2NameIndex] }
      ].filter(d => d.id);
  
      if (currentDevices.some(d => d.id === deviceId)) {
        return res.status(200).json({ success: true, message: "Đăng nhập thành công!" });
      }
  
      if (currentDevices.length >= 2) {
        return res.status(403).json({
          success: false,
          message: "Tài khoản đã đăng nhập trên 2 thiết bị. Vui lòng chọn thiết bị cần đăng xuất.",
          devices: currentDevices.map(d => ({ id: d.id, name: d.name })) // Trả về cả id và name
        });
      }
  
      currentDevices.push({ id: deviceId, name: deviceName });
      currentDevices = currentDevices.slice(-2);
  
      const values = [
        currentDevices[0]?.id || "",
        currentDevices[0]?.name || "",
        currentDevices[1]?.id || "",
        currentDevices[1]?.name || ""
      ];
  
      // Tính range động dựa trên chỉ số cột
      const startCol = String.fromCharCode(65 + device1IdIndex); // Ví dụ: L (11 -> 76)
      const endCol = String.fromCharCode(65 + device2NameIndex); // Ví dụ: O (14 -> 79)
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Accounts!${startCol}${userRowIndex + 1}:${endCol}${userRowIndex + 1}`,
        valueInputOption: "RAW",
        resource: { values: [values] }
      });
      return res.status(200).json({ success: true, message: "Đăng nhập thành công và thiết bị đã được lưu!" });
    } catch (error) {
      clearTimeout(timeout);
      logger.error('Lỗi khi kiểm tra tài khoản:', error);
      next(error);
    }
});

router.post('/register', async (req, res, next) => {
  logger.info('Request received for /api/register', { body: req.body });
    const { username, password, fullname, email, phone, occupation, workplace, province } = req.body;
  
    if (username.length > 50 || password.length > 100 || email.length > 255 || phone.length > 15) {
      return res.status(400).json({ success: false, message: "Dữ liệu đầu vào vượt quá giới hạn độ dài!" });
    }
  
    if (!username || !password || !fullname || !email || !phone || !occupation || !workplace || !province) {
        return res.status(400).json({ success: false, message: "Vui lòng điền đầy đủ thông tin!" });
    }
  
    if (username.length < 6 || /\s/.test(username)) {
      return res.status(400).json({ success: false, message: "Tên đăng nhập phải ít nhất 6 ký tự và không chứa dấu cách!" });
    }
  
    if (password.length < 6 || !/[!@#$%^&*]/.test(password)) {
      return res.status(400).json({ success: false, message: "Mật khẩu phải ít nhất 6 ký tự và chứa ít nhất 1 ký tự đặc biệt!" });
    }
  
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Email không hợp lệ!" });
    }
  
    if (!isValidPhone(phone)) {
      return res.status(400).json({ success: false, message: "Số điện thoại không hợp lệ!" });
    }

    const sheetsClient = req.app.locals.sheetsClient; // Lấy từ app.locals
    if (!sheetsClient) {
      return res.status(503).json({ success: false, message: 'Service unavailable, server not initialized' });
    }
  
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await sheetsClient.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Accounts',
            signal: controller.signal
        });
        clearTimeout(timeout);
  
        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            return res.status(500).json({ success: false, message: "Lỗi dữ liệu Google Sheets!" });
        }
  
        const headers = rows[0];
        const usernameIndex = headers.indexOf("Username");
        const emailIndex = headers.indexOf("Email");
  
        if (usernameIndex === -1 || emailIndex === -1) {
          return res.status(500).json({ success: false, message: "Lỗi cấu trúc Google Sheets!" });
        }
  
        const accounts = rows.slice(1);
        const isTaken = accounts.some(row => row[usernameIndex]?.trim() === username.trim());
        if (isTaken) {
            return res.json({ success: false, message: "Tên đăng nhập không hợp lệ!" });
        }
  
        const isEmailTaken = accounts.some(row => row[emailIndex]?.trim() === email.trim());
        if (isEmailTaken) {
          return res.json({ success: false, message: "Email đã được sử dụng!" });
        }
  
        // Hash mật khẩu
        const hashedPassword = await bcrypt.hash(password, 10); // 10 là số vòng hash
  
        // 🔹 Thêm cột Date (ngày đăng ký)
        const today = new Date().toISOString().split("T")[0]; // Lấy ngày hiện tại YYYY-MM-DD
        const newUser = [
          username,
          hashedPassword,
          fullname,
          email,
          phone,
          "Chưa duyệt",
          today,
          occupation,
          workplace,
          province,
          "", // Notified
          "", // Device_1_ID
          "", // Device_1_Name
          "", // Device_2_ID
          ""  // Device_2_Name
        ];
  
        await sheetsClient.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Accounts',
            valueInputOption: "USER_ENTERED",
            resource: { values: [newUser] }
        });
  
        await sendRegistrationEmail(email, username);
  
        res.json({ success: true, message: "Đăng ký thành công! Thông báo phê duyệt tài khoản thành công sẽ được gửi tới email của bạn." });
    } catch (error) {
        clearTimeout(timeout);
        logger.error("Lỗi khi đăng ký tài khoản:", error);
        next(error);
    }
});

router.post('/check-session', async (req, res, next) => {
    logger.info('Request received for /api/check-session', { body: req.body });
  const { username, deviceId } = req.body;

  if (!username || !deviceId) {
    console.log("Lỗi: Không có tên đăng nhập hoặc Device ID");
    return res.status(400).json({ success: false, message: "Thiếu thông tin tài khoản hoặc thiết bị!" });
  }

  const sheetsClient = req.app.locals.sheetsClient; // Lấy từ app.locals
  if (!sheetsClient) {
    return res.status(503).json({ success: false, message: 'Service unavailable, server not initialized' });
  }

  try {
    console.log(`📌 Kiểm tra trạng thái tài khoản của: ${username}, DeviceID: ${deviceId}`);
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Accounts',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log("Không tìm thấy tài khoản trong Google Sheets");
      return res.json({ success: false, message: "Không tìm thấy tài khoản!" });
    }

    const headers = rows[0];
    const usernameIndex = headers.indexOf("Username");
    const approvedIndex = headers.indexOf("Approved");
    const device1IdIndex = headers.indexOf("Device_1_ID");
    const device2IdIndex = headers.indexOf("Device_2_ID");

    if ([usernameIndex, approvedIndex, device1IdIndex, device2IdIndex].includes(-1)) {
      console.log("Lỗi: Không tìm thấy cột cần thiết");
      return res.status(500).json({ success: false, message: "Lỗi cấu trúc Google Sheets!" });
    }

    const accounts = rows.slice(1);
    const user = accounts.find(row => row[usernameIndex]?.trim() === username.trim());

    if (!user) {
      console.log("Tài khoản không tồn tại!");
      return res.json({ success: false, message: "Tài khoản không tồn tại!" });
    }

    console.log(`📌 Trạng thái tài khoản: ${user[approvedIndex]}`);

    if (!user[approvedIndex] || user[approvedIndex]?.trim().toLowerCase() !== "đã duyệt") {
      console.log("⚠️ Tài khoản bị hủy duyệt, cần đăng xuất!");
      return res.json({ success: false, message: "Tài khoản đã bị hủy duyệt!" });
    }

    // Kiểm tra xem thiết bị còn hợp lệ không
    const currentDevices = [user[device1IdIndex], user[device2IdIndex]].filter(Boolean);
    console.log(`📌 Danh sách thiết bị hợp lệ: ${currentDevices}`);

    if (!currentDevices.includes(deviceId)) {
      console.log("⚠️ Thiết bị không còn hợp lệ, cần đăng xuất!");
      return res.json({ success: false, message: "Thiết bị của bạn đã bị đăng xuất!" });
    }

    res.json({ success: true });

  } catch (error) {
    logger.error("❌ Lỗi khi kiểm tra trạng thái tài khoản:", error);
    next(error);
  }
});

router.post('/logout-device', async (req, res, next) => {
logger.info('Request received for /api/logout-device', { body: req.body });
  try {
    const { username, deviceId, newDeviceId, newDeviceName } = req.body;

    if (!username || !deviceId || !newDeviceId || !newDeviceName) {
      return res.status(400).json({ success: false, message: "Thiếu thông tin cần thiết" });
    }

    const sheetsClient = req.app.locals.sheetsClient; // Lấy từ app.locals
    if (!sheetsClient) {
      return res.status(503).json({ success: false, message: 'Service unavailable, server not initialized' });
    }

    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Accounts',
    });

    const rows = response.data.values;
    const headers = rows[0];
    const usernameIndex = headers.indexOf("Username");
    const device1IdIndex = headers.indexOf("Device_1_ID");
    const device1NameIndex = headers.indexOf("Device_1_Name");
    const device2IdIndex = headers.indexOf("Device_2_ID");
    const device2NameIndex = headers.indexOf("Device_2_Name");

    if ([usernameIndex, device1IdIndex, device1NameIndex, device2IdIndex, device2NameIndex].includes(-1)) {
      return res.status(500).json({ success: false, message: "Lỗi cấu trúc Google Sheets!" });
    }

    const userRowIndex = rows.findIndex(row => row[usernameIndex] === username);
    if (userRowIndex === -1) {
      return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản" });
    }

    let devices = [
      { id: rows[userRowIndex][device1IdIndex], name: rows[userRowIndex][device1NameIndex] },
      { id: rows[userRowIndex][device2IdIndex], name: rows[userRowIndex][device2NameIndex] }
    ].filter(d => d.id);

    // Gửi thông báo đến thiết bị cũ trước khi xóa
    const oldDevice = devices.find(d => d.id === deviceId);
    if (oldDevice) {
      const clientKey = `${username}_${deviceId}`;
      const oldClient = clients.get(clientKey);
      if (oldClient && oldClient.readyState === WebSocket.OPEN) {
        oldClient.send(JSON.stringify({ action: 'logout', message: 'Thiết bị của bạn đã bị đăng xuất bởi thiết bị mới!' }));
        logger.info(`Sent logout notification to ${clientKey}`);
      } else if (oldClient) {
        clients.delete(clientKey); // Xóa kết nối không còn hoạt động
        logger.info(`Removed stale WebSocket connection for ${clientKey}`);
      }
    }

    // Xóa thiết bị cũ
    devices = devices.filter(d => d.id !== deviceId && d.id !== newDeviceId);
    // Thêm thiết bị mới
    devices.push({ id: newDeviceId, name: newDeviceName });

    const values = [
      devices[0]?.id || "", devices[0]?.name || "",
      devices[1]?.id || "", devices[1]?.name || ""
    ];

    const startCol = String.fromCharCode(65 + device1IdIndex);
    const endCol = String.fromCharCode(65 + device2NameIndex);
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Accounts!${startCol}${userRowIndex + 1}:${endCol}${userRowIndex + 1}`,
      valueInputOption: "RAW",
      resource: { values: [values] }
    });

    return res.json({ success: true, message: "Đăng xuất thành công!" });
  } catch (error) {
    logger.error('Lỗi khi đăng xuất thiết bị:', error);
    next(error);
  }
});

// Thêm các route khác như /check-session, /logout-device
module.exports = router;