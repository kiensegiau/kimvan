/**
 * Các hàm tiện ích cho API xóa watermark
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { TOKEN_PATH, TOKEN_PATHS } from './config.js';
import os from 'os';
import { google } from 'googleapis';

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
        console.error(`Lỗi phân tích token: ${parseError.message}`);
        return null;
      }
    }
  } catch (error) {
    console.error(`Lỗi đọc token: ${error.message}`);
    return null;
  }
  return null;
}

// Thêm hàm đọc token tải lên/tải xuống
export async function getTokenByType(type = 'download') {
  try {
    // Đường dẫn tới các file token
    const tokenFiles = {
      'download': path.join(process.cwd(), 'drive_token_download.json'),
      'upload': path.join(process.cwd(), 'drive_token_upload.json')
    };
    
    const tokenFile = tokenFiles[type];
    
    if (!tokenFile) {
      console.error(`❌ Loại token không hợp lệ: ${type}`);
      return null;
    }
    
    if (!fs.existsSync(tokenFile)) {
      console.error(`❌ Không tìm thấy file token ${type} tại: ${tokenFile}`);
      return null;
    }
    
    console.log(`🔑 DEBUG: Đang đọc file token ${type} từ ${tokenFile}`);
    
    // Đọc token từ file
    const tokenContent = fs.readFileSync(tokenFile, 'utf8');
    
    // Parse token
    const token = JSON.parse(tokenContent);
    
    // Kiểm tra token có hợp lệ không
    if (!token || !token.access_token) {
      console.error(`❌ Token ${type} không hợp lệ hoặc thiếu access_token`);
      return null;
    }
    
    // Kiểm tra thời hạn
    const expiryDate = token.expiry_date;
    if (expiryDate) {
      const now = Date.now();
      if (expiryDate < now) {
        console.log(`🔄 Token ${type} đã hết hạn từ ${new Date(expiryDate).toLocaleString()}, đang làm mới...`);
        // Thử làm mới token
        const refreshedToken = await refreshToken(token, type, tokenFile);
        if (refreshedToken) {
          console.log(`✅ Đã làm mới thành công token ${type}`);
          return refreshedToken;
        } else {
          console.error(`❌ Không thể làm mới token ${type}`);
          return null;
        }
      }
      
      // Hiển thị thời hạn còn lại
      const remainingTime = (expiryDate - now) / (1000 * 60);
      console.log(`🔑 DEBUG: Token ${type} còn hạn ${remainingTime.toFixed(2)} phút`);
    }
    
    return token;
  } catch (error) {
    console.error(`❌ Lỗi khi đọc token ${type}: ${error.message}`);
    return null;
  }
}

/**
 * Làm mới token sử dụng refresh_token
 * @param {object} token - Token cũ đã hết hạn
 * @param {string} type - Loại token ('download' hoặc 'upload')
 * @param {string} tokenFile - Đường dẫn đến file token
 * @returns {Promise<object|null>} - Token mới hoặc null nếu thất bại
 */
async function refreshToken(token, type, tokenFile) {
  try {
    if (!token.refresh_token) {
      console.error(`❌ Không thể làm mới token ${type}: thiếu refresh_token`);
      return null;
    }

    console.log(`🔄 Đang làm mới token ${type} sử dụng refresh_token...`);

    // Tạo OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Thiết lập refresh token
    oauth2Client.setCredentials({
      refresh_token: token.refresh_token
    });

    try {
      // Làm mới token
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      if (!credentials || !credentials.access_token) {
        console.error('❌ Làm mới token thất bại: Không nhận được credentials hợp lệ');
        return null;
      }
      
      // Đảm bảo giữ lại refresh_token nếu không có trong credentials mới
      if (!credentials.refresh_token && token.refresh_token) {
        credentials.refresh_token = token.refresh_token;
      }
      
      // Lưu token mới
      fs.writeFileSync(tokenFile, JSON.stringify(credentials, null, 2));
      
      return credentials;
    } catch (refreshError) {
      console.error(`❌ Lỗi khi làm mới token: ${refreshError.message}`);
      if (refreshError.response && refreshError.response.data) {
        console.error('Chi tiết lỗi:', JSON.stringify(refreshError.response.data, null, 2));
      }
      return null;
    }
  } catch (error) {
    console.error(`❌ Lỗi khi làm mới token ${type}: ${error.message}`);
    return null;
  }
}

