import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { processPDFWatermark } from './watermark-service';
import { getNextApiKey } from '../../../../../utils/watermark-api-keys';
import { listFilesInFolder } from './download-service';
import { downloadFromGoogleDrive } from './download-service';
import { findOrCreateFolder, uploadToGoogleDrive } from './upload-service';
import { removeHeaderFooterWatermark, addLogoToPDF } from './pdf-service';
import { createOAuth2Client } from '../../../../../utils/drive-utils';
import VideoProcessor from './video-processor';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeFileName } from '../../../../../utils/file-utils';

// Khởi tạo VideoProcessor
let videoProcessor = null;

/**
 * Khởi tạo VideoProcessor nếu chưa có
 */
async function initVideoProcessor() {
  if (!videoProcessor) {
    const oAuth2Client = await createOAuth2Client();
    videoProcessor = new VideoProcessor(oAuth2Client, 'temp');
  }
  return videoProcessor;
}

/**
 * Xử lý file (ví dụ: loại bỏ watermark)
 * @param {string} filePath - Đường dẫn đến file cần xử lý
 * @param {string} mimeType - MIME type của file
 * @param {string} apiKey - API key cho dịch vụ xóa watermark (tùy chọn)
 * @param {string} originalFileId - File ID gốc từ Google Drive (tùy chọn)
 * @returns {Promise<Object>} - Kết quả xử lý file
 */
