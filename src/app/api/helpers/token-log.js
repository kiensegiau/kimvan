import fs from 'fs';
import path from 'path';

// File path để lưu trữ log token
const TOKEN_LOG_PATH = path.join(process.cwd(), 'token_logs.json');

/**
 * Lưu log token từ trình duyệt
 * @param {Object} logData Dữ liệu log cần lưu
 * @returns {Boolean} Kết quả lưu log
 */
export function saveTokenLog(logData) {
  try {
    // Thêm timestamp cho log
    const logEntry = {
      timestamp: new Date().toISOString(),
      ipAddress: logData.ipAddress || 'unknown',
      userAgent: logData.browserInfo?.userAgent || 'unknown',
      data: logData
    };
    
    // Đọc log hiện tại hoặc tạo mới
    let logs = [];
    if (fs.existsSync(TOKEN_LOG_PATH)) {
      const logContent = fs.readFileSync(TOKEN_LOG_PATH, 'utf8');
      logs = JSON.parse(logContent);
    }
    
    // Thêm log mới
    logs.push(logEntry);
    
    // Giới hạn số lượng log (giữ 20 log gần nhất)
    if (logs.length > 20) {
      logs = logs.slice(-20);
    }
    
    // Lưu vào file
    fs.writeFileSync(TOKEN_LOG_PATH, JSON.stringify(logs, null, 2));
    console.log('Log token đã được lưu thành công');
    return true;
  } catch (error) {
    console.error('Lỗi khi lưu log token:', error);
    return false;
  }
}

/**
 * Lấy tất cả log token
 * @returns {Array} Danh sách log token
 */
export function getTokenLogs() {
  try {
    if (fs.existsSync(TOKEN_LOG_PATH)) {
      const logContent = fs.readFileSync(TOKEN_LOG_PATH, 'utf8');
      return JSON.parse(logContent);
    }
    return [];
  } catch (error) {
    console.error('Lỗi khi đọc log token:', error);
    return [];
  }
}

/**
 * Xóa tất cả log token
 * @returns {Boolean} Kết quả xóa log
 */
export function clearTokenLogs() {
  try {
    if (fs.existsSync(TOKEN_LOG_PATH)) {
      fs.writeFileSync(TOKEN_LOG_PATH, JSON.stringify([], null, 2));
      console.log('Đã xóa tất cả log token');
      return true;
    }
    return true;
  } catch (error) {
    console.error('Lỗi khi xóa log token:', error);
    return false;
  }
} 