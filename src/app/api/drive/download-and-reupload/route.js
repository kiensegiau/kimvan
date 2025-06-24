/**
 * API tải xuống và upload lại file từ Google Drive mà không xử lý watermark
 * Dùng cho các loại file không phải PDF
 */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import { 
  extractDriveFileId, 
  getStoredToken,
  checkAndDeleteDuplicates
} from '@/utils/drive-utils';

// Hàm tải xuống file từ Google Drive
async function downloadFromGoogleDrive(fileId, resourceKey = null) {
  try {
    console.log(`Đang tải xuống file từ Google Drive với ID: ${fileId}`);
    
    // Lấy token đã lưu
    const storedToken = getStoredToken(0); // Sử dụng token đầu tiên
    if (!storedToken) {
      throw new Error('Không tìm thấy token Google Drive. Vui lòng cấu hình API trong cài đặt.');
    }
    
    // Tạo OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    // Thiết lập credentials
    oauth2Client.setCredentials(storedToken);
    
    // Khởi tạo Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Kiểm tra token Drive
    const aboutResponse = await drive.about.get({
      fields: 'user'
    });
    
    console.log(`Đã xác thực Drive API với người dùng: ${aboutResponse.data.user.emailAddress}`);
    
    // Lấy thông tin file
    let fileMetadata;
    try {
      const getParams = {
        fileId: fileId,
        fields: 'name,mimeType,size',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      };
      
      // Thêm resourceKey nếu có
      if (resourceKey) {
        getParams.resourceKey = resourceKey;
      }
      
      fileMetadata = await drive.files.get(getParams);
    } catch (error) {
      console.error('Lỗi khi lấy thông tin file:', error.message);
      throw new Error(`Không thể lấy thông tin file: ${error.message}`);
    }
    
    const fileName = fileMetadata.data.name;
    const mimeType = fileMetadata.data.mimeType;
    const fileSize = fileMetadata.data.size;
    
    console.log(`Thông tin file: ${fileName}, Loại: ${mimeType}, Kích thước: ${fileSize} bytes`);
    
    // Tạo thư mục tạm để lưu file
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drive-download-'));
    const outputPath = path.join(tempDir, fileName);
    
    // Tải xuống file
    try {
      const dest = fs.createWriteStream(outputPath);
      
      const getParams = {
        fileId: fileId,
        alt: 'media',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      };
      
      // Thêm resourceKey nếu có
      if (resourceKey) {
        getParams.resourceKey = resourceKey;
      }
      
      const response = await drive.files.get(
        getParams,
        { responseType: 'stream' }
      );
      
      await new Promise((resolve, reject) => {
        let progress = 0;
        
        response.data
          .on('data', chunk => {
            progress += chunk.length;
            if (fileSize) {
              const percent = Math.round((progress / fileSize) * 100);
              if (percent % 10 === 0) {
                console.log(`Đã tải xuống: ${percent}%`);
              }
            }
          })
          .on('end', () => {
            console.log('Tải xuống hoàn tất');
            resolve();
          })
          .on('error', err => {
            console.error('Lỗi khi tải xuống:', err);
            reject(err);
          })
          .pipe(dest);
      });
      
      return {
        success: true,
        filePath: outputPath,
        fileName: fileName,
        mimeType: mimeType,
        tempDir: tempDir
      };
    } catch (error) {
      console.error('Lỗi khi tải xuống file:', error.message);
      
      // Dọn dẹp thư mục tạm nếu có lỗi
      try {
        fs.rmdirSync(tempDir, { recursive: true });
      } catch (cleanupError) {
        console.error('Lỗi khi dọn dẹp thư mục tạm:', cleanupError);
      }
      
      throw new Error(`Không thể tải xuống file: ${error.message}`);
    }
  } catch (error) {
    console.error('Lỗi khi tải xuống file từ Google Drive:', error);
    throw error;
  }
}

