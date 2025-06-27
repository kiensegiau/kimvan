import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { extractDriveFileId } from '@/utils/drive-utils';
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

// API Endpoint - POST
export async function POST(request) {
  console.log('============== BẮT ĐẦU API XỬ LÝ VÀ THAY THẾ FILE GOOGLE DRIVE ==============');
  
  let tempDir = null;
  // Đặt timeout cho toàn bộ quá trình (60 phút)
  const GLOBAL_TIMEOUT = 60 * 60 * 1000;
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
      displayText = null // Text hiển thị trong ô
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
      googleSheetName: googleSheetName || 'không có'
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
    
    // Kiểm tra MIME type của file trước khi tải xuống
    console.log(`Kiểm tra MIME type của file với ID: ${fileId}`);
    const fileInfoResult = await checkFileInfo(fileId);
    
    if (!fileInfoResult.success) {
      console.error(`Lỗi khi kiểm tra thông tin file: ${fileInfoResult.message}`);
      
      if (fileInfoResult.error === 'FILE_NOT_FOUND') {
        return NextResponse.json(
          { error: fileInfoResult.message },
          { status: 404 }
        );
      }
      
      if (fileInfoResult.error === 'PERMISSION_DENIED') {
        return NextResponse.json(
          { error: fileInfoResult.message },
          { status: 403 }
        );
      }
      
      return NextResponse.json(
        { error: `Lỗi khi kiểm tra thông tin file: ${fileInfoResult.message}` },
        { status: 500 }
      );
    }
    
    const fileInfo = fileInfoResult.fileInfo;
    const mimeType = fileInfo.mimeType;
    console.log(`MIME type của file: ${mimeType}`);
    
    // Tạo promise cho quá trình xử lý
    const processingPromise = (async () => {
      try {
        // Xác định folder đích dựa trên thông tin request
        let targetFolderId = folderId;
        let targetFolderName = '';
        
        // Nếu là tài liệu sheet, tạo cấu trúc folder đặc biệt
        if (isSheetDocument && sheetName) {
          console.log(`Đây là tài liệu sheet: ${sheetName}, tạo cấu trúc folder đặc biệt`);
          
          // Tạo/tìm folder "Tài liệu sheet cũ"
          const mainFolderName = "Tài liệu sheet cũ";
          const mainFolderResult = await findOrCreateFolder(mainFolderName, folderId);
          
          if (!mainFolderResult.success) {
            throw new Error(`Không thể tạo folder chính "${mainFolderName}": ${mainFolderResult.error || 'Lỗi không xác định'}`);
          }
          
          // Tạo/tìm folder con với tên sheet
          const sheetFolderResult = await findOrCreateFolder(sheetName, mainFolderResult.folder.id);
          
          if (!sheetFolderResult.success) {
            throw new Error(`Không thể tạo folder con "${sheetName}": ${sheetFolderResult.error || 'Lỗi không xác định'}`);
          }
          
          targetFolderId = sheetFolderResult.folder.id;
          targetFolderName = sheetName;
          
          console.log(`Đã tạo/tìm cấu trúc folder: ${mainFolderName}/${sheetName} (ID: ${targetFolderId})`);
        } else if (courseName) {
          // Nếu có courseName, sử dụng nó làm folder cha
          console.log(`Sử dụng courseName làm folder cha: ${courseName}`);
          targetFolderName = courseName;
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
    
    return {
            success: folderResult.success,
            isFolder: true,
            originalFolder: {
              id: fileId,
              name: fileInfo.name,
              link: driveLink
            },
            targetFolder: {
              id: targetFolderId,
              name: targetFolderName || 'Mặc định'
            },
            processedFiles: folderResult.processedFiles,
            processedFolders: folderResult.processedFolders,
            skippedFiles: folderResult.skippedFiles,
            errors: folderResult.errors,
            files: folderResult.files,
            processingTime: processingTime,
            summary: summaryMessage,
            // Thêm URL của folder đã xử lý để cập nhật trong sheet
            processedFile: {
              id: targetFolderId,
              name: targetFolderName || fileInfo.name,
              link: `https://drive.google.com/drive/folders/${targetFolderId}`
            }
          };
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
                displayText // Text hiển thị (nếu có)
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
                uploadResult.webViewLink
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
        
        // Trả về kết quả
        return {
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
