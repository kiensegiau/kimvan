/**
 * cookie-service.js
 * Module xử lý tải file từ Google Drive sử dụng cookie đã lưu
 */
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

/**
 * Tải file từ Google Drive sử dụng cookie đã lưu
 * @param {string} fileId - ID của file cần tải
 * @param {string} outputPath - Đường dẫn để lưu file
 * @returns {Promise<Object>} - Kết quả tải file
 */
export async function downloadWithCookie(fileId, outputPath) {
  try {
    console.log(`🍪 Bắt đầu tải file sử dụng cookie: ${fileId}`);
    
    // Lấy cookie từ file lưu trữ
    const cookie = await getKimvanCookie();
    
    if (!cookie || !cookie.trim()) {
      console.log('❌ Không tìm thấy cookie để tải file');
      return {
        success: false,
        error: 'NO_COOKIE_FOUND',
        message: 'Không tìm thấy cookie để tải file'
      };
    }
    
    // Chuẩn bị URL tải xuống
    const downloadUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;
    console.log(`🌐 URL tải xuống: ${downloadUrl}`);
    
    // Import các module cần thiết
    const path = require('path');
    
    // Tạo thư mục tạm để lưu file tạm thời (không có extension)
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Tạo tên file tạm không có extension
    const tempFilePath = path.join(outputDir, `temp_${fileId}_${Date.now()}`);
    const tempWriter = fs.createWriteStream(tempFilePath);
    
    // Thiết lập timeout 5 phút cho request
    const timeout = 5 * 60 * 1000;
    
    // Tạo request với cookie
    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream',
      timeout: timeout,
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      maxContentLength: 500 * 1024 * 1024, // 500MB
      maxBodyLength: 500 * 1024 * 1024 // 500MB
    });
    
    // Pipe response vào file tạm
    response.data.pipe(tempWriter);
    
    // Đợi file tạm được tải xong
    await new Promise((resolve, reject) => {
      tempWriter.on('finish', resolve);
      tempWriter.on('error', reject);
    });
    
    // Xác định extension từ Content-Disposition header
    let fileExtension = '';
    let fileName = `file_${fileId}`;
    
    const contentDisposition = response.headers['content-disposition'];
    if (contentDisposition) {
      // Trích xuất tên file từ Content-Disposition
      const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
      const matches = filenameRegex.exec(contentDisposition);
      if (matches && matches[1]) {
        // Loại bỏ dấu ngoặc kép nếu có
        let extractedName = matches[1].replace(/['"]/g, '');
        // Decode URL nếu cần
        try {
          extractedName = decodeURIComponent(extractedName);
        } catch (e) {
          // Nếu không decode được, giữ nguyên
        }
        
        fileName = extractedName;
        const extractedExtension = path.extname(extractedName);
        if (extractedExtension) {
          fileExtension = extractedExtension;
          console.log(`📄 Đã trích xuất extension từ Content-Disposition: ${fileExtension}`);
        }
      }
    }
    
    // Nếu không có extension từ Content-Disposition, thử lấy từ Content-Type
    if (!fileExtension) {
      const contentType = response.headers['content-type'];
      if (contentType) {
        if (contentType.includes('pdf')) {
          fileExtension = '.pdf';
        } else if (contentType.includes('image/jpeg') || contentType.includes('image/jpg')) {
          fileExtension = '.jpg';
        } else if (contentType.includes('image/png')) {
          fileExtension = '.png';
        } else if (contentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
          fileExtension = '.docx';
        } else if (contentType.includes('application/msword')) {
          fileExtension = '.doc';
        } else if (contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
          fileExtension = '.xlsx';
        } else if (contentType.includes('application/vnd.ms-excel')) {
          fileExtension = '.xls';
        } else if (contentType.includes('application/vnd.openxmlformats-officedocument.presentationml.presentation')) {
          fileExtension = '.pptx';
        } else if (contentType.includes('application/vnd.ms-powerpoint')) {
          fileExtension = '.ppt';
        } else if (contentType.includes('video/mp4')) {
          fileExtension = '.mp4';
        } else if (contentType.includes('audio/mpeg')) {
          fileExtension = '.mp3';
        } else if (contentType.includes('text/plain')) {
          fileExtension = '.txt';
        } else {
          // Mặc định là PDF nếu không xác định được
          fileExtension = '.pdf';
        }
        console.log(`📄 Đã xác định extension từ Content-Type: ${fileExtension}`);
      } else {
        // Mặc định là PDF nếu không xác định được
        fileExtension = '.pdf';
        console.log(`📄 Không có Content-Type, sử dụng extension mặc định: ${fileExtension}`);
      }
    }
    
    // Kiểm tra magic bytes của file để xác định loại file chính xác
    try {
      const buffer = Buffer.alloc(8);
      const fd = fs.openSync(tempFilePath, 'r');
      fs.readSync(fd, buffer, 0, 8, 0);
      fs.closeSync(fd);
      
      // Kiểm tra magic bytes
      if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
        // %PDF
        fileExtension = '.pdf';
        console.log('🔍 Xác nhận file là PDF từ magic bytes');
      } else if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        // JPEG
        fileExtension = '.jpg';
        console.log('🔍 Xác nhận file là JPEG từ magic bytes');
      } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        // PNG
        fileExtension = '.png';
        console.log('🔍 Xác nhận file là PNG từ magic bytes');
      } else if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
        // ZIP-based (DOCX, XLSX, PPTX)
        // Cần kiểm tra thêm để xác định chính xác
        console.log('🔍 File có thể là DOCX/XLSX/PPTX (ZIP-based) từ magic bytes');
      }
    } catch (magicError) {
      console.error(`⚠️ Lỗi khi kiểm tra magic bytes: ${magicError.message}`);
    }
    
    // Tạo đường dẫn file cuối cùng với extension đúng
    // Ưu tiên giữ đường dẫn gốc nếu đã có extension
    const originalExtension = path.extname(outputPath);
    let finalPath;
    
    if (originalExtension) {
      // Nếu đường dẫn gốc đã có extension, giữ nguyên
      finalPath = outputPath;
      console.log(`📄 Giữ nguyên đường dẫn gốc với extension: ${originalExtension}`);
    } else {
      // Nếu không, thêm extension đã xác định
      finalPath = `${outputPath}${fileExtension}`;
      console.log(`📄 Thêm extension ${fileExtension} vào đường dẫn gốc: ${finalPath}`);
    }
    
    // Di chuyển file tạm sang file cuối cùng
    fs.renameSync(tempFilePath, finalPath);
    console.log(`✅ Đã di chuyển file tạm sang file cuối cùng: ${finalPath}`);
    
    // Kiểm tra kích thước file
    try {
      const stats = fs.statSync(finalPath);
      const fileSizeMB = stats.size / (1024 * 1024);
      
      console.log(`✅ Tải file thành công với cookie: ${finalPath} (${fileSizeMB.toFixed(2)} MB)`);
      
      // Kiểm tra nếu file quá nhỏ (dưới 10KB), có thể là trang HTML lỗi
      if (stats.size < 10 * 1024) {
        // Đọc nội dung file để kiểm tra
        const content = fs.readFileSync(finalPath, 'utf8');
        if (content.includes('<html') || content.includes('Error') || content.includes('Access denied')) {
          console.log(`❌ File tải về có vẻ là trang HTML lỗi, không phải file thực`);
          return {
            success: false,
            error: 'INVALID_FILE_CONTENT',
            message: 'File tải về không hợp lệ (có thể là trang HTML lỗi)'
          };
        }
        
        // Kiểm tra lỗi 403 trong nội dung
        if (content.includes('403') || content.includes('Forbidden') || content.includes('không có quyền')) {
          console.log(`❌ Phát hiện lỗi 403 trong nội dung tải về`);
          return {
            success: false,
            error: 'HTTP_ERROR_403',
            message: 'Lỗi 403: Không có quyền truy cập file'
          };
        }
      }
      
      return {
        success: true,
        filePath: finalPath,
        fileName: fileName,
        fileExtension: fileExtension,
        fileSizeMB: fileSizeMB,
        mimeType: response.headers['content-type'] || 'application/pdf'
      };
    } catch (statError) {
      console.error(`❌ Lỗi khi kiểm tra file: ${statError.message}`);
      throw statError;
    }
  } catch (error) {
    console.error(`❌ Lỗi khi tải file bằng cookie: ${error.message}`);
    
    // Kiểm tra lỗi cụ thể
    if (error.response) {
      // Lỗi từ server (403, 404, etc)
      console.log(`❌ Lỗi server khi tải file: ${error.response.status}`);
      
      // Nếu là lỗi 403, đánh dấu rõ để bỏ qua phương pháp cookie
      if (error.response.status === 403) {
        return {
          success: false,
          error: 'HTTP_ERROR_403',
          message: 'Lỗi 403: Không có quyền truy cập file',
          skipCookieMethod: true
        };
      }
      
      return {
        success: false,
        error: `HTTP_ERROR_${error.response.status}`,
        message: `Lỗi server: ${error.response.status}`
      };
    } else if (error.request) {
      // Không có phản hồi từ server
      console.log(`❌ Không có phản hồi từ server`);
      return {
        success: false,
        error: 'NO_RESPONSE',
        message: 'Không có phản hồi từ server'
      };
    } else {
      // Lỗi khác
      return {
        success: false,
        error: 'DOWNLOAD_ERROR',
        message: error.message
      };
    }
  }
}

