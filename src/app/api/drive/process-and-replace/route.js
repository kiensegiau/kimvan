import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { downloadFromGoogleDrive } from './lib/download-service.js';
import { processFile } from './lib/file-processor.js';
import { uploadToGoogleDrive } from './lib/upload-service.js';
import { updateSheetCell } from './lib/sheet-service.js';
import { processPDF } from '../remove-watermark/lib/drive-fix-blockdown.js';
import { extractDriveFileId } from '@/utils/drive-utils';

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
    
    // Lấy đường dẫn đến file đã xử lý
    const processedFilePath = processResult.processedPath;
    const processedFileName = path.basename(processedFilePath);
    
    console.log(`✅ Đã xử lý watermark cho file (${sourceType}): ${processedFilePath}`);
    
    // Upload file đã xử lý
    const uploadResult = await uploadToGoogleDrive(
      processedFilePath,
      processedFileName,
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
      resolve,
      reject
    };
    
    console.log(`\n📋 Thêm file vào hàng đợi xử lý Chrome:`);
    console.log(`🔍 File ID: ${params.fileId}`);
    console.log(`📄 Tên file: ${params.fileName}`);
    console.log(`⚠️ Loại lỗi: ${params.errorType}`);
    
    processingQueue.push(task);
    processNextInQueue(); // Thử xử lý ngay nếu không có file nào đang xử lý
  });
}

