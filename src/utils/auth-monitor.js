/**
 * Module giám sát và cảnh báo hoạt động đáng ngờ liên quan đến xác thực
 */

// Lưu trữ thông tin đăng nhập thất bại theo IP và email
const failedLoginAttempts = new Map();
const suspiciousActivities = [];
const MAX_SUSPICIOUS_ACTIVITIES = 100;

// Thời gian sống của dữ liệu theo dõi
const DATA_TTL = 24 * 60 * 60 * 1000; // 24 giờ

// Ngưỡng cho các hoạt động đáng ngờ
const THRESHOLDS = {
  failedLogins: 5, // Số lần đăng nhập thất bại liên tiếp
  successAfterFailures: 3, // Đăng nhập thành công sau nhiều lần thất bại
  differentIPs: 3, // Số IP khác nhau cho cùng một tài khoản
  timeWindow: 10 * 60 * 1000, // Cửa sổ thời gian cho các hoạt động (10 phút)
};

/**
 * Ghi nhận một lần đăng nhập thất bại
 * @param {string} email - Email người dùng
 * @param {string} ip - Địa chỉ IP
 * @param {string} reason - Lý do thất bại
 */
export function trackFailedLogin(email, ip, reason = 'unknown') {
  const key = `${email.toLowerCase()}:${ip}`;
  const now = Date.now();
  
  // Khởi tạo nếu chưa có
  if (!failedLoginAttempts.has(key)) {
    failedLoginAttempts.set(key, {
      email,
      ip,
      attempts: [],
      lastAttempt: now,
    });
  }
  
  const record = failedLoginAttempts.get(key);
  record.attempts.push({ timestamp: now, reason });
  record.lastAttempt = now;
  
  // Kiểm tra ngưỡng
  if (record.attempts.length >= THRESHOLDS.failedLogins) {
    addSuspiciousActivity({
      type: 'multiple_failed_logins',
      email,
      ip,
      count: record.attempts.length,
      timestamp: now,
      details: `${record.attempts.length} lần đăng nhập thất bại liên tiếp từ IP ${ip}`,
    });
  }
}

/**
 * Ghi nhận một lần đăng nhập thành công
 * @param {string} email - Email người dùng
 * @param {string} ip - Địa chỉ IP
 * @param {string} uid - ID người dùng
 */
export function trackSuccessfulLogin(email, ip, uid) {
  const key = `${email.toLowerCase()}:${ip}`;
  const now = Date.now();
  
  // Kiểm tra nếu trước đó có nhiều lần đăng nhập thất bại
  if (failedLoginAttempts.has(key)) {
    const record = failedLoginAttempts.get(key);
    const recentFailures = record.attempts.filter(
      attempt => now - attempt.timestamp < THRESHOLDS.timeWindow
    ).length;
    
    // Đăng nhập thành công sau nhiều lần thất bại
    if (recentFailures >= THRESHOLDS.successAfterFailures) {
      addSuspiciousActivity({
        type: 'success_after_failures',
        email,
        ip,
        uid,
        count: recentFailures,
        timestamp: now,
        details: `Đăng nhập thành công sau ${recentFailures} lần thất bại từ IP ${ip}`,
      });
    }
    
    // Xóa bản ghi sau khi đăng nhập thành công
    failedLoginAttempts.delete(key);
  }
  
  // Kiểm tra đăng nhập từ nhiều IP khác nhau
  checkMultipleIPs(email, ip, uid);
}

/**
 * Kiểm tra đăng nhập từ nhiều IP khác nhau trong khoảng thời gian ngắn
 * @param {string} email - Email người dùng
 * @param {string} ip - Địa chỉ IP hiện tại
 * @param {string} uid - ID người dùng
 */
