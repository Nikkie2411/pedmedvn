// Hàm kiểm tra email hợp lệ
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  // Hàm kiểm tra số điện thoại hợp lệ (dành cho số Việt Nam bắt đầu bằng 03, 05, 07, 08, 09)
  function isValidPhone(phone) {
    const phoneRegex = /^(0[35789])[0-9]{8}$/;
    return phoneRegex.test(phone);
  }
  
  module.exports = {
    isValidEmail,
    isValidPhone
  };