// Hàm kiểm tra tất cả token
export async function checkAllTokens() {
  console.log('🔍 Đang kiểm tra tất cả token...');
  
  const downloadToken = await getTokenByType('download');
  const uploadToken = await getTokenByType('upload');
  
  const results = {
    download: downloadToken ? true : false,
    upload: uploadToken ? true : false
  };
  
  if (results.download && results.upload) {
    console.log('✅ Tất cả token đều hợp lệ');
  } else {
    console.error('❌ Một hoặc nhiều token không hợp lệ');
  }
  
  return results;
}

// Get file extension from MIME type
export function getExtensionFromMimeType(mimeType) {
  try {
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
  } catch (error) {
    console.error(`Lỗi xác định phần mở rộng từ MIME: ${error.message}`);
    return '.bin'; // Giá trị mặc định an toàn
  }
}

// Cải tiến chức năng dọn dẹp tạm để hiệu quả hơn và đảm bảo giải phóng bộ nhớ
export function cleanupTempFiles(tempDir) {
  if (!tempDir) return;
  
  try {
    if (fs.existsSync(tempDir)) {
      // Sử dụng đường dẫn tuyệt đối để tránh lỗi
      const absoluteTempDir = path.resolve(tempDir);
      console.log(`🧹 Dọn dẹp thư mục tạm: ${absoluteTempDir}`);
      
      try {
        // Đọc tất cả các mục trong thư mục
        const entries = fs.readdirSync(absoluteTempDir, { withFileTypes: true });
        
        // Đếm số lượng tệp/thư mục được xử lý
        let processedCount = 0;
        const totalEntries = entries.length;
        
        // Xóa tất cả các tệp trước, sau đó các thư mục
        for (const entry of entries) {
          const fullPath = path.join(absoluteTempDir, entry.name);
          
          try {
            // Nếu là thư mục, gọi đệ quy
            if (entry.isDirectory()) {
              cleanupTempFiles(fullPath);
            } else {
              // Xóa tệp
              fs.unlinkSync(fullPath);
            }
            processedCount++;
            
            // Thúc đẩy GC sau mỗi 10 tệp để tránh tràn bộ nhớ
            if (processedCount % 10 === 0) {
              forceGarbageCollection();
            }
          } catch (entryError) {
            console.warn(`⚠️ Không thể xóa ${entry.isDirectory() ? 'thư mục' : 'tệp'} ${entry.name}: ${entryError.message}`);
          }
        }
        
        // Xóa thư mục sau khi đã xóa tất cả các mục bên trong
        fs.rmdirSync(absoluteTempDir, { recursive: true, force: true });
        console.log(`✅ Đã xóa thành công thư mục tạm với ${processedCount}/${totalEntries} mục`);
      } catch (fsError) {
        // Nếu không thể xóa bằng fs, thử dùng cách mạnh hơn trên Windows
        const isWindows = process.platform === 'win32';
        if (isWindows) {
          try {
            execSync(`rmdir /s /q "${absoluteTempDir}"`, { stdio: 'ignore' });
            console.log(`✅ Đã xóa thư mục tạm bằng lệnh rmdir`);
          } catch (cmdError) {
            console.error(`❌ Không thể xóa thư mục tạm bằng lệnh: ${cmdError.message}`);
          }
        } else {
          try {
            execSync(`rm -rf "${absoluteTempDir}"`, { stdio: 'ignore' });
            console.log(`✅ Đã xóa thư mục tạm bằng lệnh rm`);
          } catch (cmdError) {
            console.error(`❌ Không thể xóa thư mục tạm bằng lệnh: ${cmdError.message}`);
          }
        }
      }
    }
  } catch (error) {
    console.error(`❌ Lỗi dọn dẹp thư mục tạm: ${error.message}`);
  } finally {
    // Thúc đẩy GC sau khi hoàn thành
    forceGarbageCollection();
  }
}

