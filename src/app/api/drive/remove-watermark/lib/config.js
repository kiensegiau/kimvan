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

// Cấu hình mặc định cho xử lý watermark
export const DEFAULT_CONFIG = {
  dpi: 300,               // DPI cho việc xuất PDF
  pageLimit: 0,           // Giới hạn số trang (0 = không giới hạn)
  maxWorkers: 2,          // Số lượng worker threads tối đa
  batchSize: 3,           // Kích thước batch cho xử lý tuần tự
  waitTime: 300,          // Thời gian chờ giữa các batch (ms)
  gsParallel: 2,          // Số luồng song song cho GhostScript
  highPerformanceMode: false, // Chế độ hiệu suất cao
  skipWatermarkRemoval: true, // Mặc định bỏ qua xử lý watermark
  skipBackground: false,   // Mặc định không bỏ qua xử lý nền
  ultra: false,           // Chế độ Ultra performance (RAM cao)
  backgroundOpacity: 0.3  // Độ trong suốt của hình nền (nếu có)
}; 