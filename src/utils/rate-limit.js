/**
 * Triển khai Rate Limiting đơn giản để giới hạn số lượng request trong một khoảng thời gian
 * Sử dụng bộ nhớ để lưu trữ trạng thái, sẽ bị mất khi restart server
 * Trong môi trường production nên sử dụng Redis hoặc database để lưu trữ
 */

// Lưu trữ thông tin rate limiting theo IP
const rateStorage = new Map();

// Xóa các IP cũ trong cache mỗi giờ
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateStorage.entries()) {
    if (now - data.resetTime > 3600000) { // 1 giờ
      rateStorage.delete(ip);
    }
  }
}, 900000); // Kiểm tra mỗi 15 phút

/**
 * Kiểm tra và ghi nhận một request mới từ IP
 * @param {string} ip - Địa chỉ IP của client
 * @param {number} limit - Giới hạn số lượng request trong window
 * @param {number} windowMs - Khoảng thời gian (ms) để áp dụng giới hạn
 * @returns {Object} Thông tin về trạng thái rate limit và thời gian chờ
 */
export function rateLimit(ip, limit = 5, windowMs = 60000) {
  // Khởi tạo dữ liệu cho IP nếu chưa có
  if (!rateStorage.has(ip)) {
    rateStorage.set(ip, {
      count: 0,
      resetTime: Date.now() + windowMs,
      lastRequest: Date.now()
    });
  }
  
  const data = rateStorage.get(ip);
  const now = Date.now();
  
  // Reset counter nếu đã hết thời gian cửa sổ
  if (now > data.resetTime) {
    data.count = 0;
    data.resetTime = now + windowMs;
  }
  
  // Tăng counter
  data.count += 1;
  data.lastRequest = now;
  
  // Tính toán thông tin rate limit
  const remaining = Math.max(0, limit - data.count);
  const isLimited = data.count > limit;
  const retryAfter = Math.ceil((data.resetTime - now) / 1000);
  
  return {
    isLimited,
    remaining,
    retryAfter,
    resetTime: data.resetTime,
    limit
  };
}

/**
 * Middleware rate limiting cho API routes
 * @param {Object} options - Tùy chọn rate limiting
 * @returns {function} Middleware function
 */
export function withRateLimit(options = {}) {
  const {
    limit = 5,
    windowMs = 60000,
    skipSuccessfulRequests = false,
    message = 'Quá nhiều yêu cầu, vui lòng thử lại sau',
    getClientIP = (req) => req.headers['x-forwarded-for'] || req.socket.remoteAddress
  } = options;
  
  return async (req, res, next) => {
    const clientIP = getClientIP(req);
    const result = rateLimit(clientIP, limit, windowMs);
    
    // Thêm headers rate limit
    res.setHeader('X-RateLimit-Limit', result.limit);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', result.resetTime);
    
    // Nếu quá giới hạn, trả về lỗi 429
    if (result.isLimited) {
      res.setHeader('Retry-After', result.retryAfter);
      return res.status(429).json({
        error: message,
        retryAfter: result.retryAfter
      });
    }
    
    // Nếu skipSuccessfulRequests = true, giảm counter cho các request thành công
    if (skipSuccessfulRequests) {
      const originalEnd = res.end;
      res.end = function (...args) {
        if (res.statusCode < 400) {
          const data = rateStorage.get(clientIP);
          if (data && data.count > 0) {
            data.count -= 1;
          }
        }
        return originalEnd.apply(this, args);
      };
    }
    
    // Tiếp tục xử lý request
    return next ? next() : undefined;
  };
}

/**
 * Áp dụng rate limiting cho đăng nhập để ngăn tấn công brute force
 */
export const loginRateLimit = withRateLimit({
  limit: 5, // 5 lần thất bại
  windowMs: 15 * 60 * 1000, // 15 phút
  message: 'Quá nhiều lần đăng nhập thất bại, vui lòng thử lại sau',
  skipSuccessfulRequests: true, // Bỏ qua đếm khi đăng nhập thành công
});

/**
 * Áp dụng rate limiting cho đăng ký để ngăn spam tài khoản
 */
export const registerRateLimit = withRateLimit({
  limit: 3, // 3 lần trong 1 giờ
  windowMs: 60 * 60 * 1000, // 1 giờ
  message: 'Quá nhiều lần đăng ký, vui lòng thử lại sau',
});

/**
 * Áp dụng rate limiting cho quên mật khẩu để ngăn lạm dụng
 */
export const forgotPasswordRateLimit = withRateLimit({
  limit: 3, // 3 lần trong 1 giờ
  windowMs: 60 * 60 * 1000, // 1 giờ
  message: 'Quá nhiều yêu cầu đặt lại mật khẩu, vui lòng thử lại sau',
}); 