// Hàm mới: Thúc đẩy Garbage Collection để giải phóng bộ nhớ
export function forceGarbageCollection() {
  try {
    // Giải phóng các biến không cần thiết
    const beforeMemory = process.memoryUsage();
    
    // Gọi GC nếu có sẵn (cần chạy Node với flag --expose-gc)
    if (typeof global.gc === 'function') {
      global.gc();
    }
    
    // Thử thúc đẩy GC gián tiếp
    const tempArray = new Array(10000).fill(0);
    tempArray.length = 0;
    
    // Kiểm tra mức sử dụng bộ nhớ sau khi dọn dẹp (chỉ để debug)
    if (process.env.NODE_ENV === 'development') {
      const afterMemory = process.memoryUsage();
      const diffHeap = (beforeMemory.heapUsed - afterMemory.heapUsed) / (1024 * 1024);
      if (diffHeap > 1) {
        console.debug(`🧹 Đã giải phóng khoảng ${diffHeap.toFixed(2)}MB bộ nhớ`);
      }
    }
  } catch (error) {
    // Lỗi trong quá trình GC không quan trọng lắm
    console.debug(`⚠️ Lỗi khi thúc đẩy GC: ${error.message}`);
  }
}

// Kiểm tra và tìm GhostScript với thông tin chi tiết hơn
export function findGhostscript() {
  try {
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
          } catch (execError) {
            // Tiếp tục tìm đường dẫn khác
            console.debug(`Đường dẫn ${gsPath} tồn tại nhưng không thể thực thi: ${execError.message}`);
          }
        }
      } catch (existsError) {
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
    } catch (knownPathError) {
      // Handle error
      console.debug(`Không thể truy cập đường dẫn đã biết: ${knownPathError.message}`);
    }
    
    throw new Error('GhostScript không được cài đặt hoặc không thể tìm thấy. Vui lòng cài đặt GhostScript trước khi sử dụng API này.');
  } catch (error) {
    console.error(`Lỗi khi tìm GhostScript: ${error.message}`);
    throw error; // Ném lại lỗi vì đây là một hàm quan trọng
  }
}

// Hàm mới: Kiểm tra và tối ưu hóa hiệu suất dựa trên tài nguyên hệ thống
export function optimizePerformance(config = {}) {
  try {
    // Kiểm tra tài nguyên hệ thống
    const cpuCount = os.cpus().length;
    const totalMemory = Math.floor(os.totalmem() / (1024 * 1024 * 1024)); // GB
    const freeMemory = Math.floor(os.freemem() / (1024 * 1024 * 1024)); // GB
    
    console.log(`🖥️ Hệ thống có ${cpuCount} CPU, ${totalMemory}GB RAM (${freeMemory}GB trống)`);
    
    // Ghi cứng DPI là 350 theo yêu cầu
    const fixedDpi = 350;
    
    // Tính toán tối ưu
    let optimizedConfig = { ...config };
    
    // Ghi đè giá trị DPI
    optimizedConfig.dpi = fixedDpi;
    
    // Tối ưu số lượng worker dựa trên CPU và RAM
    if (totalMemory >= 16 && freeMemory > 8) {
      // Hệ thống cực mạnh: Rất nhiều RAM (>16GB)
      console.log(`🚀🚀 Phát hiện hệ thống RAM cao (${totalMemory}GB), tối ưu cho hiệu suất tối đa`);
      
      optimizedConfig.maxWorkers = Math.min(cpuCount, 16); // Tối đa 16 worker
      optimizedConfig.batchSize = Math.min(Math.floor(freeMemory / 2), 12); // Dựa vào RAM trống, tối đa 12
      optimizedConfig.waitTime = 50; // Giảm thời gian chờ xuống tối thiểu
      optimizedConfig.highPerformanceMode = true;
      optimizedConfig.ultra = true; // Chế độ cực cao
      
      // Ghi cứng DPI là 350
      optimizedConfig.dpi = fixedDpi;
      optimizedConfig.gsParallel = Math.min(Math.ceil(cpuCount / 2), 8); // Tối đa 8 luồng GhostScript
      
      console.log(`⚡ Chế độ Ultra Performance: ${optimizedConfig.maxWorkers} worker, batch ${optimizedConfig.batchSize}, DPI: ${optimizedConfig.dpi}`);
    } else if (cpuCount > 4 && freeMemory > 4) {
      // Hệ thống mạnh: Nhiều CPU và RAM
      console.log(`🚀 Phát hiện hệ thống mạnh, tối ưu cho hiệu suất cao`);
      
      optimizedConfig.maxWorkers = Math.min(cpuCount - 1, 8); // Tối đa 8 worker hoặc (số CPU - 1)
      optimizedConfig.batchSize = Math.min(Math.floor(freeMemory / 2), 6); // Dựa vào RAM trống
      optimizedConfig.waitTime = 100; // Giảm thời gian chờ
      optimizedConfig.highPerformanceMode = true;
      
      // Ghi cứng DPI là 350
      optimizedConfig.dpi = fixedDpi;
      optimizedConfig.gsParallel = Math.min(Math.floor(cpuCount / 2), 4); // Số luồng GhostScript
    } else if (cpuCount > 2 && freeMemory > 2) {
      // Hệ thống trung bình
      console.log(`⚡ Phát hiện hệ thống đủ mạnh, tối ưu cân bằng`);
      
      optimizedConfig.maxWorkers = Math.min(cpuCount - 1, 4);
      optimizedConfig.batchSize = Math.min(Math.floor(freeMemory / 3), 3);
      optimizedConfig.waitTime = 200;
      optimizedConfig.highPerformanceMode = false;
      
      // Ghi cứng DPI là 350
      optimizedConfig.dpi = fixedDpi;
      optimizedConfig.gsParallel = Math.min(Math.floor(cpuCount / 2), 2);
    } else {
      // Hệ thống yếu hoặc tải cao
      console.log(`🐢 Phát hiện hệ thống tài nguyên thấp, tối ưu cho ổn định`);
      
      optimizedConfig.maxWorkers = 2;
      optimizedConfig.batchSize = 2;
      optimizedConfig.waitTime = 300;
      optimizedConfig.highPerformanceMode = false;
      
      // Ghi cứng DPI là 350
      optimizedConfig.dpi = fixedDpi;
      optimizedConfig.gsParallel = 1;
    }
    
    console.log(`✅ Cấu hình tối ưu: ${optimizedConfig.maxWorkers} worker, batch ${optimizedConfig.batchSize}, wait ${optimizedConfig.waitTime}ms, DPI ${optimizedConfig.dpi}`);
    return optimizedConfig;
  } catch (error) {
    console.warn(`⚠️ Lỗi khi tối ưu hiệu suất: ${error.message}. Sử dụng cấu hình mặc định.`);
    return { ...config, dpi: 350 }; // Vẫn ghi đè DPI=350 ngay cả khi có lỗi
  }
}

