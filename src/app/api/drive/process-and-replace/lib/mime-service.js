/**
 * mime-service.js
 * Module quản lý kiểm tra và xử lý MIME type cho các file
 */

/**
 * Kiểm tra MIME type của file từ Google Drive API
 * @param {string} fileId - ID của file cần kiểm tra
 * @returns {Promise<Object>} - Thông tin MIME type
 */
export async function checkMimeType(fileId) {
  try {
    console.log(`🔍 Kiểm tra MIME type cho file: ${fileId}`);
    
    // Gọi API check-file-type
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/drive/check-file-type`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileId })
    });

    if (!response.ok) {
      throw new Error(`Lỗi API check-file-type: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Kết quả kiểm tra MIME type:`, data);

    return {
      success: true,
      mimeType: data.mimeType,
      isFolder: data.isFolder,
      isPdf: data.isPdf,
      isGoogleDoc: data.isGoogleDoc
    };
  } catch (error) {
    console.error(`❌ Lỗi khi kiểm tra MIME type:`, error);
    return {
      success: false,
      error: error.message,
      statusCode: error.message.includes('404') ? 404 : 
                  error.message.includes('403') ? 403 : 
                  error.message.includes('500') ? 500 : 0
    };
  }
}

/**
 * Kiểm tra thông tin file từ Google Drive API
 * @param {string} fileId - ID của file cần kiểm tra
 * @returns {Promise<Object>} - Thông tin file
 */
export async function checkFileInfo(fileId) {
  try {
    console.log(`Kiểm tra thông tin file: ${fileId}`);
    
    // Import hàm getTokenByType từ utils
    const { getTokenByType } = await import('../../remove-watermark/lib/utils.js');
    const { google } = await import('googleapis');
    
    // Lấy token tải xuống
    const downloadToken = getTokenByType('download');
    if (!downloadToken) {
      console.error('Không tìm thấy token Google Drive tải xuống');
      throw new Error('Không tìm thấy token Google Drive tải xuống');
    }
    
    // Tạo OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    // Thiết lập credentials
    oauth2Client.setCredentials(downloadToken);
    
    // Khởi tạo Google Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Lấy thông tin file
    const fileMetadata = await drive.files.get({
      fileId: fileId,
      fields: 'id,name,mimeType,size,owners,fileExtension',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    
    return {
      success: true,
      fileInfo: fileMetadata.data
    };
  } catch (error) {
    console.error(`Lỗi khi kiểm tra thông tin file: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Kiểm tra và phân loại file dựa vào MIME type
 * @param {string} mimeType - MIME type của file
 * @returns {Object} - Thông tin phân loại file
 */
export function classifyFileType(mimeType) {
  const isPdf = mimeType === 'application/pdf';
  const isVideo = mimeType.startsWith('video/');
  const isImage = mimeType.startsWith('image/');
  const isAudio = mimeType.startsWith('audio/');
  const isGoogleDoc = mimeType === 'application/vnd.google-apps.document';
  const isGoogleSheet = mimeType === 'application/vnd.google-apps.spreadsheet';
  const isGoogleSlide = mimeType === 'application/vnd.google-apps.presentation';
  const isGoogleFolder = mimeType === 'application/vnd.google-apps.folder';
  
  return {
    isPdf,
    isVideo,
    isImage,
    isAudio,
    isGoogleDoc,
    isGoogleSheet,
    isGoogleSlide,
    isGoogleFolder
  };
} 