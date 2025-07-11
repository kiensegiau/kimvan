import fs from 'fs';
import path from 'path';

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