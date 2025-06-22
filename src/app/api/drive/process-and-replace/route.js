import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import { 
  extractDriveFileId, 
  createOAuth2Client, 
  checkAndDeleteDuplicates 
} from '@/utils/drive-utils';

// Tải xuống file từ Google Drive
async function downloadFromGoogleDrive(fileId) {
  console.log(`Đang tải xuống file từ Google Drive với ID: ${fileId}`);
  
  // Tạo thư mục tạm nếu chưa tồn tại
  const tempDir = path.join(os.tmpdir(), 'drive-download-');
  const outputDir = fs.mkdtempSync(tempDir);
  
  try {
    // Tạo OAuth2 client với khả năng tự động refresh token
    const oauth2Client = createOAuth2Client(1); // Sử dụng token tải xuống (index 1)
    console.log('Sử dụng token tải xuống (drive_token_download.json)');
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    console.log('Kiểm tra quyền truy cập Drive...');
    
    // Lấy thông tin file
    let fileInfo;
    try {
      fileInfo = await drive.files.get({
        fileId: fileId,
        fields: 'name,mimeType,size,capabilities'
      });
      
      // Kiểm tra quyền truy cập
      if (fileInfo.data.capabilities && !fileInfo.data.capabilities.canDownload) {
        throw new Error('Không có quyền tải xuống file này. Vui lòng kiểm tra quyền truy cập.');
      }
    } catch (error) {
      if (error.code === 404 || error.response?.status === 404) {
        throw new Error(`Không tìm thấy file với ID: ${fileId}. File có thể đã bị xóa hoặc không tồn tại.`);
      } else if (error.code === 403 || error.response?.status === 403) {
        throw new Error(`Không có quyền truy cập file với ID: ${fileId}. Vui lòng kiểm tra quyền truy cập.`);
      }
      throw error;
    }
    
    const fileName = fileInfo.data.name;
    const mimeType = fileInfo.data.mimeType;
    const outputPath = path.join(outputDir, fileName);
    
    console.log(`Tên file: ${fileName}`);
    console.log(`Loại MIME: ${mimeType}`);
    
    // Tải xuống file
    console.log(`Đang tải xuống file ${fileName}...`);
    
    try {
      const response = await drive.files.get(
        {
          fileId: fileId,
          alt: 'media'
        },
        { responseType: 'stream' }
      );
      
      // Lưu file vào đĩa
      const dest = fs.createWriteStream(outputPath);
      
      let error = null;
      response.data
        .on('error', err => {
          error = err;
          console.error('Lỗi khi tải xuống:', err);
        })
        .pipe(dest);
      
      // Đợi cho đến khi tải xuống hoàn tất
      await new Promise((resolve, reject) => {
        dest.on('finish', () => {
          console.log(`File đã được tải xuống thành công vào: ${outputPath}`);
          resolve();
        });
        dest.on('error', err => {
          console.error('Lỗi khi ghi file:', err);
          error = err;
          reject(err);
        });
      });
      
      if (error) {
        throw error;
      }
    } catch (downloadError) {
      if (downloadError.code === 403 || downloadError.response?.status === 403) {
        throw new Error('Không thể tải xuống file. Google Drive từ chối quyền truy cập. File có thể đã bị giới hạn bởi chủ sở hữu.');
      }
      throw downloadError;
    }
    
    return {
      success: true,
      filePath: outputPath,
      fileName: fileName,
      mimeType: mimeType,
      outputDir: outputDir
    };
  } catch (error) {
    console.error('Lỗi khi tải xuống file từ Google Drive:', error);
    
    // Dọn dẹp thư mục tạm nếu có lỗi
    try {
      fs.rmdirSync(outputDir, { recursive: true });
    } catch (cleanupError) {
      console.error('Lỗi khi dọn dẹp thư mục tạm:', cleanupError);
    }
    
    throw error;
  }
}