// API Endpoint - POST
export async function POST(request) {
  let tempDir = null;
  const GLOBAL_TIMEOUT = 120 * 60 * 1000;
  const startTime = Date.now();
  
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Quá trình xử lý vượt quá thời gian cho phép (${GLOBAL_TIMEOUT / 60000} phút)`));
    }, GLOBAL_TIMEOUT);
  });
  
  try {
    const requestBody = await request.json();
    const { 
      driveLink, 
      folderId, 
      apiKey, 
      courseName, 
      sheetName, 
      isSheetDocument,
      courseId,
      sheetIndex,
      rowIndex,
      cellIndex,
      sheetId,
      googleSheetName,
      updateSheet = false,
      displayText = null,
      useSheetNameDirectly = false
    } = requestBody;
    
    if (!driveLink) {
      return NextResponse.json(
        { error: 'Thiếu liên kết Google Drive.' },
        { status: 400 }
      );
    }
    
    const fileId = extractDriveFileId(driveLink);
    if (!fileId) {
      return NextResponse.json(
        { error: 'Không thể trích xuất ID file từ URL. Vui lòng kiểm tra lại liên kết.' },
        { status: 400 }
      );
    }

    // Kiểm tra thông tin file bằng API upload
    try {
      const fileInfo = await checkFileInfo(fileId);

      if (fileInfo.success && fileInfo.fileInfo.owners?.[0]?.emailAddress === 'khoahocshare6.0@gmail.com') {
        // Xử lý cập nhật sheet nếu cần
        let sheetUpdateResult = null;
        if (updateSheet) {
          console.log('File thuộc khoahocshare6.0@gmail.com, cập nhật sheet với trạng thái bỏ qua...');
          if (courseId && sheetIndex !== undefined && rowIndex !== undefined && cellIndex !== undefined) {
            sheetUpdateResult = await updateSheetCell(
              courseId,
              sheetIndex,
              rowIndex,
              cellIndex,
              driveLink,
              driveLink, // Giữ nguyên link gốc
              displayText || fileInfo.fileInfo.name,
              request,
              {
                skipProcessing: true,
                originalLink: driveLink,
                processedTime: new Date().toISOString()
              }
            );
          } else if (sheetId && googleSheetName && rowIndex !== undefined && cellIndex !== undefined) {
            sheetUpdateResult = await updateGoogleSheetCell(
              sheetId,
              googleSheetName,
              rowIndex,
              cellIndex,
              displayText || fileInfo.fileInfo.name,
              driveLink, // Giữ nguyên link gốc
              driveLink,
              request,
              {
                skipProcessing: true,
                originalLink: driveLink,
                processedTime: new Date().toISOString()
              }
            );
          }
        }

        // Trả về kết quả
        return NextResponse.json({
          success: true,
          skipped: true,
          reason: 'File thuộc sở hữu của khoahocshare6.0@gmail.com',
          originalFile: {
            id: fileId,
            link: driveLink,
            info: fileInfo.fileInfo
          },
          sheetUpdate: updateSheet ? {
            success: sheetUpdateResult?.success || false,
            message: sheetUpdateResult?.message || sheetUpdateResult?.error || 'Không có thông tin cập nhật',
            details: sheetUpdateResult?.updatedCell || null
          } : null
        });
      }
    } catch (error) {
      // Tiếp tục xử lý nếu không kiểm tra được thông tin
    }
    
    // Xác định folder đích dựa trên thông tin request trước khi kiểm tra file
    let targetFolderId = folderId || "1Lt10aHyWp9VtPaImzInE0DmIcbrjJgpN"; // Mặc định nếu không có
    let targetFolderName = "";

    try {
      console.log(`\n🔄 Thử tải file trực tiếp với token download...`);
      
      // Tạo thư mục tạm để lưu file
      tempDir = path.join(os.tmpdir(), uuidv4());
      fs.mkdirSync(tempDir, { recursive: true });
      
      try {
        // Thử tải file trực tiếp
        const downloadResult = await downloadFromGoogleDrive(fileId);
        
        if (downloadResult.success) {
          console.log(`✅ Đã tải thành công file: ${downloadResult.filePath}`);
          console.log(`📄 MIME type: ${downloadResult.mimeType}`);
          
          // Tiếp tục xử lý file như bình thường
          let processedFilePath;
          
          // Kiểm tra xem file có phải là file bị chặn đã được xử lý không
          const isBlockedFileProcessed = downloadResult.filePath.includes('TÀI LIỆU');
          
          if (isBlockedFileProcessed) {
            processedFilePath = downloadResult.filePath;
          } else {
            processedFilePath = await processFile(downloadResult.filePath, downloadResult.mimeType);
          }
          
          // Upload file đã xử lý lên Drive
          const uploadResult = await uploadToGoogleDrive(processedFilePath, targetFolderName || courseName || 'Unknown');
          
          // Cập nhật cell trong sheet
          if (uploadResult.success) {
            await updateSheetCell(fileId, {
              newLink: uploadResult.webViewLink,
              oldLink: driveLink,
              source: isBlockedFileProcessed ? '403_chrome' : 'direct'
            });
          }
          
          return NextResponse.json(uploadResult);
        }
      } catch (downloadError) {
        // Xử lý lỗi 403 ngay lập tức
        if (downloadError.message.includes('HTTP 403') || downloadError.message.includes('cannotDownloadFile')) {
          console.log('⚠️ Phát hiện lỗi 403 - File bị chặn download');
          console.log('🌐 Chuyển sang sử dụng Chrome để tải file...');
          
          // Thêm vào hàng đợi xử lý Chrome
          console.log('\n📋 Thêm file vào hàng đợi xử lý Chrome:');
          console.log(`🔍 File ID: ${fileId}`);
          console.log(`📄 Tên file: ${targetFolderName || courseName || 'Unknown'}`);
          console.log(`⚠️ Loại lỗi: 403`);
          
          // Thêm vào hàng đợi và xử lý
          await addToProcessingQueue({
            fileId,
            driveLink,
            targetFolderName: targetFolderName || courseName || 'Unknown',
            errorType: '403'
          });
          
          return NextResponse.json({ 
            status: 'queued',
            message: 'File đã được thêm vào hàng đợi xử lý Chrome'
          });
        }
        
        // Các lỗi khác thì throw
        throw downloadError;
      }
    } catch (error) {
      console.error('❌ Lỗi:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } catch (error) {
    console.error('Lỗi khi xử lý và thay thế file:', error);
    
    // Dọn dẹp thư mục tạm nếu có lỗi
    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log(`Đã xóa thư mục tạm: ${tempDir}`);
      } catch (cleanupError) {
        console.error('Lỗi khi dọn dẹp thư mục tạm:', cleanupError);
      }
    }
    
    // Kiểm tra nếu lỗi là do timeout
    if (error.message && error.message.includes('Quá trình xử lý vượt quá thời gian')) {
      return NextResponse.json(
        { 
          success: false, 
          error: error.message,
          timeout: true,
          message: "File quá lớn hoặc quá phức tạp, không thể xử lý trong thời gian cho phép. Vui lòng thử lại với file nhỏ hơn."
        },
        { status: 504 } // Gateway Timeout
      );
    }
    
    return NextResponse.json(
      { success: false, error: `Lỗi khi xử lý và thay thế file: ${error.message}` },
      { status: 500 }
    );
  }
}
