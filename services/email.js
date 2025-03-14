const logger = require('../utils/logger');
const { REFRESH_TOKEN, CLIENT_ID, CLIENT_SECRET } = require('../config/config');

async function getAccessToken() {
  logger.info("🔄 Đang lấy Access Token...");

  try {
      const refreshToken = process.env.REFRESH_TOKEN;
      const clientId = process.env.CLIENT_ID;
      const clientSecret = process.env.CLIENT_SECRET;

      if (!refreshToken || !clientId || !clientSecret) {
          throw new Error("Thiếu thông tin OAuth (REFRESH_TOKEN, CLIENT_ID, CLIENT_SECRET) trong môi trường!");
      }

      const tokenUrl = "https://oauth2.googleapis.com/token";
      const payload = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token"
      });

      const response = await fetch(tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: payload
      });

      const json = await response.json();
      if (!response.ok) {
          throw new Error(`Lỗi khi lấy Access Token: ${json.error}`);
      }

      logger.info("✅ Access Token lấy thành công!");
      return json.access_token;
  } catch (error) {
      logger.error("❌ Lỗi khi lấy Access Token:", error.message);
      throw error;
  }
}

async function sendEmailWithGmailAPI(toEmail, subject, body, retries = 3, delay = 5000) {
  logger.info(`📧 Chuẩn bị gửi email đến: ${toEmail}`);
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
        const accessToken = await getAccessToken();
        const url = "https://www.googleapis.com/gmail/v1/users/me/messages/send";
        const rawEmail = [
            "MIME-Version: 1.0",
            "Content-Type: text/html; charset=UTF-8",
            `From: PedMedVN <pedmedvn.nch@gmail.com>`,
            `To: <${toEmail}>`,
            `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
            "",
            body
        ].join("\r\n");

        const encodedMessage = Buffer.from(rawEmail)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ raw: encodedMessage })
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(`Lỗi gửi email: ${result.error.message}`);
        }

        logger.info("✅ Email đã gửi thành công:", result);
        return true; // Thành công
    } catch (error) {
      logger.error(`Attempt ${attempt} failed to send email to ${toEmail}:`, error.message);
      if (attempt === retries) {
        throw new Error(`Không thể gửi email sau ${retries} lần thử: ${error.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function sendRegistrationEmail(toEmail, username) {
    try {
    const emailBody = `
      <h2 style="color: #4CAF50;">Xin chào ${username}!</h2>
      <p>Cảm ơn bạn đã đăng ký tài khoản tại PedMedVN. Tài khoản của bạn đã được tạo thành công và đang chờ phê duyệt từ quản trị viên.</p>
      <p>Chúng tôi sẽ thông báo qua email này khi tài khoản được phê duyệt.</p>
      <p>Trân trọng,<br>Đội ngũ PedMedVN</p>
    `;
    await sendEmailWithGmailAPI(toEmail, "ĐĂNG KÝ TÀI KHOẢN PEDMEDVN THÀNH CÔNG", emailBody);
  } catch (error) {
    logger.error(`Failed to send registration email to ${toEmail}:`, error);
    // Có thể ghi log hoặc xử lý thêm, nhưng không crash server
  }
  }
  
  async function sendApprovalEmail(toEmail, username) {
    const emailBody = `
      <h2 style="color: #4CAF50;">Xin chào ${username}!</h2>
      <p style="font-weight: bold">Tài khoản ${username} của bạn đã được phê duyệt thành công.</p>
      <p>Bạn có thể đăng nhập tại: <a href="https://pedmed-vnch.web.app">Đăng nhập ngay</a></p>
      <p>Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!</p>
    `;
    await sendEmailWithGmailAPI(toEmail, "TÀI KHOẢN PEDMEDVN ĐÃ ĐƯỢC PHÊ DUYỆT", emailBody);
  }

module.exports = { sendEmailWithGmailAPI, sendRegistrationEmail, sendApprovalEmail };