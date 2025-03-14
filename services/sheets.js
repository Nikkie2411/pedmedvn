const { google } = require('googleapis');
const logger = require('../utils/logger');
const { SPREADSHEET_ID, GOOGLE_CREDENTIALS } = require('../config/config');

let sheetsClient;
let cachedUsernames = [];
let isLoadingUsernames = false;

async function initializeSheetsClient(retries = 3, delay = 5000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      const authClient = await auth.getClient();
      sheetsClient = google.sheets({ version: 'v4', auth: authClient });
      logger.info('Google Sheets client initialized successfully');
      return; // Thành công thì thoát
    } catch (error) {
      logger.error(`Attempt ${attempt} failed to initialize Google Sheets client:`, error);
        if (attempt === retries) {
          logger.error('All attempts failed. Server cannot start.');
          throw error; // Ném lỗi để middleware xử lý
        }
        await new Promise(resolve => setTimeout(resolve, delay)); // Đợi trước khi thử lại
      }
    }
}

async function loadUsernames() {
  if (isLoadingUsernames) return;
  isLoadingUsernames = true;
  try{
        const range = 'Accounts';
        const response = await sheetsClient.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range,
        });

        if (!response || !response.data || !response.data.values) {
            console.error("⚠️ Không thể tải danh sách username.");
            return;
        }

        const rows = response.data.values;
        const headers = rows[0] || [];
        const usernameIndex = headers.indexOf("Username");

        if (usernameIndex === -1) {
            console.error("⚠️ Không tìm thấy cột Username.");
            return;
        }

        cachedUsernames = rows.slice(1).map(row => row[usernameIndex]?.trim().toLowerCase());
        console.log("✅ Tải danh sách username thành công.");
    } catch (error) {
        logger.error("❌ Lỗi khi tải danh sách username:", error);
    } finally {
      isLoadingUsernames = false;
    }
}

module.exports = { initializeSheetsClient, loadUsernames, getSheetsClient: () => sheetsClient, getCachedUsernames: () => cachedUsernames };