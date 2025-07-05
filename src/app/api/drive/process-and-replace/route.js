import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { extractDriveFileId, createOAuth2Client } from '@/utils/drive-utils';
import { 
  downloadFromGoogleDrive, 
  checkFileInfo,
  processFile,
  processFolder,
  uploadToGoogleDrive,
  findOrCreateFolder,
  updateSheetCell,
  updateGoogleSheetCell
} from './lib';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

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
        fs.rmdirSync(tempDir, { recursive: true });
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
        fs.rmdirSync(tempDir, { recursive: true });
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
    const tempFileName = `blocked_${fileId}.pdf`;
    
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

// Thêm vào đầu file, sau phần import
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
    
    const result = await processFileWithChrome(
      task.fileId,
      task.fileName,
      task.tempDir,
      task.driveLink,
      task.targetFolderId,
      task.targetFolderName,
      task.courseName,
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
      task.errorType
    );
    
    task.resolve(result);
  } catch (error) {
    task.reject(error);
  } finally {
    isProcessing = false;
    // Xử lý file tiếp theo trong hàng đợi
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
  console.log('============== BẮT ĐẦU API XỬ LÝ VÀ THAY THẾ FILE GOOGLE DRIVE ==============');
  
  let tempDir = null;
  // Đặt timeout cho toàn bộ quá trình (120 phút)
  const GLOBAL_TIMEOUT = 120 * 60 * 1000;
  const startTime = Date.now();
  
  // Tạo promise với timeout
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Quá trình xử lý vượt quá thời gian cho phép (${GLOBAL_TIMEOUT / 60000} phút)`));
    }, GLOBAL_TIMEOUT);
  });
  
  try {
    // Parse request body
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
    
    console.log('Thông tin request:', {
      driveLink: driveLink || 'không có',
      folderId: folderId || 'sẽ dùng folder mặc định "1Lt10aHyWp9VtPaImzInE0DmIcbrjJgpN"',
      apiKey: apiKey ? 'Đã cung cấp' : 'Sử dụng từ hệ thống quản lý API key',
      courseName: courseName || 'không có (sẽ lưu vào thư mục mặc định)',
      sheetName: sheetName || 'không có',
      isSheetDocument: isSheetDocument || false,
      updateSheet: updateSheet || false,
      courseId: courseId || 'không có',
      sheetIndex: sheetIndex !== undefined ? sheetIndex : 'không có',
      rowIndex: rowIndex !== undefined ? rowIndex : 'không có',
      cellIndex: cellIndex !== undefined ? cellIndex : 'không có',
      sheetId: sheetId || 'không có',
      googleSheetName: googleSheetName || 'không có',
      useSheetNameDirectly: useSheetNameDirectly || false
    });
    
    // Validate drive link
    if (!driveLink) {
      console.error('LỖI: Thiếu liên kết Google Drive');
      return NextResponse.json(
        { error: 'Thiếu liên kết Google Drive.' },
        { status: 400 }
      );
    }
    
    // Trích xuất file ID
    const fileId = extractDriveFileId(driveLink);
    if (!fileId) {
      console.error('LỖI: Không thể trích xuất ID file từ URL');
      return NextResponse.json(
        { error: 'Không thể trích xuất ID file từ URL. Vui lòng kiểm tra lại liên kết.' },
        { status: 400 }
      );
    }
    
    // Xác định folder đích dựa trên thông tin request trước khi kiểm tra file
    let targetFolderId = folderId || "1Lt10aHyWp9VtPaImzInE0DmIcbrjJgpN"; // Mặc định nếu không có
    let targetFolderName = "";

    try {
      console.log(`\n🔄 Thử tải file trực tiếp với token download...`);
      
      // Tạo thư mục tạm để lưu file
      const tempDir = path.join(os.tmpdir(), uuidv4());
      fs.mkdirSync(tempDir, { recursive: true });
      
      // Thử tải file trực tiếp
      const downloadResult = await downloadFromGoogleDrive(fileId);
      
      if (downloadResult.success) {
        console.log(`✅ Tải file thành công: ${downloadResult.filePath}`);
        console.log(`📄 MIME type: ${downloadResult.mimeType}`);
        
        // Tiếp tục xử lý file như bình thường
        let processedFilePath;
        
        // Kiểm tra xem file có phải là file bị chặn đã được xử lý không
        const isBlockedFileProcessed = downloadResult.filePath && 
          downloadResult.filePath.includes('blocked_') && 
          downloadResult.filePath.includes('_clean');
          
        if (isBlockedFileProcessed) {
          console.log('File đã được xử lý bởi drive-fix-blockdown, bỏ qua bước xử lý thông thường');
          processedFilePath = downloadResult.filePath;
        } else {
          // Xử lý file theo loại
          if (downloadResult.mimeType.includes('pdf')) {
            console.log('Phát hiện file PDF, tiến hành xử lý xóa watermark...');
            const processResult = await processFile(downloadResult.filePath, downloadResult.mimeType, apiKey);
            processedFilePath = processResult.processedPath;
          } else {
            console.log(`Phát hiện file không phải PDF (${downloadResult.mimeType}), chỉ tải xuống và upload lại`);
            processedFilePath = downloadResult.filePath;
          }
        }
          
        // Upload file đã xử lý
        const uploadResult = await uploadToGoogleDrive(
          processedFilePath,
          path.basename(processedFilePath),
          downloadResult.mimeType,
          targetFolderId,
          targetFolderName || courseName
        );
          
        // Xử lý cập nhật sheet nếu cần
        let sheetUpdateResult = null;
        if (updateSheet) {
          console.log('Yêu cầu cập nhật sheet được kích hoạt, tiến hành cập nhật...');
          if (courseId && sheetIndex !== undefined && rowIndex !== undefined && cellIndex !== undefined) {
            sheetUpdateResult = await updateSheetCell(
              courseId,
              sheetIndex,
              rowIndex,
              cellIndex,
              driveLink,
              uploadResult.webViewLink,
              displayText,
              request
            );
          } else if (sheetId && googleSheetName && rowIndex !== undefined && cellIndex !== undefined) {
            const cellDisplayText = displayText || 'Tài liệu đã xử lý';
            sheetUpdateResult = await updateGoogleSheetCell(
              sheetId,
              googleSheetName,
              rowIndex,
              cellIndex,
              cellDisplayText,
              uploadResult.webViewLink,
              driveLink,
              request
            );
          }
        }
          
        // Dọn dẹp thư mục tạm
        try {
          fs.rmdirSync(tempDir, { recursive: true });
          console.log(`Đã xóa thư mục tạm: ${tempDir}`);
        } catch (cleanupError) {
          console.error('Lỗi khi dọn dẹp thư mục tạm:', cleanupError);
        }
          
        // Trả về kết quả thành công
        return NextResponse.json({
          success: true,
          isFolder: false,
          originalFile: {
            id: fileId,
            link: driveLink
          },
          targetFolder: {
            id: targetFolderId,
            name: targetFolderName || (courseName || 'Mặc định')
          },
          processedFile: {
            id: uploadResult.fileId,
            name: uploadResult.fileName,
            link: uploadResult.webViewLink
          },
          mimeType: downloadResult.mimeType,
          processingTime: Math.round((Date.now() - startTime) / 1000),
          sheetUpdate: updateSheet ? {
            success: sheetUpdateResult?.success || false,
            message: sheetUpdateResult?.message || sheetUpdateResult?.error || 'Không có thông tin cập nhật',
            details: sheetUpdateResult?.updatedCell || null
          } : null
        });
      } else {
        // Nếu tải thất bại, ném lỗi để xử lý ở catch block
        throw new Error(downloadResult.error);
      }
    } catch (error) {
      console.error('Lỗi khi xử lý file:', error);
        
      // Dọn dẹp thư mục tạm nếu có lỗi
      if (tempDir) {
        try {
          fs.rmdirSync(tempDir, { recursive: true });
          console.log(`Đã xóa thư mục tạm: ${tempDir}`);
        } catch (cleanupError) {
          console.error('Lỗi khi dọn dẹp thư mục tạm:', cleanupError);
        }
      }
        
      return NextResponse.json(
        { 
          success: false, 
          error: error.message,
          fileId,
          driveLink
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Lỗi khi xử lý và thay thế file:', error);
    
    // Dọn dẹp thư mục tạm nếu có lỗi
    if (tempDir) {
      try {
        fs.rmdirSync(tempDir, { recursive: true });
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