// Hàm upload file lên Google Drive
async function uploadToGoogleDrive(filePath, fileName, mimeType, folderId = null) {
  try {
    console.log(`Đang tải lên file: ${fileName} (${mimeType})`);
    
    // Lấy token đã lưu
    const storedToken = getStoredToken(0); // Sử dụng token đầu tiên
    if (!storedToken) {
      throw new Error('Không tìm thấy token Google Drive. Vui lòng cấu hình API trong cài đặt.');
    }
    
    // Tạo OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    // Thiết lập credentials
    oauth2Client.setCredentials(storedToken);
    
    // Khởi tạo Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Xác định folder để lưu file
    let targetFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || null;
    let folderExists = false;
    let folderName = 'Mặc định';
    
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
        console.error(`Lỗi khi kiểm tra folder ${folderId}:`, folderError.message);
      }
    }
    
    // Xóa các file trùng lặp nếu có
    let duplicatesDeleted = 0;
    try {
      const result = await checkAndDeleteDuplicates(drive, fileName, targetFolderId);
      duplicatesDeleted = result.deletedCount;
      if (duplicatesDeleted > 0) {
        console.log(`Đã xóa ${duplicatesDeleted} file trùng lặp`);
      }
    } catch (duplicateError) {
      console.warn('Lỗi khi kiểm tra file trùng lặp:', duplicateError.message);
    }
    
    // Tải file lên
    try {
      const fileMetadata = {
        name: fileName,
        parents: targetFolderId ? [targetFolderId] : []
      };
      
      const media = {
        mimeType: mimeType,
        body: fs.createReadStream(filePath)
      };
      
      const uploadResponse = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id,name,webViewLink',
        supportsAllDrives: true
      });
      
      console.log(`File đã được tải lên thành công! ID: ${uploadResponse.data.id}`);
      
      return {
        success: true,
        fileId: uploadResponse.data.id,
        fileName: uploadResponse.data.name,
        webViewLink: uploadResponse.data.webViewLink,
        duplicatesDeleted: duplicatesDeleted
      };
    } catch (uploadError) {
      console.error('Lỗi khi tải lên file:', uploadError.message);
      throw new Error(`Không thể tải lên file: ${uploadError.message}`);
    }
  } catch (error) {
    console.error('Lỗi khi tải lên file lên Google Drive:', error);
    throw error;
  }
}

// API Endpoint
export async function POST(request) {
  console.log('============== BẮT ĐẦU API TẢI XUỐNG VÀ UPLOAD LẠI FILE (KHÔNG XỬ LÝ) ==============');
  
  let tempDir = null;
  
  try {
    // Lấy thông tin từ request body
    const requestData = await request.json();
    const { driveLink, fileType, skipProcessing = true } = requestData;
    
    if (!driveLink) {
      return NextResponse.json(
        { success: false, error: 'Thiếu liên kết Google Drive' },
        { status: 400 }
      );
    }
    
    console.log(`Xử lý file từ link: ${driveLink}`);
    console.log(`Loại file: ${fileType || 'không xác định'}`);
    
    // Trích xuất file ID từ link
    let fileId, resourceKey;
    try {
      const extracted = extractDriveFileId(driveLink);
      fileId = extracted.fileId;
      resourceKey = extracted.resourceKey;
    } catch (extractError) {
      console.error('Lỗi khi trích xuất ID file:', extractError);
      return NextResponse.json(
        { success: false, error: `Không thể trích xuất ID file: ${extractError.message}` },
        { status: 400 }
      );
    }
    
    // Tải xuống file từ Google Drive
    console.log(`Tải xuống file với ID: ${fileId}`);
    const downloadResult = await downloadFromGoogleDrive(fileId, resourceKey);
    tempDir = downloadResult.tempDir;
    
    // Upload lại file lên Google Drive
    console.log('Tải file lên lại Google Drive');
    const uploadResult = await uploadToGoogleDrive(
      downloadResult.filePath,
      downloadResult.fileName,
      downloadResult.mimeType
    );
    
    // Trả về kết quả
    return NextResponse.json({
      success: true,
      processedFile: {
        id: uploadResult.fileId,
        name: uploadResult.fileName,
        link: uploadResult.webViewLink
      },
      originalFile: {
        id: fileId,
        name: downloadResult.fileName,
        mimeType: downloadResult.mimeType
      },
      duplicatesDeleted: uploadResult.duplicatesDeleted
    });
  } catch (error) {
    console.error('Lỗi khi xử lý file:', error);
    
    return NextResponse.json(
      { success: false, error: `Lỗi khi xử lý file: ${error.message}` },
      { status: 500 }
    );
  } finally {
    // Dọn dẹp thư mục tạm
    if (tempDir) {
      try {
        fs.rmdirSync(tempDir, { recursive: true });
        console.log(`Đã xóa thư mục tạm: ${tempDir}`);
      } catch (cleanupError) {
        console.error('Lỗi khi dọn dẹp thư mục tạm:', cleanupError);
      }
    }
    
    console.log('============== KẾT THÚC API TẢI XUỐNG VÀ UPLOAD LẠI FILE (KHÔNG XỬ LÝ) ==============');
  }
} 