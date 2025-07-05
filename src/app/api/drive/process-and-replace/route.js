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
      // Thêm các tham số cho việc cập nhật sheet
      courseId,
      sheetIndex,
      rowIndex,
      cellIndex,
      sheetId,
      googleSheetName,
      updateSheet = false, // Cờ để xác định có cập nhật sheet hay không
      displayText = null, // Text hiển thị trong ô
      useSheetNameDirectly = false // Thêm tham số mới để xác định có sử dụng trực tiếp tên sheet làm thư mục hay không
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
    
    // Kiểm tra MIME type của file trước khi tải xuống
    console.log(`Kiểm tra MIME type của file với ID: ${fileId}`);
    const fileInfoResult = await checkFileInfo(fileId);
    
    if (!fileInfoResult.success) {
      console.error(`Lỗi khi kiểm tra thông tin file: ${fileInfoResult.message}`);
      
      if (fileInfoResult.error === 'FILE_NOT_FOUND') {
        console.log(`\n⚠️ Phát hiện lỗi 404: File không tồn tại`);
        console.log(`🔄 Thêm vào hàng đợi xử lý bằng Chrome...`);
        
        try {
          // Tạo thư mục tạm để lưu file
          const tempDir = path.join(os.tmpdir(), uuidv4());
          fs.mkdirSync(tempDir, { recursive: true });
          
          // Thêm vào hàng đợi và đợi kết quả
          const result = await addToProcessingQueue({
            fileId,
            fileName: 'unknown', // Không cần truy cập fileInfo vì file không tồn tại
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
            errorType: "404"
          });
          
          return NextResponse.json(result);
        } catch (error) {
          console.error(`\n❌ Không thể xử lý file 404 bằng Chrome:`);
          console.error(`💬 ${error.message}`);
          
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
              error: error.message, 
              chromeAttempted: true,
              fileId,
              driveLink 
            },
            { status: 404 }
          );
        }
      }
      
      if (fileInfoResult.error === 'PERMISSION_DENIED') {
        console.log(`\n⚠️ Phát hiện lỗi 403: Không có quyền truy cập`);
        console.log(`🔄 Thêm vào hàng đợi xử lý bằng Chrome...`);
        
        try {
          // Tạo thư mục tạm để lưu file
          const tempDir = path.join(os.tmpdir(), uuidv4());
          fs.mkdirSync(tempDir, { recursive: true });
          
          // Thêm vào hàng đợi và đợi kết quả
          const result = await addToProcessingQueue({
            fileId,
            fileName: 'unknown', // Không cần truy cập fileInfo vì không có quyền truy cập
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
            errorType: "403"
          });
          
          return NextResponse.json(result);
        } catch (error) {
          console.error(`\n❌ Không thể xử lý file 403 bằng Chrome:`);
          console.error(`💬 ${error.message}`);
          
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
              error: error.message, 
              blockdownAttempted: true,
              fileId,
              driveLink 
            },
            { status: 403 }
          );
        }
      }
      
      return NextResponse.json(
        { error: `Lỗi khi kiểm tra thông tin file: ${fileInfoResult.message}` },
        { status: 500 }
      );
    }
    
    const fileInfo = fileInfoResult.fileInfo;
    const mimeType = fileInfo.mimeType;
    console.log(`MIME type của file: ${mimeType}`);
    
    // Kiểm tra và log thông tin về chủ sở hữu file
    let ownerInfo = null;
    if (fileInfo.owners && fileInfo.owners.length > 0) {
      ownerInfo = {
        email: fileInfo.owners[0].emailAddress,
        displayName: fileInfo.owners[0].displayName,
        kind: fileInfo.owners[0].kind,
        permissionId: fileInfo.owners[0].permissionId,
        photoLink: fileInfo.owners[0].photoLink
      };
      console.log('=== THÔNG TIN CHỦ SỞ HỮU FILE ===');
      console.log(`👤 Tên: ${ownerInfo.displayName}`);
      console.log(`📧 Email: ${ownerInfo.email}`);
      console.log(`🔑 Permission ID: ${ownerInfo.permissionId}`);
      console.log(`🌐 Loại tài khoản: ${ownerInfo.kind}`);
      if (ownerInfo.photoLink) {
        console.log(`🖼️ Ảnh đại diện: ${ownerInfo.photoLink}`);
      }
      console.log('================================');
    } else {
      console.log('⚠️ Không tìm thấy thông tin về chủ sở hữu file');
    }
    
    // Tạo promise cho quá trình xử lý
    const processingPromise = (async () => {
      try {
        // Xác định folder đích dựa trên thông tin request
        targetFolderId = folderId;
        targetFolderName = '';
        
        // Nếu là tài liệu sheet, tạo cấu trúc folder
        if (isSheetDocument && sheetName) {
          console.log(`Đây là tài liệu sheet: ${sheetName}, tạo thư mục với tên sheet`);
          
          // Kiểm tra nếu cần sử dụng trực tiếp tên sheet làm thư mục
          if (useSheetNameDirectly) {
            console.log(`Sử dụng trực tiếp tên sheet làm thư mục: ${sheetName}`);
            
            // Tạo/tìm folder với tên sheet và xóa các folder trùng lặp
            const sheetFolderResult = await findOrCreateFolder(sheetName, folderId, true); // Thêm tham số true để xóa folder trùng lặp
            
            if (!sheetFolderResult.success) {
              throw new Error(`Không thể tạo folder "${sheetName}": ${sheetFolderResult.error || 'Lỗi không xác định'}`);
            }
            
            // Log thông tin về folder trùng lặp nếu có
            if (sheetFolderResult.duplicateCount > 0) {
              console.log(`Phát hiện ${sheetFolderResult.duplicateCount} folder trùng tên "${sheetName}" đã được xử lý`);
            }
            
            targetFolderId = sheetFolderResult.folder.id;
            targetFolderName = sheetName;
            
            console.log(`Đã tạo/tìm thư mục: ${sheetName} (ID: ${targetFolderId})`);
          } else {
            // Tạo/tìm folder "Tài liệu sheet cũ" (cách cũ)
            console.log(`Sử dụng cấu trúc thư mục cũ "Tài liệu sheet cũ/${sheetName}"`);
            
            const mainFolderName = "Tài liệu sheet cũ";
            const mainFolderResult = await findOrCreateFolder(mainFolderName, folderId);
            
            if (!mainFolderResult.success) {
              throw new Error(`Không thể tạo folder chính "${mainFolderName}": ${mainFolderResult.error || 'Lỗi không xác định'}`);
            }
            
            // Tạo/tìm folder con với tên sheet và xóa các folder trùng lặp
            const sheetFolderResult = await findOrCreateFolder(sheetName, mainFolderResult.folder.id, true); // Thêm tham số true để xóa folder trùng lặp
            
            if (!sheetFolderResult.success) {
              throw new Error(`Không thể tạo folder con "${sheetName}": ${sheetFolderResult.error || 'Lỗi không xác định'}`);
            }
            
            // Log thông tin về folder trùng lặp nếu có
            if (sheetFolderResult.duplicateCount > 0) {
              console.log(`Phát hiện ${sheetFolderResult.duplicateCount} folder con trùng tên "${sheetName}" đã được xử lý`);
            }
            
            targetFolderId = sheetFolderResult.folder.id;
            targetFolderName = sheetName;
            
            console.log(`Đã tạo/tìm cấu trúc folder: ${mainFolderName}/${sheetName} (ID: ${targetFolderId})`);
          }
        } else if (courseName) {
          // Nếu có courseName, sử dụng nó làm folder cha
          console.log(`Sử dụng courseName làm folder cha: ${courseName}`);
          
          // Tạo/tìm folder với tên courseName và xóa các folder trùng lặp
          const courseFolderResult = await findOrCreateFolder(courseName, folderId, true); // Thêm tham số true để xóa folder trùng lặp
          
          if (!courseFolderResult.success) {
            throw new Error(`Không thể tạo folder "${courseName}": ${courseFolderResult.error || 'Lỗi không xác định'}`);
          }
          
          // Log thông tin về folder trùng lặp nếu có
          if (courseFolderResult.duplicateCount > 0) {
            console.log(`Phát hiện ${courseFolderResult.duplicateCount} folder trùng tên "${courseName}" đã được xử lý`);
          }
          
          targetFolderId = courseFolderResult.folder.id;
          targetFolderName = courseName;
          
          console.log(`Đã tạo/tìm folder: ${courseName} (ID: ${targetFolderId})`);
        }
        
        // Kiểm tra xem đây có phải là thư mục không
        if (mimeType === 'application/vnd.google-apps.folder') {
          console.log(`Phát hiện thư mục với ID: ${fileId}, tên: ${fileInfo.name}`);
          
          // Xử lý thư mục
          const folderResult = await processFolder(
            fileId,
            fileInfo.name,
            targetFolderId || null,
            apiKey
          );
          
          // Tạo thông báo tóm tắt
          let summaryMessage = '';
          if (folderResult.success) {
            if (folderResult.isEmpty) {
              summaryMessage = 'Thư mục trống, không có file nào để xử lý.';
            } else {
              summaryMessage = `Đã xử lý ${folderResult.processedFiles} files, ${folderResult.processedFolders} thư mục con.`;
              if (folderResult.skippedFiles > 0) {
                summaryMessage += ` Bỏ qua ${folderResult.skippedFiles} files do lỗi.`;
              }
            }
          } else {
            summaryMessage = `Xử lý thư mục thất bại: ${folderResult.error || 'Lỗi không xác định'}`;
          }
          
          // Tính toán thời gian xử lý
          const processingTime = Math.round((Date.now() - startTime) / 1000);
          console.log(`✅ Hoàn tất xử lý thư mục sau ${processingTime} giây`);
          
          // Tìm folder con quan trọng nhất để sử dụng làm link chính
          let bestFolderLink = `https://drive.google.com/drive/folders/${targetFolderId}`;
          let bestFolderName = targetFolderName || 'Mặc định';
          let bestFolderId = targetFolderId;
          
          // Kiểm tra xem có folder con nào trong kết quả không
          if (folderResult.files && folderResult.files.length > 0) {
            console.log(`Tìm kiếm folder con trong ${folderResult.files.length} kết quả`);
            
            // Log chi tiết về tất cả các files/folders
            console.log("=== CHI TIẾT TẤT CẢ FILES/FOLDERS TRONG KẾT QUẢ ===");
            folderResult.files.forEach((item, idx) => {
              console.log(`Item #${idx}: name=${item.name}, type=${item.type}, id=${item.id || 'không có'}, newFileId=${item.newFileId || 'không có'}`);
              if (item.type === 'folder') {
                console.log(`  -> Folder details: isEmpty=${item.isEmpty}, processedFiles=${item.processedFiles}, targetFolderId=${item.targetFolderId || 'không có'}, link=${item.link || 'không có'}`);
              }
            });
            console.log("=== KẾT THÚC CHI TIẾT ===");
            
            // Tìm folder con đầu tiên
            const subFolder = folderResult.files.find(f => f.type === 'folder');
            if (subFolder) {
              console.log(`Đã tìm thấy folder con: ${subFolder.name} (ID: ${subFolder.id})`);
              
              // Ưu tiên sử dụng link trực tiếp từ folder con nếu có
              if (subFolder.link) {
                console.log(`Sử dụng link trực tiếp từ folder con: ${subFolder.link}`);
                bestFolderLink = subFolder.link;
                bestFolderName = subFolder.name;
                bestFolderId = subFolder.newFileId || subFolder.targetFolderId || subFolder.id;
              }
              // Nếu không có link trực tiếp, tạo link từ ID
              else if (subFolder.newFileId || subFolder.targetFolderId) {
                const folderId = subFolder.newFileId || subFolder.targetFolderId;
                console.log(`Tạo link từ ID folder con: ${folderId}`);
                bestFolderLink = `https://drive.google.com/drive/folders/${folderId}`;
                bestFolderName = subFolder.name;
                bestFolderId = folderId;
              }
              else {
                console.log(`Không tìm thấy ID hợp lệ cho folder con, sử dụng folder cha: ${targetFolderName} (ID: ${targetFolderId})`);
              }
            } else {
              console.log(`Không tìm thấy folder con, sử dụng folder cha: ${targetFolderName} (ID: ${targetFolderId})`);
            }
          } else {
            console.log(`Không có files/folders trong kết quả, sử dụng folder cha: ${targetFolderName} (ID: ${targetFolderId})`);
          }
          
          console.log(`Link folder được chọn: ${bestFolderLink} (${bestFolderName}, ID: ${bestFolderId})`);
          
          // Tạo đối tượng kết quả với đầy đủ thông tin
          const result = {
            success: folderResult.success,
            isFolder: true,
            originalFolder: {
              id: fileId,
              name: fileInfo.name,
              link: driveLink
            },
            targetFolder: {
              id: targetFolderId,
              name: targetFolderName || 'Mặc định',
              link: `https://drive.google.com/drive/folders/${targetFolderId}`
            },
            ownerInfo: ownerInfo, // Add owner information
            processedFiles: folderResult.processedFiles,
            processedFolders: folderResult.processedFolders,
            skippedFiles: folderResult.skippedFiles,
            errors: folderResult.errors,
            files: folderResult.files || [], // Đảm bảo files luôn được truyền đi
            processingTime: processingTime,
            summary: summaryMessage,
            // Thêm URL của folder đã xử lý để cập nhật trong sheet
            processedFile: {
              id: bestFolderId,
              name: bestFolderName,
              link: bestFolderLink
            }
          };
          
          // Log thông tin chi tiết về kết quả
          console.log(`Đã xử lý folder thành công. Số lượng files trong kết quả: ${result.files?.length || 0}`);
          
          return result;
        } else {
          // Xử lý file đơn lẻ
          console.log(`Phát hiện file đơn lẻ, tiến hành xử lý...`);
          
          // Kiểm tra MIME type có được hỗ trợ không
          if (!mimeType) {
            console.warn('MIME type không xác định, tiếp tục xử lý với rủi ro');
          } else if (!mimeType.includes('pdf') && 
                    !mimeType.includes('image') && 
                    !mimeType.includes('spreadsheet') && 
                    !mimeType.includes('excel') && 
                    !mimeType.includes('document') && 
                    !mimeType.includes('word') && 
                    !mimeType.includes('presentation') && 
                    !mimeType.includes('powerpoint') && 
                    !mimeType.includes('video') && 
                    !mimeType.includes('audio')) {
            console.warn(`MIME type không được hỗ trợ: ${mimeType}, file có thể không được xử lý đúng cách`);
          }
          
          // Kiểm tra xem file đã tồn tại trong thư mục đích chưa
          try {
            console.log(`Kiểm tra xem file "${fileInfo.name}" đã tồn tại trong thư mục đích chưa...`);
            
            // Tạo OAuth2 client với khả năng tự động refresh token
            const oauth2Client = createOAuth2Client(0);
            
            // Khởi tạo Drive API
            const drive = google.drive({ version: 'v3', auth: oauth2Client });
            
            // Xử lý tên file để sử dụng trong truy vấn
            const escapedFileName = fileInfo.name.replace(/'/g, "\\'");
            
            // Tìm các file trùng tên trong folder đích
            const existingFileResponse = await drive.files.list({
              q: `name='${escapedFileName}' and '${targetFolderId}' in parents and trashed=false`,
              fields: 'files(id, name, webViewLink, webContentLink)',
              spaces: 'drive'
            });
            
            // Nếu file đã tồn tại, trả về thông tin file đó mà không cần xử lý lại
            if (existingFileResponse.data.files && existingFileResponse.data.files.length > 0) {
              const existingFile = existingFileResponse.data.files[0];
              console.log(`✅ File "${fileInfo.name}" đã tồn tại trong thư mục đích (ID: ${existingFile.id}), bỏ qua xử lý`);
              
              // Nếu có yêu cầu cập nhật sheet, thực hiện cập nhật với link file đã tồn tại
              let sheetUpdateResult = null;
              if (updateSheet) {
                console.log('Yêu cầu cập nhật sheet được kích hoạt, tiến hành cập nhật với file đã tồn tại...');
                
                // Kiểm tra xem cần cập nhật vào database hay trực tiếp vào Google Sheet
                if (courseId && sheetIndex !== undefined && rowIndex !== undefined && cellIndex !== undefined) {
                  // Cập nhật vào database
                  sheetUpdateResult = await updateSheetCell(
                    courseId,
                    sheetIndex,
                    rowIndex,
                    cellIndex,
                    driveLink, // URL gốc
                    existingFile.webViewLink, // URL của file đã tồn tại
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
                    existingFile.webViewLink,
                    driveLink, // URL gốc
                    request // Pass the request object
                  );
                  
                  console.log('Kết quả cập nhật trực tiếp vào Google Sheet:', sheetUpdateResult);
                }
              }
              
              // Tính toán thời gian xử lý
              const processingTime = Math.round((Date.now() - startTime) / 1000);
              console.log(`✅ Hoàn tất xử lý sau ${processingTime} giây (sử dụng file đã tồn tại)`);
              
              // Trả về kết quả với file đã tồn tại
              return {
                success: true,
                isFolder: false,
                originalFile: {
                  id: fileId,
                  link: driveLink,
                  owner: ownerInfo // Thêm thông tin chủ sở hữu
                },
                targetFolder: {
                  id: targetFolderId,
                  name: targetFolderName || (courseName || 'Mặc định')
                },
                processedFile: {
                  id: existingFile.id,
                  name: existingFile.name,
                  link: existingFile.webViewLink
                },
                ownerInfo, // Thêm thông tin chủ sở hữu ở cấp cao nhất
                processingTime: processingTime,
                fileAlreadyExists: true,
                sheetUpdate: updateSheet ? {
                  success: sheetUpdateResult?.success || false,
                  message: sheetUpdateResult?.message || sheetUpdateResult?.error || 'Không có thông tin cập nhật',
                  details: sheetUpdateResult?.updatedCell || null
                } : null
              };
            }
            
            console.log(`File "${fileInfo.name}" chưa tồn tại trong thư mục đích, tiến hành xử lý...`);
          } catch (checkExistingError) {
            console.error(`Lỗi khi kiểm tra file đã tồn tại: ${checkExistingError.message}`);
            console.log(`Tiếp tục xử lý file...`);
          }
          
          // Tải xuống file
          console.log(`Đang xử lý yêu cầu tải xuống: ${driveLink}`);
          
          let downloadResult = await downloadFromGoogleDrive(fileId);
          tempDir = downloadResult.outputDir;
          
          let processedFilePath;
          let processedFileName = downloadResult.fileName;
          
          // Kiểm tra xem file có phải là file bị chặn đã được xử lý bởi drive-fix-blockdown không
          const isBlockedFileProcessed = downloadResult.fileName && downloadResult.fileName.includes('blocked_') && downloadResult.fileName.includes('_clean');
          
          if (isBlockedFileProcessed) {
            console.log('File đã được xử lý bởi drive-fix-blockdown, bỏ qua bước xử lý thông thường');
            processedFilePath = downloadResult.filePath;
          } else {
            // Kiểm tra loại file và xử lý tương ứng
            const mimeType = downloadResult.mimeType;
            console.log(`Xử lý file theo loại MIME: ${mimeType}`);
            
            if (mimeType.includes('pdf')) {
              // Xử lý file PDF - loại bỏ watermark như cũ
              console.log('Phát hiện file PDF, tiến hành xử lý xóa watermark...');
              
              // Xử lý file PDF để loại bỏ watermark
              const processResult = await processFile(downloadResult.filePath, downloadResult.mimeType, apiKey);
              processedFilePath = processResult.processedPath;
            } else {
              // Các loại file khác - chỉ tải xuống và upload lại không xử lý
              console.log(`Phát hiện file không phải PDF (${mimeType}), chỉ tải xuống và upload lại không xử lý`);
              
              // Tạo đường dẫn cho file không xử lý
              const fileDir = path.dirname(downloadResult.filePath);
              const fileExt = path.extname(downloadResult.filePath);
              const fileName = path.basename(downloadResult.filePath, fileExt);
              processedFilePath = path.join(fileDir, `${fileName}_uploaded${fileExt}`);
              
              // Sao chép file mà không xử lý
              fs.copyFileSync(downloadResult.filePath, processedFilePath);
              console.log(`Đã sao chép file không xử lý: ${processedFilePath}`);
            }
          }
          
          // Tải lên file đã xử lý, truyền targetFolderId
          const uploadResult = await uploadToGoogleDrive(
            processedFilePath,
            processedFileName,
            downloadResult.mimeType,
            targetFolderId,
            targetFolderName || courseName // Truyền folder name
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
          try {
            fs.rmdirSync(tempDir, { recursive: true });
            console.log(`Đã xóa thư mục tạm: ${tempDir}`);
          } catch (cleanupError) {
            console.error('Lỗi khi dọn dẹp thư mục tạm:', cleanupError);
          }
          
          // Tính toán thời gian xử lý
          const processingTime = Math.round((Date.now() - startTime) / 1000);
          console.log(`✅ Hoàn tất xử lý sau ${processingTime} giây`);
          
          // Trả về kết quả cho file đơn lẻ
          return {
            success: true,
            isFolder: false,
            originalFile: {
              id: fileId,
              link: driveLink,
              owner: ownerInfo // Thêm thông tin chủ sở hữu
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
            ownerInfo, // Thêm thông tin chủ sở hữu ở cấp cao nhất
            duplicatesDeleted: uploadResult.duplicatesDeleted || 0,
            processingTime: processingTime,
            sheetUpdate: updateSheet ? {
              success: sheetUpdateResult?.success || false,
              message: sheetUpdateResult?.message || sheetUpdateResult?.error || 'Không có thông tin cập nhật',
              details: sheetUpdateResult?.updatedCell || null
            } : null
          };
        }
      } catch (error) {
        console.error('Lỗi khi tải xuống hoặc xử lý file:', error);
        
        // Kiểm tra lỗi 404 - File không tồn tại
        if (error.message && (error.message.includes('404') || error.message.includes('không tồn tại'))) {
          console.error(`File không tồn tại (404): ${fileId}. Không thử lại.`);
          return {
            success: false, 
            error: `Không tìm thấy file với ID: ${fileId}. File có thể đã bị xóa hoặc không tồn tại.`,
            status: 404
          };
        }
        
        // Dọn dẹp thư mục tạm nếu có lỗi
        if (tempDir) {
          try {
            fs.rmdirSync(tempDir, { recursive: true });
            console.log(`Đã xóa thư mục tạm: ${tempDir}`);
          } catch (cleanupError) {
            console.error('Lỗi khi dọn dẹp thư mục tạm:', cleanupError);
          }
        }
        
        return {
          success: false, 
          error: `Lỗi khi xử lý và thay thế file: ${error.message}`,
          status: 500
        };
      }
    })();
    
    // Chạy với timeout
    const result = await Promise.race([processingPromise, timeoutPromise]);
    
    // Nếu kết quả có status code, sử dụng nó
    if (result.status) {
      return NextResponse.json(
        { success: result.success, error: result.error },
        { status: result.status }
      );
    }
    
    // Trả về kết quả thành công
    return NextResponse.json(result);
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
