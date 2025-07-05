import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import { getAccessToken } from '@/utils/auth-utils';
import { downloadWithBrowserCookie } from '../../remove-watermark/lib/drive-fix-blockdown';
import os from 'os';

/**
 * Tải xuống file từ Google Drive
 * @param {string} fileId - ID của file trên Google Drive
 * @param {Object} options - Tùy chọn tải xuống
 * @param {boolean} options.forceCookie - Bắt buộc dùng cookie thay vì API
 * @returns {Promise<Object>} - Kết quả tải xuống
 */
export async function downloadFromGoogleDrive(fileId, options = {}) {
  console.log(`Bắt đầu tải xuống file với ID: ${fileId}`);
  
  // Tạo thư mục tạm để lưu file
  const outputDir = path.join(os.tmpdir(), uuidv4());
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`Đã tạo thư mục tạm: ${outputDir}`);

  // Thêm cơ chế retry
  const MAX_RETRIES = 3;
  let lastError = null;
  
  for (let retryCount = 0; retryCount <= MAX_RETRIES; retryCount++) {
    try {
      if (retryCount > 0) {
        console.log(`Thử lại lần ${retryCount}/${MAX_RETRIES} cho file ID: ${fileId}`);
        const delayTime = Math.min(Math.pow(2, retryCount) * 2000, 30000);
        console.log(`Đợi ${delayTime/1000} giây trước khi thử lại...`);
        await new Promise(resolve => setTimeout(resolve, delayTime));
      }

      let response;
      
      // Ưu tiên sử dụng Google Drive API nếu không bị bắt buộc dùng cookie
      if (!options.forceCookie) {
        try {
          console.log('🔄 Đang thử tải file thông qua Google Drive API...');
          
          // Lấy access token từ auth-utils
          const accessToken = await getAccessToken();
          console.log('Đã lấy access token từ auth-utils');

          // Tạo URL download với token
          const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
          console.log('URL tải xuống:', downloadUrl);

          // Tải file với token
          response = await fetch(downloadUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': '*/*'
            }
          });

          // Nếu lỗi 404, chuyển sang dùng cookie
          if (response.status === 404) {
            console.log('API báo 404, chuyển sang dùng cookie...');
            return await downloadFromGoogleDrive(fileId, { forceCookie: true });
          }

          // Nếu lỗi khác 404, throw error
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Lỗi khi tải file (HTTP ${response.status}): ${errorText}`);
          }
          
          console.log('✅ Tải file qua Google Drive API thành công');
        } catch (apiError) {
          console.error(`❌ Lỗi khi tải qua API: ${apiError.message}`);
          console.log('Chuyển sang dùng cookie...');
          return await downloadFromGoogleDrive(fileId, { forceCookie: true });
        }
      } else {
        // Dùng cookie để tải
        console.log('Đang tải file bằng cookie...');
        return await downloadWithBrowserCookie(fileId, outputDir);
      }

      // Xác định đuôi file
      const mimeType = response.headers.get('content-type');
      let extension = '';
      
      if (mimeType) {
        switch (mimeType.toLowerCase()) {
          case 'application/pdf':
            extension = '.pdf';
            break;
          case 'image/jpeg':
            extension = '.jpg';
            break;
          case 'image/png':
            extension = '.png';
            break;
          case 'image/gif':
            extension = '.gif';
            break;
          case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            extension = '.docx';
            break;
          case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
            extension = '.xlsx';
            break;
          case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
            extension = '.pptx';
            break;
          default:
            console.log('⚠️ MIME type không xác định:', mimeType);
            break;
        }
      }

      // Tạo tên file với prefix mặc định nếu không có tên
      const defaultPrefix = 'Tài liệu';
      const timestamp = new Date().getTime();
      const outputFile = `${defaultPrefix}_${timestamp}${extension}`;
      const outputPath = path.join(outputDir, outputFile);

      // Log thông tin file
      console.log('📝 Tên file:', outputFile);
      console.log('📂 Đường dẫn:', outputPath);

      const dest = fs.createWriteStream(outputPath);
      const reader = response.body.getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('Hoàn tất tải xuống');
          break;
        }
        
        dest.write(Buffer.from(value));
      }
      
      await new Promise((resolve, reject) => {
        dest.end();
        dest.on('finish', resolve);
        dest.on('error', reject);
      });

      const result = {
        success: true,
        filePath: outputPath,
        outputDir,
        mimeType: mimeType,
        fileName: outputFile
      };

      // Log chi tiết về file
      console.log('✅ Tải file thành công:', result.filePath);
      console.log('📄 MIME type:', result.mimeType);
      console.log('📦 Kích thước:', Math.round(fs.statSync(result.filePath).size / 1024 / 1024 * 100) / 100, 'MB');
      console.log('⏰ Thời gian:', new Date().toLocaleString());
      console.log('🆔 File ID:', fileId);

      return result;

    } catch (error) {
      console.error(`Lỗi khi tải xuống file (lần thử ${retryCount + 1}/${MAX_RETRIES + 1}):`, error);
      lastError = error;
      
      if (retryCount === MAX_RETRIES) {
        throw new Error(`Không thể tải xuống file sau ${MAX_RETRIES + 1} lần thử: ${error.message}`);
      }
      
      try {
        if (fs.existsSync(outputDir)) {
          fs.rmSync(outputDir, { recursive: true });
          console.log(`Đã xóa thư mục tạm ${outputDir} do lỗi`);
        }
      } catch (cleanupError) {
        console.error('Lỗi khi dọn dẹp thư mục tạm:', cleanupError);
      }
    }
  }
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