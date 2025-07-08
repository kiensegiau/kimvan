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
import { downloadWithCookie } from './cookie-service';

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
    
    console.log(`\n📋 Thêm file vào hàng đợi xử lý Chrome:`);
    console.log(`🔍 File ID: ${params.fileId}`);
    console.log(`📄 Tên file: ${params.fileName || 'Không có tên'}`);
    
    processingQueue.push(task);
    processNextInQueue(); // Thử xử lý ngay nếu không có file nào đang xử lý
  });
}

/**
 * Xử lý file tiếp theo trong hàng đợi
 */
export async function processNextInQueue() {
  if (isProcessing || processingQueue.length === 0) return;
  
  isProcessing = true;
  const task = processingQueue.shift();
  
  try {
    console.log(`\n=== ĐANG XỬ LÝ FILE TRONG HÀNG ĐỢI ===`);
    console.log(`⏳ Còn ${processingQueue.length} file đang chờ...`);
    
    // Đảm bảo có fileId
    if (!task.fileId) {
      if (task.driveLink) {
        try {
          task.fileId = extractDriveFileId(task.driveLink);
          if (!task.fileId) throw new Error('Không thể trích xuất fileId từ driveLink');
        } catch (error) {
          throw new Error('Không thể trích xuất fileId từ driveLink');
        }
      } else {
        throw new Error('Không có fileId hoặc driveLink để xử lý');
      }
    }
    
    // Tạo thư mục tạm nếu chưa có
    const tempDir = task.tempDir || path.join(os.tmpdir(), uuidv4());
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Tạo đường dẫn đầu ra
    const outputPath = path.join(tempDir, `TÀI LIỆU${task.fileId}_processed.pdf`);
    
    // Sử dụng Chrome để xử lý file
    const chromeResult = await processPDF(
      null, // inputPath
      outputPath,
      {
        skipWatermarkRemoval: true,
        debugMode: true,
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
        fileId: task.fileId,
        driveLink: task.driveLink,
        targetFolderId: task.targetFolderId,
        folderName: task.targetFolderName || task.courseName || 'Unknown',
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
 * Xử lý và tải lên file đã được tải xuống
 * @param {Object} params - Tham số cho việc xử lý và tải lên
 * @returns {Promise<Object>} - Kết quả xử lý
 */
export async function processAndUploadFile(params) {
  const {
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
    sourceType
  } = params;
  
  try {
    console.log(`🔧 Xử lý file...`);
    
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
            message: `Không thể xử lý watermark: ${error.message}`
          };
        }
        
        // Các lỗi khác, ném lại để xử lý ở cấp cao hơn
        throw error;
      });

    // Kiểm tra các trường hợp đặc biệt
    if (processResult && !processResult.success) {
      // Trường hợp file quá lớn
      if (processResult.skipReason === 'FILE_TOO_LARGE') {
        return {
          success: false,
          skipped: true,
          reason: 'FILE_TOO_LARGE',
          message: processResult.message || processResult.error,
          originalFile: {
            id: fileId,
            link: driveLink,
            size: processResult.fileSizeMB
          },
          processingTime: Math.round((Date.now() - startTime) / 1000)
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
    
    // Upload file đã xử lý
    const uploadResult = await uploadToGoogleDrive(
      processedFilePath,
      path.basename(processedFilePath),
      mimeType || "application/pdf",
      targetFolderId,
      folderName
    );
    
    // Xử lý cập nhật sheet nếu cần
    let sheetUpdateResult = null;
    if (updateSheet) {
      if (courseId && sheetIndex !== undefined && rowIndex !== undefined && cellIndex !== undefined) {
        sheetUpdateResult = await updateSheetCell(
          courseId,
          sheetIndex,
          rowIndex,
          cellIndex,
          driveLink,
          uploadResult.webViewLink || processResult.webViewLink,
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
          uploadResult.webViewLink || processResult.webViewLink,
          driveLink,
          request
        );
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
    
    // Tạo kết quả phản hồi
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
        link: uploadResult.webViewLink || processResult.webViewLink
      },
      processingTime: Math.round((Date.now() - startTime) / 1000),
      sheetUpdate: updateSheet ? {
        success: sheetUpdateResult?.success || false,
        message: sheetUpdateResult?.message || sheetUpdateResult?.error || 'Không có thông tin cập nhật',
        details: sheetUpdateResult?.updatedCell || null
      } : null
    };
    
    // Thêm thông tin về nguồn xử lý
    if (sourceType) {
      if (sourceType === "404_chrome") {
        result.retrievedViaChrome = true;
        result.watermarkProcessed = true;
      } else if (sourceType === "403_chrome") {
        result.blockdownProcessed = true;
        result.watermarkProcessed = true;
      }
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Lỗi trong quá trình xử lý và upload file: ${error.message}`);
    
    // Dọn dẹp thư mục tạm nếu có lỗi
    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Lỗi khi dọn dẹp thư mục tạm:', cleanupError);
      }
    }
    
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
    request
  } = options;

  try {
    console.log(`\n🔄 Bắt đầu xử lý file: ${file.name} (${file.id})`);

    // Import hàm getTokenByType từ utils
    const { getTokenByType } = await import('../../remove-watermark/lib/utils.js');
    
    // Khởi tạo Drive client
    const downloadToken = getTokenByType('download');
    if (!downloadToken) {
      throw new Error('Không tìm thấy token Google Drive tải xuống');
    }
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials(downloadToken);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Kiểm tra file đã tồn tại trong thư mục đích chưa
    const existingCheck = await checkFileExistsInTarget(file.name, targetFolderId, drive);
    if (existingCheck.exists) {
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

    // Tạo thư mục tạm
    const tempDir = path.join(os.tmpdir(), uuidv4());
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempFilePath = path.join(tempDir, `${uuidv4()}.${file.name.split('.').pop()}`);

    // Thử tải file qua API
    try {
      // Tải file qua API
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

      // Xử lý file đã tải xuống
      return await processAndUploadFile({
        filePath: tempFilePath,
        mimeType: file.mimeType,
        fileId: file.id,
        driveLink: `https://drive.google.com/file/d/${file.id}/view`,
        targetFolderId,
        folderName: path.basename(file.name, path.extname(file.name)),
        apiKey,
        updateSheet,
        courseId,
        sheetIndex,
        rowIndex,
        cellIndex,
        sheetId,
        googleSheetName,
        displayText: file.name,
        request,
        startTime: Date.now(),
        tempDir,
        sourceType: 'api'
      });

    } catch (apiError) {
      // Nếu lỗi 403 hoặc 404, thử dùng cookie trước
      if (apiError.message.includes('HTTP 403') || apiError.message.includes('cannotDownloadFile') || 
          apiError.message.includes('HTTP 404')) {
        
        console.log(`⚠️ Lỗi khi tải qua API: ${apiError.message}`);
        console.log(`🍪 Thử tải file bằng cookie...`);
        
        try {
          // Đảm bảo tempFilePath có đuôi .pdf
          let cookieTempFilePath = tempFilePath;
          if (path.extname(cookieTempFilePath)) {
            // Nếu đã có extension, loại bỏ để cho phép cookie-service xác định đúng
            cookieTempFilePath = cookieTempFilePath.substring(0, cookieTempFilePath.lastIndexOf('.'));
          }
          
          // Thử tải bằng cookie
          const cookieDownloadResult = await downloadWithCookie(file.id, cookieTempFilePath);
          
          if (cookieDownloadResult.success) {
            console.log(`✅ Tải file bằng cookie thành công!`);
            
            // Xử lý file đã tải xuống bằng cookie
            return await processAndUploadFile({
              filePath: cookieDownloadResult.filePath, // Sử dụng đường dẫn từ kết quả cookie
              mimeType: cookieDownloadResult.mimeType || file.mimeType || 'application/pdf', // Sử dụng MIME type từ kết quả cookie
              fileId: file.id,
              driveLink: `https://drive.google.com/file/d/${file.id}/view`,
              targetFolderId,
              folderName: path.basename(cookieDownloadResult.fileName || file.name, path.extname(cookieDownloadResult.fileName || file.name)),
              apiKey,
              updateSheet,
              courseId,
              sheetIndex,
              rowIndex,
              cellIndex,
              sheetId,
              googleSheetName,
              displayText: cookieDownloadResult.fileName || file.name,
              request,
              startTime: Date.now(),
              tempDir,
              sourceType: 'cookie'
            });
          }
          
          console.log(`⚠️ Tải bằng cookie thất bại: ${cookieDownloadResult.error}`);
          
          // Nếu là lỗi 403 và cần bỏ qua phương pháp cookie
          if (cookieDownloadResult.error === 'HTTP_ERROR_403' || cookieDownloadResult.skipCookieMethod) {
            console.log(`⚠️ Phát hiện lỗi 403 với cookie, chuyển thẳng sang Chrome...`);
            
            // Chuyển thẳng sang Chrome
            const errorType = '403';
            
            // Thêm vào hàng đợi xử lý Chrome
            return await addToProcessingQueue({
              fileId: file.id,
              fileName: file.name,
              targetFolderId,
              targetFolderName: path.dirname(file.name),
              errorType,
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
        } catch (cookieError) {
          console.error(`❌ Lỗi khi tải bằng cookie: ${cookieError.message}`);
        }
        
        // Nếu cookie thất bại, thử dùng Chrome như phương án cuối cùng
        console.log(`🌐 Chuyển sang sử dụng Chrome để tải và xử lý file...`);
        
        const errorType = apiError.message.includes('HTTP 403') ? '403' : '404';
        
        // Thêm vào hàng đợi xử lý Chrome
        return await addToProcessingQueue({
          fileId: file.id,
          fileName: file.name,
          targetFolderId,
          targetFolderName: path.dirname(file.name),
          errorType,
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
      
      throw apiError;
    }
  } catch (error) {
    console.error(`❌ Lỗi xử lý file ${file.name}:`, error);
    throw error;
  }
}

/**
 * Xử lý đệ quy thư mục
 * @param {string} folderId - ID của thư mục cần xử lý 
 * @param {Object} options - Tùy chọn xử lý
 * @param {Object} parentFolderInfo - Thông tin thư mục cha
 * @param {number} depth - Độ sâu đệ quy
 * @returns {Promise<Object>} - Kết quả xử lý thư mục
 */
export async function processFolder(folderId, options, parentFolderInfo = null, depth = 0) {
  const indent = '  '.repeat(depth);
  
  try {
    console.log(`\n${indent}📂 Bắt đầu xử lý thư mục: ${folderId}`);
    
    // Import hàm getTokenByType từ utils
    const { getTokenByType } = await import('../../remove-watermark/lib/utils.js');
    
    // Khởi tạo Drive client cho tải lên và tải xuống
    const uploadToken = getTokenByType('upload');
    const downloadToken = getTokenByType('download');
    
    if (!uploadToken || !downloadToken) {
      throw new Error('Không tìm thấy token Google Drive');
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
    const folder = await downloadDrive.files.get({
      fileId: folderId,
      fields: 'name,parents,driveId',
      supportsAllDrives: true
    });
    
    // Xác định thư mục cha mới
    const newParentId = parentFolderInfo ? parentFolderInfo.id : options.targetFolderId;
    
    // Tìm hoặc tạo thư mục mới trong thư mục đích
    const existingFolders = await downloadDrive.files.list({
      q: `'${newParentId}' in parents and name = '${folder.data.name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name, webViewLink)',
      supportsAllDrives: true
    });
    
    let newFolder;
    if (existingFolders.data.files.length > 0) {
      newFolder = { data: existingFolders.data.files[0] };
      console.log(`${indent}📂 Sử dụng thư mục tồn tại: ${newFolder.data.name} (${newFolder.data.id})`);
    } else {
      const folderMetadata = {
        name: folder.data.name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [newParentId]
      };
      
      newFolder = await uploadDrive.files.create({
        resource: folderMetadata,
        fields: 'id,name,webViewLink',
        supportsAllDrives: true
      });
      
      console.log(`${indent}📂 Đã tạo thư mục mới: ${newFolder.data.name} (${newFolder.data.id})`);
    }
    
    // Lấy danh sách file và thư mục con
    const listResult = await downloadDrive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType)',
      supportsAllDrives: true
    });
    
    const files = listResult.data.files || [];
    
    // Kết quả xử lý
    const results = {
      success: true,
      isFolder: true,
      folderId: folderId,
      folderName: folder.data.name,
      originalFolderLink: options.originalFolderLink || `https://drive.google.com/drive/folders/${folderId}`,
      folderLink: newFolder.data.webViewLink,
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
        const subFolderResult = await processFolder(
          subFolder.id,
          options,
          {
            id: newFolder.data.id,
            name: newFolder.data.name
          },
          depth + 1
        );
        
        results.subFolders.push({
          id: subFolder.id,
          name: subFolder.name,
          processedFiles: subFolderResult.processedFiles.length,
          skippedFiles: subFolderResult.skippedFiles.length,
          errors: subFolderResult.errors.length
        });
        
        // Cập nhật kết quả tổng
        results.processedFiles = results.processedFiles.concat(subFolderResult.processedFiles);
        results.skippedFiles = results.skippedFiles.concat(subFolderResult.skippedFiles);
        results.errors = results.errors.concat(subFolderResult.errors);
        
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
            targetFolderId: newFolder.data.id
          };
          
          const fileResult = await processSingleFile(file, fileOptions);
          
          if (fileResult.success && !fileResult.skipped) {
            console.log(`${indent}✅ File đã xử lý thành công: ${file.name}`);
            results.processedFiles.push({
              id: file.id,
              name: file.name,
              type: mimeTypeResult.isPdf ? 'pdf' : 'video',
              result: fileResult
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
        
        let sheetUpdateResult;
        if (options.courseId && options.sheetIndex !== undefined && 
            options.rowIndex !== undefined && options.cellIndex !== undefined) {
            
          sheetUpdateResult = await updateSheetCell(
            options.courseId,
            options.sheetIndex,
            options.rowIndex,
            options.cellIndex,
            results.originalFolderLink,
            results.folderLink,
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
            results.folderLink,
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
    throw error;
  }
} 