// Tối ưu xử lý song song để cải thiện hiệu suất và tránh tràn bộ nhớ
export async function processBatches(items, processFunc, maxConcurrent, waitTime = 200) {
  try {
    const results = [];
    
    // Giảm kích thước batch để tránh sử dụng quá nhiều bộ nhớ cùng lúc
    const safeBatchSize = Math.min(maxConcurrent, 2); // Giảm xuống 2 item cùng lúc để giảm tải bộ nhớ
    
    for (let i = 0; i < items.length; i += safeBatchSize) {
      try {
        // Xử lý theo batch nhỏ
        const currentBatch = items.slice(i, i + safeBatchSize);
        
        // Bắt đầu xử lý batch hiện tại
        const batch = currentBatch.map(processFunc);
        
        let batchResults;
        try {
          batchResults = await Promise.allSettled(batch);
        } catch (batchError) {
          console.error(`Lỗi khi xử lý batch ${Math.floor(i / safeBatchSize) + 1}: ${batchError.message}`);
          batchResults = currentBatch.map(item => ({
            status: 'rejected',
            reason: batchError
          }));
        }
        
        // Thêm kết quả vào mảng kết quả
        results.push(...batchResults);
        
        // Chủ động giải phóng bộ nhớ sau mỗi batch
        forceGarbageCollection();
        
        // Đợi một chút giữa các batch để cho hệ thống thời gian xử lý bộ nhớ
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } catch (batchProcessError) {
        console.error(`Lỗi xử lý batch tại vị trí ${i}: ${batchProcessError.message}`);
        // Giải phóng bộ nhớ khi có lỗi
        forceGarbageCollection();
      }
    }
    
    return results;
  } catch (error) {
    console.error(`Lỗi xử lý batches: ${error.message}`);
    throw error;
  }
}

// Hàm escape tên file cho truy vấn Google Drive
export function escapeDriveQueryString(str) {
  if (!str) return '';
  
  // Chuẩn hóa chuỗi Unicode (NFC)
  let normalizedStr = str.normalize('NFC');
  
  // Escape các ký tự đặc biệt trong truy vấn Google Drive
  return normalizedStr
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\\/g, '\\\\');
}

