import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { createOAuth2Client } from '@/utils/drive-utils';

/**
 * Tải lên file đã xử lý lên Google Drive
 * @param {string} filePath - Đường dẫn file cần tải lên
 * @param {string} fileName - Tên file
 * @param {string} mimeType - MIME type của file
 * @param {string} folderId - ID của folder đích (tùy chọn)
 * @param {string} courseName - Tên khóa học (tùy chọn)
 * @param {string} originalFileId - ID của file gốc (để thêm vào tên file)
 * @returns {Promise<Object>} - Kết quả tải lên
 */
export async function uploadToGoogleDrive(filePath, fileName, mimeType, folderId = null, courseName = null, originalFileId = null) {
  console.log(`Đang tải lên file đã xử lý: ${filePath}`);
  
  try {
    // Kiểm tra xem filePath có phải là đối tượng không
    if (typeof filePath === 'object' && filePath !== null) {
      console.log('Phát hiện filePath là đối tượng, không phải chuỗi. Đang chuyển đổi...');
      
      // Nếu đối tượng có thuộc tính path hoặc processedPath, sử dụng nó
      if (filePath.path) {
        filePath = filePath.path;
      } else if (filePath.processedPath) {
        filePath = filePath.processedPath;
      } else {
        console.error('Không thể xác định đường dẫn file từ đối tượng:', filePath);
        throw new Error('Không thể xác định đường dẫn file từ đối tượng');
      }
      
      console.log(`Đã chuyển đổi filePath thành: ${filePath}`);
    }
    
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
    
    // Thêm ID file gốc vào tên file để tránh trùng lặp
    if (originalFileId) {
      const fileExt = path.extname(sanitizedFileName);
      const fileNameWithoutExt = path.basename(sanitizedFileName, fileExt);
      // Kiểm tra nếu tên file đã có ID này rồi thì không thêm nữa
      if (!fileNameWithoutExt.includes(`_${originalFileId}`)) {
        const shortId = originalFileId.substring(0, 8); // Lấy 8 ký tự đầu của ID
        sanitizedFileName = `${fileNameWithoutExt}_${shortId}${fileExt}`;
        console.log(`Đã thêm ID file gốc vào tên file: "${sanitizedFileName}"`);
      }
    }
    
    console.log(`Tên file sau khi làm sạch: "${sanitizedFileName}"`);
    
    // Tạo OAuth2 client với khả năng tự động refresh token
    const oauth2Client = createOAuth2Client(0);
    
    // Khởi tạo Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Xác định folder gốc để lưu file
    let rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1Lt10aHyWp9VtPaImzInE0DmIcbrjJgpN';
    
    // Ưu tiên dùng folderId được chỉ định nếu hợp lệ
    if (folderId) {
      try {
        console.log(`Kiểm tra folder ID được chỉ định: ${folderId}`);
        const folderResponse = await drive.files.get({
          fileId: folderId,
          fields: 'id,name,mimeType',
          supportsAllDrives: true
        });
        
        // Kiểm tra xem đây có phải là folder không
        if (folderResponse.data.mimeType === 'application/vnd.google-apps.folder') {
          rootFolderId = folderId;
          console.log(`Folder tồn tại, sẽ sử dụng folder gốc ID: ${rootFolderId} (${folderResponse.data.name})`);
        } else {
          console.warn(`ID ${folderId} không phải là folder, đó là: ${folderResponse.data.mimeType}`);
        }
      } catch (folderError) {
        console.error(`Lỗi khi kiểm tra folder ${folderId}:`, folderError.message);
        console.log(`Sẽ sử dụng folder mặc định: ${rootFolderId}`);
      }
    }
    
    // Biến để lưu ID folder đích cuối cùng sẽ chứa file
    let targetFolderId = rootFolderId;
    let folderName = 'Mặc định';
    
    // YÊU CẦU MỚI: LUÔN tạo folder con dựa trên courseName nếu có
    // Nếu courseName không được cung cấp, sử dụng 'Unknown' để tránh upload trực tiếp vào folder gốc
    const folderNameToCreate = courseName || 'Unknown';
    if (folderNameToCreate) {
      console.log(`Tìm hoặc tạo thư mục con dựa trên tên: ${folderNameToCreate} trong folder gốc: ${rootFolderId}`);
      
      try {
        // Tìm folder có tên là folderNameToCreate trong folder gốc
        const folderResponse = await drive.files.list({
          q: `name='${folderNameToCreate}' and mimeType='application/vnd.google-apps.folder' and '${rootFolderId}' in parents and trashed=false`,
          fields: 'files(id, name)',
          spaces: 'drive'
        });
        
        let courseFolder = null;
        
        // Nếu folder đã tồn tại, sử dụng nó
        if (folderResponse.data.files && folderResponse.data.files.length > 0) {
          courseFolder = folderResponse.data.files[0];
          console.log(`Đã tìm thấy thư mục con "${folderNameToCreate}" với ID: ${courseFolder.id}`);
        } else {
          // Nếu folder chưa tồn tại, tạo mới
          console.log(`Thư mục con "${folderNameToCreate}" chưa tồn tại trong folder gốc, tiến hành tạo mới...`);
          
          const folderMetadata = {
            name: folderNameToCreate,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [rootFolderId] // Đặt trong thư mục gốc đã xác định
          };
          
          const folder = await drive.files.create({
            resource: folderMetadata,
            fields: 'id, name, webViewLink'
          });
          
          courseFolder = folder.data;
          console.log(`Đã tạo thư mục con "${folderNameToCreate}" với ID: ${courseFolder.id} trong folder gốc: ${rootFolderId}`);
        }
        
        // Sử dụng courseFolder làm thư mục đích cuối cùng
        targetFolderId = courseFolder.id;
        folderName = folderNameToCreate;
        console.log(`Sẽ tải file lên thư mục con: ${folderName} (ID: ${targetFolderId})`);
      } catch (folderError) {
        console.error(`Lỗi khi tìm hoặc tạo thư mục con "${folderNameToCreate}":`, folderError.message);
        console.log(`Sử dụng thư mục gốc ${rootFolderId} thay thế.`);
        targetFolderId = rootFolderId;
      }
    } else {
      console.log(`Không có tên sheet/khóa học, sẽ tạo folder mặc định 'Unknown'`);
      // Tạo folder 'Unknown' thay vì upload trực tiếp vào folder gốc
      try {
        const unknownFolderResponse = await drive.files.list({
          q: `name='Unknown' and mimeType='application/vnd.google-apps.folder' and '${rootFolderId}' in parents and trashed=false`,
          fields: 'files(id, name)',
          spaces: 'drive'
        });
        
        let unknownFolder = null;
        
        if (unknownFolderResponse.data.files && unknownFolderResponse.data.files.length > 0) {
          unknownFolder = unknownFolderResponse.data.files[0];
          console.log(`Đã tìm thấy thư mục 'Unknown' với ID: ${unknownFolder.id}`);
        } else {
          const folderMetadata = {
            name: 'Unknown',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [rootFolderId]
          };
          
          const folder = await drive.files.create({
            resource: folderMetadata,
            fields: 'id, name, webViewLink'
          });
          
          unknownFolder = folder.data;
          console.log(`Đã tạo thư mục 'Unknown' với ID: ${unknownFolder.id}`);
        }
        
        targetFolderId = unknownFolder.id;
        folderName = 'Unknown';
      } catch (error) {
        console.error(`Lỗi khi tạo thư mục 'Unknown':`, error.message);
      }
    }
    
    // Kiểm tra xem file đã tồn tại trong folder chưa
    console.log(`Kiểm tra xem file "${sanitizedFileName}" đã tồn tại trong folder "${folderName}" chưa...`);
    
    // Xử lý tên file để sử dụng trong truy vấn
    const escapedFileName = sanitizedFileName.replace(/'/g, "\\'");
    
    let duplicatesDeleted = 0;
    let existingFile = null;
    
    try {
      // Tìm các file trùng tên trong folder đích
      const duplicatesResponse = await drive.files.list({
        q: `name='${escapedFileName}' and '${targetFolderId}' in parents and trashed=false`,
        fields: 'files(id, name, webViewLink, webContentLink)',
        spaces: 'drive'
      });
      
      // Kiểm tra nếu file đã tồn tại
      if (duplicatesResponse.data.files && duplicatesResponse.data.files.length > 0) {
        // Lưu thông tin file đã tồn tại
        existingFile = duplicatesResponse.data.files[0];
        console.log(`✅ File "${sanitizedFileName}" đã tồn tại trong folder đích (ID: ${existingFile.id})`);
        console.log(`🔄 Sử dụng file đã tồn tại thay vì tạo mới hoặc cập nhật nội dung`);
        
        // Trả về thông tin file đã tồn tại ngay lập tức
        return {
          success: true,
          fileId: existingFile.id,
          fileName: existingFile.name,
          webViewLink: existingFile.webViewLink,
          webContentLink: existingFile.webContentLink,
          isExisting: true // Đánh dấu đây là file đã tồn tại
        };
      } else {
        console.log(`File "${sanitizedFileName}" chưa tồn tại trong folder đích, sẽ tạo mới...`);
      }
    } catch (duplicatesError) {
      console.error(`Lỗi khi tìm kiếm file trùng tên:`, duplicatesError.message);
    }
    
    // Tạo metadata cho file
    const fileMetadata = {
      name: sanitizedFileName,
      parents: [targetFolderId]
    };
    
    // Tạo media cho file
    const media = {
      mimeType: mimeType,
      body: fs.createReadStream(filePath)
    };
    
    // Tải file lên Drive và lấy webViewLink và webContentLink
    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink'
    });
    
    console.log(`File đã được tải lên thành công: ${response.data.name} (ID: ${response.data.id})`);
    
    return {
      success: true,
      fileId: response.data.id,
      fileName: response.data.name,
      webViewLink: response.data.webViewLink,
      webContentLink: response.data.webContentLink,
      duplicatesDeleted: duplicatesDeleted,
      folderName: folderName,
      folderId: targetFolderId
    };
  } catch (error) {
    console.error('Lỗi khi tải file lên Google Drive:', error);
    throw new Error(`Không thể tải file lên Google Drive: ${error.message}`);
  }
}

