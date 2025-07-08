import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { downloadFromGoogleDrive } from './lib/download-service.js';
import { processFile } from './lib/file-processor.js';
import { uploadToGoogleDrive } from './lib/upload-service.js';
import { updateSheetCell, updateGoogleSheetCell } from './lib/sheet-service.js';
import { processPDF } from '../remove-watermark/lib/drive-fix-blockdown.js';
import { extractDriveFileId } from '@/utils/drive-utils';
import { google } from 'googleapis';

/**
 * Kiểm tra MIME type của file từ Google Drive API
 * @param {string} fileId - ID của file cần kiểm tra
 * @returns {Promise<Object>} - Thông tin MIME type
 */
async function checkMimeType(fileId) {
  try {
    console.log(`🔍 Kiểm tra MIME type cho file: ${fileId}`);
    
    // Gọi API check-file-type
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/drive/check-file-type`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileId })
    });

    if (!response.ok) {
      throw new Error(`Lỗi API check-file-type: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Kết quả kiểm tra MIME type:`, data);

    return {
      success: true,
      mimeType: data.mimeType,
      isFolder: data.isFolder,
      isPdf: data.isPdf,
      isGoogleDoc: data.isGoogleDoc
    };
  } catch (error) {
    console.error(`❌ Lỗi khi kiểm tra MIME type:`, error);
    return {
      success: false,
      error: error.message,
      statusCode: error.message.includes('404') ? 404 : 
                 error.message.includes('403') ? 403 : 
                 error.message.includes('500') ? 500 : 0
    };
  }
}

/**
 * Kiểm tra thông tin file từ Google Drive API
 * @param {string} fileId - ID của file cần kiểm tra
 * @returns {Promise<Object>} - Thông tin file
 */
async function checkFileInfo(fileId) {
  try {
    console.log(`Kiểm tra thông tin file: ${fileId}`);
    
    // Import hàm getTokenByType từ utils
    const { getTokenByType } = await import('../remove-watermark/lib/utils.js');
    
    // Lấy token tải xuống
    const downloadToken = getTokenByType('download');
    if (!downloadToken) {
      console.error('Không tìm thấy token Google Drive tải xuống');
      throw new Error('Không tìm thấy token Google Drive tải xuống');
    }
    
    // Tạo OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    // Thiết lập credentials
    oauth2Client.setCredentials(downloadToken);
    
    // Khởi tạo Google Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Lấy thông tin file
    const fileMetadata = await drive.files.get({
      fileId: fileId,
      fields: 'id,name,mimeType,size,owners,fileExtension',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    
    return {
      success: true,
      fileInfo: fileMetadata.data
    };
  } catch (error) {
    console.error(`Lỗi khi kiểm tra thông tin file: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Hàm xử lý và upload file đã tải xuống bằng Chrome
 * Sử dụng cho cả trường hợp 404 và 403
 */
async function processAndUploadFile(
  filePath,
  mimeType,
  fileId,
  driveLink,
  targetFolderId,
  folderName,
  apiKey,
  updateSheet,
  courseId,
  sheetIndex,
  rowIndex,
  cellIndex,
  sheetId,
  googleSheetName,
  displayText,
  request,
  startTime,
  tempDir,
  sourceType // "404_chrome" hoặc "403_chrome"
) {
  try {
    console.log(`🔧 Xử lý watermark cho file PDF đã tải bằng Chrome (${sourceType})...`);
    
    // Xử lý file để loại bỏ watermark
    const processResult = await processFile(filePath, mimeType || "application/pdf", apiKey);

    // Kiểm tra nếu file quá lớn
    if (processResult && !processResult.success && processResult.skipReason === 'FILE_TOO_LARGE') {
      console.log(`⚠️ File quá lớn (${processResult.fileSizeMB.toFixed(2)} MB), bỏ qua xử lý tự động`);
      return {
        success: false,
        skipped: true,
        reason: 'FILE_TOO_LARGE',
        message: processResult.error,
        originalFile: {
          id: fileId,
          link: driveLink,
          size: processResult.fileSizeMB
        },
        processingTime: Math.round((Date.now() - startTime) / 1000)
      };
    }
    
    // Kiểm tra nếu file là video
    if (processResult && !processResult.success && processResult.isVideo) {
      console.log(`🎥 Phát hiện file video, bỏ qua xử lý watermark...`);
      return {
        success: true,
        isVideo: true,
        originalFile: {
          id: fileId,
          link: driveLink
        },
        message: 'File video không cần xử lý watermark',
        processingTime: Math.round((Date.now() - startTime) / 1000)
      };
    }
    
    // Lấy đường dẫn đến file đã xử lý
    let processedFilePath = processResult.processedPath;
    
    // Kiểm tra xem processedPath có phải là đối tượng không
    if (typeof processedFilePath === 'object' && processedFilePath !== null) {
      console.log('Phát hiện processedPath là đối tượng, không phải chuỗi. Đang chuyển đổi...');
      
      // Nếu đối tượng có thuộc tính path, sử dụng nó
      if (processedFilePath.path) {
        processedFilePath = processedFilePath.path;
      } else {
        // Nếu không, tạo đường dẫn mới dựa trên filePath gốc
        const fileDir = path.dirname(filePath);
        const fileExt = path.extname(filePath);
        const fileName = path.basename(filePath, fileExt);
        processedFilePath = path.join(fileDir, `${fileName}_processed${fileExt}`);
        
        console.log(`Đã tạo đường dẫn mới: ${processedFilePath}`);
        
        // Kiểm tra xem file có tồn tại không
        if (!fs.existsSync(processedFilePath)) {
          console.error(`Lỗi: File không tồn tại tại đường dẫn ${processedFilePath}`);
          throw new Error(`File đã xử lý không tồn tại tại đường dẫn ${processedFilePath}`);
        }
      }
    }
    
    const processedFileName = path.basename(processedFilePath);
    
    console.log(`✅ Đã xử lý watermark cho file (${sourceType}): ${processedFilePath}`);
    
    // Upload file đã xử lý
    const uploadResult = await uploadToGoogleDrive(
      processedFilePath,
      path.basename(processedFilePath),
      mimeType || "application/pdf",
      targetFolderId,
      folderName
    );
    
    // Nếu có yêu cầu cập nhật sheet, thực hiện cập nhật
    let sheetUpdateResult = null;
    if (updateSheet) {
      console.log('Yêu cầu cập nhật sheet được kích hoạt, tiến hành cập nhật...');
      
      // Kiểm tra xem cần cập nhật vào database hay trực tiếp vào Google Sheet
      if (courseId && sheetIndex !== undefined && rowIndex !== undefined && cellIndex !== undefined) {
        // Cập nhật vào database
        sheetUpdateResult = await updateSheetCell(
          courseId,
          sheetIndex,
          rowIndex,
          cellIndex,
          driveLink, // URL gốc
          uploadResult.webViewLink || processResult.webViewLink, // Ưu tiên link từ upload, nếu không có thì dùng link từ xử lý Chrome
          displayText, // Text hiển thị
          request // Pass the request object
        );
        
        console.log('Kết quả cập nhật sheet trong database:', sheetUpdateResult);
      } else if (sheetId && googleSheetName && rowIndex !== undefined && cellIndex !== undefined) {
        // Cập nhật trực tiếp vào Google Sheet
        const cellDisplayText = displayText || 'Tài liệu đã xử lý';
        sheetUpdateResult = await updateGoogleSheetCell(
          sheetId,
          googleSheetName,
          rowIndex,
          cellIndex,
          cellDisplayText,
          uploadResult.webViewLink || processResult.webViewLink, // Ưu tiên link từ upload, nếu không có thì dùng link từ xử lý Chrome
          driveLink, // URL gốc
          request // Pass the request object
        );
        
        console.log('Kết quả cập nhật trực tiếp vào Google Sheet:', sheetUpdateResult);
      } else {
        console.warn('Thiếu thông tin cần thiết để cập nhật sheet, bỏ qua bước này');
        sheetUpdateResult = {
          success: false,
          error: 'Thiếu thông tin cần thiết để cập nhật sheet'
        };
      }
    }
    
    // Dọn dẹp thư mục tạm
    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log(`Đã xóa thư mục tạm: ${tempDir}`);
      } catch (cleanupError) {
        console.error('Lỗi khi dọn dẹp thư mục tạm:', cleanupError);
      }
    }
    
    // Tạo kết quả phù hợp với loại xử lý
    const result = {
      success: true,
      isFolder: false,
      originalFile: {
        id: fileId,
        link: driveLink
      },
      targetFolder: {
        id: targetFolderId,
        name: folderName
      },
      processedFile: {
        id: uploadResult.fileId,
        name: uploadResult.fileName,
        link: uploadResult.webViewLink || processResult.webViewLink // Ưu tiên link từ upload, nếu không có thì dùng link từ xử lý Chrome
      },
      processingTime: Math.round((Date.now() - startTime) / 1000),
      sheetUpdate: updateSheet ? {
        success: sheetUpdateResult?.success || false,
        message: sheetUpdateResult?.message || sheetUpdateResult?.error || 'Không có thông tin cập nhật',
        details: sheetUpdateResult?.updatedCell || null
      } : null
    };
    
    // Thêm các trường phù hợp với loại xử lý
    if (sourceType === "404_chrome") {
      result.retrievedViaChrome = true;
      result.watermarkProcessed = true;
    } else if (sourceType === "403_chrome") {
      result.blockdownProcessed = true;
      result.watermarkProcessed = true;
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Lỗi trong quá trình xử lý và upload file (${sourceType}): ${error.message}`);
    
    // Dọn dẹp thư mục tạm nếu có lỗi
    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log(`Đã xóa thư mục tạm: ${tempDir}`);
      } catch (cleanupError) {
        console.error('Lỗi khi dọn dẹp thư mục tạm:', cleanupError);
      }
    }
    
    throw error; // Ném lỗi để xử lý ở cấp cao hơn
  }
}

/**
 * Xử lý tuần tự file bằng Chrome
 */
async function processFileWithChrome(
  fileId,
  fileName,
  tempDir,
  driveLink,
  targetFolderId,
  targetFolderName,
  courseName,
  apiKey,
  updateSheet,
  courseId,
  sheetIndex,
  rowIndex,
  cellIndex,
  sheetId,
  googleSheetName,
  displayText,
  request,
  startTime,
  errorType // "404" hoặc "403"
) {
  console.log(`\n=== BẮT ĐẦU XỬ LÝ FILE BẰNG CHROME (${errorType}) ===`);
  console.log(`🔍 File ID: ${fileId}`);
  console.log(`📄 Tên file: ${fileName}`);
  console.log(`📂 Thư mục tạm: ${tempDir}`);
  
  try {
    // Thêm import nếu chưa có
    const { downloadBlockedPDF } = await import('../remove-watermark/lib/drive-fix-blockdown.js');
    
    // Tạo tên file tạm
    const tempFileName = `TÀI LIỆU${fileId}.pdf`;
    
    console.log(`\n🌐 Đang mở Chrome để tải file...`);
    console.log(`⏳ Vui lòng đợi trong khi Chrome xử lý...`);
    
    // Gọi hàm downloadBlockedPDF để tải file
    const chromeDownloadResult = await downloadBlockedPDF(
      fileId, 
      tempFileName, 
      tempDir, 
      { debugMode: true }  // BẬT chế độ debug để hiển thị Chrome
    );
    
    if (chromeDownloadResult.success) {
      console.log(`\n✅ Tải file thành công qua Chrome:`);
      console.log(`📄 File path: ${chromeDownloadResult.filePath}`);
      
      // Xử lý file đã tải
      console.log(`\n🔄 Đang xử lý file đã tải xuống...`);
      const result = await processAndUploadFile(
        chromeDownloadResult.filePath,
        "application/pdf",
        fileId,
        driveLink,
        targetFolderId,
        targetFolderName || courseName || `Chrome Download (${errorType})`,
        apiKey,
        updateSheet,
        courseId,
        sheetIndex,
        rowIndex,
        cellIndex,
        sheetId,
        googleSheetName,
        displayText,
        request,
        startTime,
        tempDir,
        `${errorType}_chrome`
      );
      
      console.log(`\n✅ Hoàn tất xử lý file bằng Chrome`);
      return result;
    } else {
      console.error(`\n❌ Không thể tải file bằng Chrome:`);
      console.error(`💬 Lỗi: ${chromeDownloadResult.error}`);
      throw new Error(chromeDownloadResult.error);
    }
  } catch (error) {
    console.error(`\n❌ Lỗi khi xử lý file bằng Chrome (${errorType}):`);
    console.error(`💬 ${error.message}`);
    throw error;
  }
}

let isProcessing = false;
const processingQueue = [];

/**
 * Xử lý hàng đợi các file cần dùng Chrome
 */
async function processNextInQueue() {
  if (isProcessing || processingQueue.length === 0) return;
  
  isProcessing = true;
  const task = processingQueue.shift();
  
  try {
    console.log(`\n=== ĐANG XỬ LÝ FILE TRONG HÀNG ĐỢI ===`);
    console.log(`⏳ Còn ${processingQueue.length} file đang chờ...`);
    
    // Sử dụng drive-fix-blockdown để xử lý
    const chromeResult = await processPDF(null, null, {
      skipWatermarkRemoval: true,
      debugMode: true
    }, true, task.fileId);

    // Kiểm tra nếu là file video
    if (!chromeResult.success && chromeResult.isVideo) {
      console.log(`🎥 Phát hiện file video, chuyển sang xử lý video...`);
      
      try {
        // Sử dụng VideoProcessor
        const VideoProcessor = require('./lib/video-processor');
        
        // Khởi tạo VideoProcessor
        const videoProcessor = new VideoProcessor(task.tempDir || 'temp');
        
        console.log(`🎥 Bắt đầu xử lý video với ID: ${task.fileId}`);
        
        // Đảm bảo có targetFolderId
        const targetFolderId = task.targetFolderId || '1Lt10aHyWp9VtPaImzInE0DmIcbrjJgpN'; // Folder mặc định nếu không có
        console.log(`📂 Target folder ID: ${targetFolderId}`);
        
        // Xử lý video
        const videoResult = await videoProcessor.handlePDFToVideo(
          task.fileId,
          task.fileName || `video_${task.fileId}.mp4`,
          targetFolderId
        );

        console.log(`🎥 Kết quả xử lý video:`, JSON.stringify(videoResult, null, 2));

        if (!videoResult.success) {
          throw new Error(`Lỗi xử lý video: ${videoResult.error}`);
        }

        // Đảm bảo đóng browser sau khi hoàn thành
        await videoProcessor.close();

        // Trả về kết quả thành công
        const resultObject = {
          success: true,
          isVideo: true,
          originalFile: {
            id: task.fileId,
            link: task.driveLink || `https://drive.google.com/file/d/${task.fileId}/view`
          },
          message: 'Đã xử lý file video thành công',
          processingTime: Math.round((Date.now() - task.startTime) / 1000)
        };

        // Thêm thông tin về file đã xử lý
        if (videoResult.uploadResult) {
          resultObject.processedFile = {
            id: videoResult.uploadResult.fileId,
            name: videoResult.uploadResult.fileName,
            link: videoResult.uploadResult.webViewLink
          };
          console.log(`✅ Video đã được upload thành công: ${videoResult.uploadResult.webViewLink}`);
          
          // Cập nhật cell trong sheet nếu cần
          if (task.updateSheet && task.courseId && task.sheetIndex !== undefined && 
              task.rowIndex !== undefined && task.cellIndex !== undefined) {
            try {
              // Xử lý URL gốc để đảm bảo nó là URL hợp lệ
              let originalUrl = task.driveLink || `https://drive.google.com/file/d/${task.fileId}/view`;
              
              // Xử lý URL redirect từ Google Sheets
              if (originalUrl.startsWith('https://www.google.com/url?q=')) {
                try {
                  const urlObj = new URL(originalUrl);
                  const redirectUrl = urlObj.searchParams.get('q');
                  if (redirectUrl) {
                    // Decode URL (Google thường encode URL hai lần)
                    let decodedUrl = redirectUrl;
                    try {
                      decodedUrl = decodeURIComponent(redirectUrl);
                      // Decode một lần nữa nếu URL vẫn chứa các ký tự được mã hóa
                      if (decodedUrl.includes('%')) {
                        try {
                          decodedUrl = decodeURIComponent(decodedUrl);
                        } catch (e) {
                          console.log('Không thể decode URL thêm lần nữa:', e.message);
                        }
                      }
                    } catch (e) {
                      console.error('Error decoding URL:', e);
                    }
                    originalUrl = decodedUrl;
                  }
                } catch (urlError) {
                  console.error(`❌ Lỗi xử lý URL redirect: ${urlError.message}`);
                }
              }
              
              console.log(`📝 Cập nhật sheet với URL gốc: ${originalUrl}`);
              console.log(`📝 URL mới: ${videoResult.uploadResult.webViewLink}`);
              
              const sheetUpdateResult = await updateSheetCell(
                task.courseId,
                task.sheetIndex,
                task.rowIndex,
                task.cellIndex,
                originalUrl, // URL gốc đã được xử lý
                videoResult.uploadResult.webViewLink, // URL mới
                task.displayText || videoResult.uploadResult.fileName, // Text hiển thị
                task.request // Pass the request object
              );
              
              resultObject.sheetUpdate = {
                success: sheetUpdateResult?.success || false,
                message: sheetUpdateResult?.message || sheetUpdateResult?.error || 'Đã cập nhật sheet',
                details: sheetUpdateResult?.updatedCell || null
              };
              
              console.log(`📝 Đã cập nhật sheet: ${JSON.stringify(resultObject.sheetUpdate)}`);
            } catch (sheetError) {
              console.error(`❌ Lỗi cập nhật sheet: ${sheetError.message}`);
              resultObject.sheetUpdate = {
                success: false,
                message: `Lỗi cập nhật sheet: ${sheetError.message}`
              };
            }
          }
        } else {
          resultObject.processedFile = {
            id: videoResult.fileId,
            name: videoResult.fileName,
            path: videoResult.filePath
          };
          console.log(`⚠️ Video chỉ được tải xuống, chưa được upload: ${videoResult.filePath}`);
        }

        task.resolve(resultObject);
        return;
      } catch (videoError) {
        console.error(`❌ Lỗi khi xử lý video: ${videoError.message}`);
        throw videoError;
      }
    }

    if (chromeResult.success) {
      console.log(`✅ Đã tải thành công file bằng Chrome: ${chromeResult.filePath}`);
      const result = await processAndUploadFile(
        chromeResult.filePath,
        'application/pdf',
        task.fileId,
        task.driveLink,
        task.targetFolderId,
        task.targetFolderName || task.courseName || 'Unknown',
        task.apiKey,
        task.updateSheet,
        task.courseId,
        task.sheetIndex,
        task.rowIndex,
        task.cellIndex,
        task.sheetId,
        task.googleSheetName,
        task.displayText,
        task.request,
        task.startTime,
        task.tempDir,
        task.errorType === "403" ? "403_chrome" : "404_chrome"
      );
      task.resolve(result);
    } else {
      throw new Error(`Không thể tải file bằng Chrome: ${chromeResult.error}`);
    }
  } catch (error) {
    console.error(`❌ Lỗi khi xử lý file trong hàng đợi: ${error.message}`);
    task.reject(error);
  } finally {
    isProcessing = false;
    processNextInQueue();
  }
}

