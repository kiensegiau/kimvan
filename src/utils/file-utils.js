/**
 * Làm sạch tên file để đảm bảo an toàn cho hệ thống file
 * @param {string} fileName Tên file gốc
 * @returns {string} Tên file đã được làm sạch
 */
export function sanitizeFileName(fileName) {
  if (!fileName) return 'unknown_file';
  
  // Loại bỏ các ký tự không hợp lệ trong tên file
  let sanitized = fileName
    .replace(/[\\/:*?"<>|]/g, '_') // Thay thế các ký tự không hợp lệ bằng dấu gạch dưới
    .replace(/\s+/g, ' ')          // Thay thế nhiều khoảng trắng bằng một khoảng trắng
    .trim();                       // Loại bỏ khoảng trắng ở đầu và cuối
  
  // Giới hạn độ dài tên file
  if (sanitized.length > 200) {
    const extension = sanitized.lastIndexOf('.');
    if (extension !== -1 && extension > 190) {
      // Nếu có phần mở rộng và tên file quá dài
      const ext = sanitized.substring(extension);
      sanitized = sanitized.substring(0, 190) + ext;
    } else {
      // Nếu không có phần mở rộng hoặc phần mở rộng ngắn
      sanitized = sanitized.substring(0, 200);
    }
  }
  
  // Đảm bảo tên file không trống
  if (!sanitized) {
    sanitized = 'unnamed_file';
  }
  
  return sanitized;
} 