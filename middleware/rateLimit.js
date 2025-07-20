const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Smart rate limiting with progressive delays
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 7, // Increased from 5 to 7 attempts
  message: { success: false, message: "Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút!" },
  keyGenerator: (req) => {
    const username = req.body?.username?.trim().toLowerCase() || 'unknown';
    const ip = req.ip || req.connection.remoteAddress;
    return `login_${username}_${ip}`;
  },
  skipSuccessfulRequests: true,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path.includes('/health') || req.path.includes('/monitoring');
  },
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for login: ${req.body?.username || 'unknown'} from ${req.ip}`);
    res.status(429).json({ 
      success: false, 
      message: "Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút!",
      retryAfter: Math.ceil(15 * 60) // seconds
    });
  }
});

// More lenient API rate limiting
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { success: false, message: "Quá nhiều requests. Vui lòng thử lại sau!" },
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  },
  skip: (req) => {
    // Skip for monitoring endpoints
    return req.path.includes('/health') || req.path.includes('/monitoring');
  },
  standardHeaders: true,
  legacyHeaders: false
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 OTP attempts
  message: { success: false, message: "Quá nhiều lần thử gửi OTP. Vui lòng đợi 15 phút!" },
  keyGenerator: (req) => {
    const username = req.body?.username?.trim().toLowerCase() || 'unknown';
    const ip = req.ip || req.connection.remoteAddress;
    return `otp_${username}_${ip}`;
  },
  handler: (req, res) => {
    logger.warn(`OTP rate limit exceeded for: ${req.body?.username || 'unknown'} from ${req.ip}`);
    res.status(429).json({ 
      success: false, 
      message: "Quá nhiều lần thử gửi OTP. Vui lòng đợi 15 phút!",
      retryAfter: Math.ceil(15 * 60)
    });
  }
});

module.exports = { loginLimiter, otpLimiter, apiLimiter };