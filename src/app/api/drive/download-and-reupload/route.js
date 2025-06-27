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
async function uploadToGoogleDrive(filePath, fileName, mimeType, folderId = null, courseName = null) {
  try {
    console.log(`Đang tải lên file: ${fileName} (${mimeType})`);
    
    // Lấy token đã lưu
    const storedToken = getStoredToken(0); // Sử dụng token đầu tiên
    if (!storedToken) {
      throw new Error('Không tìm thấy token Google Drive. Vui lòng cấu hình API trong cài đặt.');
    }
    
    // Tạo OAuth2 client
    const oauth2Client = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      },
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    
    // Khởi tạo Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Xác định folder để lưu file
    let targetFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || null;
    let folderName = 'Mặc định';
    
    // Nếu có courseName, tìm hoặc tạo thư mục cha có tên là courseName
    if (courseName) {
      console.log(`Tìm hoặc tạo thư mục cha có tên: ${courseName}`);
      
      try {
        // Tìm folder có tên là courseName
        const folderResponse = await drive.files.list({
          q: `name='${courseName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id, name, createdTime)',
          spaces: 'drive'
        });
        
        let courseFolder = null;
        
        // Nếu folder đã tồn tại, sử dụng nó
        if (folderResponse.data.files && folderResponse.data.files.length > 0) {
          // Kiểm tra xem có nhiều folder trùng tên không
          if (folderResponse.data.files.length > 1) {
            console.log(`Phát hiện ${folderResponse.data.files.length} folder trùng tên "${courseName}", tiến hành dọn dẹp...`);
            
            // Sắp xếp theo thời gian tạo và lấy folder mới nhất
            folderResponse.data.files.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
            courseFolder = folderResponse.data.files[0];
            console.log(`Sử dụng folder mới nhất: ${courseFolder.name} (ID: ${courseFolder.id})`);
            
            // Xóa các folder trùng lặp
            let deletedCount = 0;
            for (let i = 1; i < folderResponse.data.files.length; i++) {
              try {
                await drive.files.delete({ fileId: folderResponse.data.files[i].id });
                console.log(`Đã xóa folder trùng lặp ID: ${folderResponse.data.files[i].id}`);
                deletedCount++;
              } catch (deleteError) {
                console.error(`Không thể xóa folder trùng lặp: ${deleteError.message}`);
              }
            }
            console.log(`Đã xóa ${deletedCount}/${folderResponse.data.files.length - 1} folder trùng lặp`);
          } else {
            courseFolder = folderResponse.data.files[0];
            console.log(`Đã tìm thấy thư mục "${courseName}" với ID: ${courseFolder.id}`);
          }
        } else {
          // Nếu folder chưa tồn tại, tạo mới
          console.log(`Thư mục "${courseName}" chưa tồn tại, tiến hành tạo mới...`);
          
          const folderMetadata = {
            name: courseName,
            mimeType: 'application/vnd.google-apps.folder'
          };
          
          const folder = await drive.files.create({
            resource: folderMetadata,
            fields: 'id, name, webViewLink'
          });
          
          courseFolder = folder.data;
          console.log(`Đã tạo thư mục "${courseName}" với ID: ${courseFolder.id}`);
          
          // Kiểm tra ngay các folder trùng lặp có thể đã được tạo trước đó
          try {
            const checkDuplicateResponse = await drive.files.list({
              q: `name='${courseName}' and mimeType='application/vnd.google-apps.folder' and id!='${courseFolder.id}' and trashed=false`,
              fields: 'files(id, name)',
              spaces: 'drive'
            });
            
            if (checkDuplicateResponse.data.files && checkDuplicateResponse.data.files.length > 0) {
              console.log(`Phát hiện ${checkDuplicateResponse.data.files.length} folder trùng lặp sau khi tạo, tiến hành xóa...`);
              
              let deletedCount = 0;
              for (const duplicateFolder of checkDuplicateResponse.data.files) {
                try {
                  await drive.files.delete({ fileId: duplicateFolder.id });
                  console.log(`Đã xóa folder trùng lặp ID: ${duplicateFolder.id}`);
                  deletedCount++;
                } catch (deleteError) {
                  console.error(`Không thể xóa folder trùng lặp: ${deleteError.message}`);
                }
              }
              console.log(`Đã xóa ${deletedCount}/${checkDuplicateResponse.data.files.length} folder trùng lặp`);
            }
          } catch (checkError) {
            console.error(`Lỗi khi kiểm tra folder trùng lặp: ${checkError.message}`);
          }
        }
        
        // Sử dụng courseFolder làm thư mục đích
        targetFolderId = courseFolder.id;
        folderName = courseName;
      } catch (folderError) {
        console.error(`Lỗi khi tìm hoặc tạo thư mục "${courseName}":`, folderError.message);
        console.log(`Sử dụng thư mục mặc định hoặc folderId được chỉ định thay thế.`);
      }
    }
    
    // Kiểm tra folder được chỉ định
    if (folderId && !targetFolderId) {
      try {
        console.log(`Kiểm tra folder ID: ${folderId}`);
        const folderResponse = await drive.files.get({
          fileId: folderId,
          fields: 'id,name,mimeType'
        });
        
        // Kiểm tra xem đây có phải là folder không
        if (folderResponse.data.mimeType === 'application/vnd.google-apps.folder') {
          targetFolderId = folderId;
          folderName = folderResponse.data.name;
          console.log(`Folder tồn tại, sẽ sử dụng folder ID: ${targetFolderId} (${folderName})`);
        } else {
          console.warn(`ID ${folderId} không phải là folder, đó là: ${folderResponse.data.mimeType}`);
        }
      } catch (folderError) {
        console.error(`Lỗi khi kiểm tra folder ${folderId}:`, folderError.message);
      }
    }
    
    // Nếu không có folder nào được xác định, tạo folder mới
    if (!targetFolderId) {
      try {
        console.log('Không có folder nào được xác định, tìm hoặc tạo folder mặc định...');
        const defaultFolderName = 'Files từ Google Drive';
        
        // Kiểm tra xem folder mặc định đã tồn tại chưa
        const folderResponse = await drive.files.list({
          q: `name='${defaultFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id, name, createdTime)',
          spaces: 'drive'
        });
        
        if (folderResponse.data.files && folderResponse.data.files.length > 0) {
          // Kiểm tra xem có nhiều folder trùng tên không
          if (folderResponse.data.files.length > 1) {
            console.log(`Phát hiện ${folderResponse.data.files.length} folder mặc định trùng tên, tiến hành dọn dẹp...`);
            
            // Sắp xếp theo thời gian tạo và lấy folder mới nhất
            folderResponse.data.files.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
            const defaultFolder = folderResponse.data.files[0];
            
            // Xóa các folder trùng lặp
            let deletedCount = 0;
            for (let i = 1; i < folderResponse.data.files.length; i++) {
              try {
                await drive.files.delete({ fileId: folderResponse.data.files[i].id });
                console.log(`Đã xóa folder mặc định trùng lặp ID: ${folderResponse.data.files[i].id}`);
                deletedCount++;
              } catch (deleteError) {
                console.error(`Không thể xóa folder mặc định trùng lặp: ${deleteError.message}`);
              }
            }
            console.log(`Đã xóa ${deletedCount}/${folderResponse.data.files.length - 1} folder mặc định trùng lặp`);
            
            targetFolderId = defaultFolder.id;
            folderName = defaultFolder.name;
            console.log(`Sử dụng folder mặc định đã tồn tại: ${targetFolderId} (${folderName})`);
          } else {
            targetFolderId = folderResponse.data.files[0].id;
            folderName = folderResponse.data.files[0].name;
            console.log(`Đã tìm thấy folder mặc định: ${targetFolderId} (${folderName})`);
          }
        } else {
          // Tạo folder mặc định mới
          console.log(`Folder mặc định chưa tồn tại, tiến hành tạo mới...`);
          const folderMetadata = {
            name: defaultFolderName,
            mimeType: 'application/vnd.google-apps.folder'
          };
          
          const folder = await drive.files.create({
            resource: folderMetadata,
            fields: 'id, name'
          });
          
          targetFolderId = folder.data.id;
          folderName = folder.data.name;
          console.log(`Đã tạo folder mặc định: ${targetFolderId} (${folderName})`);
          
          // Kiểm tra ngay các folder trùng lặp có thể đã được tạo trước đó
          try {
            const checkDuplicateResponse = await drive.files.list({
              q: `name='${defaultFolderName}' and mimeType='application/vnd.google-apps.folder' and id!='${targetFolderId}' and trashed=false`,
              fields: 'files(id, name)',
              spaces: 'drive'
            });
            
            if (checkDuplicateResponse.data.files && checkDuplicateResponse.data.files.length > 0) {
              console.log(`Phát hiện ${checkDuplicateResponse.data.files.length} folder mặc định trùng lặp sau khi tạo, tiến hành xóa...`);
              
              let deletedCount = 0;
              for (const duplicateFolder of checkDuplicateResponse.data.files) {
                try {
                  await drive.files.delete({ fileId: duplicateFolder.id });
                  console.log(`Đã xóa folder mặc định trùng lặp ID: ${duplicateFolder.id}`);
                  deletedCount++;
                } catch (deleteError) {
                  console.error(`Không thể xóa folder mặc định trùng lặp: ${deleteError.message}`);
                }
              }
              console.log(`Đã xóa ${deletedCount}/${checkDuplicateResponse.data.files.length} folder mặc định trùng lặp`);
            }
          } catch (checkError) {
            console.error(`Lỗi khi kiểm tra folder mặc định trùng lặp: ${checkError.message}`);
          }
        }
      } catch (createFolderError) {
        console.error('Lỗi khi tìm hoặc tạo folder mặc định:', createFolderError.message);
        throw new Error(`Không thể tìm hoặc tạo folder mặc định: ${createFolderError.message}`);
      }
    }
    
    // Kiểm tra xem file đã tồn tại trong folder chưa
    console.log(`Kiểm tra xem file "${fileName}" đã tồn tại trong folder "${folderName}" chưa...`);
    
    // Xử lý tên file để sử dụng trong truy vấn
    const escapedFileName = fileName.replace(/'/g, "\\'");
    
    let duplicatesDeleted = 0;
    
    try {
      // Tìm các file trùng tên trong folder đích
      const duplicatesResponse = await drive.files.list({
        q: `name='${escapedFileName}' and '${targetFolderId}' in parents and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive'
      });
      
      // Xóa các file trùng tên nếu có
      if (duplicatesResponse.data.files && duplicatesResponse.data.files.length > 0) {
        console.log(`Tìm thấy ${duplicatesResponse.data.files.length} file trùng tên trong folder đích, tiến hành xóa...`);
        
        for (const duplicate of duplicatesResponse.data.files) {
          console.log(`Xóa file trùng tên: ${duplicate.name} (ID: ${duplicate.id})`);
          
          try {
            await drive.files.delete({
              fileId: duplicate.id
            });
            
            duplicatesDeleted++;
            console.log(`Đã xóa file trùng tên: ${duplicate.name}`);
          } catch (deleteError) {
            console.error(`Lỗi khi xóa file trùng tên ${duplicate.name}:`, deleteError.message);
          }
        }
      } else {
        console.log(`Không tìm thấy file trùng tên trong folder đích.`);
      }
    } catch (duplicatesError) {
      console.error(`Lỗi khi tìm kiếm file trùng tên:`, duplicatesError.message);
    }
    
    // Tạo metadata cho file
    const fileMetadata = {
      name: fileName,
      parents: [targetFolderId]
    };
    
    // Tạo media cho file
    const media = {
      mimeType: mimeType,
      body: fs.createReadStream(filePath)
    };
    
    // Tải file lên Drive
    console.log(`Đang tải file "${fileName}" lên thư mục "${folderName}" (ID: ${targetFolderId})...`);
    
    const uploadResponse = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink'
    });
    
    console.log(`File đã được tải lên thành công: ${uploadResponse.data.name} (ID: ${uploadResponse.data.id})`);
    
    return {
      success: true,
      fileId: uploadResponse.data.id,
      fileName: uploadResponse.data.name,
      webViewLink: uploadResponse.data.webViewLink,
      webContentLink: uploadResponse.data.webContentLink,
      duplicatesDeleted: duplicatesDeleted,
      folderName: folderName,
      folderId: targetFolderId
    };
  } catch (error) {
    console.error('Lỗi khi tải file lên Google Drive:', error);
    throw new Error(`Không thể tải file lên Google Drive: ${error.message}`);
  }
}

// API Endpoint
export async function POST(request) {
  console.log('============== BẮT ĐẦU API TẢI XUỐNG VÀ TẢI LÊN LẠI FILE GOOGLE DRIVE ==============');
  
  let tempDir = null;
  
  try {
    // Parse request body
    const requestBody = await request.json();
    const { driveLink, folderId, fileType, skipProcessing, courseName } = requestBody;
    
    console.log('Thông tin request:', {
      driveLink: driveLink || 'không có',
      folderId: folderId || 'không có (sẽ dùng folder mặc định)',
      fileType: fileType || 'không xác định',
      skipProcessing: skipProcessing ? 'true' : 'false',
      courseName: courseName || 'không có (sẽ lưu vào thư mục mặc định)'
    });
    
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
      downloadResult.mimeType,
      folderId,
      courseName
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