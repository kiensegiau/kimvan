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
      error: error.message
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
          uploadResult.webViewLink, // URL mới
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
          uploadResult.webViewLink,
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
        link: uploadResult.webViewLink
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

      console.log(`✅ Tải file thành công qua API: ${tempFilePath}`);

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
        console.error(`⚠️ Lỗi khi dọn dẹp thư mục tạm: ${cleanupError.message}`);
      }

      return await fileResult.json();

    } catch (apiError) {
      // Nếu lỗi 403, thử dùng Chrome
      if (apiError.message.includes('HTTP 403') || apiError.message.includes('cannotDownloadFile')) {
        console.log(`⚠️ Lỗi 403 khi tải qua API, chuyển sang dùng Chrome...`);
        
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
    console.error(`❌ Lỗi khi xử lý file ${file.name}:`, error);
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
    console.log(`\n${indent}📂 Bắt đầu xử lý folder: ${folderId}`);

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

    // Lấy thông tin folder gốc
    const folder = await drive.files.get({
      fileId: folderId,
      fields: 'name,parents',
      supportsAllDrives: true
    });

    // Xác định parent folder ID cho folder mới
    const newParentId = parentFolderInfo ? parentFolderInfo.id : targetFolderId;

    // Log thông tin về folder cha
    if (!parentFolderInfo) {
      try {
        const parentFolder = await drive.files.get({
          fileId: targetFolderId,
          fields: 'name',
          supportsAllDrives: true
        });
        console.log(`${indent}📁 Folder cha: ${parentFolder.data.name} (${targetFolderId})`);
      } catch (error) {
        console.warn(`${indent}⚠️ Không thể lấy thông tin folder cha: ${error.message}`);
      }
    }

    // Tạo folder mới trong thư mục đích
    const newFolder = await drive.files.create({
      requestBody: {
        name: folder.data.name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [newParentId]
      },
      fields: 'id,name,webViewLink',
      supportsAllDrives: true
    });

    console.log(`${indent}📂 Đã tạo folder mới: ${newFolder.data.name}`);
    console.log(`${indent}📎 ID: ${newFolder.data.id}`);
    console.log(`${indent}🔗 Link: ${newFolder.data.webViewLink}`);

    // Log cấu trúc folder
    let folderPath = [];
    if (parentFolderInfo) {
      folderPath = [...parentFolderInfo.path, parentFolderInfo.name];
    }
    folderPath.push(newFolder.data.name);
    console.log(`${indent}📍 Vị trí: ${sheetFolderName || 'Sheet folder'} > ${folderPath.join(' > ')}`);

    // Lấy danh sách các file trong folder
    const files = await drive.files.list({
      q: `'${folderId}' in parents`,
      fields: 'files(id, name, mimeType)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    console.log(`${indent}📊 Tổng số items trong folder: ${files.data.files.length}`);

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
          console.log(`\n${indent}  📂 Xử lý folder con: ${file.name} (${file.id})`);
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
          console.log(`${indent}  🔄 Xử lý ${mimeTypeResult.isPdf ? 'PDF' : 'video'}: ${file.name}`);
          const fileResult = await processSingleFile(file, {
            ...options,
            targetFolderId: newFolder.data.id
          });
          
          if (fileResult.success) {
            console.log(`${indent}  ✅ Đã xử lý thành công: ${file.name}`);
            results.processedFiles.push({
              id: file.id,
              name: file.name,
              type: mimeTypeResult.isPdf ? 'pdf' : 'video',
              result: fileResult
            });
          } else {
            console.error(`${indent}  ❌ Lỗi khi xử lý: ${file.name}`);
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
        console.error(`${indent}  ❌ Lỗi khi xử lý file ${file.name}:`, fileError);
        results.errors.push({
          id: file.id,
          name: file.name,
          error: fileError.message
        });
      }
    }

    // Tổng kết kết quả xử lý folder
    console.log(`\n${indent}📊 Kết quả xử lý folder ${newFolder.data.name}:`);
    console.log(`${indent}✅ Đã xử lý: ${results.processedFiles.length} files`);
    console.log(`${indent}⚠️ Bỏ qua: ${results.skippedFiles.length} files`);
    console.log(`${indent}❌ Lỗi: ${results.errors.length} files`);

    // Nếu đây là folder gốc và cần cập nhật sheet
    if (!parentFolderInfo && updateSheet) {
      try {
        console.log(`\n${indent}📝 Cập nhật link folder mới vào sheet...`);
        
        if (courseId && sheetIndex !== undefined && rowIndex !== undefined && cellIndex !== undefined) {
          const sheetUpdateResult = await updateSheetCell(
            courseId,
            sheetIndex,
            rowIndex,
            cellIndex,
            results.originalFolderLink,
            results.folderLink,
            displayText || results.folderName,
            request
          );
          
          results.sheetUpdate = {
            success: sheetUpdateResult?.success || false,
            message: sheetUpdateResult?.message || sheetUpdateResult?.error || 'Đã cập nhật sheet',
            details: sheetUpdateResult?.updatedCell || null
          };
          console.log(`${indent}✅ Đã cập nhật sheet thành công`);
        } else if (sheetId && googleSheetName && rowIndex !== undefined && cellIndex !== undefined) {
          const sheetUpdateResult = await updateGoogleSheetCell(
            sheetId,
            googleSheetName,
            rowIndex,
            cellIndex,
            displayText || results.folderName,
            results.folderLink,
            results.originalFolderLink,
            request
          );
          
          results.sheetUpdate = {
            success: sheetUpdateResult?.success || false,
            message: sheetUpdateResult?.message || 'Đã cập nhật Google Sheet',
            details: sheetUpdateResult
          };
          console.log(`${indent}✅ Đã cập nhật Google Sheet thành công`);
        }
      } catch (sheetError) {
        console.error(`${indent}❌ Lỗi khi cập nhật sheet:`, sheetError);
        results.sheetUpdate = {
          success: false,
          message: `Lỗi khi cập nhật sheet: ${sheetError.message}`
        };
      }
    }

    return results;
  } catch (error) {
    console.error(`${indent}❌ Lỗi khi xử lý folder ${folderId}:`, error);
    throw error;
  }
}

export async function POST(request) {
  const startTime = Date.now();
  const tempDir = path.join(os.tmpdir(), uuidv4());
  
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
      courseName, // Thêm courseName
      sheetName,  // Thêm sheetName
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
    const finalTargetFolderId = targetFolderId || folderId;

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

    // Nếu là folder, xử lý đệ quy
    if (mimeTypeResult.isFolder) {
      console.log('\n📂 PHÁT HIỆN FOLDER - BẮT ĐẦU XỬ LÝ ĐỆ QUY');
      console.log(`📁 Target folder ID: ${finalTargetFolderId}`);
      console.log(`📁 Sheet folder name: ${finalFolderName}`);

      // Validate target folder exists
      try {
        const { getTokenByType } = await import('../remove-watermark/lib/utils.js');
        const downloadToken = getTokenByType('download');
        if (!downloadToken) {
          throw new Error('Không tìm thấy token Google Drive');
        }

        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI
        );
        oauth2Client.setCredentials(downloadToken);
        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        // Check if target folder exists
        await drive.files.get({
          fileId: finalTargetFolderId,
          fields: 'id,name',
          supportsAllDrives: true
        });
      } catch (error) {
        if (error.code === 404) {
          throw new Error(`Không tìm thấy folder đích (${finalTargetFolderId})`);
        }
        throw new Error(`Lỗi khi kiểm tra folder đích: ${error.message}`);
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

      // Log tổng kết thời gian xử lý
      const processingTime = Math.round((Date.now() - startTime) / 1000);
      console.log('\n=== KẾT THÚC XỬ LÝ FOLDER ===');
      console.log(`⏱️ Tổng thời gian: ${processingTime} giây`);
      console.log(`📊 Tổng số file đã xử lý: ${folderResult.processedFiles.length}`);
      console.log(`⚠️ Tổng số file bỏ qua: ${folderResult.skippedFiles.length}`);
      console.log(`❌ Tổng số lỗi: ${folderResult.errors.length}`);

      return NextResponse.json({
        ...folderResult,
        processingTime
      });
    }

    // Kiểm tra xem có phải là Google Doc không
    if (mimeTypeResult.isGoogleDoc) {
      throw new Error('Không thể xử lý Google Doc, chỉ hỗ trợ file PDF');
    }

    // Kiểm tra xem có phải là PDF không
    if (!mimeTypeResult.isPdf) {
      console.log(`⚠️ File không phải PDF (${mimeTypeResult.mimeType}), bỏ qua xử lý watermark`);
      return NextResponse.json({
        success: true,
        skipped: true,
        message: `File không phải PDF (${mimeTypeResult.mimeType}), bỏ qua xử lý`,
        originalFile: {
          id: finalFileId,
          link: driveLink
        }
      });
    }

    // Tạo thư mục tạm nếu chưa tồn tại
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    console.log(`\n🔄 Tải file qua Google Drive API...`);
    
    let downloadResult;
    
    try {
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
      
      // Tạo tên file tạm
      const tempFilePath = path.join(tempDir, `${uuidv4()}.pdf`);
      
      console.log(`📥 Bắt đầu tải file ${finalFileId} về ${tempFilePath}`);
      
      // Tải file về
      const response = await drive.files.get(
        {
          fileId: finalFileId,
          alt: 'media'
        },
        { responseType: 'stream' }
      );
      
      // Lưu file vào ổ đĩa
      const dest = fs.createWriteStream(tempFilePath);
      response.data.pipe(dest);
      
      await new Promise((resolve, reject) => {
        dest.on('finish', resolve);
        dest.on('error', (err) => {
          console.error(`❌ Lỗi khi lưu file: ${err.message}`);
          reject(err);
        });
      });
      
      console.log(`✅ Đã tải file thành công: ${tempFilePath}`);
      
      downloadResult = {
        success: true,
        filePath: tempFilePath,
        mimeType: mimeTypeResult.mimeType
      };

      // Kiểm tra nếu là file video
      if (downloadResult.mimeType && downloadResult.mimeType.includes('video/')) {
        console.log(`🎥 Phát hiện file video từ MIME type: ${downloadResult.mimeType}`);
        
        // Trả về kết quả với file video
        return NextResponse.json({
          success: true,
          isVideo: true,
          skipped: true,
          reason: 'File video không cần xử lý',
          originalFile: {
            id: fileId,
            link: driveLink,
            mimeType: downloadResult.mimeType
          },
          processingTime: Math.round((Date.now() - startTime) / 1000)
        });
      }
      
      // Tiếp tục xử lý file như bình thường
      let processedFilePath;
      
      // Kiểm tra xem file có phải là file bị chặn đã được xử lý không
      const isBlockedFileProcessed = downloadResult.filePath.includes('TÀI LIỆU');
      
      if (isBlockedFileProcessed) {
        processedFilePath = downloadResult.filePath;
      } else {
        const processResult = await processFile(downloadResult.filePath, downloadResult.mimeType);
        
        // Kiểm tra nếu file là video
        if (processResult && !processResult.success && processResult.isVideo) {
          console.log(`🎥 Phát hiện file video từ processFile, bỏ qua xử lý...`);
          return NextResponse.json({
            success: true,
            isVideo: true,
            skipped: true,
            reason: 'File video không cần xử lý',
            originalFile: {
              id: fileId,
              link: driveLink
            },
            processingTime: Math.round((Date.now() - startTime) / 1000)
          });
        }
        
        processedFilePath = processResult.processedPath;
        
        // Kiểm tra và xử lý nếu processedPath là object
        if (typeof processedFilePath === 'object' && processedFilePath !== null) {
          if (processedFilePath.path) {
            processedFilePath = processedFilePath.path;
          } else {
            throw new Error('Không thể xác định đường dẫn file đã xử lý');
          }
        }
      }
      
      // Upload file đã xử lý lên Drive
      const uploadResult = await uploadToGoogleDrive(
        processedFilePath,
        path.basename(processedFilePath),
        downloadResult.mimeType,
        finalTargetFolderId,
        finalFolderName
      );
      
      // Cập nhật cell trong sheet
      let sheetUpdateResult = null;
      if (uploadResult.success && updateSheet) {
        if (courseId && sheetIndex !== undefined && rowIndex !== undefined && cellIndex !== undefined) {
          sheetUpdateResult = await updateSheetCell(
            courseId,
            sheetIndex,
            rowIndex,
            cellIndex,
            driveLink, // URL gốc
            uploadResult.webViewLink, // URL mới
            displayText, // Text hiển thị
            request // Pass the request object
          );
        } else if (sheetId && googleSheetName && rowIndex !== undefined && cellIndex !== undefined) {
          sheetUpdateResult = await updateGoogleSheetCell(
            sheetId,
            googleSheetName,
            rowIndex,
            cellIndex,
            displayText || path.basename(processedFilePath),
            uploadResult.webViewLink, // URL mới
            driveLink, // URL gốc
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
          message: sheetUpdateResult?.message || sheetUpdateResult?.error || 'Không có thông tin cập nhật',
          details: sheetUpdateResult?.updatedCell || null
        } : null,
        processingTime: Math.round((Date.now() - startTime) / 1000)
      });

    } catch (downloadError) {
      // Xử lý lỗi 403 ngay lập tức
      if (downloadError.message.includes('HTTP 403') || downloadError.message.includes('cannotDownloadFile')) {
        console.log('⚠️ Phát hiện lỗi 403 - File bị chặn download');
        console.log('🌐 Chuyển sang sử dụng Chrome để tải file...');
        
        // Thêm vào hàng đợi xử lý Chrome
        console.log('\n📋 Thêm file vào hàng đợi xử lý Chrome:');
        console.log(`🔍 File ID: ${fileId}`);
        console.log(`📄 Tên file: ${folderName || 'Unknown'}`);
        console.log(`⚠️ Loại lỗi: 403`);
        
        // Thêm vào hàng đợi và xử lý
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
        
        // Nếu là video, trả về kết quả ngay
        if (chromeResult && chromeResult.isVideo) {
          console.log(`🎥 Chrome phát hiện file là video, trả về kết quả video`);
          return NextResponse.json(chromeResult);
        }
        
        // Nếu không phải video, trả về trạng thái đã xếp hàng đợi
        return NextResponse.json({ 
          status: 'queued',
          message: 'File đã được thêm vào hàng đợi xử lý Chrome'
        });
      }
      
      // Nếu không phải lỗi 403, ném lỗi để xử lý ở catch bên ngoài
      throw downloadError;
    }
  } catch (error) {
    console.error(`❌ Lỗi khi xử lý file: ${error.message}`);
    return NextResponse.json({ error: `Lỗi khi xử lý file: ${error.message}` }, { status: 500 });
  } finally {
    // Dọn dẹp thư mục tạm nếu tồn tại
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log(`🧹 Đã dọn dẹp thư mục tạm: ${tempDir}`);
      } catch (cleanupError) {
        console.error(`⚠️ Lỗi khi dọn dẹp thư mục tạm: ${cleanupError.message}`);
      }
    }
  }
}