export async function processFile(filePath, mimeType, apiKey, originalFileId) {
  try {
    console.log(`Đang xử lý file: ${filePath}`);
    
    // Kiểm tra xem file có tồn tại không
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Lỗi: File không tồn tại tại đường dẫn: ${filePath}`);
      throw new Error(`File không tồn tại: ${filePath}`);
    }
    
    // Xác định đuôi file
    const fileExt = path.extname(filePath).toLowerCase();
    
    // Tạo đường dẫn đầu ra cho file được xử lý
    const processedFileName = originalFileId ? `file_${originalFileId}_processed${fileExt}` : `processed_${path.basename(filePath)}`;
    const processedPath = path.join(path.dirname(filePath), processedFileName);
    
    // Kiểm tra loại file để xử lý phù hợp
    const mimeTypeLower = mimeType ? mimeType.toLowerCase() : '';

    // Xử lý các loại file PDF
    if (mimeTypeLower.includes('pdf') || fileExt === '.pdf') {
      // Xử lý file PDF - sử dụng API techhk.aoscdn.com để xóa watermark
      console.log('Đang xử lý file PDF với API xóa watermark...');
      
      // Lấy API key từ hệ thống quản lý API key
      const apiKeyToUse = apiKey || await getNextApiKey();
      
      if (!apiKeyToUse) {
        console.error('Không có API key khả dụng để xóa watermark');
        throw new Error('Không có API key khả dụng để xóa watermark');
      }
      
      console.log(`Sử dụng API key: ${apiKeyToUse.substring(0, 5)}... để xóa watermark`);
      
      // Kiểm tra kích thước file để cảnh báo nếu quá lớn
      try {
        const fileStats = fs.statSync(filePath);
        const fileSizeMB = fileStats.size / (1024 * 1024);
        console.log(`Kích thước file: ${fileSizeMB.toFixed(2)} MB`);
        
        if (fileSizeMB > 50) {
          console.log(`⚠️ Cảnh báo: File có kích thước lớn (${fileSizeMB.toFixed(2)} MB), quá trình xử lý có thể mất nhiều thời gian`);
          console.log(`Thời gian xử lý ước tính: ${Math.ceil(fileSizeMB * 15 / 60)} phút`);
        }
      } catch (statError) {
        console.error(`❌ Lỗi khi kiểm tra kích thước file: ${statError.message}`);
        throw new Error(`Không thể đọc thông tin file: ${statError.message}`);
      }
      
      // Gọi API xóa watermark
      let processingStartTime = Date.now();
      console.log(`Bắt đầu xử lý PDF lúc: ${new Date(processingStartTime).toLocaleTimeString()}`);
      
      // Tạo đường dẫn đầu ra cho file PDF bị chặn
      const outputDir = path.dirname(processedPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      try {
        // Thử xử lý với API watermark trước
        /*
        const result = await processPDFWatermark(filePath, processedPath, apiKeyToUse);
        
        // Kiểm tra kết quả xử lý từ API watermark
        if (result && result.success !== false && result.processedPath && fs.existsSync(result.processedPath)) {
          console.log(`PDF đã được xử lý thành công sau ${Math.round((Date.now() - processingStartTime)/1000)} giây`);
        
          // Xóa watermark dạng text ở header và footer và thêm logo
          await removeHeaderFooterWatermark(result.processedPath, result.processedPath);
          console.log(`Đã xóa watermark dạng text ở header và footer và thêm logo`);
          
          return {
            success: true,
            processedPath: result.processedPath || processedPath,
            webViewLink: result.webViewLink,
            inputSize: result.inputSize || 0,
            outputSize: result.outputSize || 0,
            pages: result.pages || 0
          };
        }
        
        // Kiểm tra nếu kết quả cho thấy đã bỏ qua do kích thước
        if (result && result.skippedDueToSize) {
          console.log(`⚠️ Đã bỏ qua xử lý watermark do file quá lớn (${result.message || 'Unknown reason'})`);
          return {
            success: true,
            processedPath: result.processedPath || filePath,
            message: result.message || 'Đã bỏ qua xử lý watermark do file quá lớn',
            skipReason: 'FILE_TOO_LARGE',
            fileSizeMB: result.inputSize ? (result.inputSize / (1024 * 1024)).toFixed(2) : 'Unknown'
          };
        }
        
        // Kiểm tra nếu kết quả cho thấy đây là file video
        if (result && !result.success && result.isVideo && !result.shouldRetry) {
          console.log(`🎥 Phát hiện file video, chuyển sang xử lý video...`);
          return {
            success: false,
            error: 'FILE_IS_VIDEO',
            isVideo: true,
            fileId: result.fileId,
            fileName: result.fileName,
            shouldRetry: false
          };
        }
        
        // Nếu API xử lý watermark thất bại, chuyển sang phương pháp đơn giản
        if (!result || !result.success) {
          console.log(`⚠️ Phát hiện lỗi "${result?.error || 'Xử lý thất bại'}", phân tích sâu hơn...`);
          console.log(`📊 Kích thước file: ${fileSizeMB.toFixed(2)} MB`);
          
          if (result.error && (result.error.includes('Xử lý thất bại') || result.error.includes('Lỗi khi xử lý PDF'))) {
            console.log(`🔄 Thử lại lần 1 với API key khác do lỗi xử lý thất bại...`);
            
            // Thử lại với API key khác
            const newApiKey = await getNextApiKey(true); // true để lấy key khác
            
            if (newApiKey && newApiKey !== apiKeyToUse) {
              console.log(`🔄 Chuyển sang phương pháp đơn giản do lỗi xử lý thất bại...`);
            }
        */
            
        // Sử dụng phương pháp đơn giản
        console.log(`⚠️ Sử dụng phương pháp đơn giản để xử lý file PDF (bỏ qua mọi xử lý)`);
        
        // Bỏ đoạn đọc PDF để lấy số trang vì có thể gặp lỗi với file encrypted
        /*
        // Đọc PDF để lấy số trang
        const PDFDocument = require('pdf-lib').PDFDocument;
        const pdfBytes = fs.readFileSync(filePath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pageCount = pdfDoc.getPageCount();
        console.log(`Số trang PDF: ${pageCount}`);
        */
        
        // Sao chép file gốc sang file đích thay vì xử lý
        fs.copyFileSync(filePath, processedPath);
        console.log(`Đã sao chép file gốc sang file đích: ${processedPath}`);
        console.log(`✅ Đã sao chép file mà không thực hiện xử lý gì thêm`);
        
        // Giữ nguyên originalFileName được truyền từ bên ngoài (nếu có)
        const fileName = originalFileId ? `file_${originalFileId}${fileExt}` : path.basename(filePath);
        
        return {
          success: true,
          processedPath: processedPath,
          message: 'Đã bỏ qua mọi xử lý, chỉ sao chép file gốc',
          skipWatermark: true,
          // originalFileName sẽ được thiết lập ở processAndUploadFile
        };
        
        /* 
        // Nếu là lỗi khác liên quan đến việc tải file (không phải lỗi xử lý watermark),
        // mới chuyển sang Chrome
        if (result.shouldRetry !== false && 
            (result.error && (result.error.includes('download') || 
                            result.error.includes('tải') || 
                            result.error.includes('access') || 
                            result.error.includes('permission')))) {
          console.log('🔄 Thử lại với Chrome do lỗi tải file...');
          
          // Import các module cần thiết
          const { processPDF } = await import('../../remove-watermark/lib/drive-fix-blockdown.js');
          const { google } = await import('googleapis');
          
          // Sử dụng originalFileId được truyền vào nếu có
          let fileId = originalFileId;
          
          // Nếu không có originalFileId, cố gắng trích xuất từ tên file
          if (!fileId) {
            const fileIdMatch = fileName.match(/TÀI LIỆU(.*?)(_processed)?$/);
            fileId = fileIdMatch ? fileIdMatch[1] : null;
            
            // Nếu vẫn không tìm được fileId, thử lấy từ tên file khác
            if (!fileId) {
              // Trích xuất fileId từ đường dẫn file
              const pathMatch = filePath.match(/([a-zA-Z0-9_-]{25,})/);
              fileId = pathMatch ? pathMatch[1] : null;
            }
          }
          
          if (!fileId) {
            console.error('Không tìm thấy file ID từ tên file hoặc đường dẫn. Bỏ qua xử lý Chrome.');
            return {
              success: false,
              error: 'FILE_ID_NOT_FOUND',
              message: 'Không thể xác định file ID để xử lý với Chrome',
              processedPath: filePath
            };
          }
          
          console.log(`Tìm thấy File ID để xử lý với Chrome: ${fileId}`);
          
          // Tạo đường dẫn đầu ra rõ ràng
          const outputDir = path.dirname(processedPath);
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            console.log(`Đã tạo thư mục đầu ra: ${outputDir}`);
          }
          
          try {
            // Truyền google object vào hàm processPDF qua config
            const chromeResult = await processPDF(
              null, // inputPath
              processedPath, // outputPath
              { 
                debugMode: true,
                google: google, // Truyền đối tượng Google API
                skipWatermarkRemoval: true // Tạm thời bỏ qua xử lý watermark để tập trung vào việc tải xuống
              }, 
              true, // isBlocked
              fileId // fileId
            );
          
            if (!chromeResult.success) {
              console.error(`Lỗi xử lý Chrome: ${chromeResult.error}`);
              
              if (chromeResult.error === 'NO_IMAGES_DOWNLOADED' || chromeResult.error === 'NO_IMAGES_CONVERTED') {
                throw new Error(`Không thể tải các trang PDF: ${chromeResult.message}`);
              }
              
              throw new Error(chromeResult.error || 'Không thể xử lý file bằng Chrome');
            }
            
            // Lấy link mới từ kết quả Chrome
            const newLink = chromeResult.webViewLink || chromeResult.filePath;
            if (!newLink) {
              throw new Error('Không thể lấy link mới từ kết quả xử lý Chrome');
            }
            
            return {
              success: true,
              processedPath: chromeResult.filePath || processedPath,
              webViewLink: newLink // Thêm link mới vào kết quả
            };
          } catch (error) {
            console.error(`Lỗi khi xử lý với Chrome: ${error.message}`);
            return {
              success: false,
              error: error.message,
              processedPath: filePath
            };
          }
        } else {
          // Lỗi xử lý watermark không cần thiết phải mở Chrome
          console.log(`⚠️ Sử dụng phương pháp đơn giản do lỗi xử lý watermark: ${result.error}`);
          
          // Xóa watermark dạng text ở header và footer và thêm logo
          await removeHeaderFooterWatermark(filePath, processedPath);
          console.log(`Đã cắt header và footer của PDF và thêm logo: ${processedPath}`);
          console.log(`✅ Đã xử lý file bằng phương pháp đơn giản (chỉ thêm logo)`);
          
          return {
            success: true,
            processedPath: processedPath,
            message: `Đã xử lý bằng phương pháp đơn giản: ${result.error}`,
            skipWatermark: true
          };
        }
        */
      } catch (watermarkError) {
        console.error(`❌ Lỗi khi xử lý watermark: ${watermarkError.message}`);
        
        // Sử dụng phương pháp đơn giản khi gặp lỗi - chỉ sao chép file gốc
        console.log(`⚠️ Sử dụng phương pháp đơn giản do lỗi xử lý watermark: chỉ sao chép file gốc`);
        
        // Sao chép file gốc sang file đích thay vì xử lý
        fs.copyFileSync(filePath, processedPath);
        console.log(`Đã sao chép file gốc sang file đích do lỗi: ${processedPath}`);
        console.log(`✅ Đã sao chép file mà không thực hiện xử lý gì thêm`);
        
        return {
          success: true,
          processedPath: processedPath,
          message: `Chỉ sao chép file gốc do lỗi: ${watermarkError.message}`,
          skipWatermark: true
          // originalFileName sẽ được thiết lập ở processAndUploadFile
        };
      }
    } else if (mimeTypeLower.includes('video')) {
      // Xử lý file video
      console.log('🎥 Đang xử lý file video...');
      
      // Thay vì sử dụng processor, chỉ đơn giản sao chép file video để tránh lỗi token
      console.log('⏭️ Bỏ qua xử lý video, chỉ sao chép file video để upload...');
      fs.copyFileSync(filePath, processedPath);
      console.log(`Đã sao chép file video sang: ${processedPath}`);
      
      return {
        success: true,
        processedPath: processedPath,
        message: 'File video được sao chép trực tiếp không qua xử lý',
        skipProcessing: true
      };
      
      // Đoạn code cũ - không sử dụng nữa
      // const processor = await initVideoProcessor();
      // return await processor.processVideo(filePath, fileName, targetFolderId);
    } else if (mimeTypeLower.includes('image')) {
      // Xử lý file hình ảnh - hiện tại chỉ sao chép
      console.log('Đang xử lý file hình ảnh (chỉ sao chép)...');
      fs.copyFileSync(filePath, processedPath);
    } else if (mimeTypeLower.includes('spreadsheet') || mimeTypeLower.includes('excel')) {
      // Xử lý file bảng tính - hiện tại chỉ sao chép
      console.log('Đang xử lý file bảng tính (chỉ sao chép)...');
      fs.copyFileSync(filePath, processedPath);
    } else if (mimeTypeLower.includes('document') || mimeTypeLower.includes('word')) {
      // Xử lý file văn bản - hiện tại chỉ sao chép
      console.log('Đang xử lý file văn bản (chỉ sao chép)...');
      fs.copyFileSync(filePath, processedPath);
    } else if (mimeTypeLower.includes('presentation') || mimeTypeLower.includes('powerpoint')) {
      // Xử lý file trình chiếu - hiện tại chỉ sao chép
      console.log('Đang xử lý file trình chiếu (chỉ sao chép)...');
      fs.copyFileSync(filePath, processedPath);
    } else if (mimeTypeLower.includes('video') || mimeTypeLower.includes('audio')) {
      // Xử lý file media - hiện tại chỉ sao chép
      console.log('Đang xử lý file media (chỉ sao chép)...');
      fs.copyFileSync(filePath, processedPath);
    } else {
      // Các loại file khác - chỉ sao chép
      console.log(`Không có xử lý đặc biệt cho loại file: ${mimeType}, thực hiện sao chép đơn giản`);
      fs.copyFileSync(filePath, processedPath);
    }
    
    console.log(`File đã được xử lý và lưu tại: ${processedPath}`);
    
    return {
      success: true,
      processedPath: processedPath
    };
  } catch (error) {
    console.error('Lỗi khi xử lý file:', error);
    throw new Error(`Không thể xử lý file: ${error.message}`);
  }
}

/**
 * Xử lý folder Google Drive
 * @param {string} folderId - ID của folder cần xử lý
 * @param {string} folderName - Tên của folder
 * @param {string} targetFolderId - ID của folder đích để upload kết quả
 * @param {string} apiKey - API key cho dịch vụ xóa watermark (tùy chọn)
 * @returns {Promise<Object>} - Kết quả xử lý folder
 */
export async function processFolder(folderId, folderName, targetFolderId, apiKey) {
  console.log(`Xử lý folder: ${folderName} (${folderId})`);
  
  // Kết quả xử lý
  const results = {
    success: true,
    folderName: folderName,
    folderId: folderId,
    targetFolderId: targetFolderId,
    processedFiles: 0,
    processedFolders: 0,
    skippedFiles: 0,
    errors: [],
    files: []
  };
  
  try {
    // Liệt kê tất cả các file trong folder
    const listResult = await listFilesInFolder(folderId);
    
    if (!listResult.success) {
      // Kiểm tra lỗi quyền truy cập
      if (listResult.error && (
          listResult.error.includes('403') || 
          listResult.error.includes('permission') || 
          listResult.error.includes('quyền truy cập')
      )) {
        throw new Error(`Không có quyền truy cập vào folder: ${folderName} (${folderId})`);
      }
      
      throw new Error(`Không thể liệt kê các file trong folder: ${listResult.error}`);
    }
    
    // Kiểm tra nếu folder trống
    if (!listResult.files || listResult.files.length === 0) {
      console.log(`Folder ${folderName} (${folderId}) trống, không có file nào để xử lý`);
      return {
        ...results,
        isEmpty: true,
        message: 'Folder trống, không có file nào để xử lý'
      };
    }
    
    // Tạo folder đích tương ứng
    const targetFolderResult = await findOrCreateFolder(folderName, targetFolderId, true);
    
    if (!targetFolderResult.success) {
      throw new Error(`Không thể tạo folder đích: ${targetFolderResult.error || 'Lỗi không xác định'}`);
    }
    
    const newTargetFolderId = targetFolderResult.folder.id;
    console.log(`Đã tạo/tìm folder đích: ${folderName} (${newTargetFolderId})`);
    
    // Xử lý từng file trong folder
    for (const file of listResult.files) {
      try {
        if (file.mimeType === 'application/vnd.google-apps.folder') {
          // Xử lý đệ quy nếu là folder con
          console.log(`Phát hiện folder con: ${file.name} (${file.id})`);
          
          const subFolderResult = await processFolder(
            file.id, 
            file.name, 
            newTargetFolderId, 
            apiKey
          );
          
          results.processedFolders++;
          results.processedFiles += subFolderResult.processedFiles;
          results.skippedFiles += subFolderResult.skippedFiles;
          
          // Thêm lỗi từ folder con nếu có
          if (subFolderResult.errors && subFolderResult.errors.length > 0) {
            results.errors = [...results.errors, ...subFolderResult.errors.map(err => `[${file.name}] ${err}`)];
          }
          
          // Tạo thông tin chi tiết về folder con đã xử lý
          const folderInfo = {
            name: file.name,
            id: file.id,
            type: 'folder',
            success: subFolderResult.success,
            processedFiles: subFolderResult.processedFiles,
            isEmpty: subFolderResult.isEmpty || false,
            link: `https://drive.google.com/drive/folders/${newTargetFolderId}`,
            targetFolderId: newTargetFolderId,
            newFileId: newTargetFolderId // Sử dụng ID của folder đích
          };
          
          // Log thông tin chi tiết về folder con
          console.log(`Thông tin chi tiết folder con: name=${folderInfo.name}, id=${folderInfo.id}, newFileId=${folderInfo.newFileId}, link=${folderInfo.link}`);
          
          results.files.push(folderInfo);
          
          console.log(`Đã xử lý folder con: ${file.name} - ${subFolderResult.processedFiles} files`);
        } else {
          // Xử lý file
          console.log(`Đang xử lý file: ${file.name} (${file.id})`);
          
          // Kiểm tra xem file đã tồn tại trong thư mục đích chưa
          try {
            console.log(`Kiểm tra xem file "${file.name}" đã tồn tại trong thư mục đích chưa...`);
            
            // Tạo OAuth2 client với khả năng tự động refresh token
            const oauth2Client = createOAuth2Client(0);
            
            // Khởi tạo Drive API
            const drive = google.drive({ version: 'v3', auth: oauth2Client });
            
            // Xử lý tên file để sử dụng trong truy vấn
            const escapedFileName = file.name.replace(/'/g, "\\'");
            
            // Tìm các file trùng tên trong folder đích
            const existingFileResponse = await drive.files.list({
              q: `name='${escapedFileName}' and '${newTargetFolderId}' in parents and trashed=false`,
              fields: 'files(id, name, webViewLink, webContentLink)',
              spaces: 'drive'
            });
            
            // Nếu file đã tồn tại, bỏ qua xử lý
            if (existingFileResponse.data.files && existingFileResponse.data.files.length > 0) {
              const existingFile = existingFileResponse.data.files[0];
              console.log(`✅ File "${file.name}" đã tồn tại trong thư mục đích (ID: ${existingFile.id}), bỏ qua xử lý`);
              
              results.files.push({
                name: file.name,
                id: file.id,
                type: 'file',
                mimeType: file.mimeType,
                success: true,
                newFileId: existingFile.id,
                link: existingFile.webViewLink,
                alreadyExists: true
              });
              
              // Tăng số file đã xử lý
              results.processedFiles++;
              
              // Bỏ qua các bước còn lại
              continue;
            }
            
            console.log(`File "${file.name}" chưa tồn tại trong thư mục đích, tiến hành xử lý...`);
          } catch (checkExistingError) {
            console.error(`Lỗi khi kiểm tra file đã tồn tại: ${checkExistingError.message}`);
            console.log(`Tiếp tục xử lý file...`);
          }
          
          // Tải xuống file
          const downloadResult = await downloadFromGoogleDrive(file.id);
          
          if (!downloadResult.success) {
            console.error(`Không thể tải xuống file: ${file.name}`);
            results.skippedFiles++;
            results.errors.push(`Không thể tải xuống: ${file.name}`);
            continue;
          }
          
          // Hiển thị thông tin kích thước file
          const fileSizeMB = downloadResult.fileSize ? downloadResult.fileSize / (1024 * 1024) : 0;
          console.log(`📊 Kích thước file: ${fileSizeMB.toFixed(2)} MB - ${file.name}`);
          // Không còn giới hạn kích thước file
          
          // Xử lý file theo loại MIME
          let processedFilePath;
          const mimeType = downloadResult.mimeType;
          
          try {
            if (mimeType.includes('pdf')) {
              // Xử lý file PDF
              const processResult = await processFile(downloadResult.filePath, mimeType, apiKey, file.id);
              processedFilePath = processResult.processedPath;
              
              // Kiểm tra xem processedPath có phải là đối tượng không
              if (typeof processedFilePath === 'object' && processedFilePath !== null) {
                console.log('Phát hiện processedPath là đối tượng, không phải chuỗi. Đang chuyển đổi...');
                
                // Nếu đối tượng có thuộc tính path, sử dụng nó
                if (processedFilePath.path) {
                  processedFilePath = processedFilePath.path;
                } else {
                  // Nếu không, tạo đường dẫn mới dựa trên filePath gốc
                  const fileDir = path.dirname(downloadResult.filePath);
                  const fileExt = path.extname(downloadResult.filePath);
                  const fileName = path.basename(downloadResult.filePath, fileExt);
                  processedFilePath = path.join(fileDir, `${fileName}_processed${fileExt}`);
                  
                  console.log(`Đã tạo đường dẫn mới: ${processedFilePath}`);
                  
                  // Kiểm tra xem file có tồn tại không
                  if (!fs.existsSync(processedFilePath)) {
                    console.error(`Lỗi: File không tồn tại tại đường dẫn ${processedFilePath}`);
                    throw new Error(`File đã xử lý không tồn tại tại đường dẫn ${processedFilePath}`);
                  }
                }
              }
            } else {
              // Các loại file khác - chỉ sao chép
              const fileDir = path.dirname(downloadResult.filePath);
              const fileExt = path.extname(downloadResult.filePath);
              const fileName = path.basename(downloadResult.filePath, fileExt);
              processedFilePath = path.join(fileDir, `${fileName}_uploaded${fileExt}`);
              fs.copyFileSync(downloadResult.filePath, processedFilePath);
            }
            
            // Upload file đã xử lý
            const uploadResult = await uploadToGoogleDrive(
              processedFilePath,
              downloadResult.fileName,
              downloadResult.mimeType,
              newTargetFolderId
            );
            
            // Dọn dẹp thư mục tạm
            try {
              fs.rmdirSync(downloadResult.outputDir, { recursive: true });
            } catch (cleanupError) {
              console.error(`Lỗi khi dọn dẹp thư mục tạm: ${cleanupError.message}`);
            }
            
            results.processedFiles++;
            results.files.push({
              name: file.name,
              id: file.id,
              type: 'file',
              mimeType: mimeType,
              success: true,
              newFileId: uploadResult.fileId,
              link: uploadResult.webViewLink
            });
            
            console.log(`Đã xử lý file: ${file.name} -> ${uploadResult.fileName}`);
          } catch (processingError) {
            // Xử lý lỗi khi xử lý hoặc upload file
            console.error(`Lỗi khi xử lý hoặc upload file ${file.name}:`, processingError);
            
            // Dọn dẹp thư mục tạm nếu có
            if (downloadResult.outputDir) {
              try {
                fs.rmdirSync(downloadResult.outputDir, { recursive: true });
              } catch (cleanupError) {
                console.error(`Lỗi khi dọn dẹp thư mục tạm: ${cleanupError.message}`);
              }
            }
            
            results.skippedFiles++;
            results.errors.push(`Lỗi khi xử lý ${file.name}: ${processingError.message}`);
            
            results.files.push({
              name: file.name,
              id: file.id,
              type: 'file',
              mimeType: mimeType,
              success: false,
              error: processingError.message
            });
          }
        }
      } catch (fileError) {
        console.error(`Lỗi khi xử lý ${file.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file'}: ${file.name}`, fileError);
        
        results.skippedFiles++;
        results.errors.push(`Lỗi khi xử lý ${file.name}: ${fileError.message}`);
        
        results.files.push({
          name: file.name,
          id: file.id,
          type: file.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
          success: false,
          error: fileError.message
        });
      }
    }
    
    console.log(`Hoàn tất xử lý folder: ${folderName} - Đã xử lý ${results.processedFiles} files, ${results.processedFolders} folders, bỏ qua ${results.skippedFiles} files`);
    
  } catch (error) {
    console.error(`Lỗi khi xử lý folder ${folderName}:`, error);
    
    results.success = false;
    results.error = error.message;
  }
  
  return results;
} 