/**
 * Tạo folder trên Google Drive
 * @param {string} folderName - Tên folder cần tạo
 * @param {string} parentFolderId - ID của folder cha (tùy chọn)
 * @returns {Promise<Object>} - Thông tin folder đã tạo
 */
export async function createFolder(folderName, parentFolderId = null) {
  console.log(`Tạo folder "${folderName}" trên Google Drive...`);
  
  try {
    // Tạo OAuth2 client với khả năng tự động refresh token
    const oauth2Client = createOAuth2Client(0);
    
    // Khởi tạo Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Xác định folder cha
    const parents = parentFolderId ? [parentFolderId] : [];
    
    // Tạo folder
    const folderMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parents
    };
    
    const response = await drive.files.create({
      resource: folderMetadata,
      fields: 'id, name, webViewLink'
    });
    
    console.log(`Đã tạo folder "${folderName}" với ID: ${response.data.id}`);
    
    return {
      success: true,
      folderId: response.data.id,
      folderName: response.data.name,
      webViewLink: response.data.webViewLink
    };
  } catch (error) {
    console.error(`Lỗi khi tạo folder "${folderName}":`, error);
    throw new Error(`Không thể tạo folder: ${error.message}`);
  }
}

/**
 * Tìm folder trên Google Drive theo tên
 * @param {string} folderName - Tên folder cần tìm
 * @param {string} parentFolderId - ID của folder cha (tùy chọn)
 * @returns {Promise<Object>} - Thông tin folder đã tìm thấy
 */
