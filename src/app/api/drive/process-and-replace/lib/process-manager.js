/**
 * process-manager.js
 * Module quản lý các quy trình xử lý file và thư mục
 */
import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { extractDriveFileId } from '@/utils/drive-utils';
import { checkMimeType } from './mime-service';
import { downloadFromGoogleDrive, checkFileInfo } from './download-service';
import { processFile } from './file-processor';
import { uploadToGoogleDrive, findOrCreateFolder } from './upload-service';
import { updateSheetCell, updateGoogleSheetCell } from './sheet-service';
import { processPDF } from '../../remove-watermark/lib/drive-fix-blockdown';

// Quản lý hàng đợi xử lý Chrome
let isProcessing = false;
const processingQueue = [];

/**
 * Thêm file vào hàng đợi xử lý Chrome
 * @param {Object} params - Thông số để xử lý file
 * @returns {Promise<Object>} - Kết quả xử lý
 */
export function addToProcessingQueue(params) {
  return new Promise((resolve, reject) => {
    const task = {
      ...params,
      startTime: Date.now(),
      resolve,
      reject
    };
    
    // Đảm bảo originalFileId luôn có giá trị để dùng cho việc đặt tên file
    if (!task.originalFileId && task.fileId) {
      task.originalFileId = task.fileId;
    }
    
    console.log(`\n📋 Thêm file vào hàng đợi xử lý Chrome:`);
    console.log(`🔍 File ID: ${params.fileId}`);
    console.log(`📄 Tên file: ${params.fileName || 'Không có tên'}`);
    console.log(`🗂️ Folder đích: ${params.folderName || params.targetFolderName || 'Không xác định'}`);
    console.log(`🔄 Loại lỗi: ${params.errorType || 'Không xác định'}`);
    console.log(`🔄 Original File ID: ${params.originalFileId || 'Không xác định'}`);
    console.log(`⏳ Thời gian thêm vào hàng đợi: ${new Date().toLocaleString()}`);
    console.log(`📊 Số lượng file trong hàng đợi: ${processingQueue.length}`);
    
    // Thêm log chi tiết nếu là lỗi 403 hoặc cannotDownloadFile
    if (params.errorType === "403" || params.originalError?.includes('cannotDownloadFile')) {
      console.log(`🚫 Phát hiện lỗi 403/cannotDownloadFile - Sẽ sử dụng Chrome để tải file`);
      console.log(`🔍 Chi tiết lỗi gốc: ${params.originalError || 'Không có thông tin lỗi gốc'}`);
    }
    
    processingQueue.push(task);
    
    // Thử xử lý ngay nếu không có file nào đang xử lý
    console.log(`🔄 Đang kiểm tra hàng đợi để xử lý ngay (isProcessing=${isProcessing})...`);
    processNextInQueue();
    
    // Trả về thông báo đã thêm vào hàng đợi
    return {
      status: 'queued',
      message: 'File đã được thêm vào hàng đợi xử lý Chrome',
      queuePosition: processingQueue.length,
      fileId: params.fileId,
      fileName: params.fileName
    };
  });
}

/**
 * Xử lý file tiếp theo trong hàng đợi
 */