/**
 * Thêm file vào hàng đợi xử lý
 */
function addToProcessingQueue(params) {
  return new Promise((resolve, reject) => {
    const task = {
      ...params,
      startTime: Date.now(),
      resolve,
      reject
    };
    
    console.log(`\n📋 Thêm file vào hàng đợi xử lý Chrome:`);
    console.log(`🔍 File ID: ${params.fileId}`);
    console.log(`📄 Tên file: ${params.fileName || 'Không có tên'}`);
    console.log(`📂 Target folder ID: ${params.targetFolderId || 'Mặc định'}`);
    console.log(`⚠️ Loại lỗi: ${params.errorType}`);
    
    if (params.updateSheet) {
      console.log(`📝 Sẽ cập nhật sheet sau khi xử lý`);
    }
    
    processingQueue.push(task);
    processNextInQueue(); // Thử xử lý ngay nếu không có file nào đang xử lý
  });
}

/**
 * Kiểm tra file đã tồn tại trong folder đích chưa
 */
async function checkFileExistsInTarget(fileName, parentId, drive) {
  try {
    console.log(`🔍 Kiểm tra file ${fileName} trong thư mục ${parentId}...`);
    const response = await drive.files.list({
      q: `'${parentId}' in parents and name = '${fileName}' and trashed = false`,
      fields: 'files(id, name, webViewLink, mimeType)',
      supportsAllDrives: true
    });

    if (response.data.files.length > 0) {
      const existingFile = response.data.files[0];
      console.log(`⚠️ File đã tồn tại: ${existingFile.name} (${existingFile.id})`);
      return {
        exists: true,
        file: existingFile
      };
    }

    console.log(`✅ File không tồn tại trong thư mục đích`);
    return {
      exists: false
    };
  } catch (error) {
    console.error(`❌ Lỗi kiểm tra file:`, error);
    throw error;
  }
}