export async function findFolder(folderName, parentFolderId = null) {
  console.log(`Tìm folder "${folderName}" trên Google Drive...`);
  
  try {
    // Tạo OAuth2 client với khả năng tự động refresh token
    const oauth2Client = createOAuth2Client(0);
    
    // Khởi tạo Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Xây dựng query
    let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    
    if (parentFolderId) {
      query += ` and '${parentFolderId}' in parents`;
    }
    
    // Tìm folder
    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, webViewLink, createdTime)',
      spaces: 'drive'
    });
    
    if (response.data.files && response.data.files.length > 0) {
      // Ghi log số lượng folder trùng tên được tìm thấy
      console.log(`Tìm thấy ${response.data.files.length} folder có tên "${folderName}"`);
      
      if (response.data.files.length > 1) {
        // Nếu có nhiều folder cùng tên, sắp xếp theo thời gian tạo và lấy folder mới nhất
        response.data.files.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
        console.log(`Có ${response.data.files.length} folder trùng tên, sử dụng folder mới nhất (ID: ${response.data.files[0].id})`);
      }
      
      const folder = response.data.files[0];
      console.log(`Đã tìm thấy folder "${folderName}" với ID: ${folder.id}`);
      
      return {
        success: true,
        folderId: folder.id,
        folderName: folder.name,
        webViewLink: folder.webViewLink,
        duplicateCount: response.data.files.length - 1 // Số lượng folder trùng lặp
      };
    } else {
      console.log(`Không tìm thấy folder "${folderName}"`);
      
      return {
        success: false,
        message: `Không tìm thấy folder "${folderName}"`
      };
    }
  } catch (error) {
    console.error(`Lỗi khi tìm folder "${folderName}":`, error);
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Tìm hoặc tạo folder trên Google Drive
 * @param {string} folderName - Tên folder cần tìm hoặc tạo
 * @param {string} parentFolderId - ID của folder cha (tùy chọn)
 * @param {boolean} cleanupDuplicates - Có xóa các folder trùng lặp không (mặc định: false)
 * @returns {Promise<Object>} - Thông tin folder
 */
export async function findOrCreateFolder(folderName, parentFolderId = null, cleanupDuplicates = false) {
  // Tìm folder
  const findResult = await findFolder(folderName, parentFolderId);
  
  if (findResult.success) {
    // Nếu có folder trùng lặp và cần xóa
    if (cleanupDuplicates && findResult.duplicateCount > 0) {
      try {
        console.log(`Phát hiện ${findResult.duplicateCount} folder trùng lặp, tiến hành xóa...`);
        
        // Tạo OAuth2 client với khả năng tự động refresh token
        const oauth2Client = createOAuth2Client(0);
        
        // Khởi tạo Drive API
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        
        // Xây dựng query để lấy tất cả folder trùng tên
        let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        
        if (parentFolderId) {
          query += ` and '${parentFolderId}' in parents`;
        }
        
        // Lấy danh sách tất cả folder trùng tên
        const response = await drive.files.list({
          q: query,
          fields: 'files(id, name, createdTime)',
          spaces: 'drive'
        });
        
        // Sắp xếp theo thời gian tạo, giữ lại folder mới nhất
        if (response.data.files && response.data.files.length > 1) {
          response.data.files.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
          
          // Giữ lại folder mới nhất, xóa các folder còn lại
          const keepFolderId = response.data.files[0].id;
          let deletedCount = 0;
          
          for (let i = 1; i < response.data.files.length; i++) {
            const folderToDelete = response.data.files[i];
            console.log(`Xóa folder trùng lặp: ${folderToDelete.name} (ID: ${folderToDelete.id})`);
            
            try {
              await drive.files.delete({
                fileId: folderToDelete.id
              });
              deletedCount++;
            } catch (deleteError) {
              console.error(`Lỗi khi xóa folder trùng lặp: ${deleteError.message}`);
            }
          }
          
          console.log(`Đã xóa ${deletedCount}/${findResult.duplicateCount} folder trùng lặp`);
        }
      } catch (cleanupError) {
        console.error(`Lỗi khi xóa folder trùng lặp: ${cleanupError.message}`);
      }
    }
    
    return {
      success: true,
      folder: {
        id: findResult.folderId,
        name: findResult.folderName,
        webViewLink: findResult.webViewLink
      },
      duplicateCount: findResult.duplicateCount || 0
    };
  }
  
  // Nếu không tìm thấy, tạo mới
  const createResult = await createFolder(folderName, parentFolderId);
  
  if (createResult.success) {
    return {
      success: true,
      folder: {
        id: createResult.folderId,
        name: createResult.folderName,
        webViewLink: createResult.webViewLink
      },
      isNewFolder: true
    };
  }
  
  return {
    success: false,
    error: createResult.error || 'Không thể tạo folder'
  };
} 