export async function processNextInQueue() {
  if (isProcessing || processingQueue.length === 0) {
    if (isProcessing) {
      console.log(`⏳ Đang có file đang được xử lý, chờ đợi...`);
    } else if (processingQueue.length === 0) {
      console.log(`✅ Không có file nào trong hàng đợi cần xử lý`);
    }
    return;
  }
  
  isProcessing = true;
  const task = processingQueue.shift();
  
  try {
    console.log(`\n=== ĐANG XỬ LÝ FILE TRONG HÀNG ĐỢI ===`);
    console.log(`⏳ Còn ${processingQueue.length} file đang chờ...`);
    console.log(`📄 File ID: ${task.fileId}`);
    console.log(`📝 Tên file: ${task.fileName || 'Không có tên'}`);
    console.log(`🔄 Loại lỗi: ${task.errorType || 'Không xác định'}`);
    console.log(`🗂️ Folder đích: ${task.folderName || task.targetFolderName || 'Không xác định'}`);
    console.log(`🔄 Original File ID: ${task.originalFileId || 'Không xác định'}`);
    console.log(`⏱️ Thời gian bắt đầu xử lý: ${new Date().toLocaleString()}`);
    
    // Thêm log chi tiết nếu là lỗi 403 hoặc cannotDownloadFile
    if (task.errorType === "403" || task.originalError?.includes('cannotDownloadFile')) {
      console.log(`🚫 Bắt đầu xử lý file bị chặn (403/cannotDownloadFile) bằng Chrome`);
      console.log(`🔍 Chi tiết lỗi gốc: ${task.originalError || 'Không có thông tin lỗi gốc'}`);
    }
    
    // Đảm bảo có fileId
    if (!task.fileId) {
      if (task.driveLink) {
        try {
          const extracted = extractDriveFileId(task.driveLink);
          if (!extracted || !extracted.fileId) throw new Error('Không thể trích xuất fileId từ driveLink');
          task.fileId = extracted.fileId;
          console.log(`✅ Đã trích xuất fileId từ driveLink: ${task.fileId}`);
        } catch (error) {
          throw new Error(`Không thể trích xuất fileId từ driveLink: ${error.message}`);
        }
      } else {
        throw new Error('Không có fileId hoặc driveLink để xử lý');
      }
    }
    
    // Tạo thư mục tạm nếu chưa có
    const tempDir = task.tempDir || path.join(os.tmpdir(), uuidv4());
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log(`✅ Đã tạo thư mục tạm: ${tempDir}`);
    }
    
    // Tạo đường dẫn đầu ra
    const outputPath = path.join(tempDir, `TÀI LIỆU${task.fileId}_processed.pdf`);
    console.log(`📂 Đường dẫn đầu ra: ${outputPath}`);
    
    // Sử dụng Chrome để xử lý file
    console.log(`🌐 Bắt đầu sử dụng Chrome để tải file bị chặn: ${task.fileId}`);
    console.log(`⏳ Quá trình này có thể mất vài phút, vui lòng đợi...`);
    
    const chromeResult = await processPDF(
      null, // inputPath
      outputPath,
      {
        skipWatermarkRemoval: true,
        debugMode: false,
        tempDir: tempDir
      }, 
      true, // isBlocked
      task.fileId
    );

    // Xử lý kết quả từ Chrome
    if (chromeResult.success) {
      console.log(`✅ Đã tải thành công file bằng Chrome: ${chromeResult.filePath}`);
      
      const result = await processAndUploadFile({
        filePath: chromeResult.filePath,
        mimeType: 'application/pdf',
        fileId: task.fileId, // ID của file gốc
        originalFileId: task.originalFileId || task.fileId, // Sử dụng originalFileId nếu có
        driveLink: task.driveLink,
        targetFolderId: task.targetFolderId,
        folderName: task.folderName || task.targetFolderName, // Sử dụng folderName hoặc targetFolderName
        apiKey: task.apiKey,
        updateSheet: task.updateSheet,
        courseId: task.courseId,
        sheetIndex: task.sheetIndex,
        rowIndex: task.rowIndex,
        cellIndex: task.cellIndex,
        sheetId: task.sheetId,
        googleSheetName: task.googleSheetName,
        displayText: task.displayText,
        request: task.request,
        startTime: task.startTime,
        tempDir: tempDir,
        sourceType: task.errorType === "403" ? "403_chrome" : "404_chrome"
      });
      
      console.log(`✅ Đã xử lý và tải lên thành công file: ${result.processedPath || result.webViewLink || 'Không có link'}`);
      task.resolve(result);
    } else {
      console.log(`⚠️ Lỗi khi xử lý bằng Chrome: ${chromeResult.error || 'Không rõ lỗi'}`);
      console.log(`🔍 Chi tiết lỗi Chrome: `, chromeResult);
      
      // Trả về kết quả thất bại để không cập nhật sheet khi không có link mới
      task.resolve({
        success: false, // Đánh dấu thất bại để không cập nhật sheet
        skipWatermark: true,
        message: `Lỗi: ${chromeResult.error || 'Không thể xử lý bằng Chrome'}`,
        filePath: chromeResult.filePath || null,
        originalFile: {
          id: task.fileId,
          link: task.driveLink
        },
        // Thêm processedFile để tương thích với client-side code, nhưng đảm bảo success là false
        processedFile: {
          id: task.fileId,
          name: task.fileName,
          link: task.driveLink, // Vẫn giữ link gốc nhưng sẽ không cập nhật sheet do success=false
          webViewLink: task.driveLink,
          webContentLink: null
        }
      });
    }
  } catch (error) {
    console.error(`❌ Lỗi khi xử lý file trong hàng đợi: ${error.message}`);
    console.error(`🔍 Chi tiết lỗi:`, error);
    task.reject(error);
  } finally {
    isProcessing = false;
    console.log(`🔄 Hoàn thành xử lý file trong hàng đợi, tiếp tục kiểm tra hàng đợi...`);
    processNextInQueue();
  }
}

/**
 * Xử lý và tải lên file đã được tải xuống
 * @param {Object} params - Tham số cho việc xử lý và tải lên
 * @returns {Promise<Object>} - Kết quả xử lý
 */
