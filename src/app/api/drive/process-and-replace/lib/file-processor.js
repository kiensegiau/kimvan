import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { processPDFWatermark } from './watermark-service';
import { getNextApiKey } from '@/utils/watermark-api-keys';
import { listFilesInFolder } from './download-service';
import { downloadFromGoogleDrive } from './download-service';
import { findOrCreateFolder, uploadToGoogleDrive } from './upload-service';
import { removeHeaderFooterWatermark, addLogoToPDF } from './pdf-service';
import { createOAuth2Client } from '@/utils/drive-utils';

/**
 * Xử lý file (ví dụ: loại bỏ watermark)
 * @param {string} filePath - Đường dẫn đến file cần xử lý
 * @param {string} mimeType - MIME type của file
 * @param {string} apiKey - API key cho dịch vụ xóa watermark (tùy chọn)
 * @returns {Promise<Object>} - Kết quả xử lý file
 */
export async function processFile(filePath, mimeType, apiKey) {
  console.log(`Đang xử lý file: ${filePath}`);
  
  // Tạo đường dẫn cho file đã xử lý
  const fileDir = path.dirname(filePath);
  const fileExt = path.extname(filePath);
  const fileName = path.basename(filePath, fileExt);
  const processedPath = path.join(fileDir, `${fileName}_processed${fileExt}`);
  
  try {
    // Xác định loại file và áp dụng xử lý phù hợp
    if (mimeType.includes('pdf')) {
      // Xử lý file PDF - sử dụng API techhk.aoscdn.com để xóa watermark
      console.log('Đang xử lý file PDF với API xóa watermark...');
      
      // Lấy API key từ hệ thống quản lý API key
      // Nếu apiKey được truyền vào, sử dụng nó, nếu không, lấy key từ hệ thống
      const apiKeyToUse = apiKey || await getNextApiKey();
      
      if (!apiKeyToUse) {
        console.error('Không có API key khả dụng để xóa watermark');
        throw new Error('Không có API key khả dụng để xóa watermark');
      }
      
      console.log(`Sử dụng API key: ${apiKeyToUse.substring(0, 5)}... để xóa watermark`);
      
      // Kiểm tra kích thước file để cảnh báo nếu quá lớn
      const fileStats = fs.statSync(filePath);
      const fileSizeMB = fileStats.size / (1024 * 1024);
      if (fileSizeMB > 50) {
        console.log(`⚠️ Cảnh báo: File có kích thước lớn (${fileSizeMB.toFixed(2)} MB), quá trình xử lý có thể mất nhiều thời gian`);
        console.log(`Thời gian xử lý ước tính: ${Math.ceil(fileSizeMB * 15 / 60)} phút`);
      }
      
      // Gọi API xóa watermark
      let processingStartTime = Date.now();
      console.log(`Bắt đầu xử lý PDF lúc: ${new Date(processingStartTime).toLocaleTimeString()}`);
      
      const result = await processPDFWatermark(filePath, processedPath, apiKeyToUse);
      console.log(`PDF đã được xử lý thành công sau ${Math.round((Date.now() - processingStartTime)/1000)} giây`);
      
      // Xóa watermark dạng text ở header và footer và thêm logo
      await removeHeaderFooterWatermark(processedPath, processedPath);
      console.log(`Đã xóa watermark dạng text ở header và footer và thêm logo`);
      
      return {
        success: true,
        processedPath: processedPath,
        inputSize: result.inputSize || 0,
        outputSize: result.outputSize || 0,
        pages: result.pages || 0
      };
    } else if (mimeType.includes('image')) {
      // Xử lý file hình ảnh - hiện tại chỉ sao chép
      console.log('Đang xử lý file hình ảnh (chỉ sao chép)...');
      fs.copyFileSync(filePath, processedPath);
    } else if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
      // Xử lý file bảng tính - hiện tại chỉ sao chép
      console.log('Đang xử lý file bảng tính (chỉ sao chép)...');
      fs.copyFileSync(filePath, processedPath);
    } else if (mimeType.includes('document') || mimeType.includes('word')) {
      // Xử lý file văn bản - hiện tại chỉ sao chép
      console.log('Đang xử lý file văn bản (chỉ sao chép)...');
      fs.copyFileSync(filePath, processedPath);
    } else if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
      // Xử lý file trình chiếu - hiện tại chỉ sao chép
      console.log('Đang xử lý file trình chiếu (chỉ sao chép)...');
      fs.copyFileSync(filePath, processedPath);
    } else if (mimeType.includes('video') || mimeType.includes('audio')) {
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
          
          results.files.push({
            name: file.name,
            id: file.id,
            type: 'folder',
            success: subFolderResult.success,
            processedFiles: subFolderResult.processedFiles,
            isEmpty: subFolderResult.isEmpty || false
          });
          
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
          
          // Kiểm tra kích thước file quá lớn
          const fileSizeMB = downloadResult.fileSize ? downloadResult.fileSize / (1024 * 1024) : 0;
          if (fileSizeMB > 100) {
            console.warn(`File quá lớn (${fileSizeMB.toFixed(2)} MB), có thể gặp vấn đề khi xử lý: ${file.name}`);
          }
          
          // Xử lý file theo loại MIME
          let processedFilePath;
          const mimeType = downloadResult.mimeType;
          
          try {
            if (mimeType.includes('pdf')) {
              // Xử lý file PDF
              const processResult = await processFile(downloadResult.filePath, mimeType, apiKey);
              processedFilePath = processResult.processedPath;
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