// Xử lý file (ví dụ: loại bỏ watermark)
async function processFile(filePath, mimeType) {
  console.log(`Đang xử lý file: ${filePath}`);
  
  // Tạo đường dẫn cho file đã xử lý
  const fileDir = path.dirname(filePath);
  const fileExt = path.extname(filePath);
  const fileName = path.basename(filePath, fileExt);
  const processedPath = path.join(fileDir, `${fileName}_processed${fileExt}`);
  
  try {
    // Xác định loại file và áp dụng xử lý phù hợp
    if (mimeType.includes('pdf')) {
      // Xử lý file PDF - hiện tại chỉ sao chép
      console.log('Đang xử lý file PDF...');
      fs.copyFileSync(filePath, processedPath);
    } else if (mimeType.includes('image')) {
      // Xử lý file hình ảnh - hiện tại chỉ sao chép
      console.log('Đang xử lý file hình ảnh...');
      fs.copyFileSync(filePath, processedPath);
    } else if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
      // Xử lý file bảng tính - hiện tại chỉ sao chép
      console.log('Đang xử lý file bảng tính...');
      fs.copyFileSync(filePath, processedPath);
    } else if (mimeType.includes('document') || mimeType.includes('word')) {
      // Xử lý file văn bản - hiện tại chỉ sao chép
      console.log('Đang xử lý file văn bản...');
      fs.copyFileSync(filePath, processedPath);
    } else if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
      // Xử lý file trình chiếu - hiện tại chỉ sao chép
      console.log('Đang xử lý file trình chiếu...');
      fs.copyFileSync(filePath, processedPath);
    } else if (mimeType.includes('video') || mimeType.includes('audio')) {
      // Xử lý file media - hiện tại chỉ sao chép
      console.log('Đang xử lý file media...');
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

// Tải lên file đã xử lý lên Google Drive
async function uploadToGoogleDrive(filePath, fileName, mimeType, folderId = null) {
  console.log(`Đang tải lên file đã xử lý: ${filePath}`);
  
  try {
    // Kiểm tra file có tồn tại không
    if (!fs.existsSync(filePath)) {
      console.error(`Lỗi: File không tồn tại tại đường dẫn ${filePath}`);
      throw new Error(`File không tồn tại tại đường dẫn ${filePath}`);
    }
    
    // Kiểm tra kích thước file
    const stats = fs.statSync(filePath);
    const fileSizeInBytes = stats.size;
    const fileSizeInMB = fileSizeInBytes / (1024 * 1024);
    console.log(`Kích thước file: ${fileSizeInBytes} bytes (${fileSizeInMB.toFixed(2)} MB)`);
    
    if (fileSizeInMB > 100) {
      console.warn(`Cảnh báo: File có kích thước lớn (${fileSizeInMB.toFixed(2)} MB), có thể gặp vấn đề khi tải lên`);
    }
    
    // Kiểm tra tên file có ký tự đặc biệt không
    console.log(`Tên file gốc: "${fileName}"`);
    
    // Xóa trùng đuôi file (ví dụ: .pdf.pdf hoặc .pdf.pdf.pdf)
    let sanitizedFileName = fileName;
    
    // Tìm tất cả các đuôi file trong tên
    const extensionMatch = fileName.match(/(\.[a-zA-Z0-9]+)(\1+)$/);
    if (extensionMatch) {
      // Nếu có đuôi file trùng lặp, chỉ giữ lại một đuôi
      const duplicateExtension = extensionMatch[0];
      const singleExtension = extensionMatch[1];
      sanitizedFileName = fileName.replace(duplicateExtension, singleExtension);
      console.log(`Đã xóa đuôi file trùng lặp: "${duplicateExtension}" -> "${singleExtension}"`);
    }
    
    console.log(`Tên file sau khi làm sạch: "${sanitizedFileName}"`);
    
    // Tạo OAuth2 client với khả năng tự động refresh token
    const oauth2Client = createOAuth2Client(0); // Sử dụng token tải lên (index 0)
    console.log('Sử dụng token tải lên (drive_token_upload.json)');
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Kiểm tra token
    try {
      console.log('Kiểm tra token...');
      const aboutResponse = await drive.about.get({
        fields: 'user'
      });
      console.log(`Token hợp lệ, người dùng: ${aboutResponse.data.user.emailAddress || 'không có email'}`);
    } catch (tokenError) {
      console.error('Lỗi khi kiểm tra token:', tokenError);
      throw new Error(`Token không hợp lệ hoặc đã hết hạn: ${tokenError.message}`);
    }
    
    console.log('Kiểm tra quyền truy cập Drive...');
    
    // Folder mặc định nếu không có folderId
    const defaultFolderId = "1Lt10aHyWp9VtPaImzInE0DmIcbrjJgpN"; // ID của folder mới
    
    // Xác định folder ID sẽ sử dụng
    let targetFolderId = null;
    let folderExists = false;
    let folderName = "";
    
    // Kiểm tra folder được chỉ định
    if (folderId) {
      try {
        console.log(`Kiểm tra folder ID: ${folderId}`);
        const folderResponse = await drive.files.get({
          fileId: folderId,
          fields: 'id,name,mimeType'
        });
        
        // Kiểm tra xem đây có phải là folder không
        if (folderResponse.data.mimeType === 'application/vnd.google-apps.folder') {
          targetFolderId = folderId;
          folderExists = true;
          folderName = folderResponse.data.name;
          console.log(`Folder tồn tại, sẽ sử dụng folder ID: ${targetFolderId} (${folderName})`);
        } else {
          console.warn(`ID ${folderId} không phải là folder, đó là: ${folderResponse.data.mimeType}`);
        }
      } catch (folderError) {
        if (folderError.code === 404 || folderError.response?.status === 404) {
          console.log(`Folder ID ${folderId} không tồn tại.`);
        } else {
          console.error(`Lỗi khi kiểm tra folder ${folderId}:`, folderError.message);
        }
      }
    }
    
    // Nếu folder không tồn tại hoặc không phải là folder, thử dùng folder mặc định
    if (!folderExists) {
      try {
        console.log(`Kiểm tra folder mặc định: ${defaultFolderId}`);
        const defaultFolderResponse = await drive.files.get({
          fileId: defaultFolderId,
          fields: 'id,name,mimeType'
        });
        
        if (defaultFolderResponse.data.mimeType === 'application/vnd.google-apps.folder') {
          targetFolderId = defaultFolderId;
          folderExists = true;
          folderName = defaultFolderResponse.data.name;
          console.log(`Sử dụng folder mặc định: ${targetFolderId} (${folderName})`);
        } else {
          console.warn(`ID mặc định ${defaultFolderId} không phải là folder`);
        }
      } catch (defaultFolderError) {
        console.error(`Lỗi khi kiểm tra folder mặc định:`, defaultFolderError.message);
      }
    }
    
    // Nếu cả hai folder đều không tồn tại, tạo folder mới
    if (!folderExists) {
      try {
        const folderDate = new Date().toISOString().split('T')[0];
        const newFolderName = `Processed Files ${folderDate}`;
        console.log(`Không tìm thấy folder hợp lệ, tạo folder mới: ${newFolderName}`);
        
        const newFolder = await drive.files.create({
          requestBody: {
            name: newFolderName,
            mimeType: 'application/vnd.google-apps.folder'
          },
          fields: 'id,name'
        });
        
        targetFolderId = newFolder.data.id;
        folderExists = true;
        folderName = newFolder.data.name;
        console.log(`Đã tạo folder mới: ${targetFolderId} (${folderName})`);
      } catch (createFolderError) {
        console.error('Lỗi khi tạo folder mới:', createFolderError);
        throw new Error(`Không thể tạo folder: ${createFolderError.message}`);
      }
    }
    
    // Kiểm tra xem đã có folder ID hợp lệ chưa
    if (!targetFolderId) {
      throw new Error('Không thể xác định folder để tải lên file');
    }
    
    console.log(`Folder đích: ${folderName} (${targetFolderId})`);
    
    // Tạo tên file với timestamp để tránh trùng lặp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const processedFileName = `${sanitizedFileName} (Processed-${timestamp.substring(0, 10)})`;
    
    console.log(`Tên file cuối cùng sẽ tải lên: "${processedFileName}"`);
    
    // Kiểm tra MIME type
    if (!mimeType) {
      console.warn('MIME type không được cung cấp, sử dụng application/octet-stream');
      mimeType = 'application/octet-stream';
    }
    console.log(`MIME type: ${mimeType}`);
    
    // Tạo metadata cho file
    const fileMetadata = {
      name: processedFileName,
      parents: [targetFolderId]
    };
    
    console.log(`Tải lên vào folder: ${targetFolderId}`);
    console.log(`Metadata file:`, JSON.stringify(fileMetadata, null, 2));
    
    // Tạo media cho file
    let fileStream;
    try {
      fileStream = fs.createReadStream(filePath);
      console.log('Đã tạo stream đọc file thành công');
      
      // Kiểm tra stream
      fileStream.on('error', (streamError) => {
        console.error('Lỗi khi đọc file stream:', streamError);
      });
    } catch (streamError) {
      console.error('Lỗi khi tạo stream đọc file:', streamError);
      throw new Error(`Không thể đọc file: ${streamError.message}`);
    }
    
    // Tải lên file
    console.log('Đang tải lên file...', {
      fileName: fileMetadata.name,
      mimeType: mimeType,
      folderId: targetFolderId
    });
    
    try {
      console.log('Bắt đầu quá trình tải lên...');
      
      // Thử tải lên với simple upload
      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: {
          mimeType: mimeType,
          body: fileStream
        },
        fields: 'id,name,webViewLink',
        supportsAllDrives: true
      });
      
      console.log('File đã được tải lên thành công!');
      console.log(`ID: ${response.data.id}`);
      console.log(`Tên: ${response.data.name}`);
      console.log(`Link: ${response.data.webViewLink}`);
      
      return {
        success: true,
        fileId: response.data.id,
        fileName: response.data.name,
        webViewLink: response.data.webViewLink,
        duplicatesDeleted: 0
      };
    } catch (uploadError) {
      console.error('Lỗi chi tiết khi tải lên file:', JSON.stringify({
        message: uploadError.message,
        code: uploadError.code,
        errors: uploadError.errors,
        response: uploadError.response?.data
      }, null, 2));
      
      // Thử phương án thay thế với tên file đơn giản
      try {
        console.log('Thử phương án thay thế với tên file đơn giản...');
        
        // Tạo tên file đơn giản không có ký tự đặc biệt
        const fileExt = mimeType.split('/')[1] || 'bin';
        const simpleFileName = `file_${Date.now()}.${fileExt}`;
        console.log(`Tên file đơn giản: ${simpleFileName}`);
        
        // Tạo metadata đơn giản
        const simpleMetadata = {
          name: simpleFileName,
          parents: [targetFolderId]
        };
        
        // Tạo stream đọc file mới
        const newFileStream = fs.createReadStream(filePath);
        
        // Thử tải lên với cấu hình tối giản
        const simpleResponse = await drive.files.create({
          requestBody: simpleMetadata,
          media: {
            mimeType: mimeType,
            body: newFileStream
          },
          fields: 'id,name,webViewLink'
        });
        
        console.log('File đã được tải lên thành công với tên đơn giản!');
        console.log(`ID: ${simpleResponse.data.id}`);
        console.log(`Tên: ${simpleResponse.data.name}`);
        console.log(`Link: ${simpleResponse.data.webViewLink}`);
        
        return {
          success: true,
          fileId: simpleResponse.data.id,
          fileName: simpleResponse.data.name,
          webViewLink: simpleResponse.data.webViewLink,
          duplicatesDeleted: 0
        };
      } catch (fallbackError) {
        console.error('Lỗi khi thử phương án thay thế:', fallbackError);
        
        // Thử phương án cuối cùng: sử dụng resumable upload
        try {
          console.log('Thử phương án cuối cùng với resumable upload...');
          
          const finalFileName = `backup_${Date.now()}.${mimeType.split('/')[1] || 'bin'}`;
          const finalMetadata = {
            name: finalFileName,
            parents: [targetFolderId]
          };
          
          // Sử dụng resumable upload
          const finalResponse = await drive.files.create({
            requestBody: finalMetadata,
            media: {
              mimeType: mimeType,
              body: fs.createReadStream(filePath) // Tạo stream mới
            },
            fields: 'id,name,webViewLink',
            uploadType: 'resumable'
          });
          
          console.log('File đã được tải lên thành công với phương án cuối cùng!');
          return {
            success: true,
            fileId: finalResponse.data.id,
            fileName: finalResponse.data.name,
            webViewLink: finalResponse.data.webViewLink,
            duplicatesDeleted: 0
          };
        } catch (finalError) {
          console.error('Tất cả các phương án tải lên đều thất bại:', finalError);
          throw new Error(`Không thể tải lên file: ${finalError.message}`);
        }
      }
    }
  } catch (error) {
    console.error('Lỗi khi tải lên file lên Google Drive:', error);
    throw error;
  }
}

