import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

/**
 * Lấy token theo loại
 * @param {string} type - 'download' hoặc 'upload'
 * @returns {object|null} - Token hoặc null nếu không tìm thấy
 */
export function getTokenByType(type = 'download') {
  try {
    // Đường dẫn tới các file token
    const tokenFiles = {
      'download': path.join(process.cwd(), 'drive_token_download.json'),
      'upload': path.join(process.cwd(), 'drive_token_upload.json')
    };
    
    const tokenFile = tokenFiles[type];
    
    if (!tokenFile) {
      console.error(`❌ Loại token không hợp lệ: ${type}`);
      return null;
    }
    
    if (!fs.existsSync(tokenFile)) {
      console.error(`❌ Không tìm thấy file token ${type} tại: ${tokenFile}`);
      return null;
    }
    
    console.log(`🔑 DEBUG: Đang đọc file token ${type} từ ${tokenFile}`);
    
    // Đọc token từ file
    const tokenContent = fs.readFileSync(tokenFile, 'utf8');
    
    // Parse token
    const token = JSON.parse(tokenContent);
    
    // Kiểm tra token có hợp lệ không
    if (!token || !token.access_token) {
      console.error(`❌ Token ${type} không hợp lệ hoặc thiếu access_token`);
      return null;
    }
    
    // Kiểm tra thời hạn
    const expiryDate = token.expiry_date;
    if (expiryDate) {
      const now = Date.now();
      if (expiryDate < now) {
        console.error(`❌ Token ${type} đã hết hạn từ ${new Date(expiryDate).toLocaleString()}`);
        return null;
      }
      
      // Hiển thị thời hạn còn lại
      const remainingTime = (expiryDate - now) / (1000 * 60);
      console.log(`🔑 DEBUG: Token ${type} còn hạn ${remainingTime.toFixed(2)} phút`);
    }
    
    return token;
  } catch (error) {
    console.error(`❌ Lỗi khi đọc token ${type}: ${error.message}`);
    return null;
  }
}

/**
 * Kiểm tra tất cả token
 * @returns {object} - Trạng thái của các token
 */
export function checkAllTokens() {
  console.log('🔍 Đang kiểm tra tất cả token...');
  
  const downloadToken = getTokenByType('download');
  const uploadToken = getTokenByType('upload');
  
  const results = {
    download: downloadToken ? true : false,
    upload: uploadToken ? true : false
  };
  
  if (results.download && results.upload) {
    console.log('✅ Tất cả token đều hợp lệ');
  } else {
    console.error('❌ Một hoặc nhiều token không hợp lệ');
  }
  
  return results;
} 

/**
 * Kiểm tra quyền truy cập vào thư mục Google Drive
 * @param {string} folderId - ID của thư mục cần kiểm tra
 * @param {string} tokenType - Loại token ('download' hoặc 'upload')
 * @returns {Promise<object>} - Kết quả kiểm tra
 */
export async function checkFolderAccess(folderId, tokenType = 'download') {
  try {
    console.log(`🔒 Kiểm tra quyền truy cập vào thư mục ${folderId} với token ${tokenType}`);
    
    // Lấy token
    const token = getTokenByType(tokenType);
    if (!token) {
      return {
        success: false,
        error: `Không tìm thấy token ${tokenType} hợp lệ`
      };
    }
    
    // Tạo OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    // Thiết lập credentials
    oauth2Client.setCredentials(token);
    
    // Khởi tạo Google Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Thử lấy thông tin thư mục
    console.log(`🔒 Đang lấy thông tin thư mục: ${folderId}`);
    const folderInfo = await drive.files.get({
      fileId: folderId,
      fields: 'id,name,mimeType,capabilities(canEdit,canShare,canAddChildren),shared,permissions',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    
    // Kiểm tra quyền truy cập vào các file trong thư mục
    console.log(`🔒 Kiểm tra quyền liệt kê file trong thư mục: ${folderId}`);
    const listResult = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id,name)',
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    
    // Trả về kết quả
    return {
      success: true,
      folderInfo: folderInfo.data,
      canListFiles: true,
      fileCount: listResult.data.files ? listResult.data.files.length : 0,
      capabilities: folderInfo.data.capabilities || {}
    };
  } catch (error) {
    console.error(`❌ Lỗi kiểm tra quyền truy cập: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
} 

/**
 * Kiểm tra chi tiết về thư mục được chia sẻ
 * @param {string} folderId - ID của thư mục cần kiểm tra
 * @returns {Promise<object>} - Kết quả kiểm tra
 */
export async function checkSharedFolderDetails(folderId) {
  try {
    console.log(`🔍 Kiểm tra chi tiết thư mục được chia sẻ: ${folderId}`);
    
    // Lấy token download và upload để kiểm tra
    const downloadToken = getTokenByType('download');
    const uploadToken = getTokenByType('upload');
    
    if (!downloadToken && !uploadToken) {
      return {
        success: false,
        error: 'Không tìm thấy token hợp lệ'
      };
    }
    
    // Sử dụng token nào có sẵn
    const token = downloadToken || uploadToken;
    const tokenType = downloadToken ? 'download' : 'upload';
    
    // Tạo OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    // Thiết lập credentials
    oauth2Client.setCredentials(token);
    
    // Khởi tạo Google Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Lấy thông tin chi tiết về thư mục
    console.log(`🔍 Đang lấy thông tin chi tiết về thư mục: ${folderId} với token ${tokenType}`);
    const folderInfo = await drive.files.get({
      fileId: folderId,
      fields: 'id,name,mimeType,shared,sharingUser,owners,permissions,capabilities,driveId,teamDriveId',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    
    // Lấy danh sách quyền của thư mục
    console.log(`🔍 Đang lấy danh sách quyền của thư mục: ${folderId}`);
    const permissionsResponse = await drive.permissions.list({
      fileId: folderId,
      fields: 'permissions(id,type,emailAddress,role,displayName)',
      supportsAllDrives: true
    });
    
    const permissions = permissionsResponse.data.permissions || [];
    
    // Kiểm tra xem có thể liệt kê file không
    let canListFiles = false;
    let fileListError = null;
    let fileCount = 0;
    
    try {
      const listResult = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id,name)',
        pageSize: 10,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      });
      
      canListFiles = true;
      fileCount = listResult.data.files ? listResult.data.files.length : 0;
    } catch (error) {
      fileListError = error.message;
    }
    
    // Trả về kết quả
    return {
      success: true,
      folderInfo: folderInfo.data,
      permissions,
      canListFiles,
      fileCount,
      fileListError,
      isShared: folderInfo.data.shared || false,
      driveId: folderInfo.data.driveId || folderInfo.data.teamDriveId,
      tokenType
    };
  } catch (error) {
    console.error(`❌ Lỗi kiểm tra thư mục được chia sẻ: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
} 