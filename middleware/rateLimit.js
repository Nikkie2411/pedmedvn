const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5, // 5 lần thử
  message: { success: false, message: "Quá nhiều lần thử đăng nhập với tài khoản này. Vui lòng thử lại sau 15 phút!" },
  keyGenerator: (req) => {
    // Kiểm tra req.body có tồn tại không
    const username = req.body && req.body.username ? req.body.username.trim().toLowerCase() : 'unknown';
    return username;
  },
  skipSuccessfulRequests: true, // Chỉ bỏ qua khi đăng nhập thành công
  handler: (req, res) => {
    res.status(429).json({ success: false, message: "Quá nhiều lần thử đăng nhập với tài khoản này. Vui lòng thử lại sau 15 phút!" });
  }
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5, // 5 lần thử
  message: { success: false, message: "Quá nhiều lần thử gửi OTP. Vui lòng đợi 15 phút!" },
  keyGenerator: (req) => {
    return req.body && req.body.username ? req.body.username : 'unknown';
  }
});

module.exports = { loginLimiter, otpLimiter };