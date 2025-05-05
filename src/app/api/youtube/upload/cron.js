import { processScheduledUploads } from './automation';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';

// Đường dẫn lưu file log
const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'youtube-upload-cron.log');

// Đảm bảo thư mục log tồn tại
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Ghi log vào file
 * @param {string} message - Nội dung log
 */
function writeLog(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  console.log(logMessage.trim());
  
  fs.appendFileSync(LOG_FILE, logMessage);
}

/**
 * Khởi tạo cron job để xử lý các video đã lên lịch
 */
export function initUploadCronJob() {
  try {
    // Chạy mỗi 15 phút
    const job = cron.schedule('*/15 * * * *', async () => {
      try {
        writeLog('Bắt đầu xử lý video đã lên lịch');
        
        const result = await processScheduledUploads();
        
        writeLog(`Hoàn thành xử lý: ${result.message}`);
      } catch (error) {
        writeLog(`Lỗi xử lý video lên lịch: ${error.message}`);
      }
    });
    
    writeLog('Đã khởi tạo cron job xử lý video YouTube');
    
    return job;
  } catch (error) {
    writeLog(`Lỗi khởi tạo cron job: ${error.message}`);
    throw error;
  }
}

/**
 * Hàm thực thi thủ công để xử lý các video đã lên lịch
 */
export async function manualProcessUploads() {
  try {
    writeLog('Bắt đầu xử lý thủ công video đã lên lịch');
    
    const result = await processScheduledUploads();
    
    writeLog(`Hoàn thành xử lý thủ công: ${result.message}`);
    
    return result;
  } catch (error) {
    writeLog(`Lỗi xử lý thủ công: ${error.message}`);
    throw error;
  }
} 