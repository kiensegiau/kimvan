import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

// Đường dẫn file lưu token
const TOKEN_PATHS = [
  path.join(process.cwd(), 'drive_token_upload.json'),   // Token tải lên - Upload
  path.join(process.cwd(), 'drive_token_download.json')  // Token tải xuống - Download
];

// Đọc token từ file
export function getStoredToken(accountIndex) {
  try {
    if (fs.existsSync(TOKEN_PATHS[accountIndex])) {
      const tokenContent = fs.readFileSync(TOKEN_PATHS[accountIndex], 'utf8');
      
      try {
        const parsedToken = JSON.parse(tokenContent);
        return parsedToken;
      } catch (parseError) {
        console.error('Lỗi phân tích JSON token:', parseError);
        return null;
      }
    } else {
      console.error('File token không tồn tại tại đường dẫn:', TOKEN_PATHS[accountIndex]);
    }
  } catch (error) {
    console.error(`Lỗi đọc file token ${accountIndex}:`, error);
  }
  return null;
}

// Cập nhật token vào file
export function updateStoredToken(accountIndex, token) {
  try {
    fs.writeFileSync(TOKEN_PATHS[accountIndex], JSON.stringify(token, null, 2));
    return true;
  } catch (error) {
    console.error(`Lỗi khi cập nhật token vào file ${accountIndex}:`, error);
    return false;
  }
}

/**
 * Trích xuất Google Drive file ID từ URL
 * @param {string} url - URL Google Drive
 * @returns {Object|null} - Đối tượng chứa fileId và các thông tin khác, hoặc null nếu không trích xuất được
 */
