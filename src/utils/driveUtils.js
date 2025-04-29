import axios from 'axios';

/**
 * Trích xuất Google Drive File ID từ nhiều định dạng URL khác nhau
 * @param {string} url - URL của Google Drive
 * @returns {string|null} File ID hoặc null nếu không tìm thấy
 */
export function extractGoogleDriveFileId(url) {
  if (!url || typeof url !== 'string') return null;
  
  let fileId = null;
  
  // Format: https://drive.google.com/file/d/FILE_ID/view
  if (url.includes('drive.google.com/file/d/')) {
    const match = url.match(/\/file\/d\/([^\/\?&]+)/);
    if (match && match[1]) {
      fileId = match[1].split('?')[0]; // Loại bỏ các tham số URL
    }
  } 
  // Format: https://drive.google.com/open?id=FILE_ID
  else if (url.includes('drive.google.com/open')) {
    const match = url.match(/[?&]id=([^&]+)/);
    if (match && match[1]) {
      fileId = match[1].split('&')[0]; // Loại bỏ các tham số khác
    }
  }
  // Format: https://docs.google.com/document/d/FILE_ID/edit
  else if (url.includes('docs.google.com/document')) {
    const match = url.match(/\/document\/d\/([^\/\?&]+)/);
    if (match && match[1]) {
      fileId = match[1].split('?')[0]; // Loại bỏ các tham số URL
    }
  }
  // Format: https://docs.google.com/spreadsheets/d/FILE_ID/edit
  else if (url.includes('docs.google.com/spreadsheets')) {
    const match = url.match(/\/spreadsheets\/d\/([^\/\?&]+)/);
    if (match && match[1]) {
      fileId = match[1].split('?')[0];
    }
  }
  // Format: https://docs.google.com/presentation/d/FILE_ID/edit
  else if (url.includes('docs.google.com/presentation')) {
    const match = url.match(/\/presentation\/d\/([^\/\?&]+)/);
    if (match && match[1]) {
      fileId = match[1].split('?')[0];
    }
  }
  // Format: https://drive.google.com/uc?id=FILE_ID
  else if (url.includes('drive.google.com/uc')) {
    const match = url.match(/[?&]id=([^&]+)/);
    if (match && match[1]) {
      fileId = match[1].split('&')[0];
    }
  }
  
  return fileId;
}

/**
 * Tạo URL API của ứng dụng để tải file từ Google Drive
 * @param {string} fileId - ID file Google Drive
 * @param {string} fileName - Tên file (tùy chọn)
 * @param {boolean} forceDownload - Bắt buộc tải xuống thay vì xem trực tiếp
 * @returns {string} URL API
 */
export function getAppDriveDownloadUrl(fileId, fileName = '', forceDownload = false) {
  if (!fileId) return null;
  
  let url = `/api/courses/media/drive?fileId=${fileId}`;
  
  if (fileName) {
    url += `&fileName=${encodeURIComponent(fileName)}`;
  }
  
  if (forceDownload) {
    url += '&download=true';
  }
  
  return url;
}

/**
 * Tạo URL tải xuống công khai từ Google Drive (chỉ hoạt động với file công khai)
 * @param {string} fileId - ID file Google Drive
 * @returns {string} URL tải xuống trực tiếp
 */
export function getPublicDriveDownloadUrl(fileId) {
  if (!fileId) return null;
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Tạo URL xem trước công khai từ Google Drive (chỉ hoạt động với file công khai)
 * @param {string} fileId - ID file Google Drive
 * @returns {string} URL xem trước
 */
export function getPublicDriveViewUrl(fileId) {
  if (!fileId) return null;
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/**
 * Kiểm tra xem URL có phải là URL Google Drive không
 * @param {string} url - URL cần kiểm tra
 * @returns {boolean} true nếu là URL Google Drive
 */
export function isGoogleDriveUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  return (
    url.includes('drive.google.com') || 
    url.includes('docs.google.com')
  );
}

/**
 * Xác định loại file Google Docs
 * @param {string} mimeType - MIME type của file
 * @returns {string} Loại file (document, spreadsheet, presentation, drawing, form, other)
 */
export function getGoogleDocsType(mimeType) {
  if (!mimeType) return 'unknown';
  
  if (mimeType === 'application/vnd.google-apps.document') {
    return 'document';
  } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    return 'spreadsheet';
  } else if (mimeType === 'application/vnd.google-apps.presentation') {
    return 'presentation';
  } else if (mimeType === 'application/vnd.google-apps.drawing') {
    return 'drawing';
  } else if (mimeType === 'application/vnd.google-apps.form') {
    return 'form';
  } else if (mimeType.startsWith('application/vnd.google-apps.')) {
    return 'google-apps';
  }
  
  return 'file';
}

/**
 * Kiểm tra xem file có thể xem trực tiếp trong trình duyệt không
 * @param {string} mimeType - MIME type của file
 * @returns {boolean} true nếu có thể xem trực tiếp
 */
export function isViewableInBrowser(mimeType) {
  if (!mimeType) return false;
  
  const viewableMimeTypes = [
    // PDF
    'application/pdf',
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp',
    // Audio
    'audio/mpeg', 'audio/ogg', 'audio/wav',
    // Video
    'video/mp4', 'video/webm', 'video/ogg',
    // Text
    'text/plain', 'text/html', 'text/css', 'text/javascript',
    // Google Docs
    'application/vnd.google-apps.document',
    'application/vnd.google-apps.spreadsheet',
    'application/vnd.google-apps.presentation',
    'application/vnd.google-apps.drawing'
  ];
  
  return viewableMimeTypes.includes(mimeType);
}

/**
 * Kiểm tra xem một file Google Drive có thể tải xuống thông qua API không
 * @param {string} fileId - ID file Google Drive
 * @returns {Promise<boolean>} true nếu có thể tải xuống, false nếu không
 */
export async function checkDriveFileAccessibility(fileId) {
  if (!fileId) return false;
  
  try {
    // Chỉ kiểm tra metadata, không tải xuống nội dung
    const response = await axios.get(`/api/courses/media/drive/check?fileId=${fileId}`);
    return response.data.accessible;
  } catch (error) {
    console.error('Lỗi kiểm tra quyền truy cập file Drive:', error);
    return false;
  }
}

/**
 * Chuyển đổi URL Google Drive thành URL có thể sử dụng trong ứng dụng
 * @param {string} url - URL gốc
 * @returns {string} URL đã chuyển đổi
 */
export function convertToUsableUrl(url) {
  if (!url) return '';
  
  const fileId = extractGoogleDriveFileId(url);
  
  if (fileId) {
    return getAppDriveDownloadUrl(fileId);
  }
  
  return url;
} 