/**
 * Xử lý một file đơn lẻ với logic ưu tiên tải qua API
 */
async function processSingleFile(file, options) {
  const {
    targetFolderId,
    apiKey,
    updateSheet,
    courseId,
    sheetIndex,
    rowIndex,
    cellIndex,
    sheetId,
    googleSheetName,
    request
  } = options;

  try {
    console.log(`\n🔄 Bắt đầu xử lý file: ${file.name} (${file.id})`);

    // Import hàm getTokenByType từ utils
    const { getTokenByType } = await import('../remove-watermark/lib/utils.js');
    
    // Lấy token tải xuống
    const downloadToken = getTokenByType('download');
    if (!downloadToken) {
      throw new Error('Không tìm thấy token Google Drive tải xuống');
    }
    
    // Tạo OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    // Thiết lập credentials
    oauth2Client.setCredentials(downloadToken);
    
    // Khởi tạo Google Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Kiểm tra file đã tồn tại chưa
    const existingCheck = await checkFileExistsInTarget(file.name, targetFolderId, drive);
    if (existingCheck.exists) {
      console.log(`⚠️ File đã tồn tại trong thư mục đích, bỏ qua xử lý`);
      return {
        success: true,
        skipped: true,
        reason: 'File already exists in target folder',
        originalFile: {
          id: file.id,
          link: `https://drive.google.com/file/d/${file.id}/view`
        },
        existingFile: {
          id: existingCheck.file.id,
          name: existingCheck.file.name,
          link: existingCheck.file.webViewLink
        }
      };
    }

    try {
      // Thử tải file bằng API trước
      const tempDir = path.join(os.tmpdir(), uuidv4());
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFilePath = path.join(tempDir, `${uuidv4()}.${file.name.split('.').pop()}`);
      
      console.log(`📥 Đang tải file qua API: ${file.name}`);
      
      const response = await drive.files.get(
        {
          fileId: file.id,
          alt: 'media'
        },
        { responseType: 'stream' }
      );

      const dest = fs.createWriteStream(tempFilePath);
      response.data.pipe(dest);

      await new Promise((resolve, reject) => {
        dest.on('finish', resolve);
        dest.on('error', reject);
      });

      console.log(`✅ File tải xuống thành công qua API: ${tempFilePath}`);

      // Gọi POST để xử lý file đã tải
      const fileResult = await POST(new Request(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify({
          fileId: file.id,
          targetFolderId,
          apiKey,
          updateSheet,
          courseId,
          sheetIndex,
          rowIndex,
          cellIndex,
          sheetId,
          googleSheetName,
          displayText: file.name
        })
      }));

      // Dọn dẹp thư mục tạm
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error(`⚠️ Lỗi dọn dẹp thư mục tạm: ${cleanupError.message}`);
      }

      return await fileResult.json();

    } catch (apiError) {
      // Nếu lỗi 403, thử dùng Chrome
      if (apiError.message.includes('HTTP 403') || apiError.message.includes('cannotDownloadFile')) {
        console.log(`⚠️ Lỗi 403 khi tải file qua API, chuyển sang Chrome...`);
        
        // Thêm vào hàng đợi xử lý Chrome
        return await addToProcessingQueue({
          fileId: file.id,
          fileName: file.name,
          targetFolderId,
          targetFolderName: path.dirname(file.name),
          errorType: '403',
          updateSheet,
          courseId,
          sheetIndex,
          rowIndex,
          cellIndex,
          sheetId,
          googleSheetName,
          displayText: file.name,
          request
        });
      }
      
      // Nếu không phải lỗi 403, ném lỗi để xử lý ở cấp cao hơn
      throw apiError;
    }
  } catch (error) {
    console.error(`❌ Lỗi xử lý file ${file.name}:`, error);
    throw error;
  }
}

