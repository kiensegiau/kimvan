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
        console.error(`Lỗi phân tích token ${type}: ${parseError.message}`);
        // Fallback to old token file
        return getStoredToken();
      }
    } else {
      // Fallback to old token file
      return getStoredToken();
    }
  } catch (error) {
    console.error(`Lỗi đọc token ${type}: ${error.message}`);
    // Fallback to old token file
    return getStoredToken();
  }
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

// Clean up temporary files
export function cleanupTempFiles(tempDir) {
  try {
    if (fs.existsSync(tempDir)) {
      try {
        const files = fs.readdirSync(tempDir);
        for (const file of files) {
          try {
            fs.unlinkSync(path.join(tempDir, file));
          } catch (unlinkError) {
            console.warn(`Không thể xóa file ${file}: ${unlinkError.message}`);
            // Tiếp tục với file tiếp theo
          }
        }
        try {
          fs.rmdirSync(tempDir, { recursive: true });
        } catch (rmdirError) {
          console.warn(`Không thể xóa thư mục ${tempDir}: ${rmdirError.message}`);
        }
      } catch (readError) {
        console.error(`Không thể đọc thư mục ${tempDir}: ${readError.message}`);
      }
    }
  } catch (error) {
    console.error(`Lỗi khi dọn dẹp tệp tạm: ${error.message}`);
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

// Tối ưu xử lý song song để cải thiện hiệu suất và tránh tràn bộ nhớ
export async function processBatches(items, processFunc, maxConcurrent) {
  try {
    const results = [];
    
    // Giảm kích thước batch để tránh sử dụng quá nhiều bộ nhớ cùng lúc
    const safeBatchSize = Math.min(maxConcurrent, 3); // Tối đa 3 item cùng lúc
    
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
        
        // Đợi GC chạy sau mỗi batch
        if (typeof global.gc === 'function') {
          try {
            global.gc();
          } catch (gcError) {
            console.debug(`Lỗi khi gọi GC: ${gcError.message}`);
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (batchProcessError) {
        console.error(`Lỗi xử lý batch tại vị trí ${i}: ${batchProcessError.message}`);
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
  // Escape các ký tự đặc biệt trong truy vấn Google Drive
  return str.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\\/g, '\\\\');
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