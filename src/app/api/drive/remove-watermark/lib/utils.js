/**
 * Các hàm tiện ích cho API xóa watermark
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { TOKEN_PATH, TOKEN_PATHS } from './config.js';

// Đọc token từ file
export function getStoredToken() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const tokenContent = fs.readFileSync(TOKEN_PATH, 'utf8');
      
      if (tokenContent.length === 0) {
        return null;
      }
      
      try {
        const parsedToken = JSON.parse(tokenContent);
        return parsedToken;
      } catch (parseError) {
        return null;
      }
    }
  } catch (error) {
    // Handle error
  }
  return null;
}

// Thêm hàm đọc token tải lên/tải xuống
export function getTokenByType(type = 'upload') {
  try {
    const tokenIndex = type === 'upload' ? 0 : 1;
    const tokenPath = TOKEN_PATHS[tokenIndex];
    
    if (fs.existsSync(tokenPath)) {
      const tokenContent = fs.readFileSync(tokenPath, 'utf8');
      
      if (tokenContent.length === 0) {
        return null;
      }
      
      try {
        const parsedToken = JSON.parse(tokenContent);
        return parsedToken;
      } catch (parseError) {
        // Fallback to old token file
        return getStoredToken();
      }
    } else {
      // Fallback to old token file
      return getStoredToken();
    }
  } catch (error) {
    // Fallback to old token file
    return getStoredToken();
  }
}

// Get file extension from MIME type
export function getExtensionFromMimeType(mimeType) {
  if (!mimeType) return '.bin';
  
  const mimeToExt = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'audio/mpeg': '.mp3',
    'text/plain': '.txt',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx'
  };
  
  for (const [mime, ext] of Object.entries(mimeToExt)) {
    if (mimeType.includes(mime)) return ext;
  }
  
  return '.bin';
}

// Clean up temporary files
export function cleanupTempFiles(tempDir) {
  if (fs.existsSync(tempDir)) {
    const files = fs.readdirSync(tempDir);
    for (const file of files) {
      fs.unlinkSync(path.join(tempDir, file));
    }
    fs.rmdirSync(tempDir, { recursive: true });
  }
}

// Kiểm tra và tìm GhostScript với thông tin chi tiết hơn
export function findGhostscript() {
  const possibleGsPaths = [
    // Đường dẫn Windows phổ biến
    'C:\\Program Files\\gs\\gs10.05.0\\bin\\gswin64c.exe', // Thêm phiên bản 10.05.0 vào đầu danh sách
    'C:\\Program Files\\gs\\gs10.02.0\\bin\\gswin64c.exe',
    'C:\\Program Files\\gs\\gs10.01.2\\bin\\gswin64c.exe',
    'C:\\Program Files\\gs\\gs10.00.0\\bin\\gswin64c.exe',
    'C:\\Program Files\\gs\\gs9.56.1\\bin\\gswin64c.exe',
    'C:\\Program Files\\gs\\gs9.55.0\\bin\\gswin64c.exe',
    'C:\\Program Files\\gs\\gs9.54.0\\bin\\gswin64c.exe',
    'C:\\Program Files\\gs\\gs9.53.3\\bin\\gswin64c.exe',
    // Đường dẫn 32-bit
    'C:\\Program Files (x86)\\gs\\gs10.05.0\\bin\\gswin32c.exe', // Thêm phiên bản 10.05.0
    'C:\\Program Files (x86)\\gs\\gs10.02.0\\bin\\gswin32c.exe',
    'C:\\Program Files (x86)\\gs\\gs9.56.1\\bin\\gswin32c.exe',
    // Đường dẫn Linux/Mac
    '/usr/bin/gs',
    '/usr/local/bin/gs',
    '/opt/homebrew/bin/gs'
  ];

  // Thử tìm trong các đường dẫn có thể
  for (const gsPath of possibleGsPaths) {
    try {
      if (fs.existsSync(gsPath)) {
        // Thử thực thi để kiểm tra
        try {
          const version = execSync(`"${gsPath}" -v`, { stdio: 'pipe', encoding: 'utf8' });
          return gsPath;
        } catch (error) {
          // Tiếp tục tìm đường dẫn khác
        }
      }
    } catch (error) {
      // Bỏ qua lỗi khi kiểm tra tồn tại
    }
  }

  // Thử thực thi các lệnh GhostScript trực tiếp (sử dụng PATH)
  try {
    const version = execSync('gswin64c -v', { stdio: 'pipe', encoding: 'utf8' });
    return 'gswin64c';
  } catch (gswin64cError) {
    try {
      const version = execSync('gswin32c -v', { stdio: 'pipe', encoding: 'utf8' });
      return 'gswin32c';
    } catch (gswin32cError) {
      try {
        const version = execSync('gs -v', { stdio: 'pipe', encoding: 'utf8' });
        return 'gs';
      } catch (gsError) {
        // No GS in PATH
      }
    }
  }

  // Thử truy cập trực tiếp đường dẫn đã biết hoạt động
  try {
    // Sử dụng đường dẫn bạn đã biết chắc chắn hoạt động
    const knownPath = 'C:\\Program Files\\gs\\gs10.05.0\\bin\\gswin64c.exe';
    if (fs.existsSync(knownPath)) {
      return knownPath;
    }
  } catch (error) {
    // Handle error
  }
  
  throw new Error('GhostScript không được cài đặt hoặc không thể tìm thấy. Vui lòng cài đặt GhostScript trước khi sử dụng API này.');
}

// Tối ưu xử lý song song để cải thiện hiệu suất và tránh tràn bộ nhớ
export async function processBatches(items, processFunc, maxConcurrent) {
  const results = [];
  
  // Giảm kích thước batch để tránh sử dụng quá nhiều bộ nhớ cùng lúc
  const safeBatchSize = Math.min(maxConcurrent, 3); // Tối đa 3 item cùng lúc
  
  for (let i = 0; i < items.length; i += safeBatchSize) {
    // Xử lý theo batch nhỏ
    const currentBatch = items.slice(i, i + safeBatchSize);
    
    // Bắt đầu xử lý batch hiện tại
    const batch = currentBatch.map(processFunc);
    const batchResults = await Promise.allSettled(batch);
    
    // Thêm kết quả vào mảng kết quả
    results.push(...batchResults);
    
    // Đợi GC chạy sau mỗi batch
    global.gc && global.gc();
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
} 