/**
 * Tạo indent cho log dựa vào độ sâu của folder
 */
function getLogIndent(depth = 0) {
  return '  '.repeat(depth);
}

/**
 * Xử lý đệ quy folder và các file bên trong
 * @param {string} folderId - ID của folder cần xử lý
 * @param {Object} options - Các tùy chọn xử lý
 * @returns {Promise<Object>} - Kết quả xử lý folder
 */
async function processFolder(folderId, options, parentFolderInfo = null, depth = 0) {
  const {
    targetFolderId,
    apiKey,
    updateSheet,
    courseId,
    sheetIndex,
    rowIndex,
    cellIndex,
    sheetId,
    googleSheetName,
    displayText,
    request,
    originalFolderLink,
    sheetFolderName
  } = options;

  const indent = getLogIndent(depth);

  try {
    console.log(`\n${indent}📂 Bắt đầu xử lý thư mục: ${folderId}`);

    // Import hàm getTokenByType từ utils
    const { getTokenByType } = await import('../remove-watermark/lib/utils.js');
    
    // Lấy token tải lên để tạo folder
    const uploadToken = getTokenByType('upload');
    if (!uploadToken) {
      throw new Error('Không tìm thấy token Google Drive tải lên');
    }

    // Lấy token tải xuống để đọc file
    const downloadToken = getTokenByType('download');
    if (!downloadToken) {
      throw new Error('Không tìm thấy token Google Drive tải xuống');
    }
    
    // Tạo OAuth2 client cho upload
    const uploadOAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    uploadOAuth2Client.setCredentials(uploadToken);

    // Tạo OAuth2 client cho download
    const downloadOAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    downloadOAuth2Client.setCredentials(downloadToken);
    
    // Khởi tạo Drive API cho upload và download
    const uploadDrive = google.drive({ version: 'v3', auth: uploadOAuth2Client });
    const downloadDrive = google.drive({ version: 'v3', auth: downloadOAuth2Client });

    // Lấy thông tin folder gốc và kiểm tra xem nó có trong Shared Drive không
    const folder = await downloadDrive.files.get({
      fileId: folderId,
      fields: 'name,parents,driveId',
      supportsAllDrives: true
    });

    // Xác định parent folder ID cho folder mới
    const newParentId = parentFolderInfo ? parentFolderInfo.id : targetFolderId;

    // Log thông tin về folder cha
    if (!parentFolderInfo) {
      try {
        const parentFolder = await downloadDrive.files.get({
          fileId: targetFolderId,
          fields: 'name,driveId',
          supportsAllDrives: true
        });
        console.log(`${indent}📁 Thư mục cha: ${parentFolder.data.name} (${targetFolderId})`);
        
        // Kiểm tra quyền truy cập vào folder cha
        try {
          await uploadDrive.permissions.list({
            fileId: targetFolderId,
            supportsAllDrives: true
          });
        } catch (permError) {
          console.error(`${indent}❌ Không có quyền truy cập vào thư mục cha: ${permError.message}`);
          throw new Error('Không có quyền truy cập vào thư mục đích. Vui lòng kiểm tra quyền và thử lại.');
        }
      } catch (error) {
        console.warn(`${indent}⚠️ Không thể lấy thông tin thư mục cha: ${error.message}`);
      }
    }

    // Tạo folder mới trong thư mục đích
    console.log(`${indent}📂 Đang tạo thư mục mới...`);
    
    // Khai báo biến newFolder ở đây
    let newFolder;
    
    // Kiểm tra folder trùng lặp trước khi tạo
    try {
      const existingFolders = await downloadDrive.files.list({
        q: `'${newParentId}' in parents and name = '${folder.data.name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name, webViewLink)',
        supportsAllDrives: true
      });

      if (existingFolders.data.files.length > 0) {
        console.log(`${indent}⚠️ Thư mục tên tương tự đã tồn tại: ${folder.data.name}`);
        const existingFolder = existingFolders.data.files[0];
        console.log(`${indent}📂 Sử dụng thư mục tồn tại: ${existingFolder.name}`);
        console.log(`${indent}📎 ID: ${existingFolder.id}`);
        console.log(`${indent}🔗 Link: ${existingFolder.webViewLink}`);
        newFolder = { data: existingFolder };
      } else {
        // Tạo metadata cho folder
        const folderMetadata = {
          name: folder.data.name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [newParentId]
        };

        // Nếu folder gốc hoặc folder cha nằm trong Shared Drive
        if (folder.data.driveId) {
          console.log(`${indent}📁 Thư mục nằm trong Shared Drive: ${folder.data.driveId}`);
          folderMetadata.driveId = folder.data.driveId;
        }

        newFolder = await uploadDrive.files.create({
          resource: folderMetadata,
          fields: 'id,name,webViewLink',
          supportsAllDrives: true
        });
        
        console.log(`${indent}📂 Thư mục mới đã tạo: ${newFolder.data.name}`);
        console.log(`${indent}📎 ID: ${newFolder.data.id}`);
        console.log(`${indent}🔗 Link: ${newFolder.data.webViewLink}`);
      }
    } catch (createError) {
      console.error(`${indent}❌ Lỗi tạo/kiểm tra thư mục:`, createError.message);
      if (createError.code === 403) {
        throw new Error(`Không có quyền truy cập vào thư mục trong thư mục đích. Vui lòng kiểm tra quyền và thử lại.`);
      }
      throw createError;
    }

    // Log cấu trúc folder
    let folderPath = [];
    if (parentFolderInfo) {
      folderPath = [...parentFolderInfo.path, parentFolderInfo.name];
    }
    folderPath.push(newFolder.data.name);
    console.log(`${indent}📍 Vị trí: ${sheetFolderName || 'Thư mục sheet'} > ${folderPath.join(' > ')}`);

    // Lấy danh sách các file trong folder
    const files = await downloadDrive.files.list({
      q: `'${folderId}' in parents`,
      fields: 'files(id, name, mimeType, driveId)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    console.log(`${indent}📊 Tổng số mục trong thư mục: ${files.data.files.length}`);

    const results = {
      success: true,
      folderId: newFolder.data.id,
      folderName: newFolder.data.name,
      folderLink: newFolder.data.webViewLink,
      originalFolderLink: originalFolderLink || `https://drive.google.com/drive/folders/${folderId}`,
      processedFiles: [],
      skippedFiles: [],
      errors: []
    };

      // Xử lý từng file trong folder
      for (const file of files.data.files) {
        try {
          // Kiểm tra nếu là folder con
          if (file.mimeType === 'application/vnd.google-apps.folder') {
            console.log(`\n${indent}  📂 Đang xử lý thư mục con: ${file.name} (${file.id})`);
            const subFolderResult = await processFolder(
              file.id,
              {
                ...options,
                targetFolderId: newFolder.data.id
              },
              {
                id: newFolder.data.id,
                name: newFolder.data.name,
                path: folderPath,
                link: newFolder.data.webViewLink
              },
              depth + 1
            );
            
            results.processedFiles.push({
              id: file.id,
              name: file.name,
              type: 'folder',
              result: subFolderResult
            });
            continue;
          }

          // Kiểm tra MIME type của file
          console.log(`${indent}  🔍 Kiểm tra file: ${file.name} (${file.id})`);
          const mimeTypeResult = await checkMimeType(file.id);
          
          // Bỏ qua nếu là Google Doc
          if (mimeTypeResult.isGoogleDoc) {
            console.log(`${indent}  ⚠️ Bỏ qua Google Doc: ${file.name}`);
            results.skippedFiles.push({
              id: file.id,
              name: file.name,
              reason: 'Google Doc không được hỗ trợ'
            });
            continue;
          }

          // Xử lý file PDF hoặc video
          if (mimeTypeResult.isPdf || mimeTypeResult.mimeType.includes('video/')) {
            console.log(`${indent}  🔄 Đang xử lý ${mimeTypeResult.isPdf ? 'PDF' : 'video'}: ${file.name}`);
            const fileResult = await processSingleFile(file, {
              ...options,
              targetFolderId: newFolder.data.id
            });
            
            if (fileResult.success) {
              console.log(`${indent}  ✅ Xử lý thành công: ${file.name}`);
              results.processedFiles.push({
                id: file.id,
                name: file.name,
                type: mimeTypeResult.isPdf ? 'pdf' : 'video',
                result: fileResult
              });
            } else {
              console.error(`${indent}  ❌ Lỗi xử lý: ${file.name}`);
              results.errors.push({
                id: file.id,
                name: file.name,
                error: fileResult.error
              });
            }
          } else {
            console.log(`${indent}  ⚠️ Bỏ qua file không được hỗ trợ: ${file.name} (${mimeTypeResult.mimeType})`);
            results.skippedFiles.push({
              id: file.id,
              name: file.name,
              reason: `Không phải file PDF hoặc video (${mimeTypeResult.mimeType})`
            });
          }
        } catch (fileError) {
          console.error(`${indent}  ❌ Lỗi xử lý file ${file.name}:`, fileError);
          results.errors.push({
            id: file.id,
            name: file.name,
            error: fileError.message
          });
        }
      }

      // Tổng kết kết quả xử lý folder
      console.log(`\n${indent}📊 Tổng kết xử lý thư mục:`);
      console.log(`${indent}✅ Đã xử lý: ${results.processedFiles.length} file`);
      console.log(`${indent}⚠️ Đã bỏ qua: ${results.skippedFiles.length} file`);
      console.log(`${indent}❌ Lỗi: ${results.errors.length} file`);

      // Nếu đây là thư mục gốc và cần cập nhật sheet
      if (!parentFolderInfo && updateSheet) {
        try {
          console.log(`\n${indent}📝 Cập nhật liên kết và thư mục...`);
          console.log(`${indent}Thông tin cập nhật:`);
          console.log(`${indent}- Liên kết gốc: ${results.originalFolderLink}`);
          console.log(`${indent}- Liên kết mới: ${results.folderLink}`);
          console.log(`${indent}- Văn bản hiển thị: ${displayText || results.folderName}`);
          
          let sheetUpdateResult;
          if (courseId && sheetIndex !== undefined && rowIndex !== undefined && cellIndex !== undefined) {
            console.log(`${indent}Cập nhật trong cơ sở dữ liệu:`);
            console.log(`${indent}- ID Khóa học: ${courseId}`);
            console.log(`${indent}- Chỉ số Sheet: ${sheetIndex}`);
            console.log(`${indent}- Chỉ số hàng: ${rowIndex}`);
            console.log(`${indent}- Chỉ số ô: ${cellIndex}`);
            
            sheetUpdateResult = await updateSheetCell(
              courseId,
              sheetIndex,
              rowIndex,
              cellIndex,
              results.originalFolderLink,
              results.folderLink,
              displayText || results.folderName,
              request
            );
            
            console.log(`${indent}Kết quả cập nhật cơ sở dữ liệu:`, JSON.stringify(sheetUpdateResult, null, 2));
          } else if (sheetId && googleSheetName && rowIndex !== undefined && cellIndex !== undefined) {
            console.log(`${indent}Cập nhật trực tiếp vào Google Sheet:`);
            console.log(`${indent}- ID Sheet: ${sheetId}`);
            console.log(`${indent}- Tên Sheet: ${googleSheetName}`);
            console.log(`${indent}- Chỉ số hàng: ${rowIndex}`);
            console.log(`${indent}- Chỉ số ô: ${cellIndex}`);
            
            sheetUpdateResult = await updateGoogleSheetCell(
              sheetId,
              googleSheetName,
              rowIndex,
              cellIndex,
              displayText || results.folderName,
              results.folderLink,
              results.originalFolderLink,
              request
            );
            
            console.log(`${indent}Kết quả cập nhật Google Sheet:`, JSON.stringify(sheetUpdateResult, null, 2));
          }
          
          if (!sheetUpdateResult || !sheetUpdateResult.success) {
            console.error(`${indent}❌ Cập nhật sheet thất bại:`, sheetUpdateResult?.error || 'Không có thông tin lỗi');
            results.sheetUpdate = {
              success: false,
              message: `Lỗi cập nhật sheet: ${sheetUpdateResult?.error || 'Không rõ lỗi'}`,
              details: sheetUpdateResult
            };
          } else {
            console.log(`${indent}✅ Sheet đã được cập nhật thành công`);
            if (sheetUpdateResult.updatedCell) {
              console.log(`${indent}Ô đã cập nhật:`, JSON.stringify(sheetUpdateResult.updatedCell, null, 2));
            }
            results.sheetUpdate = {
              success: true,
              message: 'Sheet đã được cập nhật thành công',
              details: sheetUpdateResult
            };
          }
        } catch (sheetError) {
          console.error(`${indent}❌ Lỗi cập nhật sheet:`, sheetError);
          results.sheetUpdate = {
            success: false,
            message: `Lỗi cập nhật sheet: ${sheetError.message}`,
            error: sheetError
          };
        }
      }

      return results;
    } catch (error) {
      console.error(`${indent}❌ Lỗi xử lý thư mục ${folderId}:`, error);
      throw error;
    }
  }

export const maxDuration = 1800; // 30 minutes timeout
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(request) {
  const startTime = Date.now();
  const tempDir = path.join(os.tmpdir(), uuidv4());
  
  // Tạo response stream để gửi updates
  const encoder = new TextEncoder();
  const customStream = new TransformStream();
  const writer = customStream.writable.getWriter();
  
  // Hàm helper để gửi updates
  const sendUpdate = async (message) => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
    } catch (e) {
      console.error('Lỗi khi gửi update:', e);
    }
  };

  try {
    console.log('\n=== BẮT ĐẦU XỬ LÝ REQUEST PROCESS-AND-REPLACE ===');
    
    // Parse request body
    const requestBody = await request.json();
    
    // Log request body để debug
    console.log('📝 Request body:', JSON.stringify({
      ...requestBody,
      apiKey: requestBody.apiKey ? '[HIDDEN]' : undefined
    }, null, 2));
    
    const {
      fileId,
      driveLink,
      targetFolderId,
      folderId,
      folderName,
      courseName,
      sheetName,
      apiKey,
      updateSheet = false,
      courseId,
      sheetIndex,
      rowIndex,
      cellIndex,
      sheetId,
      googleSheetName,
      displayText
    } = requestBody;

    // Sử dụng targetFolderId hoặc folderId
    let finalTargetFolderId = targetFolderId || folderId;

    // Sử dụng folderName hoặc courseName hoặc sheetName
    const finalFolderName = folderName || courseName || sheetName || 'Unknown';

    // Log các tham số quan trọng
    console.log('\n📋 Thông tin request:');
    console.log(`- File ID: ${fileId || 'không có'}`);
    console.log(`- Drive Link: ${driveLink || 'không có'}`);
    console.log(`- Target Folder ID: ${finalTargetFolderId || 'không có'}`);
    console.log(`- Folder Name: ${finalFolderName}`);
    console.log(`- Update Sheet: ${updateSheet}`);
    if (updateSheet) {
      if (courseId) {
        console.log('- Course ID:', courseId);
        console.log('- Sheet Index:', sheetIndex);
        console.log('- Row Index:', rowIndex);
        console.log('- Cell Index:', cellIndex);
      } else if (sheetId) {
        console.log('- Sheet ID:', sheetId);
        console.log('- Google Sheet Name:', googleSheetName);
        console.log('- Row Index:', rowIndex);
        console.log('- Cell Index:', cellIndex);
      }
    }

    // Validate required parameters
    if (!fileId && !driveLink) {
      throw new Error('Thiếu fileId hoặc driveLink');
    }

    if (!finalTargetFolderId) {
      throw new Error('Thiếu folder ID đích (targetFolderId hoặc folderId)');
    }

    // Validate update sheet parameters
    if (updateSheet) {
      if (courseId) {
        if (sheetIndex === undefined || rowIndex === undefined || cellIndex === undefined) {
          throw new Error('Thiếu thông tin cập nhật sheet (sheetIndex, rowIndex, cellIndex)');
        }
      } else if (sheetId && googleSheetName) {
        if (rowIndex === undefined || cellIndex === undefined) {
          throw new Error('Thiếu thông tin cập nhật Google Sheet (rowIndex, cellIndex)');
        }
      } else {
        throw new Error('Thiếu thông tin sheet (courseId hoặc sheetId + googleSheetName)');
      }
    }

    // Get file ID from drive link if provided
    const finalFileId = fileId || extractDriveFileId(driveLink);
    if (!finalFileId) {
      throw new Error('Không thể lấy được file ID');
    }

    // Check file type
    console.log('🔍 Kiểm tra loại file...');
    const mimeTypeResult = await checkMimeType(finalFileId);

    // Xử lý kết quả kiểm tra MIME type
    if (!mimeTypeResult.success) {
      console.log(`⚠️ Lỗi khi kiểm tra MIME type: ${mimeTypeResult.error}`);
      
      // Chuyển sang xử lý bằng Chrome cho mọi lỗi API (404, 500, v.v.)
      console.log('🌐 Chuyển sang sử dụng Chrome để tải và xử lý file...');
      
      // Thêm file vào hàng đợi xử lý Chrome
      console.log(`📋 Thêm file vào hàng đợi xử lý Chrome:`);
      console.log(`🔍 File ID: ${finalFileId}`);
      console.log(`📄 Drive Link: ${driveLink || 'không có'}`);
      
      // Xác định loại lỗi để ghi log
      const errorType = mimeTypeResult.statusCode || 'unknown';
      console.log(`⚠️ Loại lỗi: ${errorType}`);
      
      const chromeResult = await addToProcessingQueue({
        fileId: finalFileId,
        fileName: `file_${finalFileId}`,
        driveLink,
        targetFolderId: finalTargetFolderId,
        targetFolderName: finalFolderName,
        errorType: errorType.toString(),
        updateSheet,
        courseId,
        sheetIndex,
        rowIndex,
        cellIndex,
        sheetId,
        googleSheetName,
        displayText,
        request
      });
      
      if (chromeResult) {
        console.log(`Kết quả xử lý Chrome: ${JSON.stringify(chromeResult)}`);
        return NextResponse.json({
          ...chromeResult,
          processingMode: `chrome_${errorType}`
        });
      }
      
      return NextResponse.json({ 
        status: 'queued',
        message: 'File đã được thêm vào hàng đợi xử lý Chrome'
      });
    }

    // Nếu là folder, xử lý đệ quy
    if (mimeTypeResult.isFolder) {
      console.log('\n📂 THƯ MỤC DETECTED - STARTING RECURSIVE PROCESSING');
      console.log(`📁 Target folder ID: ${finalTargetFolderId}`);
      
      // Check if sheet folder name exists
      if (!finalFolderName) {
        throw new Error('Thiếu tên thư mục sheet (Tên thư mục sheet)');
      }
      console.log(`📁 Sheet folder name: ${finalFolderName}`);

      // Validate and create sheet folder name
      try {
        const { getTokenByType } = await import('../remove-watermark/lib/utils.js');
        const downloadToken = getTokenByType('download');
        if (!downloadToken) {
          throw new Error('Thiếu token Google Drive');
        }

        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI
        );
        oauth2Client.setCredentials(downloadToken);
        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        // Check if target folder exists
        const targetFolder = await drive.files.get({
          fileId: finalTargetFolderId,
          fields: 'id,name',
          supportsAllDrives: true
        });
        console.log(`📁 Target folder confirmed to exist: ${targetFolder.data.name} (${finalTargetFolderId})`);

        // Check if sheet folder name already exists
        const existingFolders = await drive.files.list({
          q: `'${finalTargetFolderId}' in parents and name = '${finalFolderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id, name)',
          supportsAllDrives: true
        });

        let sheetFolder;
        if (existingFolders.data.files.length > 0) {
          // Use existing sheet folder name
          sheetFolder = existingFolders.data.files[0];
          console.log(`📁 Found existing sheet folder name: ${sheetFolder.name} (${sheetFolder.id})`);
        } else {
          // Create new sheet folder name
          console.log(`📁 Creating new sheet folder name: ${finalFolderName}`);
          const folderMetadata = {
            name: finalFolderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [finalTargetFolderId]
          };

          sheetFolder = (await drive.files.create({
            resource: folderMetadata,
            fields: 'id,name',
            supportsAllDrives: true
          })).data;
          console.log(`📁 Created sheet folder name: ${sheetFolder.name} (${sheetFolder.id})`);
        }

        // Update finalTargetFolderId to the ID of the sheet folder name
        finalTargetFolderId = sheetFolder.id;

        // Check if source folder exists
        const sourceFolder = await drive.files.get({
          fileId: finalFileId,
          fields: 'id,name',
          supportsAllDrives: true
        });
        console.log(`📁 Source folder confirmed to exist: ${sourceFolder.data.name} (${finalFileId})`);

      } catch (error) {
        if (error.code === 404) {
          throw new Error(`Thư mục không tìm thấy (${error.message.includes(finalTargetFolderId) ? 'đích' : 'nguồn'})`);
        }
        throw new Error(`Lỗi kiểm tra/tạo thư mục: ${error.message}`);
      }

      const folderResult = await processFolder(finalFileId, {
        targetFolderId: finalTargetFolderId,
        apiKey,
        updateSheet,
        courseId,
        sheetIndex,
        rowIndex,
        cellIndex,
        sheetId,
        googleSheetName,
        displayText,
        request,
        originalFolderLink: driveLink,
        sheetFolderName: finalFolderName
      });

      // Log total processing time
      const processingTime = Math.round((Date.now() - startTime) / 1000);
      console.log('\n=== FINISHED FOLDER PROCESSING ===');
      console.log(`⏱️ Tổng thời gian: ${processingTime} giây`);
      console.log(`📊 Tổng số file đã xử lý: ${folderResult.processedFiles.length}`);
      console.log(`⚠️ Tổng số file đã bỏ qua: ${folderResult.skippedFiles.length}`);
      console.log(`❌ Tổng số lỗi: ${folderResult.errors.length}`);

      return NextResponse.json({
        ...folderResult,
        processingTime
      });
    }

    // Check if it's a Google Doc
    if (mimeTypeResult.isGoogleDoc) {
      throw new Error('Không thể xử lý Google Doc, chỉ file PDF được hỗ trợ');
    }

    // Check if it's a PDF
    if (!mimeTypeResult.isPdf) {
      console.log(`⚠️ File không phải là PDF (${mimeTypeResult.mimeType}), bỏ qua xử lý watermark`);
      return NextResponse.json({
        success: true,
        skipped: true,
        message: `File không phải là PDF (${mimeTypeResult.mimeType}), bỏ qua xử lý watermark`,
        originalFile: {
          id: finalFileId,
          link: driveLink
        }
      });
    }

    // Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    console.log(`\n🔄 Đang tải file qua API Google Drive...`);
    
    let downloadResult;
    
    try {
      // Import hàm getTokenByType từ utils
      const { getTokenByType } = await import('../remove-watermark/lib/utils.js');
      
      // Lấy token tải xuống
      const downloadToken = getTokenByType('download');
      if (!downloadToken) {
        throw new Error('Thiếu token Google Drive tải xuống');
      }
      
      // Tạo OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      
      // Thiết lập credentials
      oauth2Client.setCredentials(downloadToken);
      
      // Khởi tạo Google Drive API
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      
      // Tạo tên file tạm
      const tempFilePath = path.join(tempDir, `${uuidv4()}.pdf`);
      
      console.log(`📥 Đang tải file ${finalFileId} vào ${tempFilePath}`);
      
      // Download file
      const response = await drive.files.get(
        {
          fileId: finalFileId,
          alt: 'media'
        },
        { responseType: 'stream' }
      );
      
      // Save file to disk
      const dest = fs.createWriteStream(tempFilePath);
      response.data.pipe(dest);
      
      await new Promise((resolve, reject) => {
        dest.on('finish', resolve);
        dest.on('error', (err) => {
          console.error(`❌ Lỗi lưu file: ${err.message}`);
          reject(err);
        });
      });
      
      console.log(`✅ File tải xuống thành công: ${tempFilePath}`);
      
      downloadResult = {
        success: true,
        filePath: tempFilePath,
        mimeType: mimeTypeResult.mimeType
      };

      // Check if it's a video file
      if (downloadResult.mimeType && downloadResult.mimeType.includes('video/')) {
        console.log(`🎥 File video được phát hiện từ MIME type: ${downloadResult.mimeType}`);
        
        // Return result with video file
        return NextResponse.json({
          success: true,
          isVideo: true,
          skipped: true,
          reason: 'File video không cần xử lý watermark',
          originalFile: {
            id: fileId,
            link: driveLink,
            mimeType: downloadResult.mimeType
          },
          processingTime: Math.round((Date.now() - startTime) / 1000)
        });
      }
      
      // Continue processing the file as normal
      let processedFilePath;
      
      // Check if the file is a blocked file that has been processed
      const isBlockedFileProcessed = downloadResult.filePath.includes('TÀI LIỆU');
      
      if (isBlockedFileProcessed) {
        processedFilePath = downloadResult.filePath;
      } else {
        const processResult = await processFile(downloadResult.filePath, downloadResult.mimeType);
        
        // Check if it's a video file
        if (processResult && !processResult.success && processResult.isVideo) {
          console.log(`🎥 File video được phát hiện từ processFile, bỏ qua xử lý...`);
          return NextResponse.json({
            success: true,
            isVideo: true,
            skipped: true,
            reason: 'File video không cần xử lý watermark',
            originalFile: {
              id: fileId,
              link: driveLink
            },
            processingTime: Math.round((Date.now() - startTime) / 1000)
          });
        }
        
        processedFilePath = processResult.processedPath;
        
        // Check and process if processedPath is an object
        if (typeof processedFilePath === 'object' && processedFilePath !== null) {
          if (processedFilePath.path) {
            processedFilePath = processedFilePath.path;
          } else {
            throw new Error('Không thể xác định đường dẫn file đã xử lý');
          }
        }
      }
      
      // Upload the processed file to Drive
      const uploadResult = await uploadToGoogleDrive(
        processedFilePath,
        path.basename(processedFilePath),
        downloadResult.mimeType,
        finalTargetFolderId,
        finalFolderName
      );
      
      // Update cell in sheet
      let sheetUpdateResult = null;
      if (uploadResult.success && updateSheet) {
        if (courseId && sheetIndex !== undefined && rowIndex !== undefined && cellIndex !== undefined) {
          sheetUpdateResult = await updateSheetCell(
            courseId,
            sheetIndex,
            rowIndex,
            cellIndex,
            driveLink, // Original URL
            uploadResult.webViewLink, // New URL
            displayText, // Display text
            request // Pass the request object
          );
        } else if (sheetId && googleSheetName && rowIndex !== undefined && cellIndex !== undefined) {
          sheetUpdateResult = await updateGoogleSheetCell(
            sheetId,
            googleSheetName,
            rowIndex,
            cellIndex,
            displayText || path.basename(processedFilePath),
            uploadResult.webViewLink, // New URL
            driveLink, // Original URL
            request // Pass the request object
          );
        }
      }
      
      return NextResponse.json({
        success: true,
        isFolder: false,
        originalFile: {
          id: fileId,
          link: driveLink
        },
        processedFile: {
          id: uploadResult.fileId,
          name: uploadResult.fileName,
          link: uploadResult.webViewLink
        },
        sheetUpdate: updateSheet ? {
          success: sheetUpdateResult?.success || false,
          message: sheetUpdateResult?.message || sheetUpdateResult?.error || 'Không có thông tin cập nhật sheet',
          details: sheetUpdateResult?.updatedCell || null
        } : null,
        processingTime: Math.round((Date.now() - startTime) / 1000)
      });

    } catch (downloadError) {
      // Handle 403 error immediately
      if (downloadError.message.includes('HTTP 403') || downloadError.message.includes('cannotDownloadFile')) {
        console.log('⚠️ 403 được phát hiện - File bị chặn tải xuống');
        console.log('🌐 Chuyển sang Chrome để tải và xử lý file...');
        
        // Add to Chrome processing queue
        console.log('\n📋 Thêm file vào hàng đợi xử lý Chrome:');
        console.log(`🔍 File ID: ${fileId}`);
        console.log(`📄 Tên File: ${folderName || 'Không rõ'}`);
        console.log(`⚠️ Loại Lỗi: 403`);
        
        // Add to queue and process
        const chromeResult = await addToProcessingQueue({
          fileId,
          fileName: `video_${fileId}.mp4`,
          driveLink,
          targetFolderId: finalTargetFolderId || "1Lt10aHyWp9VtPaImzInE0DmIcbrjJgpN",
          targetFolderName: finalFolderName,
          errorType: '403',
          updateSheet,
          courseId,
          sheetIndex,
          rowIndex,
          cellIndex,
          sheetId,
          googleSheetName,
          displayText,
          request
        });
        
        // If it's a video, return video result immediately
        if (chromeResult && chromeResult.isVideo) {
          console.log(`🎥 Chrome phát hiện file video, trả về kết quả video`);
          return NextResponse.json(chromeResult);
        }
        
        // If not a video, return queued status
        return NextResponse.json({ 
          status: 'queued',
          message: 'File đã được thêm vào hàng đợi xử lý Chrome'
        });
      }
      
      // If not 403, re-throw error for higher-level catch
      throw downloadError;
    }
  } catch (error) {
    console.error(`❌ Lỗi xử lý file: ${error.message}`);
    
    // Send error message
    await sendUpdate({
      type: 'error',
      error: error.message
    });
    
    // Close stream
    await writer.close();
    
    return new Response(
      JSON.stringify({ error: `Lỗi xử lý file: ${error.message}` }), 
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  } finally {
    // Clean up temp directory if it exists
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log(`🧹 Đã xóa thư mục tạm: ${tempDir}`);
      } catch (cleanupError) {
        console.error(`⚠️ Lỗi dọn dẹp thư mục tạm: ${cleanupError.message}`);
      }
    }
    
    // Ensure stream is closed
    try {
      await writer.close();
    } catch (e) {
      console.error('Lỗi đóng stream:', e);
    }
  }
  
  // Return stream response
  return new Response(customStream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}