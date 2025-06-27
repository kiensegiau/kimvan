import fs from 'fs';
import path from 'path';
import os from 'os';
import { google } from 'googleapis';
import { 
  createOAuth2Client 
} from '@/utils/drive-utils';
import { processPDF } from '@/app/api/drive/remove-watermark/lib/drive-fix-blockdown.js';
import { addLogoToPDF } from './pdf-service';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeFileName } from '@/utils/file-utils';
import { getAccessToken } from '@/utils/auth-utils';

/**
 * Tải xuống file từ Google Drive
 * @param {string} fileId - ID của file trên Google Drive
 * @returns {Promise<Object>} - Kết quả tải xuống
 */
export async function downloadFromGoogleDrive(fileId) {
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
        // Đợi thời gian tăng dần trước khi thử lại (exponential backoff)
        const delayTime = Math.min(Math.pow(2, retryCount) * 2000, 30000); // tối đa 30 giây
        console.log(`Đợi ${delayTime/1000} giây trước khi thử lại...`);
        await new Promise(resolve => setTimeout(resolve, delayTime));
      }
      
      // Lấy thông tin file trước khi tải xuống
      console.log('Lấy thông tin file từ Google Drive API...');
      const fileInfoResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size,fileExtension`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`
          },
          // Tăng timeout cho request
          signal: AbortSignal.timeout(60000) // 60 giây
        }
      );
      
      if (!fileInfoResponse.ok) {
        const errorText = await fileInfoResponse.text();
        throw new Error(`Lỗi khi lấy thông tin file (HTTP ${fileInfoResponse.status}): ${errorText}`);
      }
      
      const fileInfo = await fileInfoResponse.json();
      console.log(`Thông tin file: ${JSON.stringify(fileInfo)}`);
      
      // Xác định tên file và đường dẫn
      let fileName = fileInfo.name;
      let fileExtension = fileInfo.fileExtension || '';
      
      // Xử lý trường hợp file Google Docs, Sheets, Slides
      if (fileInfo.mimeType.includes('google-apps')) {
        if (fileInfo.mimeType.includes('document')) {
          fileName = `${fileName}.docx`;
          fileExtension = 'docx';
        } else if (fileInfo.mimeType.includes('spreadsheet')) {
          fileName = `${fileName}.xlsx`;
          fileExtension = 'xlsx';
        } else if (fileInfo.mimeType.includes('presentation')) {
          fileName = `${fileName}.pptx`;
          fileExtension = 'pptx';
        }
      }
      
      // Đảm bảo tên file an toàn cho hệ thống file
      fileName = sanitizeFileName(fileName);
      
      const filePath = path.join(outputDir, fileName);
      console.log(`Đường dẫn file đích: ${filePath}`);
      
      // Tạo writeStream để lưu file
      const dest = fs.createWriteStream(filePath);
      
      // Tải xuống file với stream
      console.log('Bắt đầu tải xuống nội dung file...');
      
      // Tạo controller để có thể abort request nếu cần
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // Timeout 120 giây
      
      let response;
      try {
        // Sử dụng export API cho các file Google Docs, Sheets, Slides
        if (fileInfo.mimeType.includes('google-apps')) {
          let exportMimeType;
          
          if (fileInfo.mimeType.includes('document')) {
            exportMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          } else if (fileInfo.mimeType.includes('spreadsheet')) {
            exportMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          } else if (fileInfo.mimeType.includes('presentation')) {
            exportMimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
          } else {
            exportMimeType = 'application/pdf';
          }
          
          console.log(`Sử dụng export API với MIME type: ${exportMimeType}`);
          response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMimeType)}`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${await getAccessToken()}`
              },
              signal: controller.signal
            }
          );
        } else {
          // Tải xuống trực tiếp cho các file thông thường
          console.log('Sử dụng API tải xuống trực tiếp');
          response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${await getAccessToken()}`
              },
              signal: controller.signal
            }
          );
        }
        
        // Xóa timeout sau khi request hoàn thành
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Lỗi khi tải file (HTTP ${response.status}): ${errorText}`);
        }
        
        // Kiểm tra nếu response body là null hoặc undefined
        if (!response.body) {
          throw new Error('Response body trống');
        }
        
        // Stream response vào file
        const reader = response.body.getReader();
        let bytesRead = 0;
        
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('Hoàn tất tải xuống');
            break;
          }
          
          bytesRead += value.length;
         
          dest.write(Buffer.from(value));
        }
        
        // Đóng file
        await new Promise((resolve, reject) => {
          dest.end();
          dest.on('finish', resolve);
          dest.on('error', reject);
        });
        
        console.log(`File đã được tải xuống thành công: ${filePath}`);
        
        // Trả về thông tin file đã tải xuống
        return {
          success: true,
          filePath,
          fileName,
          outputDir,
          mimeType: fileInfo.mimeType,
          originalName: fileInfo.name,
          fileSize: fileInfo.size
        };
      } catch (abortError) {
        // Xóa timeout nếu có lỗi
        clearTimeout(timeoutId);
        
        // Đóng writeStream nếu đang mở
        dest.end();
        
        // Kiểm tra nếu là lỗi abort (timeout)
        if (abortError.name === 'AbortError') {
          console.error(`Request timeout sau 120 giây cho file ID: ${fileId}`);
          throw new Error('Request timeout sau 120 giây');
        }
        
        // Ném lại lỗi khác
        throw abortError;
      }
    } catch (error) {
      lastError = error;
      console.error(`Lỗi khi tải xuống file (lần thử ${retryCount + 1}/${MAX_RETRIES + 1}):`, error.message);
      
      // Nếu đã thử lại đủ số lần, ném lỗi
      if (retryCount === MAX_RETRIES) {
        console.error(`Đã thử lại ${MAX_RETRIES} lần không thành công, từ bỏ.`);
        
        // Xóa thư mục tạm nếu có lỗi
        try {
          fs.rmdirSync(outputDir, { recursive: true });
          console.log(`Đã xóa thư mục tạm do lỗi: ${outputDir}`);
        } catch (cleanupError) {
          console.error('Lỗi khi dọn dẹp thư mục tạm:', cleanupError);
        }
        
        throw new Error(`Không thể tải xuống file sau ${MAX_RETRIES + 1} lần thử: ${error.message}`);
      }
    }
  }
}