/**
 * Lấy cookie Kimvan đã lưu
 * @returns {Promise<string>} Cookie string
 */
async function getKimvanCookie() {
  try {
    // Đường dẫn đến các file cookie có thể có
    const cookieFilePaths = [
      path.join(process.cwd(), 'kimvan-cookie.txt'),
      path.join(process.cwd(), 'data', 'kimvan-cookie.txt'),
      path.join(process.cwd(), 'kimvan-cookie.json')
    ];
    
    // Thử đọc từ các file cookie
    for (const cookiePath of cookieFilePaths) {
      if (fs.existsSync(cookiePath)) {
        console.log(`✅ Tìm thấy file cookie tại: ${cookiePath}`);
        
        // Kiểm tra nếu là file JSON
        if (cookiePath.endsWith('.json')) {
          const cookieJson = JSON.parse(fs.readFileSync(cookiePath, 'utf8'));
          // Chuyển đổi từ định dạng JSON sang chuỗi cookie
          const cookieString = cookieJson.map(c => `${c.name}=${c.value}`).join('; ');
          console.log(`✅ Đã chuyển đổi cookie từ JSON sang chuỗi`);
          return cookieString;
        } else {
          // Đọc file cookie text thông thường
          return fs.readFileSync(cookiePath, 'utf8');
        }
      }
    }
    
    // Thử lấy cookie từ API
    try {
      console.log(`🔄 Thử lấy cookie từ API...`);
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/youtube/kimvan-cookie`;
      const response = await axios.get(apiUrl);
      
      if (response.data && response.data.cookie) {
        console.log(`✅ Đã lấy cookie từ API`);
        return response.data.cookie;
      }
    } catch (apiError) {
      console.error(`❌ Không thể lấy cookie từ API: ${apiError.message}`);
    }
    
    console.log(`❌ Không tìm thấy cookie ở bất kỳ vị trí nào`);
    return null;
  } catch (error) {
    console.error(`❌ Lỗi khi lấy cookie: ${error.message}`);
    return null;
  }
} 