// API Endpoint - POST
export async function POST(request) {
  console.log('============== BẮT ĐẦU API XỬ LÝ VÀ THAY THẾ FILE GOOGLE DRIVE ==============');
  
  let tempDir = null;
  
  try {
    // Parse request body
    const requestBody = await request.json();
    const { driveLink, folderId } = requestBody;
    
    console.log('Thông tin request:', {
      driveLink: driveLink || 'không có',
      folderId: folderId || 'sẽ dùng folder mặc định "1Lt10aHyWp9VtPaImzInE0DmIcbrjJgpN"'
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
    
    // Tải xuống file
    console.log(`Đang xử lý yêu cầu tải xuống: ${driveLink}`);
    const downloadResult = await downloadFromGoogleDrive(fileId);
    tempDir = downloadResult.outputDir;
    
    // Xử lý file
    const processResult = await processFile(downloadResult.filePath, downloadResult.mimeType);
    
    // Tải lên file đã xử lý
    const uploadResult = await uploadToGoogleDrive(
      processResult.processedPath,
      downloadResult.fileName,
      downloadResult.mimeType,
      folderId
    );
    
    // Dọn dẹp thư mục tạm
    try {
      fs.rmdirSync(tempDir, { recursive: true });
      console.log(`Đã xóa thư mục tạm: ${tempDir}`);
    } catch (cleanupError) {
      console.error('Lỗi khi dọn dẹp thư mục tạm:', cleanupError);
    }
    
    // Trả về kết quả
    return NextResponse.json({
      success: true,
      originalFile: {
        id: fileId,
        link: driveLink
      },
      processedFile: {
        id: uploadResult.fileId,
        name: uploadResult.fileName,
        link: uploadResult.webViewLink
      },
      duplicatesDeleted: uploadResult.duplicatesDeleted || 0
    });
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
    
    return NextResponse.json(
      { success: false, error: `Lỗi khi xử lý và thay thế file: ${error.message}` },
      { status: 500 }
    );
  }
}
