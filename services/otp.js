const bcrypt = require('bcrypt');
const logger = require('../utils/logger');

const otpStore = new Map();

const setOtp = (username, otpCode, ttlInSeconds) => {
  const hashedOtp = bcrypt.hashSync(otpCode, 10); // Mã hóa OTP
    const expiry = Date.now() + ttlInSeconds * 1000;
    otpStore.set(username, { code: hashedOtp, expiry });
    logger.info(`Stored OTP for ${username}, expires at ${new Date(expiry).toISOString()}`);
    
    // Tự động xóa sau khi hết hạn
    setTimeout(() => {
      if (otpStore.get(username)?.expiry === expiry) {
        otpStore.delete(username);
        logger.info(`OTP for ${username} expired and removed`);
      }
    }, ttlInSeconds * 1000);
};

const getOtp = async (username, inputOtp) => {
  const otpData = otpStore.get(username);
  if (!otpData || Date.now() > otpData.expiry) {
    otpStore.delete(username);
    return false;
  }
  return await bcrypt.compare(inputOtp, otpData.code);
};

const deleteOtp = (username) => {
  otpStore.delete(username);
  logger.info(`OTP for ${username} deleted`);
};

module.exports = { setOtp, getOtp, deleteOtp };