/**
 * Xử lý một file đơn lẻ
 * @param {Object} file - Thông tin file cần xử lý
 * @param {Object} options - Các tùy chọn xử lý
 * @returns {Promise<Object>} - Kết quả xử lý
 */
export async function processSingleFile(file, options = {}) {
  try {
    console.log(`🔄 Bắt đầu xử lý file: ${file.name || file.id}`);
    
    // Trích xuất các options
    const { 
      targetFolderId, 
      apiKey, 
      skipProcessing = false,
      courseName
    } = options;
    
    // Tạo thư mục tạm nếu chưa có
    const tempDir = path.join(os.tmpdir(), 'process-and-replace');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Tạo đường dẫn tạm cho file tải xuống
    const downloadPath = path.join(tempDir, `${uuidv4()}_${sanitizeFileName(file.name || `file_${file.id}`)}`);
    
    // Tải file từ Google Drive
    console.log(`📥 Tải file từ Google Drive: ${file.id}`);
    await downloadFromGoogleDrive(file.id, downloadPath);
    console.log(`✅ Đã tải file thành công: ${downloadPath}`);
    
    // Xác định loại file để xử lý
    const mimeTypeLower = (file.mimeType || '').toLowerCase();
    const isPDF = mimeTypeLower.includes('pdf');
    const isVideo = mimeTypeLower.includes('video');
    const isImage = mimeTypeLower.includes('image');
    
    // Đường dẫn cho file đã xử lý
    let processedPath = downloadPath;
    let processResult = null;
    
    // Nếu skipProcessing = true, bỏ qua xử lý và chỉ upload lại
    if (skipProcessing) {
      console.log(`⏭️ Bỏ qua xử lý theo yêu cầu, chỉ upload lại file`);
    }
    // Nếu là PDF và không skip processing, xử lý watermark
    else if (isPDF) {
      // Xử lý file PDF
      console.log('📄 Đang xử lý file PDF...');
      
      // Tạo đường dẫn cho file đã xử lý
      processedPath = path.join(tempDir, `processed_${uuidv4()}.pdf`);
      
      // Xử lý PDF với API
      const processor = await initVideoProcessor(); // Changed from initPDFProcessor to initVideoProcessor
      processResult = await processor.processVideo(downloadPath, file.name, targetFolderId); // Changed to processVideo
      
      if (!processResult.success) {
        throw new Error(`Lỗi khi xử lý PDF: ${processResult.error}`);
      }
      
      console.log(`✅ Đã xử lý PDF thành công: ${processedPath}`);
    } 
    // Nếu là video và không skip processing, xử lý video
    else if (isVideo) {
      // Xử lý file video
      console.log('🎥 Đang xử lý file video...');
      
      // Thay vì sử dụng processor, chỉ đơn giản sao chép file video để tránh lỗi token
      console.log('⏭️ Bỏ qua xử lý video, chỉ sao chép file video để upload...');
      processedPath = path.join(tempDir, `processed_${uuidv4()}_${path.basename(downloadPath)}`);
      fs.copyFileSync(downloadPath, processedPath);
      console.log(`Đã sao chép file video sang: ${processedPath}`);
      
      processResult = {
        success: true,
        message: 'File video được sao chép trực tiếp không qua xử lý',
        skipProcessing: true
      };
    }
    // Các loại file khác, không xử lý
    else {
      console.log(`⏭️ File không phải PDF hoặc video (${mimeTypeLower}), bỏ qua xử lý`);
      processResult = {
        success: true,
        message: `Bỏ qua xử lý cho loại file: ${mimeTypeLower}`,
        skipProcessing: true
      };
    }
    
    // Upload file đã xử lý
    if (!skipProcessing) {
      const uploadResult = await uploadToGoogleDrive(
        processedPath,
        file.name,
        file.mimeType,
        targetFolderId
      );
      
      if (!uploadResult.success) {
        console.error(`Lỗi khi upload file ${file.name}:`, uploadResult.error);
        throw new Error(`Không thể upload file ${file.name}: ${uploadResult.error}`);
      }
      
      console.log(`✅ Đã upload file thành công: ${uploadResult.fileName}`);
      
      // Dọn dẹp thư mục tạm
      try {
        fs.rmdirSync(tempDir, { recursive: true });
      } catch (cleanupError) {
        console.error(`Lỗi khi dọn dẹp thư mục tạm: ${cleanupError.message}`);
      }
      
      return {
        success: true,
        processedPath: uploadResult.webViewLink, // Trả về link mới
        message: processResult.message || 'File đã được xử lý và upload thành công',
        skipProcessing: processResult.skipProcessing || false
      };
    } else {
      // Dọn dẹp thư mục tạm
      try {
        fs.rmdirSync(tempDir, { recursive: true });
      } catch (cleanupError) {
        console.error(`Lỗi khi dọn dẹp thư mục tạm: ${cleanupError.message}`);
      }
      
      return processResult;
    }
  } catch (error) {
    console.error(`Lỗi khi xử lý file ${file.name || file.id}:`, error);
    return {
      success: false,
      error: error.message,
      processedPath: file.id // Trả về ID của file gốc nếu có lỗi
    };
  }
} 