export async function processAndUploadFile(params) {
  const {
    filePath,
    mimeType,
    fileId,
    originalFileId, // ID của file gốc để thêm vào tên file
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
    displayText, // displayText là tên file gốc
    request,
    startTime,
    tempDir,
    sourceType
  } = params;
  
  try {
    console.log(`🔧 Xử lý file...`);
    
    // Lưu tên file gốc cho việc sử dụng sau này
    const originalFileName = displayText || `file_${fileId}.pdf`;
    
    // Xử lý file để loại bỏ watermark
    const processResult = await processFile(filePath, mimeType || "application/pdf", apiKey, fileId)
      .catch(async (error) => {
        console.error(`❌ Lỗi khi xử lý file: ${error.message}`);
        
        // Kiểm tra nếu đây là lỗi từ API xử lý watermark
        if (error.message.includes('Lỗi khi xử lý PDF') || 
            error.message.includes('Xử lý thất bại') ||
            error.message.includes('Không thể xử lý PDF')) {
          
          console.log(`⚠️ Gặp lỗi từ API xử lý watermark, thử xử lý thay thế...`);
          
          // File quá lớn hoặc có vấn đề khi xử lý, thử sử dụng file gốc
          console.log(`⚠️ Sẽ sử dụng file gốc do không thể xử lý watermark`);
          
          return {
            success: true, // Đánh dấu thành công để tiếp tục quy trình
            processedPath: filePath, // Sử dụng file gốc
            skipWatermark: true,
            message: `Không thể xử lý watermark: ${error.message}`,
            originalFileName: originalFileName // Thêm tên file gốc vào kết quả
          };
        }
        
        // Các lỗi khác, ném lại để xử lý ở cấp cao hơn
        throw error;
      });

    // Thêm tên file gốc vào processResult nếu chưa có
    if (!processResult.originalFileName) {
      processResult.originalFileName = originalFileName;
    }

    // Kiểm tra các trường hợp đặc biệt
    if (processResult && !processResult.success) {
      // Trường hợp file quá lớn
      if (processResult.skipReason === 'FILE_TOO_LARGE') {
        return {
          success: true, // Thay đổi từ false sang true để tiếp tục quy trình
          skipped: false, // Thay đổi từ true sang false để không bỏ qua xử lý
          reason: 'FILE_TOO_LARGE',
          message: processResult.message || processResult.error,
          originalFile: {
            id: fileId,
            link: driveLink,
            size: processResult.fileSizeMB
          },
          processingTime: Math.round((Date.now() - startTime) / 1000),
          originalFileName: originalFileName // Thêm tên file gốc
        };
      }
      
      // Trường hợp file là video
      if (processResult.isVideo) {
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
    }
    
    // Thêm xử lý cho file đã bỏ qua việc xóa watermark
    if (processResult && processResult.skipWatermark) {
      console.log(`⚠️ Bỏ qua xử lý watermark do gặp lỗi: ${processResult.message || 'Không rõ lý do'}`);
    }
    
    // Lấy đường dẫn đến file đã xử lý
    let processedFilePath = processResult.processedPath;
    
    // Xử lý trường hợp đặc biệt khi processedPath là đối tượng
    if (typeof processedFilePath === 'object' && processedFilePath !== null) {
      if (processedFilePath.path) {
        processedFilePath = processedFilePath.path;
      } else {
        const fileDir = path.dirname(filePath);
        const fileExt = path.extname(filePath);
        const fileName = path.basename(filePath, fileExt);
        processedFilePath = path.join(fileDir, `${fileName}_processed${fileExt}`);
        
        if (!fs.existsSync(processedFilePath)) {
          throw new Error(`File đã xử lý không tồn tại tại đường dẫn ${processedFilePath}`);
        }
      }
    }
    
    // Đảm bảo có folderName để luôn upload vào folder con
    const finalFolderName = folderName || 'Unknown';
    console.log(`🗂️ Đảm bảo upload vào folder con: ${finalFolderName}`);
    
    // Sử dụng originalFileId nếu có, nếu không thì sử dụng fileId
    const idForFileName = originalFileId || fileId;
    console.log(`🏷️ Sử dụng ID cho tên file: ${idForFileName}`);
    
    // Upload file đã xử lý
    const uploadResult = await uploadToGoogleDrive(
      processedFilePath,
      processResult.originalFileName || path.basename(processedFilePath), // Sử dụng tên file gốc nếu có
      mimeType || "application/pdf",
      targetFolderId,
      finalFolderName, // Luôn sử dụng folderName
      idForFileName // Thêm ID của file gốc để thêm vào tên file
    );
    
    if (!uploadResult.success) {
      console.error(`Lỗi khi upload file ${processResult.originalFileName || path.basename(processedFilePath)}:`, uploadResult.error);
      throw new Error(`Không thể upload file: ${uploadResult.error}`);
    }
    
    // Kiểm tra nếu file đã tồn tại và sử dụng link hiện có
    if (uploadResult.isExisting) {
      console.log(`✅ Phát hiện file đã tồn tại trên Drive, sử dụng link hiện có`);
      console.log(`🔗 Link file hiện có: ${uploadResult.webViewLink}`);
    } else {
      console.log(`✅ Đã upload file mới thành công: ${uploadResult.fileName}`);
    }
    
    // Dọn dẹp thư mục tạm
    try {
      fs.rmdirSync(tempDir, { recursive: true });
    } catch (cleanupError) {
      console.error(`Lỗi khi dọn dẹp thư mục tạm: ${cleanupError.message}`);
    }
    
    // Xử lý cập nhật sheet nếu cần
    let sheetUpdateResult = null;
    if (updateSheet) {
      console.log(`\n📝 Đang xử lý cập nhật sheet...`);
      console.log(`- courseId: ${courseId || 'không có'}`);
      console.log(`- sheetIndex: ${sheetIndex !== undefined ? sheetIndex : 'không có'}`);
      console.log(`- sheetId: ${sheetId || 'không có'}`);
      console.log(`- googleSheetName: ${googleSheetName || 'không có'}`);
      console.log(`- rowIndex: ${rowIndex !== undefined ? rowIndex : 'không có'}`);
      console.log(`- cellIndex: ${cellIndex !== undefined ? cellIndex : 'không có'}`);
      
      try {
        if (courseId && sheetIndex !== undefined && rowIndex !== undefined && cellIndex !== undefined) {
          console.log(`🔄 Cập nhật sheet cho khóa học: courseId=${courseId}, sheetIndex=${sheetIndex}, rowIndex=${rowIndex}, cellIndex=${cellIndex}`);
          
          const originalUrl = driveLink || `https://drive.google.com/file/d/${fileId}/view`;
          const newUrl = uploadResult.webViewLink || processResult.webViewLink || `https://drive.google.com/file/d/${uploadResult.fileId}/view?usp=drivesdk`;
          const cellText = displayText || path.basename(processedFilePath);
          
          console.log(`🔗 URL gốc: ${originalUrl}`);
          console.log(`🔗 URL mới: ${newUrl}`);
          console.log(`📄 Text hiển thị: ${cellText}`);
          
          // Thêm thông tin nếu file đã tồn tại
          if (uploadResult.isExisting) {
            console.log(`ℹ️ Sử dụng link file đã tồn tại để cập nhật sheet`);
          }
          
          sheetUpdateResult = await updateSheetCell(
            courseId,
            sheetIndex,
            rowIndex,
            cellIndex,
            originalUrl,
            newUrl,
            cellText,
            request,
            {
              skipProcessing: processResult && processResult.skipWatermark,
              originalLink: originalUrl,
              isExisting: uploadResult.isExisting // Thêm thông tin file đã tồn tại
            }
          );
          
          if (sheetUpdateResult?.success) {
            console.log(`✅ Đã cập nhật sheet thành công!`);
          } else {
            console.error(`❌ Lỗi khi cập nhật sheet: ${sheetUpdateResult?.error || 'Không rõ lỗi'}`);
          }
        } else if (sheetId && googleSheetName && rowIndex !== undefined && cellIndex !== undefined) {
          console.log(`🔄 Cập nhật Google Sheet: sheetId=${sheetId}, sheetName=${googleSheetName}, rowIndex=${rowIndex}, cellIndex=${cellIndex}`);
          
          const cellDisplayText = displayText || 'Tài liệu đã xử lý';
          const originalUrl = driveLink || `https://drive.google.com/file/d/${fileId}/view`;
          const newUrl = uploadResult.webViewLink || processResult.webViewLink || `https://drive.google.com/file/d/${uploadResult.fileId}/view?usp=drivesdk`;
          
          console.log(`🔗 URL gốc: ${originalUrl}`);
          console.log(`🔗 URL mới: ${newUrl}`);
          console.log(`📄 Text hiển thị: ${cellDisplayText}`);
          
          // Thêm thông tin nếu file đã tồn tại
          if (uploadResult.isExisting) {
            console.log(`ℹ️ Sử dụng link file đã tồn tại để cập nhật Google Sheet`);
          }
          
          sheetUpdateResult = await updateGoogleSheetCell(
            sheetId,
            googleSheetName,
            rowIndex,
            cellIndex,
            cellDisplayText,
            newUrl,
            originalUrl,
            request,
            {
              skipProcessing: processResult && processResult.skipWatermark,
              originalLink: originalUrl,
              isExisting: uploadResult.isExisting // Thêm thông tin file đã tồn tại
            }
          );
          
          if (sheetUpdateResult?.success) {
            console.log(`✅ Đã cập nhật Google Sheet thành công!`);
          } else {
            console.error(`❌ Lỗi khi cập nhật Google Sheet: ${sheetUpdateResult?.error || 'Không rõ lỗi'}`);
          }
        } else {
          console.warn(`⚠️ Thiếu thông tin cần thiết để cập nhật sheet`);
          sheetUpdateResult = {
            success: false,
            error: 'Thiếu thông tin cần thiết để cập nhật sheet'
          };
        }
      } catch (updateError) {
        console.error(`❌ Lỗi ngoại lệ khi cập nhật sheet: ${updateError.message}`);
        sheetUpdateResult = {
          success: false,
          error: `Lỗi khi cập nhật sheet: ${updateError.message}`
        };
      }
    }
    
    // Dọn dẹp thư mục tạm
    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Lỗi khi dọn dẹp thư mục tạm:', cleanupError);
      }
    }
    
    // Trả về kết quả xử lý
    return {
      success: true,
      processedPath: uploadResult.webViewLink, // Trả về link mới
      message: processResult.skipWatermark 
        ? `Đã bỏ qua mọi xử lý, chỉ sao chép file gốc`
        : (uploadResult.isExisting 
            ? `File đã tồn tại trên Drive, sử dụng link hiện có` 
            : 'File đã được xử lý và upload thành công'),
      skipProcessing: processResult.skipProcessing || false,
      isExisting: uploadResult.isExisting || false,
      processingMode: sourceType || 'normal',
      sheetUpdateResult: sheetUpdateResult,
      // Thêm processedFile để tương thích với client-side code
      processedFile: {
        id: uploadResult.fileId,
        name: uploadResult.fileName,
        link: uploadResult.webViewLink,
        webViewLink: uploadResult.webViewLink,
        webContentLink: uploadResult.webContentLink
      }
    };
  } catch (error) {
    console.error(`❌ Lỗi khi xử lý và upload file: ${error.message}`);
    throw error;
  }
}

