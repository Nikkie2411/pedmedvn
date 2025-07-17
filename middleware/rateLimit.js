const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');

// Custom store for better performance
const rateLimitStore = new NodeCache({ 
  stdTTL: 900, // 15 minutes
  checkperiod: 300, // cleanup every 5 minutes
  maxKeys: 10000
});

// Custom store implementation
const customStore = {
  incr: (key, cb) => {
    const current = rateLimitStore.get(key) || 0;
    const newValue = current + 1;
    rateLimitStore.set(key, newValue, 900); // 15 minutes TTL
    cb(null, newValue, new Date(Date.now() + 900000)); // current, resetTime
  },
  decrement: (key) => {
    const current = rateLimitStore.get(key) || 0;
    if (current > 0) {
      rateLimitStore.set(key, current - 1, 900);
    }
  },
  resetKey: (key) => {
    rateLimitStore.del(key);
  }
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 8, // Increased from 5 to 8 for better UX
  store: customStore,
  message: { 
    success: false, 
    message: "Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút!",
    retryAfter: 15 * 60 // seconds
  },
  keyGenerator: (req) => {
    // Combine username and IP for better security
    const username = req.body?.username?.trim().toLowerCase() || 'unknown';
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `login:${username}:${ip}`;
  },
  skipSuccessfulRequests: true,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({ 
      success: false, 
      message: "Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút!",
      retryAfter: 15 * 60,
      timestamp: new Date().toISOString()
    });
  }
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // More restrictive for OTP
  store: customStore,
  message: { 
    success: false, 
    message: "Quá nhiều lần gửi OTP. Vui lòng đợi 15 phút!",
    retryAfter: 15 * 60
  },
  keyGenerator: (req) => {
    const identifier = req.body?.username || req.body?.email || req.ip || 'unknown';
    return `otp:${identifier}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Quá nhiều lần gửi OTP. Vui lòng đợi 15 phút!",
      retryAfter: 15 * 60,
      timestamp: new Date().toISOString()
    });
  }
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  store: customStore,
  keyGenerator: (req) => `api:${req.ip}`,
  message: {
    success: false,
    message: "Quá nhiều requests. Vui lòng thử lại sau!",
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { 
  loginLimiter, 
  otpLimiter, 
  apiLimiter,
  rateLimitStore // Export for monitoring
};