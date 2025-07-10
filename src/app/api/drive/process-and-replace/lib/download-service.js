import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import { getAccessToken } from '@/utils/auth-utils';
import os from 'os';

/**
 * Tải xuống file từ Google Drive
 * @param {string} fileId - ID của file trên Google Drive
 * @param {string} outputPath - Đường dẫn đầu ra để lưu file
 * @returns {Promise<Object>} - Kết quả tải xuống
 */
export async function downloadFromGoogleDrive(fileId, outputPath) {
  console.log(`Bắt đầu tải xuống file với ID: ${fileId}`);
  console.log(`Đường dẫn đầu ra: ${outputPath}`);
  
  // Đảm bảo thư mục chứa file tồn tại
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Đã tạo thư mục: ${outputDir}`);
  } else {
    console.log(`Thư mục đã tồn tại: ${outputDir}`);
  }

  // Xóa file cũ nếu đã tồn tại
  if (fs.existsSync(outputPath)) {
    console.log(`File đã tồn tại, đang xóa: ${outputPath}`);
    try {
      fs.unlinkSync(outputPath);
      console.log(`Đã xóa file cũ tại: ${outputPath}`);
    } catch (unlinkError) {
      console.error(`Không thể xóa file cũ: ${unlinkError.message}`);
    }
  }

  // Thêm cơ chế retry
  const MAX_RETRIES = 1;
  let lastError = null;
  
  for (let retryCount = 0; retryCount <= MAX_RETRIES; retryCount++) {
    try {
      if (retryCount > 0) {
        console.log(`Thử lại lần ${retryCount}/${MAX_RETRIES} cho file ID: ${fileId}`);
        const delayTime = Math.min(Math.pow(2, retryCount) * 2000, 30000);
        console.log(`Đợi ${delayTime/1000} giây trước khi thử lại...`);
        await new Promise(resolve => setTimeout(resolve, delayTime));
      }

      console.log('🔄 Đang thử tải file thông qua Google Drive API...');
      
      // Lấy access token từ auth-utils
      const accessToken = await getAccessToken();
      console.log('Đã lấy access token từ auth-utils');

      // Tạo URL tải xuống
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      console.log('URL tải xuống:', downloadUrl);

      // Thực hiện request tải xuống
      console.log(`Bắt đầu gửi request tải xuống...`);
      const response = await axios({
        method: 'get',
        url: downloadUrl,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        responseType: 'stream',
        timeout: 30000 // 30 giây timeout
      });
      console.log(`Đã nhận phản hồi từ server, bắt đầu ghi file...`);

      // Xác định đuôi file dựa trên MIME type
      const mimeType = response.headers['content-type'];
      console.log(`MIME type: ${mimeType}`);
      
      // Ghi file vào outputPath
      const writer = fs.createWriteStream(outputPath);
      console.log(`Đã tạo stream ghi file tại: ${outputPath}`);
      
      // Bắt sự kiện lỗi của writer
      writer.on('error', (err) => {
        console.error(`Lỗi khi ghi file: ${err.message}`);
      });
      
      // Bắt sự kiện pipe data
      response.data.on('data', (chunk) => {
        // Log khi đã nhận dữ liệu đầu tiên
        if (!writer.bytesWritten || writer.bytesWritten === 0) {
          console.log(`Đang nhận dữ liệu...`);
        }
      });
      
      // Pipe dữ liệu
      response.data.pipe(writer);

      // Đợi ghi file hoàn tất
      await new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log(`Stream ghi file đã kết thúc`);
          resolve();
        });
        writer.on('error', (err) => {
          console.error(`Lỗi stream ghi file: ${err.message}`);
          reject(err);
        });
      });

      // Kiểm tra file đã được tạo thành công
      if (fs.existsSync(outputPath)) {
        try {
          const fileStats = fs.statSync(outputPath);
          const fileSizeMB = fileStats.size / (1024 * 1024);
          
          console.log(`✅ Tải file thành công qua API`);
          console.log(`📄 Đường dẫn: ${outputPath}`);
          console.log(`📦 Kích thước: ${fileSizeMB.toFixed(2)} MB`);
          
          if (fileSizeMB < 0.001) {
            console.warn(`⚠️ Cảnh báo: File có kích thước quá nhỏ (${fileStats.size} bytes)`);
          }
          
          return {
            success: true,
            filePath: outputPath,
            mimeType: mimeType
          };
        } catch (statError) {
          console.error(`Lỗi khi kiểm tra file: ${statError.message}`);
          throw new Error(`File đã tạo nhưng không thể đọc thông tin: ${statError.message}`);
        }
      } else {
        console.error(`❌ Lỗi: File không được tạo tại đường dẫn: ${outputPath}`);
        throw new Error(`File không được tạo tại đường dẫn: ${outputPath}`);
      }

    } catch (error) {
      let errorMessage = 'Unknown error';
      
      try {
        if (error.response?.data) {
          // Xử lý an toàn để tránh lỗi circular structure
          errorMessage = typeof error.response.data === 'string' ? 
            error.response.data : 
            'Error response data (cannot stringify)';
        } else {
          errorMessage = error.message || 'Unknown error';
        }
      } catch (jsonError) {
        errorMessage = `Error parsing response data: ${error.message || 'Unknown error'}`;
      }
        
      console.error(`Lỗi khi tải xuống file (lần thử ${retryCount + 1}/${MAX_RETRIES + 1}):`, errorMessage);
      console.error(`Loại lỗi: ${error.name}, Code: ${error.code}, Response status: ${error.response?.status}`);
      
      lastError = error;
      
      // Kiểm tra lỗi 403 (Không có quyền truy cập)
      if (error.response?.status === 403 || 
          error.message?.includes('403') || 
          error.message?.includes('cannotDownloadFile')) {
        console.log('⚠️ Phát hiện lỗi 403 - File bị chặn download');
        throw new Error(`HTTP 403: File bị chặn download - ${errorMessage}`);
      }
      
      // Nếu đã thử hết số lần, ném lỗi
      if (retryCount === MAX_RETRIES) {
        throw new Error(`Không thể tải xuống file sau ${MAX_RETRIES + 1} lần thử: ${errorMessage}`);
      }
      
      // Xóa file tạm nếu có lỗi và tồn tại
      if (fs.existsSync(outputPath)) {
        try {
          fs.unlinkSync(outputPath);
          console.log(`Đã xóa file tạm ${outputPath} do lỗi`);
        } catch (cleanupError) {
          console.error('Lỗi khi xóa file tạm:', cleanupError.message);
        }
      }
    }
  }
  
  // Nếu code chạy đến đây, có lỗi không xử lý được
  throw lastError || new Error('Không thể tải xuống file vì lỗi không xác định');
}

/**
 * Kiểm tra thông tin và quyền truy cập file
 * @param {string} fileId - ID của file trên Google Drive
 * @returns {Promise<Object>} - Thông tin file
 */
export async function checkFileInfo(fileId) {
  console.log(`Kiểm tra thông tin file ${fileId}...`);
  
  try {
    // Lấy thông tin chi tiết của file, bao gồm permissions và owner
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,fileExtension,capabilities,permissions,owners,sharingUser`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${await getAccessToken()}`
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Lỗi khi lấy thông tin file: ${errorText}`);
      
      if (response.status === 404) {
        return {
          success: false,
          error: 'File không tồn tại hoặc đã bị xóa',
          status: 404
        };
      }
      
      if (response.status === 403) {
        return {
          success: false,
          error: 'Không có quyền truy cập file',
          status: 403
        };
      }
      
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const fileInfo = await response.json();
    
  

    // Kiểm tra quyền truy cập
    const canDownload = fileInfo.capabilities?.canDownload;
    if (!canDownload) {
      return {
        success: false,
        error: 'Không có quyền tải xuống file',
        status: 403,
        fileInfo
      };
    }

    return {
      success: true,
      fileInfo
    };
  } catch (error) {
    console.error('Lỗi khi kiểm tra file:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Liệt kê tất cả các file trong một folder Google Drive
 * @param {string} folderId - ID của folder cần liệt kê
 * @returns {Promise<Array>} - Danh sách các file trong folder
 */
export async function listFilesInFolder(folderId) {
  console.log(`Đang liệt kê các file trong folder ${folderId}...`);
  
  try {
    // Tạo OAuth2 client với khả năng tự động refresh token
    const oauth2Client = createOAuth2Client(1); // Sử dụng token tải xuống
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Kiểm tra quyền truy cập folder
    try {
      const folderInfo = await drive.files.get({
        fileId: folderId,
        fields: 'name,mimeType,capabilities'
      });
      
      // Kiểm tra xem đây có phải là folder không
      if (folderInfo.data.mimeType !== 'application/vnd.google-apps.folder') {
        return {
          success: false,
          error: 'ID được cung cấp không phải là folder',
          errorCode: 'NOT_A_FOLDER'
        };
      }
      
      // Kiểm tra quyền truy cập
      if (folderInfo.data.capabilities && !folderInfo.data.capabilities.canListChildren) {
        return {
          success: false,
          error: `Không có quyền liệt kê nội dung của folder: ${folderInfo.data.name || folderId}`,
          errorCode: 'PERMISSION_DENIED'
        };
      }
      
      console.log(`Đã xác nhận quyền truy cập vào folder: ${folderInfo.data.name}`);
    } catch (error) {
      // Xử lý lỗi khi kiểm tra folder
      if (error.code === 404 || error.response?.status === 404) {
        return {
          success: false,
          error: `Folder không tồn tại (404): ${folderId}`,
          errorCode: 'FOLDER_NOT_FOUND'
        };
      }
      
      if (error.code === 403 || error.response?.status === 403) {
        return {
          success: false,
          error: `Không có quyền truy cập folder (403): ${folderId}`,
          errorCode: 'PERMISSION_DENIED'
        };
      }
      
      return {
        success: false,
        error: `Lỗi khi kiểm tra folder: ${error.message}`,
        errorCode: 'CHECK_FOLDER_ERROR'
      };
    }
    
    let files = [];
    let pageToken = null;
    
    do {
      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id, name, mimeType, size)',
        pageToken: pageToken,
        pageSize: 1000
      });
      
      files = files.concat(response.data.files);
      pageToken = response.data.nextPageToken;
    } while (pageToken);
    
    console.log(`Đã tìm thấy ${files.length} file/folder trong folder ${folderId}`);
    return {
      success: true,
      files: files
    };
  } catch (error) {
    console.error(`Lỗi khi liệt kê file trong folder ${folderId}:`, error);
    
    // Phân loại lỗi
    let errorCode = 'UNKNOWN_ERROR';
    let errorMessage = error.message;
    
    if (error.code === 404 || error.response?.status === 404) {
      errorCode = 'FOLDER_NOT_FOUND';
      errorMessage = `Folder không tồn tại (404): ${folderId}`;
    } else if (error.code === 403 || error.response?.status === 403) {
      errorCode = 'PERMISSION_DENIED';
      errorMessage = `Không có quyền truy cập folder (403): ${folderId}`;
    } else if (error.code === 401 || error.response?.status === 401) {
      errorCode = 'UNAUTHORIZED';
      errorMessage = `Không được xác thực để truy cập folder (401): ${folderId}`;
    }
    
    return {
      success: false,
      error: errorMessage,
      errorCode: errorCode
    };
  }
} 