/**
 * Kiểm tra file đã tồn tại trong thư mục đích chưa
 * @param {string} fileName - Tên file cần kiểm tra
 * @param {string} parentId - ID của thư mục cha
 * @param {Object} drive - Đối tượng Google Drive API
 * @returns {Promise<Object>} - Kết quả kiểm tra
 */
export async function checkFileExistsInTarget(fileName, parentId, drive) {
  try {
    const response = await drive.files.list({
      q: `'${parentId}' in parents and name = '${fileName}' and trashed = false`,
      fields: 'files(id, name, webViewLink, mimeType)',
      supportsAllDrives: true
    });

    if (response.data.files.length > 0) {
      const existingFile = response.data.files[0];
      return {
        exists: true,
        file: existingFile
      };
    }

    return {
      exists: false
    };
  } catch (error) {
    console.error(`❌ Lỗi kiểm tra file:`, error);
    throw error;
  }
}

/**
 * Xử lý một file đơn lẻ
 * @param {Object} file - Thông tin file cần xử lý
 * @param {Object} options - Các tùy chọn xử lý
 * @returns {Promise<Object>} - Kết quả xử lý
 */
export async function processSingleFile(file, options) {
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
    folderName
  } = options;
  
  try {
    console.log(`\n🔄 Bắt đầu xử lý file: ${displayText || file.name} (${file.id})`);
    
    // Tạo thư mục tạm
    const tempDir = path.join(os.tmpdir(), uuidv4());
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Xác định loại file từ mimeType và tên file
    let fileExtension = '.pdf'; // Mặc định là .pdf
    
    if (file.mimeType) {
      if (file.mimeType.includes('pdf')) {
        fileExtension = '.pdf';
      } else if (file.mimeType.includes('image/jpeg') || file.mimeType.includes('image/jpg')) {
        fileExtension = '.jpg';
      } else if (file.mimeType.includes('image/png')) {
        fileExtension = '.png';
      } else if (file.mimeType.includes('video')) {
        // Xác định loại video từ mimeType
        if (file.mimeType.includes('mp4')) {
          fileExtension = '.mp4';
        } else if (file.mimeType.includes('webm')) {
          fileExtension = '.webm';
        } else if (file.mimeType.includes('avi')) {
          fileExtension = '.avi';
        } else {
          fileExtension = '.mp4'; // Default cho video
        }
      }
    } else {
      // Nếu không có mimeType, thử đoán từ tên file
      const fileName = file.name || displayText || '';
      if (fileName.toLowerCase().endsWith('.pdf')) {
        fileExtension = '.pdf';
      } else if (fileName.toLowerCase().endsWith('.jpg') || fileName.toLowerCase().endsWith('.jpeg')) {
        fileExtension = '.jpg';
      } else if (fileName.toLowerCase().endsWith('.png')) {
        fileExtension = '.png';
      } else if (fileName.toLowerCase().endsWith('.mp4')) {
        fileExtension = '.mp4';
      } else if (fileName.toLowerCase().endsWith('.webm')) {
        fileExtension = '.webm';
      } else if (fileName.toLowerCase().endsWith('.avi')) {
        fileExtension = '.avi';
      }
    }
    
    // Tạo tên file tạm
    const tempFileName = `${uuidv4()}${fileExtension}`;
    const tempFilePath = path.join(tempDir, tempFileName);
    
    // Tải file về máy chủ
    console.log(`📥 Đang tải file: ${file.name || 'Không có tên'} (${file.id})`);
    
    try {
      await downloadFromGoogleDrive(file.id, tempFilePath);
    } catch (downloadError) {
      console.error(`❌ Lỗi tải file: ${downloadError.message}`);
      
      // Kiểm tra nếu đây là lỗi 403 (Access Denied)
      if (downloadError.message.includes('403') || 
          downloadError.message.includes('Access denied') ||
          downloadError.message.includes('Permission') ||
          downloadError.message.includes('access')) {
        throw new Error(`cannotDownloadFile: ${downloadError.message}`);
      }
      
      throw downloadError;
    }
    
    // Xử lý và upload file
    console.log(`🔄 File đã tải về: ${tempFilePath}, đang xử lý và upload...`);
    
    const processingOptions = {
      filePath: tempFilePath,
      mimeType: file.mimeType,
      fileId: file.id, // Truyền ID của file gốc
      originalFileId: options.originalFileId || file.id, // Sử dụng originalFileId từ options nếu có, không thì dùng file.id
      driveLink: `https://drive.google.com/file/d/${file.id}/view`,
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
      displayText: displayText || file.name,
      request,
      startTime: Date.now(),
      tempDir
    };
    
    // Sử dụng processAndUploadFile để xử lý tiếp file
    const result = await processAndUploadFile(processingOptions);
    
    // Thêm log nếu file đã tồn tại
    if (result.isExisting) {
      console.log(`✅ Phát hiện file đã tồn tại trên Drive với tên: ${file.name}`);
      console.log(`🔗 Sử dụng link file hiện có: ${result.processedFile?.link || 'Không có link'}`);
    }
    
    return {
      success: true,
      ...result
    };
  } catch (error) {
    console.error(`❌ Lỗi xử lý file: ${error.message}`);
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Xử lý folder theo kiểu đệ quy
 * @param {string} folderId - ID của folder
 * @param {Object} options - Các tùy chọn cho việc xử lý
 * @param {Object} parentFolderInfo - Thông tin về folder cha (cho đệ quy)
 * @param {number} depth - Độ sâu hiện tại (cho đệ quy)
 * @returns {Promise<Object>} - Kết quả xử lý
 */
export async function processFolder(folderId, options, parentFolderInfo = null, depth = 0) {
  const indent = '  '.repeat(depth);
  
  try {
    console.log(`\n${indent}📂 Bắt đầu xử lý thư mục: ${folderId}`);
    console.log(`${indent}📂 DEBUG: Options = ${JSON.stringify({
      ...options,
      request: '[REQUEST OBJECT]' // Không in request object
    }, null, 2)}`);
    
    // Kiểm tra input
    if (!folderId) {
      throw new Error('Thiếu folderId để xử lý');
    }
    
    if (!options.targetFolderId) {
      throw new Error('Thiếu targetFolderId để lưu kết quả');
    }
    
    // Import hàm getTokenByType từ utils
    const { getTokenByType } = await import('./utils.js');
    
    // Lấy token upload và download
    const uploadToken = await getTokenByType('upload');
    const downloadToken = await getTokenByType('download');
    
    // Kiểm tra token
    if (!uploadToken || !downloadToken) {
      throw new Error('Không tìm thấy token Google Drive hợp lệ');
    }

    const uploadOAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    uploadOAuth2Client.setCredentials(uploadToken);
    
    const downloadOAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    downloadOAuth2Client.setCredentials(downloadToken);
    
    const uploadDrive = google.drive({ version: 'v3', auth: uploadOAuth2Client });
    const downloadDrive = google.drive({ version: 'v3', auth: downloadOAuth2Client });
    
    // Lấy thông tin về thư mục nguồn
    console.log(`${indent}📂 DEBUG: Đang lấy thông tin thư mục nguồn: ${folderId}`);
    const folder = await downloadDrive.files.get({
      fileId: folderId,
      fields: 'name,parents,driveId',
      supportsAllDrives: true
    }).catch(error => {
      console.error(`${indent}❌ Lỗi lấy thông tin thư mục: ${error.message}`);
      throw new Error(`Không thể lấy thông tin thư mục: ${error.message}`);
    });
    
    console.log(`${indent}📂 DEBUG: Thông tin thư mục nguồn: Name=${folder.data.name}, Parents=${folder.data.parents}`);
    
    // Xác định thư mục cha mới
    const newParentId = parentFolderInfo ? parentFolderInfo.id : options.targetFolderId;
    console.log(`${indent}📂 DEBUG: Thư mục cha mới: ${newParentId}`);
    
    // Tìm hoặc tạo thư mục mới trong thư mục đích
    const escapedFolderName = folder.data.name.replace(/'/g, "\\'");
    const searchQuery = `'${newParentId}' in parents and name = '${escapedFolderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    
    console.log(`${indent}📂 DEBUG: Tìm thư mục trong đích với query: ${searchQuery}`);
    const existingFolders = await uploadDrive.files.list({
      q: searchQuery,
      fields: 'files(id, name, webViewLink)',
      supportsAllDrives: true
    }).catch(error => {
      console.error(`${indent}❌ Lỗi tìm thư mục trong đích: ${error.message}`);
      throw new Error(`Không thể tìm kiếm thư mục trong đích: ${error.message}`);
    });
    
    let newFolder;
    if (existingFolders.data.files && existingFolders.data.files.length > 0) {
      newFolder = { data: existingFolders.data.files[0] };
      console.log(`${indent}📂 Sử dụng thư mục tồn tại: ${newFolder.data.name} (${newFolder.data.id})`);
      console.log(`${indent}📂 DEBUG: Link thư mục tồn tại: ${newFolder.data.webViewLink}`);
    } else {
      console.log(`${indent}📂 Cần tạo thư mục mới với tên: ${folder.data.name}`);
      
      const folderMetadata = {
        name: folder.data.name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [newParentId]
      };
      
      try {
        newFolder = await uploadDrive.files.create({
          resource: folderMetadata,
          fields: 'id,name,webViewLink',
          supportsAllDrives: true
        });
        
        console.log(`${indent}📂 Đã tạo thư mục mới: ${newFolder.data.name} (${newFolder.data.id})`);
        console.log(`${indent}📂 DEBUG: Link thư mục mới: ${newFolder.data.webViewLink}`);
      } catch (createError) {
        console.error(`${indent}❌ Lỗi tạo thư mục: ${createError.message}`);
        throw new Error(`Không thể tạo thư mục mới: ${createError.message}`);
      }
    }
    
    // Lấy danh sách file và thư mục con
    console.log(`${indent}📂 DEBUG: Lấy danh sách file và thư mục con trong: ${folderId}`);
    
    // Chuẩn bị tham số cho việc liệt kê file
    const listParams = {
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType), nextPageToken',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    };
    
    // Thêm driveId nếu có
    if (folder.data.driveId) {
      console.log(`${indent}📂 DEBUG: Sử dụng driveId: ${folder.data.driveId}`);
      listParams.driveId = folder.data.driveId;
      listParams.corpora = 'drive';
    }
    
    // Thực hiện API call
    console.log(`${indent}📂 DEBUG: Gọi API với tham số: ${JSON.stringify(listParams)}`);
    const listResult = await downloadDrive.files.list(listParams).catch(error => {
      console.error(`${indent}❌ Lỗi lấy danh sách file: ${error.message}`);
      throw new Error(`Không thể lấy danh sách file trong thư mục: ${error.message}`);
    });
    
    let files = listResult.data.files || [];
    console.log(`${indent}📂 Tìm thấy ${files.length} file/folder trong thư mục nguồn`);
    
    // Nếu không tìm thấy file nào, thử phương pháp thay thế
    if (files.length === 0) {
      console.log(`${indent}⚠️ Không tìm thấy file, thử phương pháp thay thế...`);
      
      try {
        // Phương pháp 1: Sử dụng corpora='allDrives'
        console.log(`${indent}📂 Phương pháp 1: Sử dụng corpora='allDrives'...`);
        const altParams = {
          q: `'${folderId}' in parents and trashed = false`,
          fields: 'files(id, name, mimeType)',
          pageSize: 100,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          corpora: 'allDrives'
        };
        
        console.log(`${indent}📂 DEBUG: Gọi API thay thế với tham số: ${JSON.stringify(altParams)}`);
        const alternativeListResult = await downloadDrive.files.list(altParams);
        const alternativeFiles = alternativeListResult.data.files || [];
        
        if (alternativeFiles.length > 0) {
          console.log(`${indent}✅ Phương pháp thay thế thành công: Tìm thấy ${alternativeFiles.length} file/folder`);
          files = alternativeFiles;
        } else {
          // Phương pháp 2: Sử dụng corpora='user'
          console.log(`${indent}📂 Phương pháp 2: Thử với corpora='user'...`);
          const altParams2 = {
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType)',
            pageSize: 100,
            corpora: 'user'
          };
          
          const alternativeListResult2 = await downloadDrive.files.list(altParams2);
          const alternativeFiles2 = alternativeListResult2.data.files || [];
          
          if (alternativeFiles2.length > 0) {
            console.log(`${indent}✅ Phương pháp 2 thành công: Tìm thấy ${alternativeFiles2.length} file/folder`);
            files = alternativeFiles2;
          } else {
            // Phương pháp 3: Kiểm tra chi tiết về thư mục được chia sẻ và thử truy cập với token khác
            console.log(`${indent}📂 Phương pháp 3: Kiểm tra chi tiết thư mục được chia sẻ...`);
            
            try {
              // Import hàm checkSharedFolderDetails từ utils
              const { checkSharedFolderDetails } = await import('./utils.js');
              const sharedDetails = await checkSharedFolderDetails(folderId);
              
              if (sharedDetails.success && sharedDetails.fileCount > 0) {
                console.log(`${indent}📂 Phát hiện ${sharedDetails.fileCount} file trong kiểm tra chi tiết`);
                
                if (sharedDetails.driveId) {
                  console.log(`${indent}📂 Thử liệt kê với driveId: ${sharedDetails.driveId}`);
                  
                  const tokenType = sharedDetails.tokenType || 'download';
                  const token = await getTokenByType(tokenType);
                  
                  if (token) {
                    const oauth2Client = new google.auth.OAuth2(
                      process.env.GOOGLE_CLIENT_ID,
                      process.env.GOOGLE_CLIENT_SECRET,
                      process.env.GOOGLE_REDIRECT_URI
                    );
                    oauth2Client.setCredentials(token);
                    const detailDrive = google.drive({ version: 'v3', auth: oauth2Client });
                    
                    const detailListResult = await detailDrive.files.list({
                      q: `'${folderId}' in parents and trashed = false`,
                      fields: 'files(id, name, mimeType)',
                      pageSize: 100,
                      supportsAllDrives: true,
                      includeItemsFromAllDrives: true,
                      driveId: sharedDetails.driveId,
                      corpora: 'drive'
                    });
                    
                    const detailFiles = detailListResult.data.files || [];
                    console.log(`${indent}📂 Liệt kê với phương pháp 3: Tìm thấy ${detailFiles.length} file/folder`);
                    
                    if (detailFiles.length > 0) {
                      files = detailFiles;
                    }
                  }
                }
              }
            } catch (error) {
              console.error(`${indent}❌ Lỗi với phương pháp 3: ${error.message}`);
            }
          }
        }
      } catch (altError) {
        console.error(`${indent}❌ Lỗi khi thử phương pháp thay thế: ${altError.message}`);
        // Không throw error, tiếp tục với files rỗng
      }
      
      console.log(`${indent}📂 Sau khi thử các phương pháp: Tìm thấy ${files.length} file/folder`);
    }
    
    // Kết quả xử lý
    const results = {
      success: true,
      isFolder: true,
      folderId: folderId,
      folderName: folder.data.name,
      originalFolderLink: options.originalFolderLink || `https://drive.google.com/drive/folders/${folderId}`,
      folderLink: newFolder.data.webViewLink,
      processedFolderLink: newFolder.data.webViewLink,
      processedFiles: [],
      skippedFiles: [],
      errors: [],
      subFolders: []
    };
    
    // Xử lý các thư mục con trước
    const subFolders = files.filter(file => file.mimeType === 'application/vnd.google-apps.folder');
    for (const subFolder of subFolders) {
      try {
        console.log(`${indent}📂 Xử lý thư mục con: ${subFolder.name} (${subFolder.id})`);
        
        // Đảm bảo tham số sheetFolderName được truyền khi gọi đệ quy
        const subFolderOptions = {
          ...options,
          sheetFolderName: options.sheetFolderName || options.folderName // Bảo toàn tên folder gốc
        };
        
        console.log(`${indent}📂 Truyền tham số cho thư mục con: sheetFolderName=${subFolderOptions.sheetFolderName}, folderName=${options.folderName}`);
        
        const subFolderResult = await processFolder(
          subFolder.id,
          subFolderOptions,
          {
            id: newFolder.data.id,
            name: newFolder.data.name
          },
          depth + 1
        );
        
        results.subFolders.push({
          id: subFolder.id,
          name: subFolder.name,
          processedFiles: subFolderResult.processedFiles ? subFolderResult.processedFiles.length : 0,
          skippedFiles: subFolderResult.skippedFiles ? subFolderResult.skippedFiles.length : 0,
          errors: subFolderResult.errors ? subFolderResult.errors.length : 0
        });
        
        // Cập nhật kết quả tổng
        if (subFolderResult.processedFiles) {
          results.processedFiles = results.processedFiles.concat(subFolderResult.processedFiles);
        }
        if (subFolderResult.skippedFiles) {
          results.skippedFiles = results.skippedFiles.concat(subFolderResult.skippedFiles);
        }
        if (subFolderResult.errors) {
          results.errors = results.errors.concat(subFolderResult.errors);
        }
      } catch (folderError) {
        console.error(`${indent}❌ Lỗi xử lý thư mục con ${subFolder.name}:`, folderError);
        results.errors.push({
          id: subFolder.id,
          name: subFolder.name,
          error: folderError.message
        });
      }
    }
    
    // Xử lý các file
    const nonFolders = files.filter(file => file.mimeType !== 'application/vnd.google-apps.folder');
    for (const file of nonFolders) {
      try {
        console.log(`${indent}📄 Xử lý file: ${file.name} (${file.id})`);
        
        // Kiểm tra MIME type
        const mimeTypeResult = await checkMimeType(file.id);
        
        if (mimeTypeResult.success && (mimeTypeResult.isPdf || file.mimeType.includes('video'))) {
          const fileOptions = {
            ...options,
            targetFolderId: newFolder.data.id,
            folderName: options.sheetFolderName || options.folderName || newFolder.data.name,
            originalFileId: file.id // Thêm ID file gốc để đảm bảo tên file không trùng lặp
          };
          
          console.log(`${indent}📝 Tham số folderName: ${fileOptions.folderName}, sheetFolderName: ${options.sheetFolderName}`);
          console.log(`${indent}📝 Sử dụng originalFileId: ${fileOptions.originalFileId}`);
          
          const fileResult = await processSingleFile(file, fileOptions);
          
          if (fileResult.success && !fileResult.skipped) {
            // Kiểm tra nếu file đã tồn tại
            if (fileResult.isExisting) {
              console.log(`${indent}✅ Phát hiện file đã tồn tại trên Drive: ${file.name}`);
              console.log(`${indent}🔗 Sử dụng link hiện có thay vì tạo mới`);
            } else {
              console.log(`${indent}✅ File đã xử lý thành công: ${file.name}`);
            }
            
            results.processedFiles.push({
              id: file.id,
              name: file.name,
              type: mimeTypeResult.isPdf ? 'pdf' : 'video',
              result: fileResult,
              isExisting: fileResult.isExisting || false
            });
          } else if (fileResult.skipped) {
            console.log(`${indent}⚠️ File đã bị bỏ qua: ${file.name}`);
            results.skippedFiles.push({
              id: file.id,
              name: file.name,
              reason: fileResult.reason || 'Không rõ lý do'
            });
          } else {
            console.error(`${indent}❌ Lỗi xử lý: ${file.name}`);
            results.errors.push({
              id: file.id,
              name: file.name,
              error: fileResult.error
            });
          }
        } else {
          console.log(`${indent}⚠️ Bỏ qua file không được hỗ trợ: ${file.name}`);
          results.skippedFiles.push({
            id: file.id,
            name: file.name,
            reason: `Không phải file PDF hoặc video (${mimeTypeResult.mimeType})`
          });
        }
      } catch (fileError) {
        console.error(`${indent}❌ Lỗi xử lý file ${file.name}:`, fileError);
        results.errors.push({
          id: file.id,
          name: file.name,
          error: fileError.message
        });
      }
    }
    
    // Thực hiện cập nhật sheet nếu đây là thư mục gốc và cần cập nhật
    if (!parentFolderInfo && options.updateSheet) {
      try {
        console.log(`\n${indent}📝 Cập nhật liên kết thư mục trong sheet...`);
        
        // Đảm bảo có folderLink để cập nhật
        const linkToUpdate = results.folderLink || results.originalFolderLink;
        if (!linkToUpdate) {
          console.warn(`${indent}⚠️ Không có liên kết thư mục để cập nhật trong sheet`);
          results.sheetUpdate = {
            success: false,
            message: 'Không có liên kết thư mục để cập nhật'
          };
        } else {
          let sheetUpdateResult;
          if (options.courseId && options.sheetIndex !== undefined && 
              options.rowIndex !== undefined && options.cellIndex !== undefined) {
              
            sheetUpdateResult = await updateSheetCell(
              options.courseId,
              options.sheetIndex,
              options.rowIndex,
              options.cellIndex,
              results.originalFolderLink,
              linkToUpdate,
              options.displayText || results.folderName,
              options.request
            );
            
          } else if (options.sheetId && options.googleSheetName && 
                    options.rowIndex !== undefined && options.cellIndex !== undefined) {
                    
            sheetUpdateResult = await updateGoogleSheetCell(
              options.sheetId,
              options.googleSheetName,
              options.rowIndex,
              options.cellIndex,
              options.displayText || results.folderName,
              linkToUpdate,
              results.originalFolderLink,
              options.request
            );
          }
          
          if (!sheetUpdateResult || !sheetUpdateResult.success) {
            results.sheetUpdate = {
              success: false,
              message: `Lỗi cập nhật sheet: ${sheetUpdateResult?.error || 'Không rõ lỗi'}`,
              details: sheetUpdateResult
            };
          } else {
            results.sheetUpdate = {
              success: true,
              message: 'Sheet đã được cập nhật thành công',
              details: sheetUpdateResult
            };
          }
        }
      } catch (sheetError) {
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
    
    // Trả về một đối tượng kết quả với thông tin lỗi
    let folderName = 'Unknown Folder';
    let originalFolderLink = `https://drive.google.com/drive/folders/${folderId}`;
    
    // Đảm bảo biến folder tồn tại trước khi sử dụng
    if (options && options.originalFolderLink) {
      originalFolderLink = options.originalFolderLink;
    }
    
    // Nếu folder đã được định nghĩa, sử dụng tên của nó
    try {
      if (typeof folder !== 'undefined' && folder && folder.data && folder.data.name) {
        folderName = folder.data.name;
      }
    } catch (nameError) {
      console.error(`${indent}❌ Không thể lấy tên thư mục:`, nameError);
    }
    
    return {
      success: false,
      isFolder: true,
      folderId: folderId,
      folderName: folderName,
      originalFolderLink: originalFolderLink,
      folderLink: null, // Không có link đã xử lý vì xử lý thất bại
      processedFolderLink: null, // Thêm trường này để tránh lỗi undefined
      error: error.message,
      processedFiles: [],
      skippedFiles: [],
      errors: [{ message: error.message }],
      subFolders: []
    };
  }
} 
