import fs from 'fs';
import path from 'path';
import os from 'os';
import { google } from 'googleapis';
import { 
  createOAuth2Client 
} from '@/utils/drive-utils';
import { processPDF } from '@/app/api/drive/remove-watermark/lib/drive-fix-blockdown.js';
import { addLogoToPDF } from './pdf-service';

/**
 * Tải xuống file từ Google Drive
 * @param {string} fileId - ID của file trên Google Drive
 * @returns {Promise<Object>} - Kết quả tải xuống
 */
export async function downloadFromGoogleDrive(fileId) {
  console.log(`Đang tải xuống file từ Google Drive với ID: ${fileId}`);
  
  // Tạo thư mục tạm nếu chưa tồn tại
  const tempDir = path.join(os.tmpdir(), 'drive-download-');
  const outputDir = fs.mkdtempSync(tempDir);
  
  try {
    // Tạo OAuth2 client với khả năng tự động refresh token
    const oauth2Client = createOAuth2Client(1); // Sử dụng token tải xuống (index 1)
    console.log('Sử dụng token tải xuống (drive_token_download.json)');
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    console.log('Kiểm tra quyền truy cập Drive...');
    
    // Lấy thông tin file
    let fileInfo;
    try {
      fileInfo = await drive.files.get({
        fileId: fileId,
        fields: 'name,mimeType,size,capabilities'
      });
      
      // Kiểm tra quyền truy cập
      if (fileInfo.data.capabilities && !fileInfo.data.capabilities.canDownload) {
        console.log('Phát hiện file không có quyền tải xuống, sẽ sử dụng phương pháp drive-fix-blockdown');
        // Sử dụng phương pháp đặc biệt cho file bị chặn
        const tempDir = path.join(os.tmpdir(), 'blocked-pdf-');
        const blockedTempDir = fs.mkdtempSync(tempDir);
        // Thêm tham số keepChromeOpen=true để giữ Chrome mở khi debug
        const result = await processPDF(null, null, {
          keepChromeOpen: true, // Giữ Chrome mở để debug
          debugMode: true // Bật chế độ debug
        }, true, fileId);
        
        if (!result.success) {
          throw new Error(`Không thể xử lý file bị chặn: ${result.error}`);
        }
        
        // Kiểm tra nếu không phát hiện trang nào
        if (result.pageCount === 0 || !result.filePath || result.emptyFile) {
          throw new Error(`Không phát hiện trang nào trong file PDF. Chrome đã được giữ mở để debug. File ID: ${fileId}`);
        }
        
        // Lấy tên file gốc
        let originalFileName;
        try {
          originalFileName = fileInfo.data.name;
          console.log(`Tên file gốc từ Drive: ${originalFileName}`);
        } catch (nameError) {
          console.warn(`Không thể lấy tên file gốc: ${nameError.message}`);
          originalFileName = result.fileName || `file_${fileId}.pdf`;
        }
        
        // Thêm logo vào file PDF đã tải xuống
        try {
          console.log('Thêm logo vào file PDF đã tải xuống bằng Chrome (không cắt)...');
          await addLogoToPDF(result.filePath, result.filePath);
          console.log('Đã thêm logo thành công vào file PDF đã tải xuống bằng Chrome');
        } catch (logoError) {
          console.error(`Không thể thêm logo vào file PDF: ${logoError.message}`);
        }
        
        return {
          success: true,
          filePath: result.filePath,
          fileName: originalFileName, // Sử dụng tên file gốc
          mimeType: 'application/pdf',
          outputDir: blockedTempDir
        };
      }
    } catch (error) {
      // Kiểm tra lỗi 404 - File không tồn tại
      if (error.code === 404 || error.response?.status === 404) {
        console.error(`File không tồn tại (404): ${fileId}. Không thử lại.`);
        throw new Error(`Không tìm thấy file với ID: ${fileId}. File có thể đã bị xóa hoặc không tồn tại.`);
      } 
      // Kiểm tra lỗi 403 - Không có quyền truy cập
      else if (error.code === 403 || error.response?.status === 403) {
        console.log(`Lỗi quyền truy cập (403): ${fileId}. Thử sử dụng Chrome để tải nhưng không xử lý watermark...`);
        
        try {
          // Sử dụng phương pháp đặc biệt cho file bị chặn
          const tempDir = path.join(os.tmpdir(), 'blocked-pdf-');
          const blockedTempDir = fs.mkdtempSync(tempDir);
          
          // Thử xử lý file bằng phương pháp đặc biệt nhưng tắt xử lý watermark
          console.log('Tải file bằng Chrome và BỎ QUA hoàn toàn bước xử lý watermark');
          const result = await processPDF(null, null, {
            keepChromeOpen: true,
            debugMode: true,
            skipWatermarkRemoval: true, // Bỏ qua bước xóa watermark
            skipImageProcessing: true,  // Bỏ qua bước xử lý ảnh
            preserveOriginal: true,     // Giữ nguyên nội dung gốc
            noProcessing: true          // Flag đặc biệt để đảm bảo không xử lý
          }, true, fileId);
          
          if (!result.success) {
            throw new Error(`Không thể tải file bị chặn: ${result.error}`);
          }
          
          // Kiểm tra nếu không phát hiện trang nào
          if (result.pageCount === 0 || !result.filePath || result.emptyFile) {
            throw new Error(`Không phát hiện trang nào trong file PDF. Chrome đã được giữ mở để debug. File ID: ${fileId}`);
          }
          
          // Lấy tên file gốc từ fileInfo nếu có
          let originalFileName;
          try {
            const fileInfoResponse = await drive.files.get({
              fileId: fileId,
              fields: 'name'
            });
            originalFileName = fileInfoResponse.data.name;
            console.log(`Tên file gốc từ Drive: ${originalFileName}`);
          } catch (nameError) {
            console.warn(`Không thể lấy tên file gốc: ${nameError.message}`);
            originalFileName = result.fileName || `file_${fileId}.pdf`;
          }
          
          // Thêm logo vào file PDF đã tải xuống
          try {
            console.log('Thêm logo vào file PDF đã tải xuống bằng Chrome (403 case)...');
            await addLogoToPDF(result.filePath, result.filePath);
            console.log('Đã thêm logo thành công vào file PDF đã tải xuống bằng Chrome (403 case)');
          } catch (logoError) {
            console.error(`Không thể thêm logo vào file PDF (403 case): ${logoError.message}`);
          }
          
          return {
            success: true,
            filePath: result.filePath,
            fileName: originalFileName, // Sử dụng tên file gốc
            mimeType: 'application/pdf',
            outputDir: blockedTempDir
          };
        } catch (blockError) {
          console.error(`Không thể tải file bị chặn: ${blockError.message}`);
          throw new Error(`Không có quyền truy cập file với ID: ${fileId}. Đã thử tải bằng Chrome nhưng không thành công: ${blockError.message}`);
        }
      }
      
      // Các lỗi khác
      throw error;
    }
    
    const fileName = fileInfo.data.name;
    const mimeType = fileInfo.data.mimeType;
    const outputPath = path.join(outputDir, fileName);
    
    console.log(`Tên file: ${fileName}`);
    console.log(`Loại MIME: ${mimeType}`);
    
    // Tải xuống file
    console.log(`Đang tải xuống file ${fileName}...`);
    
    try {
      const response = await drive.files.get(
        {
          fileId: fileId,
          alt: 'media'
        },
        { responseType: 'stream' }
      );
      
      // Lưu file vào đĩa
      const dest = fs.createWriteStream(outputPath);
      
      let error = null;
      response.data
        .on('error', err => {
          error = err;
          console.error('Lỗi khi tải xuống:', err);
        })
        .pipe(dest);
      
      // Đợi cho đến khi tải xuống hoàn tất
      await new Promise((resolve, reject) => {
        dest.on('finish', () => {
          console.log(`File đã được tải xuống thành công vào: ${outputPath}`);
          resolve();
        });
        dest.on('error', err => {
          console.error('Lỗi khi ghi file:', err);
          error = err;
          reject(err);
        });
      });
      
      if (error) {
        throw error;
      }
    } catch (downloadError) {
      if (downloadError.code === 403 || downloadError.response?.status === 403) {
        throw new Error('Không thể tải xuống file. Google Drive từ chối quyền truy cập. File có thể đã bị giới hạn bởi chủ sở hữu.');
      }
      throw downloadError;
    }
    
    return {
      success: true,
      filePath: outputPath,
      fileName: fileName,
      mimeType: mimeType,
      outputDir: outputDir
    };
  } catch (error) {
    console.error('Lỗi khi tải xuống file từ Google Drive:', error);
    
    // Dọn dẹp thư mục tạm nếu có lỗi
    try {
      fs.rmdirSync(outputDir, { recursive: true });
    } catch (cleanupError) {
      console.error('Lỗi khi dọn dẹp thư mục tạm:', cleanupError);
    }
    
    throw error;
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