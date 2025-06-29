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

// Trích xuất ID từ URL Google Drive - Hàm thống nhất
export function extractDriveFileId(url) {
  if (!url) return null;
  
  // Handle Google redirects (google.com/url?q=...)
  if (url.includes('google.com/url?q=')) {
    try {
      // Extract the encoded URL from the redirect
      const match = url.match(/google\.com\/url\?q=([^&]+)/);
      if (match && match[1]) {
        // Decode the URL
        const decodedUrl = decodeURIComponent(match[1]);
        
        // Now extract the ID from the decoded URL
        return extractDriveFileId(decodedUrl);
      }
    } catch (error) {
      console.error('Lỗi khi giải mã URL:', error);
    }
  }
  
  // Handle URL encoded parameters (id%3D...)
  if (url.includes('id%3D')) {
    try {
      const match = url.match(/id%3D([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return match[1];
      }
    } catch (error) {
      console.error('Lỗi khi trích xuất ID từ URL có mã hóa:', error);
    }
  }
  
  // Handle URL encoded parameters with additional encoding (id%253D...)
  if (url.includes('id%253D')) {
    try {
      const match = url.match(/id%253D([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return match[1];
      }
    } catch (error) {
      console.error('Lỗi khi trích xuất ID từ URL có mã hóa kép:', error);
    }
  }
  
  // Mẫu URL Google Drive
  const patterns = [
    /\/d\/([a-zA-Z0-9-_]+)/,                // Format: /d/FILE_ID
    /id=([a-zA-Z0-9-_]+)/,                  // Format: id=FILE_ID
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9-_]+)/,  // Format: drive.google.com/file/d/FILE_ID
    /drive\.google\.com\/open\?id=([a-zA-Z0-9-_]+)/,  // Format: drive.google.com/open?id=FILE_ID
    /docs\.google\.com\/\w+\/d\/([a-zA-Z0-9-_]+)/,    // Format: docs.google.com/document/d/FILE_ID
    /spreadsheets\/d\/([a-zA-Z0-9-_]+)/,              // Format: spreadsheets/d/FILE_ID
    /presentation\/d\/([a-zA-Z0-9-_]+)/,              // Format: presentation/d/FILE_ID
    /^([a-zA-Z0-9-_]{25,40})$/              // Direct ID (25-40 chars)
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  // Try one more time with double decoding if we haven't found anything yet
  try {
    const doubleDecodedUrl = decodeURIComponent(decodeURIComponent(url));
    if (doubleDecodedUrl !== url) {
      return extractDriveFileId(doubleDecodedUrl);
    }
  } catch (error) {
    console.error('Lỗi khi giải mã URL hai lần:', error);
  }
  
  return null;
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

// Trích xuất URL từ nội dung ô
export function extractUrlFromCell(cellContent) {
  if (!cellContent) return null;
  
  // Nếu là công thức HYPERLINK
  if (typeof cellContent === 'string' && cellContent.startsWith('=HYPERLINK(')) {
    const match = cellContent.match(/=HYPERLINK\("([^"]+)"[^)]*\)/);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  // Nếu là URL thông thường
  return cellContent;
}

// Kiểm tra xem URL có phải là URL Google Drive không
export function isDriveUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  return (
    url.includes('drive.google.com') || 
    url.includes('docs.google.com')
  );
}

// Tạo công thức HYPERLINK
export function createHyperlinkFormula(originalCell, newUrl) {
  // Nếu ô ban đầu là công thức HYPERLINK
  if (typeof originalCell === 'string' && originalCell.startsWith('=HYPERLINK(')) {
    // Trích xuất phần hiển thị của công thức
    const displayTextMatch = originalCell.match(/=HYPERLINK\("[^"]+",\s*"([^"]+)"\)/);
    
    if (displayTextMatch && displayTextMatch[1]) {
      // Giữ nguyên phần hiển thị, chỉ thay đổi URL
      return `=HYPERLINK("${newUrl}", "${displayTextMatch[1]}")`;
    } else {
      // Nếu không có phần hiển thị, tạo công thức mới với URL là phần hiển thị
      const fileName = newUrl.split('/').pop() || newUrl;
      return `=HYPERLINK("${newUrl}", "${fileName}")`;
    }
  }
  
  // Nếu ô ban đầu không phải công thức, tạo công thức mới
  // Sử dụng nội dung ô ban đầu làm phần hiển thị nếu có
  if (originalCell && typeof originalCell === 'string' && !originalCell.startsWith('http')) {
    return `=HYPERLINK("${newUrl}", "${originalCell}")`;
  }
  
  // Mặc định: tạo công thức với URL là phần hiển thị
  const fileName = newUrl.split('/').pop() || newUrl;
  return `=HYPERLINK("${newUrl}", "${fileName}")`;
}

// Xử lý link
export async function processLink(baseUrl, url, cookie = '', maxRetries = 2, timeoutMs = 60000, fileType = null, sheetName = null) {
  // Triển khai xử lý link theo yêu cầu
  // Đây là hàm phức tạp cần triển khai theo nghiệp vụ cụ thể
  // ...
}

// Reexport processRecursiveFolder từ drive-service.js
export { processRecursiveFolder } from '@/app/api/drive/remove-watermark/lib/drive-service.js'; 