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
 * Extract the file ID from a Google Drive URL
 * @param {string} url - The Google Drive URL
 * @returns {string|null} The file ID or null if not found
 */
export function extractDriveFileId(url) {
  if (!url) return null;
  
  try {
    // Xử lý URL redirect từ Google Sheets
    if (url.startsWith('https://www.google.com/url?q=')) {
      try {
        const urlObj = new URL(url);
        const redirectUrl = urlObj.searchParams.get('q');
        if (redirectUrl) {
          // Decode URL (Google thường encode URL hai lần)
          let decodedUrl = redirectUrl;
          try {
            decodedUrl = decodeURIComponent(redirectUrl);
            // Decode một lần nữa nếu URL vẫn chứa các ký tự được mã hóa
            if (decodedUrl.includes('%')) {
              try {
                decodedUrl = decodeURIComponent(decodedUrl);
              } catch (e) {
                console.log('Không thể decode URL thêm lần nữa:', e.message);
              }
            }
          } catch (e) {
            console.error('Error decoding URL:', e);
          }
          
          // Gọi đệ quy để xử lý URL đã decode
          console.log(`URL sau khi decode: ${decodedUrl}`);
          return extractDriveFileId(decodedUrl);
        }
      } catch (urlError) {
        console.error(`Lỗi xử lý URL redirect: ${urlError.message}`);
      }
    }
    
    // Try to extract ID using common patterns
    const patterns = [
      /\/file\/d\/([^/]+)/,        // Standard format: /file/d/ID/
      /id=([^&]+)/,                // id parameter: ?id=ID
      /folders\/([^/]+)/,          // Folders: /folders/ID
      /drive\.google\.com\/open\?id=([^&]+)/, // Open link format
      /drive\.google\.com\/file\/d\/([^/]+)/, // Another standard format
      /drive\.google\.com\/drive\/folders\/([^/?&]+)/, // Folders format
      /docs\.google\.com\/\w+\/d\/([^/]+)/, // Docs, Sheets, etc
      /drive_copy&id=([^&]+)/, // drive_copy format
      /1drv\.ms\/\w\/\w!([A-Za-z0-9_-]+)/ // OneDrive format (just in case)
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    // Xử lý trường hợp đặc biệt cho URL có dạng drive_copy
    if (url.includes('drive_copy')) {
      const driveIdMatch = url.match(/id%3D([A-Za-z0-9_-]+)(%26|$)/);
      if (driveIdMatch && driveIdMatch[1]) {
        return driveIdMatch[1];
      }
    }
    
    // Check if URL is just the ID itself (at least 25 chars of alphanumeric and dashes/underscores)
    if (/^[a-zA-Z0-9_-]{25,}$/.test(url)) {
      return url;
    }
    
    // Log URL không xử lý được để debug
    console.error(`Không thể trích xuất ID từ URL: ${url}`);
    
    return null;
  } catch (error) {
    console.error('Error extracting Drive file ID:', error);
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
  
  // Check for common Google Drive patterns
  const drivePatterns = [
    'drive.google.com',
    'docs.google.com',
    'googleusercontent.com'
  ];
  
  return drivePatterns.some(pattern => url.includes(pattern)) || 
         extractDriveFileId(url) !== null;
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