/**
 * Kiểm tra thông tin file trên Google Drive
 * @param {string} fileId - ID của file trên Google Drive
 * @returns {Promise<Object>} - Thông tin file
 */
export async function checkFileInfo(fileId) {
  console.log(`Kiểm tra thông tin file với ID: ${fileId}`);
  
  try {
    // Tạo OAuth2 client với khả năng tự động refresh token
    const oauth2Client = createOAuth2Client(1); // Sử dụng token tải xuống (index 1)
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Lấy thông tin file
    const fileInfo = await drive.files.get({
      fileId: fileId,
      fields: 'id,name,mimeType,size,capabilities,parents'
    });
    
    console.log(`Thông tin file: ${fileInfo.data.name} (${fileInfo.data.mimeType})`);
    
    return {
      success: true,
      fileInfo: fileInfo.data
    };
  } catch (error) {
    console.error(`Lỗi khi kiểm tra thông tin file: ${error.message}`);
    
    // Kiểm tra lỗi 404 - File không tồn tại
    if (error.code === 404 || error.response?.status === 404) {
      return {
        success: false,
        error: 'FILE_NOT_FOUND',
        message: `Không tìm thấy file với ID: ${fileId}. File có thể đã bị xóa hoặc không tồn tại.`
      };
    }
    
    // Kiểm tra lỗi 403 - Không có quyền truy cập
    if (error.code === 403 || error.response?.status === 403) {
      return {
        success: false,
        error: 'PERMISSION_DENIED',
        message: `Không có quyền truy cập file với ID: ${fileId}.`
      };
    }
    
    return {
      success: false,
      error: 'UNKNOWN_ERROR',
      message: error.message
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