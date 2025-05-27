/**
 * File cấu hình cho API xóa watermark
 */
import os from 'os';
import path from 'path';

// API validation token
export const API_TOKEN = 'api@test-watermark';

// Đường dẫn file lưu token
export const TOKEN_PATH = path.join(process.cwd(), 'youtube_token.json');

// Thêm đường dẫn cho token upload và download
export const TOKEN_PATHS = [
  path.join(process.cwd(), 'drive_token_upload.json'),   // Token tải lên - Upload
  path.join(process.cwd(), 'drive_token_download.json')  // Token tải xuống - Download
];

// Tính toán maxWorkers trong try-catch để tránh lỗi
let maxWorkers = 1;
try {
  maxWorkers = Math.max(1, Math.min(2, os.cpus().length - 1));
} catch (error) {
  console.error('Lỗi khi tính maxWorkers:', error);
  maxWorkers = 1; // Giá trị mặc định an toàn
}

// Cấu hình mặc định cho việc xử lý watermark
export const DEFAULT_CONFIG = {
  dpi: 350,                // Giảm độ phân giải xuống
  brightness: 30,          // Độ sáng - tăng từ 20 lên 30
  contrast: 45,            // Độ tương phản - tăng từ 35 lên 45
  threshold: 0,            // Ngưỡng (0 = giữ màu sắc)
  gamma: 1.6,              // Gamma - tăng từ 1.4 lên 1.6
  sharpening: 1.6,         // Độ sắc nét - tăng từ 1.3 lên 1.6
  processCenter: false,    // Xử lý vùng trung tâm
  centerSize: 0.8,         // Kích thước vùng trung tâm (80% của trang)
  keepColors: true,        // Giữ màu sắc
  cleanupTempFiles: false, // Có xóa file tạm không
  maxWorkers: maxWorkers,  // Giảm worker xuống tối đa 2 luồng
  backgroundImage: null,   // Đường dẫn đến hình nền tùy chỉnh
  backgroundOpacity: 0.15, // Giảm xuống 0.15 (15% đục - đậm hơn),
  batchSize: 3,            // Số lượng trang xử lý cùng lúc
}; 