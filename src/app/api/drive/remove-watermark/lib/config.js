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

// Cấu hình mặc định cho việc xử lý watermark
export const DEFAULT_CONFIG = {
  dpi: 350,                // Giảm độ phân giải xuống
  brightness: 20,          // Độ sáng
  contrast: 35,            // Độ tương phản
  threshold: 0,            // Ngưỡng (0 = giữ màu sắc)
  gamma: 1.4,              // Gamma
  sharpening: 1.3,         // Độ sắc nét
  processCenter: false,    // Xử lý vùng trung tâm
  centerSize: 0.8,         // Kích thước vùng trung tâm (80% của trang)
  keepColors: true,        // Giữ màu sắc
  cleanupTempFiles: false, // Có xóa file tạm không
  maxWorkers: Math.max(1, Math.min(2, os.cpus().length - 1)), // Giảm worker xuống tối đa 2 luồng
  backgroundImage: null,   // Đường dẫn đến hình nền tùy chỉnh
  backgroundOpacity: 0.3,  // Giảm xuống 0.3 (30% đục),
  batchSize: 3,            // Số lượng trang xử lý cùng lúc
}; 