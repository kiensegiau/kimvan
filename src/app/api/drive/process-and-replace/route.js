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
                  link: driveLink
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