export function extractDriveFileId(url) {
  if (!url) return null;
  
  try {
    // Kiểm tra xem URL có phải từ Google Sheets không (có dạng https://www.google.com/url?q=...)
    if (url.includes('google.com/url?q=')) {
      // Trích xuất phần URL được mã hóa
      const match = url.match(/[?&]q=([^&]+)/);
      if (match && match[1]) {
        // Giải mã URL
        try {
          const decodedUrl = decodeURIComponent(match[1]);
          console.log(`URL sau khi decode: ${decodedUrl}`);
          
          // Tiếp tục xử lý với URL đã giải mã
          return extractDriveFileId(decodedUrl);
        } catch (decodeError) {
          console.error(`Lỗi giải mã URL: ${decodeError.message}`);
          // Trả về null nếu không giải mã được thay vì xử lý URL gốc
          return null;
        }
      }
    }
    
    // Xử lý trường hợp URL là ID trực tiếp (25+ ký tự, không có dấu /)
    if (/^[a-zA-Z0-9_-]{25,}$/.test(url.trim())) {
      return {
        fileId: url.trim(),
        isFolder: false,
        originalUrl: url
      };
    }
    
    // Xử lý URL thông thường
    let fileId = null;
    let isFolder = false;
    
    // Định dạng 1: drive.google.com/file/d/{fileId}/view
    if (url.includes('/file/d/')) {
      const match = url.match(/\/file\/d\/([^/?&#]+)/);
      if (match && match[1]) {
        fileId = match[1];
      }
    } 
    // Định dạng 2: drive.google.com/open?id={fileId}
    else if (url.includes('drive.google.com/open')) {
      try {
        const urlObj = new URL(url);
        fileId = urlObj.searchParams.get('id');
      } catch (e) {
        // Nếu URL không hợp lệ, thử trích xuất id bằng regex
        const match = url.match(/[?&]id=([^&#]+)/);
        if (match && match[1]) {
          fileId = match[1];
        }
      }
    }
    // Định dạng 3: drive.google.com/drive/folders/{fileId}
    else if (url.includes('/drive/folders/') || url.includes('/drive/u/0/folders/')) {
      const match = url.match(/\/folders\/([^/?&#]+)/);
      if (match && match[1]) {
        fileId = match[1];
        isFolder = true;
      }
    }
    // Định dạng 4: docs.google.com/document/d/{fileId}/edit
    else if (url.includes('docs.google.com/document/d/')) {
      const match = url.match(/\/document\/d\/([^/?&#]+)/);
      if (match && match[1]) {
        fileId = match[1];
      }
    }
    // Định dạng 5: docs.google.com/spreadsheets/d/{fileId}/edit
    else if (url.includes('docs.google.com/spreadsheets/d/')) {
      const match = url.match(/\/spreadsheets\/d\/([^/?&#]+)/);
      if (match && match[1]) {
        fileId = match[1];
      }
    }
    // Định dạng 6: docs.google.com/presentation/d/{fileId}/edit
    else if (url.includes('docs.google.com/presentation/d/')) {
      const match = url.match(/\/presentation\/d\/([^/?&#]+)/);
      if (match && match[1]) {
        fileId = match[1];
      }
    }
    // Định dạng 7: drive.google.com/uc?id={fileId}
    else if (url.includes('drive.google.com/uc')) {
      try {
        const urlObj = new URL(url);
        fileId = urlObj.searchParams.get('id');
      } catch (e) {
        // Nếu URL không hợp lệ, thử trích xuất id bằng regex
        const match = url.match(/[?&]id=([^&#]+)/);
        if (match && match[1]) {
          fileId = match[1];
        }
      }
    }
    // Định dạng 8: drive.google.com/drive/u/0/my-drive (không có file ID cụ thể)
    else if (url.includes('/drive/u/0/my-drive') || url.includes('/drive/my-drive')) {
      return null; // Không có file ID cụ thể
    }
    
    // Trả về kết quả nếu tìm thấy fileId
    if (fileId) {
      // Xử lý trường hợp fileId có thể chứa các ký tự không mong muốn
      fileId = fileId.split('&')[0]; // Loại bỏ các tham số phía sau nếu có
      fileId = fileId.split('#')[0]; // Loại bỏ fragment identifier nếu có
      
      // Kiểm tra fileId có đúng định dạng không (thường là 25+ ký tự)
      if (fileId.length < 25 || fileId.includes('/')) {
        console.warn(`FileId có vẻ không hợp lệ: ${fileId}`);
        return null; // Trả về null nếu ID không đáng tin cậy
      }
      
      return {
        fileId,
        isFolder,
        originalUrl: url
      };
    }
    
    // Kiểm tra xem có ID trong URL không (trường hợp đặc biệt)
    try {
      const urlObj = new URL(url);
      const idParam = urlObj.searchParams.get('id');
      if (idParam) {
        const cleanId = idParam.split('&')[0]; // Loại bỏ các tham số phía sau nếu có
        
        // Kiểm tra ID có hợp lệ không
        if (cleanId.length >= 25 && !cleanId.includes('/')) {
          return {
            fileId: cleanId,
            isFolder: false,
            originalUrl: url
          };
        }
      }
    } catch (e) {
      // Nếu URL không hợp lệ, thử trích xuất id bằng regex
      const match = url.match(/[?&]id=([^&#]+)/);
      if (match && match[1]) {
        const cleanId = match[1].split('&')[0]; // Loại bỏ các tham số phía sau nếu có
        
        // Kiểm tra ID có hợp lệ không
        if (cleanId.length >= 25 && !cleanId.includes('/')) {
          return {
            fileId: cleanId,
            isFolder: false,
            originalUrl: url
          };
        }
      }
    }
    
    // Tìm ID Drive trực tiếp trong URL (25+ ký tự, không có dấu /)
    const driveIdMatch = url.match(/([a-zA-Z0-9_-]{25,})/);
    if (driveIdMatch && driveIdMatch[1] && !driveIdMatch[1].includes('/')) {
      return {
        fileId: driveIdMatch[1],
        isFolder: false,
        originalUrl: url
      };
    }
    
    // Nếu không tìm thấy ID hợp lệ, trả về null
    return null;
  } catch (error) {
    console.error(`Lỗi khi trích xuất Drive file ID: ${error.message}`);
    return null;
  }
}

/**
 * Check if a URL is a Google Drive URL
 * @param {string} url - The URL to check
 * @returns {boolean} Whether it's a Drive URL
 */
export function isDriveUrl(url) {
  if (!url) return false;
  
  try {
    // Làm sạch URL Google redirect nếu có
    if (url.includes('google.com/url?q=')) {
      const match = url.match(/[?&]q=([^&]+)/);
      if (match && match[1]) {
        try {
          const decodedUrl = decodeURIComponent(match[1]);
          return isDriveUrl(decodedUrl); // Gọi đệ quy với URL đã giải mã
        } catch (e) {
          console.error('Lỗi giải mã URL:', e);
          return false;
        }
      }
      return false; // URL redirect Google không có tham số q hợp lệ
    }
    
    // Danh sách các mẫu URL Google Drive hợp lệ
    const strictDrivePatterns = [
      /drive\.google\.com\/file\/d\//i,         // drive.google.com/file/d/ID/...
      /drive\.google\.com\/open\?id=/i,         // drive.google.com/open?id=ID
      /drive\.google\.com\/drive\/folders\//i,  // drive.google.com/drive/folders/ID
      /drive\.google\.com\/drive\/u\/\d+\/folders\//i, // drive.google.com/drive/u/0/folders/ID
      /docs\.google\.com\/document\/d\//i,      // docs.google.com/document/d/ID/...
      /docs\.google\.com\/spreadsheets\/d\//i,  // docs.google.com/spreadsheets/d/ID/...
      /docs\.google\.com\/presentation\/d\//i,  // docs.google.com/presentation/d/ID/...
      /drive\.google\.com\/uc\?id=/i,           // drive.google.com/uc?id=ID
      /docs\.google\.com\/forms\/d\//i,         // docs.google.com/forms/d/ID/...
      /lh\d+\.googleusercontent\.com\//i        // lh3.googleusercontent.com/...
    ];
    
    // Kiểm tra URL với các mẫu nghiêm ngặt
    for (const pattern of strictDrivePatterns) {
      if (pattern.test(url)) {
        return true;
      }
    }
    
    // Không còn sử dụng extractDriveFileId để tránh false positive
    return false;
  } catch (error) {
    console.error('Lỗi khi kiểm tra Drive URL:', error.message);
    return false;
  }
}

/**
 * Extract a URL from a cell content (text)
 * @param {string} cellContent - The content of the cell
 * @returns {string|null} Extracted URL or null
 */
export function extractUrlFromCell(cellContent) {
  if (!cellContent || typeof cellContent !== 'string') return null;
  
  // Look for URLs in the cell content
  const urlRegex = /(https?:\/\/[^\s"]+)/g;
  const matches = cellContent.match(urlRegex);
  
  if (matches && matches.length > 0) {
    return matches[0]; // Return the first URL found
  }
  
  // Look for HYPERLINK formula
  const hyperlinkRegex = /=HYPERLINK\("([^"]+)"/;
  const hyperlinkMatch = cellContent.match(hyperlinkRegex);
  
  if (hyperlinkMatch && hyperlinkMatch[1]) {
    return hyperlinkMatch[1];
  }
  
  return null;
}

/**
 * Create a Google Sheets HYPERLINK formula
 * @param {string} url - The URL to link to
 * @param {string} displayText - The text to display
 * @returns {string} HYPERLINK formula
 */
export function createHyperlinkFormula(url, displayText) {
  // Ensure the URL is properly quoted
  const safeUrl = url.replace(/"/g, '""');
  const safeDisplayText = displayText.replace(/"/g, '""');
  
  return `=HYPERLINK("${safeUrl}","${safeDisplayText}")`;
}

/**
 * Clean a Google URL (remove tracking parameters)
 * @param {string} url - The URL to clean
 * @returns {string} Cleaned URL
 */
export function cleanGoogleUrl(url) {
  if (!url) return url;
  
  try {
    // Handle Google redirect URLs
    if (url.startsWith('https://www.google.com/url?q=')) {
      const urlObj = new URL(url);
      const redirectUrl = urlObj.searchParams.get('q');
      if (redirectUrl) {
        // Decode URL (Google often encodes URLs twice)
        let decodedUrl = redirectUrl;
        try {
          decodedUrl = decodeURIComponent(redirectUrl);
          // Decode một lần nữa nếu URL vẫn chứa các ký tự được mã hóa
          if (decodedUrl.includes('%')) {
            try {
              decodedUrl = decodeURIComponent(decodedUrl);
            } catch (e) {
              // Bỏ qua nếu không thể decode thêm
              console.log('Không thể decode URL thêm lần nữa:', e.message);
            }
          }
        } catch (e) {
          console.error('Error decoding URL:', e);
        }
        
        // Clean the decoded URL
        return cleanGoogleUrl(decodedUrl);
      }
    }
    
    // Process normal URLs
    const urlObj = new URL(url);
    
    // Remove tracking parameters
    const paramsToRemove = ['usp', 'utm_source', 'utm_medium', 'utm_campaign', 'sa', 'usg', 'ust'];
    paramsToRemove.forEach(param => {
      urlObj.searchParams.delete(param);
    });
    
    return urlObj.toString();
  } catch (error) {
    // If there's an error parsing the URL, return the original
    console.error('Error cleaning URL:', error, 'Original URL:', url);
    
    // Cố gắng trích xuất fileId trực tiếp nếu URL có định dạng không chuẩn
    const fileId = extractDriveFileId(url);
    if (fileId) {
      console.log('Đã trích xuất được fileId từ URL không chuẩn:', fileId);
      return `https://drive.google.com/file/d/${fileId}/view`;
    }
    
    return url;
  }
}

/**
 * Process a link and return the processed result
 * @param {string} url - The URL to process
 * @returns {Promise<Object>} The processing result
 */
export async function processLink(url) {
  try {
    // Kiểm tra và làm sạch URL
    const cleanedUrl = cleanGoogleUrl(url);
    
    // Kiểm tra xem có phải là Google Drive URL không
    if (!isDriveUrl(cleanedUrl)) {
      return {
        success: false,
        error: 'Không phải là Google Drive URL',
        originalUrl: url
      };
    }
    
    // Lấy file ID
    const fileId = extractDriveFileId(cleanedUrl);
    if (!fileId) {
      return {
        success: false,
        error: 'Không thể trích xuất file ID',
        originalUrl: url
      };
    }
    
    // Gọi API để xử lý file
    const response = await fetch('/api/drive/process-and-replace', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        driveLink: cleanedUrl,
        updateSheet: false // Không cập nhật sheet vì chúng ta sẽ làm điều đó sau
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      return {
        success: true,
        originalUrl: url,
        processedUrl: result.processedFile.link,
        fileId: result.processedFile.id,
        fileName: result.processedFile.name
      };
    } else {
      return {
        success: false,
        error: result.error || 'Lỗi không xác định',
        originalUrl: url
      };
    }
  } catch (error) {
    console.error('Lỗi khi xử lý link:', error);
    return {
      success: false,
      error: error.message,
      originalUrl: url
    };
  }
}

/**
 * Placeholder function for processing a recursive folder (to be implemented)
 */
export async function processRecursiveFolder(folderId) {
  // This is a placeholder for future implementation
  console.log('Processing folder:', folderId);
  return { 
    folderId,
    processed: true
  };
}

// Tạo OAuth2 client với khả năng tự động refresh token
export function createOAuth2Client(accountIndex) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  
  const storedToken = getStoredToken(accountIndex);
  if (!storedToken) {
    throw new Error(`Không tìm thấy token Google Drive cho tài khoản ${accountIndex === 0 ? 'tải lên' : 'tải xuống'}. Vui lòng cấu hình API trong cài đặt.`);
  }
  
  oauth2Client.setCredentials(storedToken);
  
  // Thiết lập callback để tự động lưu token mới khi refresh
  oauth2Client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
      // Lưu refresh_token mới nếu có
      const updatedToken = { ...storedToken, ...tokens };
      updateStoredToken(accountIndex, updatedToken);
    } else if (tokens.access_token) {
      // Chỉ cập nhật access_token nếu không có refresh_token
      const updatedToken = { 
        ...storedToken, 
        access_token: tokens.access_token,
        expiry_date: tokens.expiry_date
      };
      updateStoredToken(accountIndex, updatedToken);
    }
  });
  
  return oauth2Client;
}

// Kiểm tra và xóa file trùng lặp trước khi tải lên
export async function checkAndDeleteDuplicates(drive, fileName, folderId) {
  try {
    // Escape special characters in file name for the query
    const escapedFileName = fileName.replace(/'/g, "\\'").replace(/\\/g, "\\\\");
    
    // Xây dựng query để tìm file trùng lặp
    let query = `name = '${escapedFileName} (Processed)' and trashed = false`;
    
    // Nếu có folder ID, thêm vào query
    if (folderId) {
      query += ` and '${folderId}' in parents`;
    } else {
      // Sử dụng folder mặc định "tài liệu sheet"
      const defaultFolderId = "1Qs4Oi8OGZ-t2HKGX5PUH4-FMVcVYdI9N";
      query += ` and '${defaultFolderId}' in parents`;
    }
    
    try {
      // Tìm kiếm các file trùng lặp
      const response = await drive.files.list({
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive'
      });
      
      const duplicates = response.data.files;
      
      // Xóa các file trùng lặp
      for (const file of duplicates) {
        try {
          await drive.files.delete({
            fileId: file.id
          });
          console.log(`Đã xóa file trùng lặp: ${file.name} (${file.id})`);
        } catch (deleteError) {
          console.error(`Lỗi khi xóa file trùng lặp ${file.id}:`, deleteError.message);
        }
      }
      
      return duplicates.length > 0;
    } catch (listError) {
      console.error('Lỗi khi tìm kiếm file trùng lặp:', listError.message);
      return false;
    }
  } catch (error) {
    console.error('Lỗi khi kiểm tra file trùng lặp:', error);
    return false;
  }
}

// Kiểm tra quyền truy cập vào folder
export async function validateFolderAccess(drive, folderId) {
  try {
    // Kiểm tra xem folder có tồn tại không
    const response = await drive.files.get({
      fileId: folderId,
      fields: 'id,name,mimeType,capabilities'
    });
    
    const file = response.data;
    
    // Kiểm tra xem đây có phải là folder không
    if (file.mimeType !== 'application/vnd.google-apps.folder') {
      console.error('ID được cung cấp không phải là folder:', file.mimeType);
      return {
        success: false,
        message: 'ID được cung cấp không phải là folder'
      };
    }
    
    // Kiểm tra quyền
    const canEdit = file.capabilities && file.capabilities.canEdit;
    
    if (!canEdit) {
      console.error('Không có quyền chỉnh sửa folder:', file.name);
      return {
        success: false,
        message: `Không có quyền chỉnh sửa folder: ${file.name}`
      };
    }
    
    return {
      success: true,
      folderName: file.name
    };
  } catch (error) {
    console.error('Lỗi khi kiểm tra quyền truy cập folder:', error.message);
    
    // Phân tích lỗi cụ thể
    if (error.code === 404) {
      return {
        success: false,
        message: 'Folder không tồn tại'
      };
    } else if (error.code === 403) {
      return {
        success: false,
        message: 'Không có quyền truy cập folder'
      };
    }
    
    return {
      success: false,
      message: `Lỗi khi kiểm tra folder: ${error.message}`
    };
  }
}

// Kiểm tra và refresh token nếu cần
export async function validateAndRefreshToken(oauth2Client) {
  try {
    // Lấy thông tin token hiện tại
    const credentials = oauth2Client.credentials;
    
    // Kiểm tra xem token có hết hạn chưa
    const isTokenExpired = credentials.expiry_date <= Date.now();
    
    if (isTokenExpired) {
      // Thực hiện refresh token
      const refreshResponse = await oauth2Client.refreshAccessToken();
      const newCredentials = refreshResponse.credentials;
      
      // Cập nhật credentials
      oauth2Client.setCredentials(newCredentials);
      
      return {
        success: true,
        refreshed: true,
        message: 'Token đã được làm mới thành công'
      };
    }
    
    return {
      success: true,
      refreshed: false,
      message: 'Token vẫn còn hiệu lực'
    };
  } catch (error) {
    console.error('Lỗi khi refresh token:', error);
    return {
      success: false,
      refreshed: false,
      message: `Lỗi khi refresh token: ${error.message}`
    };
  }
}

// Không cần import processRecursiveFolder từ drive-service.js vì chúng ta đã định nghĩa nó ở trên 