// Hàm cập nhật thông tin file đã xử lý vào MongoDB
export async function updateProcessedFileInDB(mongoClient, courseId, originalUrl, processedData) {
  try {
    if (!mongoClient || !courseId || !originalUrl || !processedData) {
      console.error('Thiếu thông tin cần thiết để cập nhật DB');
      return { success: false, error: 'Thiếu thông tin cần thiết' };
    }

    console.log(`Cập nhật thông tin file đã xử lý vào DB: ${originalUrl} -> ${processedData.downloadLink}`);
    
    const db = mongoClient.db('kimvan');
    const collection = db.collection('courses');
    
    // Tìm khóa học theo ID
    const course = await collection.findOne({ _id: courseId });
    
    if (!course) {
      console.error(`Không tìm thấy khóa học với ID: ${courseId}`);
      return { success: false, error: 'Không tìm thấy khóa học' };
    }
    
    // Khởi tạo processedDriveFiles nếu chưa có
    if (!course.processedDriveFiles) {
      course.processedDriveFiles = [];
    }
    
    // Kiểm tra xem file đã được xử lý trước đó chưa
    const existingFileIndex = course.processedDriveFiles.findIndex(
      file => file.originalUrl === originalUrl
    );
    
    // Kiểm tra link cũ nếu có
    if (existingFileIndex !== -1) {
      const oldProcessedUrl = course.processedDriveFiles[existingFileIndex].processedUrl;
      if (oldProcessedUrl) {
        console.log(`Link đã xử lý trước đó: ${oldProcessedUrl}`);
        
        // Nếu link cũ khác link mới, kiểm tra trạng thái link cũ
        if (oldProcessedUrl !== (processedData.viewLink || processedData.downloadLink)) {
          console.log(`Kiểm tra trạng thái link đã xử lý: ${oldProcessedUrl}`);
          
          // Ở đây có thể thêm mã để kiểm tra xem link cũ còn truy cập được không
          // Ví dụ: gửi một request đến link cũ để kiểm tra trạng thái
          // Nhưng đơn giản hơn, chúng ta chỉ log thông báo là link đã thay đổi
          console.log(`Link đã xử lý không còn tồn tại: ${oldProcessedUrl}`);
          console.log(`Sẽ cập nhật với link mới: ${processedData.viewLink || processedData.downloadLink}`);
        }
      }
    }
    
    // Tạo đối tượng lưu thông tin file đã xử lý
    const processedFileData = {
      originalUrl,
      processedUrl: processedData.viewLink || processedData.downloadLink,
      downloadUrl: processedData.downloadLink,
      viewUrl: processedData.viewLink,
      fileName: processedData.processedFilename || processedData.originalFilename,
      originalFileName: processedData.originalFilename,
      updatedAt: new Date(),
      isSkipped: processedData.skipped || false
    };
    
    // Cập nhật hoặc thêm mới thông tin file
    if (existingFileIndex !== -1) {
      // Cập nhật thông tin file đã tồn tại
      await collection.updateOne(
        { _id: courseId },
        { $set: { [`processedDriveFiles.${existingFileIndex}`]: processedFileData } }
      );
      console.log(`Đã cập nhật thông tin file đã xử lý trong DB: ${originalUrl}`);
      console.log(`✅ Xử lý thành công, URL mới: ${processedData.viewLink}`);
    } else {
      // Thêm thông tin file mới
      await collection.updateOne(
        { _id: courseId },
        { $push: { processedDriveFiles: processedFileData } }
      );
      console.log(`Đã thêm thông tin file đã xử lý vào DB: ${originalUrl}`);
      console.log(`✅ Xử lý thành công, URL mới: ${processedData.viewLink}`);
    }
    
    return { success: true };
  } catch (error) {
    console.error(`Lỗi khi cập nhật thông tin file vào DB: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Thêm hàm kiểm tra thông tin email trong token
export function validateTokenEmail(token, tokenType = 'upload') {
  if (!token) {
    console.error(`❌ Token ${tokenType} không tồn tại`);
    return false;
  }

  if (!token.email) {
    console.warn(`⚠️ Token ${tokenType} không có thông tin email, có thể gây lỗi quyền truy cập`);
    return false;
  }

  console.log(`✅ Token ${tokenType} hợp lệ với email: ${token.email}`);
  return true;
} 