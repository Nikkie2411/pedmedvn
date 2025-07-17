const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const NodeCache = require('node-cache');
const { loginLimiter } = require('../middleware/rateLimit');
const { getSheetsClient, batchGetSheetData, safeSheetOperation } = require('../services/sheets');
const { sendRegistrationEmail, sendApprovalEmail  } = require('../services/email');
const logger = require('../utils/logger');
const { isValidEmail, isValidPhone } = require('../utils/validation');

// Enhanced cache with different TTLs for different data types
const cache = new NodeCache({ 
  stdTTL: 1800, // 30 minutes default
  checkperiod: 300, // cleanup every 5 minutes
  maxKeys: 500 // limit memory usage
});

// User cache with shorter TTL for security
const userCache = new NodeCache({ 
  stdTTL: 600, // 10 minutes
  checkperiod: 120,
  maxKeys: 200
});

// Device cache
const deviceCache = new NodeCache({ 
  stdTTL: 3600, // 1 hour
  checkperiod: 300,
  maxKeys: 1000
});

// Khởi tạo cache
// const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

// Trong file router (ví dụ: routes/auth.js)
router.get('/ping', (req, res) => {
  logger.info('Ping request received');
  res.status(200).json({ success: true, message: 'Server is alive' });
});

router.post('/login', loginLimiter, async (req, res, next) => {
  const { username, password, deviceId, deviceName } = req.body;
  logger.info('Login attempt', { username, deviceId, deviceName });
  
  if (!username || !password || !deviceId) {
    return res.status(400).json({ success: false, message: "Thiếu thông tin đăng nhập!" });
  }

  const sheetsClient = req.app.locals.sheetsClient;
  const SPREADSHEET_ID = req.app.locals.SPREADSHEET_ID;
  if (!sheetsClient || !SPREADSHEET_ID) {
    return res.status(503).json({ success: false, message: 'Service unavailable, server not initialized' });
  }

  try {
    // Check user cache first
    const userCacheKey = `user:${username}`;
    let userData = userCache.get(userCacheKey);
    
    if (!userData) {
      // Use optimized sheet operation with timeout
      const response = await safeSheetOperation(async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000); // Reduced timeout
        
        try {
          return await sheetsClient.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Accounts',
            signal: controller.signal,
            majorDimension: 'ROWS',
            valueRenderOption: 'UNFORMATTED_VALUE'
          });
        } finally {
          clearTimeout(timeout);
        }
      });

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
      userData = {
        username,
        hashedPassword: user[passwordIndex]?.trim() || '',
        approved: user[approvedIndex]?.trim().toLowerCase(),
        devices: [
          { id: user[device1IdIndex], name: user[device1NameIndex] },
          { id: user[device2IdIndex], name: user[device2NameIndex] }
        ].filter(d => d.id),
        rowIndex: userRowIndex
      };
      
      // Cache user data for 10 minutes
      userCache.set(userCacheKey, userData, 600);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password.trim(), userData.hashedPassword);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: "Tài khoản hoặc mật khẩu chưa đúng!" });
    }

    if (userData.approved !== "đã duyệt") {
      return res.status(403).json({ success: false, message: "Tài khoản chưa được phê duyệt bởi quản trị viên." });
    }

    // Check device authorization
    if (userData.devices.some(d => d.id === deviceId)) {
      // Cache successful login
      deviceCache.set(`auth:${username}:${deviceId}`, true, 3600);
      return res.status(200).json({ success: true, message: "Đăng nhập thành công!" });
    }

    // Handle device limit
    if (userData.devices.length >= 2) {
      return res.status(403).json({
        success: false,
        message: "Tài khoản đã đăng nhập trên 2 thiết bị. Vui lòng chọn thiết bị cần đăng xuất.",
        devices: userData.devices.map(d => ({ id: d.id, name: d.name }))
      });
    }

    // Add new device
    const newDevices = [...userData.devices, { id: deviceId, name: deviceName }].slice(-2);
    
    // Update sheet with new device
    await safeSheetOperation(async () => {
      const headers = ['Device_1_ID', 'Device_1_Name', 'Device_2_ID', 'Device_2_Name'];
      const values = [
        newDevices[0]?.id || "",
        newDevices[0]?.name || "",
        newDevices[1]?.id || "",
        newDevices[1]?.name || ""
      ];

      // Update sheet
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Accounts!L${userData.rowIndex + 1}:O${userData.rowIndex + 1}`,
        valueInputOption: "RAW",
        resource: { values: [values] }
      });
    });
    
    // Update cache with new device data
    userData.devices = newDevices;
    userCache.set(userCacheKey, userData, 600);
    deviceCache.set(`auth:${username}:${deviceId}`, true, 3600);
    
    return res.status(200).json({ success: true, message: "Đăng nhập thành công và thiết bị đã được lưu!" });
    
  } catch (error) {
    logger.error('Login error:', error.message);
    
    // Return appropriate error based on type
    if (error.name === 'AbortError') {
      return res.status(408).json({ success: false, message: "Kết nối quá chậm, vui lòng thử lại!" });
    }
    
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

    const sheetsClient = req.app.locals.sheetsClient;
    const SPREADSHEET_ID = req.app.locals.SPREADSHEET_ID;
    if (!sheetsClient || !SPREADSHEET_ID) {
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

// API kiểm tra username
router.post('/check-username', async (req, res, next) => {
  logger.info('Request received for /api/check-username', { body: req.body });
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ success: false, message: 'Yêu cầu không hợp lệ: Thiếu body hoặc định dạng sai!' });
    }
      const { username } = req.body;
      if (!username) {
          return res.status(400).json({ exists: false, message: "Thiếu tên đăng nhập!" });
      }

      const sheetsClient = req.app.locals.sheetsClient;
      const SPREADSHEET_ID = req.app.locals.SPREADSHEET_ID;
      if (!sheetsClient || !SPREADSHEET_ID) {
        return res.status(503).json({ success: false, message: 'Service unavailable, server not initialized' });
      }

      const response = await sheetsClient.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Accounts'
      });

      const rows = response.data.values;
      const headers = rows[0];
      const usernameIndex = headers.indexOf("Username");

      if (usernameIndex === -1) {
        return res.status(500).json({ success: false, message: "Lỗi cấu trúc Google Sheets!" });
      }

      const isUsernameTaken = rows.slice(1).some(row => row[usernameIndex]?.trim().toLowerCase() === username.trim().toLowerCase());
      return res.json({ exists: isUsernameTaken });
  } catch (error) {
      console.error("❌ Lỗi khi kiểm tra username:", error);
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

  const sheetsClient = req.app.locals.sheetsClient;
  const SPREADSHEET_ID = req.app.locals.SPREADSHEET_ID;
  if (!sheetsClient || !SPREADSHEET_ID) {
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

    const sheetsClient = req.app.locals.sheetsClient;
    const SPREADSHEET_ID = req.app.locals.SPREADSHEET_ID;
    if (!sheetsClient || !SPREADSHEET_ID) {
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
      const clients = req.app.locals.clients;
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

router.post('/logout-device-from-sheet', async (req, res, next) => {
  logger.info('Request received for /api/logout-device-from-sheet', { body: req.body });
  try {
  const { username, deviceId } = req.body;

  if (!username || !deviceId) {
    return res.status(400).json({ success: false, message: "Thiếu thông tin tài khoản hoặc thiết bị!" });
  }

  const sheetsClient = req.app.locals.sheetsClient;
  const SPREADSHEET_ID = req.app.locals.SPREADSHEET_ID;
  if (!sheetsClient || !SPREADSHEET_ID) {
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
    return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản!" });
  }

  let devices = [
    { id: rows[userRowIndex][device1IdIndex], name: rows[userRowIndex][device1NameIndex] },
    { id: rows[userRowIndex][device2IdIndex], name: rows[userRowIndex][device2NameIndex] }
  ].filter(d => d.id);

  if (!devices.some(d => d.id === deviceId)) {
    return res.status(400).json({ success: false, message: "Thiết bị không tồn tại trong danh sách!" });
  }

  // Gửi thông báo đến thiết bị bị xóa trước khi xóa
  const oldDevice = devices.find(d => d.id === deviceId);
  if (oldDevice) {
    const clientKey = `${username}_${deviceId}`;
    const clients = req.app.locals.clients;
    const oldClient = clients.get(clientKey);
    if (oldClient && oldClient.readyState === WebSocket.OPEN) {
      oldClient.send(JSON.stringify({ action: 'logout', message: 'Thiết bị của bạn đã bị đăng xuất!' }));
      logger.info(`Sent logout notification to ${clientKey}`);
    } else if (oldClient) {
      clients.delete(clientKey); // Xóa kết nối không hoạt động
      logger.info(`Removed stale WebSocket connection for ${clientKey}`);
    }
  }

  devices = devices.filter(d => d.id !== deviceId);
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

  return res.json({ success: true, message: "Thiết bị đã được xóa khỏi danh sách!" });
} catch (error) {
  logger.error('Lỗi khi xóa thiết bị khỏi Google Sheets:', error);
  next(error);
}
});

router.post('/check-approval', async (req, res, next) => {
  logger.info('Request received for /api/check-approval');
  try {
    const sheetsClient = req.app.locals.sheetsClient;
    const SPREADSHEET_ID = req.app.locals.SPREADSHEET_ID;
    if (!sheetsClient || !SPREADSHEET_ID) {
      return res.status(503).json({ success: false, message: 'Service unavailable, server not initialized' });
    }
    
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Accounts'
    });

    const rows = response.data.values;
    const headers = rows[0];
    const usernameIndex = headers.indexOf("Username");
    const emailIndex = headers.indexOf("Email");
    const approvedIndex = headers.indexOf("Approved");

    if ([usernameIndex, emailIndex, approvedIndex].includes(-1)) {
      return res.status(500).json({ success: false, message: "Lỗi cấu trúc Google Sheets!" });
    }

    const accounts = rows.slice(1);
    for (let i = 0; i < accounts.length; i++) {
      const username = accounts[i][usernameIndex];
      const email = accounts[i][emailIndex];
      const approved = accounts[i][approvedIndex]?.trim().toLowerCase();

      if (approved === "đã duyệt" && !cache.get(`approved_${username}`)) {
        await sendApprovalEmail(email, username);
        cache.set(`approved_${username}`, true);
      }
    }

    res.json({ success: true, message: "Kiểm tra và gửi email hoàn tất" });
  } catch (error) {
    logger.error("Lỗi khi kiểm tra phê duyệt:", error);
    next(error);
  }
});

module.exports = router;