function checkMultipleIPs(email, ip, uid) {
  const now = Date.now();
  const recentActivities = suspiciousActivities.filter(
    activity => 
      activity.email === email && 
      activity.type === 'login' &&
      now - activity.timestamp < THRESHOLDS.timeWindow
  );
  
  // Lấy các IP duy nhất
  const uniqueIPs = new Set(recentActivities.map(activity => activity.ip));
  uniqueIPs.add(ip);
  
  // Nếu có quá nhiều IP khác nhau
  if (uniqueIPs.size >= THRESHOLDS.differentIPs) {
    addSuspiciousActivity({
      type: 'multiple_ips',
      email,
      uid,
      ips: Array.from(uniqueIPs),
      timestamp: now,
      details: `Đăng nhập từ ${uniqueIPs.size} IP khác nhau trong ${THRESHOLDS.timeWindow / 60000} phút`,
    });
  }
  
  // Ghi nhận hoạt động đăng nhập thành công
  addSuspiciousActivity({
    type: 'login',
    email,
    ip,
    uid,
    timestamp: now,
    details: `Đăng nhập thành công từ IP ${ip}`,
  });
}

/**
 * Thêm một hoạt động đáng ngờ vào danh sách theo dõi
 * @param {Object} activity - Thông tin hoạt động
 */
function addSuspiciousActivity(activity) {
  suspiciousActivities.unshift(activity);
  
  // Giới hạn số lượng hoạt động lưu trữ
  if (suspiciousActivities.length > MAX_SUSPICIOUS_ACTIVITIES) {
    suspiciousActivities.pop();
  }
  
  // Ghi log hoạt động đáng ngờ
  if (activity.type !== 'login') {
    console.warn('Hoạt động đáng ngờ phát hiện:', activity);
    // Tại đây có thể thêm code gửi thông báo, email, hoặc lưu vào database
  }
}

/**
 * Xóa dữ liệu cũ
 */
function cleanupOldData() {
  const now = Date.now();
  
  // Xóa các bản ghi đăng nhập thất bại cũ
  for (const [key, record] of failedLoginAttempts.entries()) {
    if (now - record.lastAttempt > DATA_TTL) {
      failedLoginAttempts.delete(key);
    }
  }
}

// Dọn dẹp dữ liệu cũ mỗi giờ
setInterval(cleanupOldData, 60 * 60 * 1000);

/**
 * Lấy danh sách hoạt động đáng ngờ gần đây
 * @returns {Array} Danh sách hoạt động đáng ngờ
 */
export function getRecentSuspiciousActivities() {
  return [...suspiciousActivities];
}

/**
 * Kiểm tra xem một IP có bị chặn không
 * @param {string} ip - Địa chỉ IP cần kiểm tra
 * @returns {boolean} true nếu IP bị chặn, false nếu không
 */
export function isIPBlocked(ip) {
  const now = Date.now();
  let totalFailures = 0;
  
  // Đếm tổng số lần đăng nhập thất bại trong 10 phút gần đây
  for (const [key, record] of failedLoginAttempts.entries()) {
    if (record.ip === ip) {
      const recentFailures = record.attempts.filter(
        attempt => now - attempt.timestamp < THRESHOLDS.timeWindow
      ).length;
      totalFailures += recentFailures;
    }
  }
  
  // Nếu có quá nhiều lần thất bại, chặn IP
  return totalFailures >= THRESHOLDS.failedLogins * 3;
}

/**
 * Kiểm tra xem một email có bị tạm khóa không
 * @param {string} email - Email cần kiểm tra
 * @returns {boolean} true nếu email bị tạm khóa, false nếu không
 */
export function isEmailLocked(email) {
  const now = Date.now();
  let totalFailures = 0;
  
  // Đếm tổng số lần đăng nhập thất bại trong 10 phút gần đây
  for (const [key, record] of failedLoginAttempts.entries()) {
    if (record.email.toLowerCase() === email.toLowerCase()) {
      const recentFailures = record.attempts.filter(
        attempt => now - attempt.timestamp < THRESHOLDS.timeWindow
      ).length;
      totalFailures += recentFailures;
    }
  }
  
  // Nếu có quá nhiều lần thất bại, tạm khóa email
  return totalFailures >= THRESHOLDS.failedLogins * 2;
} 