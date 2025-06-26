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
      console.log(`Đọc token từ file: ${TOKEN_PATHS[accountIndex]}`);
      
      try {
        const parsedToken = JSON.parse(tokenContent);
        console.log('Phân tích token thành công');
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
    console.log(`Token đã được cập nhật vào file: ${TOKEN_PATHS[accountIndex]}`);
    return true;
  } catch (error) {
    console.error(`Lỗi khi cập nhật token vào file ${accountIndex}:`, error);
    return false;
  }
}

// Trích xuất ID từ URL Google Drive - Hàm thống nhất
export function extractDriveFileId(url) {
  if (!url) return null;
  
  console.log('Trích xuất ID từ URL:', url);
  
  // Handle Google redirects (google.com/url?q=...)
  if (url.includes('google.com/url?q=')) {
    try {
      // Extract the encoded URL from the redirect
      const match = url.match(/google\.com\/url\?q=([^&]+)/);
      if (match && match[1]) {
        // Decode the URL
        const decodedUrl = decodeURIComponent(match[1]);
        console.log('Giải mã URL từ Google redirect:', decodedUrl);
        
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
        console.log('Tìm thấy ID từ URL có mã hóa:', match[1]);
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
        console.log('Tìm thấy ID từ URL có mã hóa kép:', match[1]);
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
      console.log('Tìm thấy ID từ pattern:', match[1]);
      return match[1];
    }
  }
  
  // Try one more time with double decoding if we haven't found anything yet
  try {
    const doubleDecodedUrl = decodeURIComponent(decodeURIComponent(url));
    if (doubleDecodedUrl !== url) {
      console.log('Thử giải mã URL hai lần:', doubleDecodedUrl);
      return extractDriveFileId(doubleDecodedUrl);
    }
  } catch (error) {
    console.error('Lỗi khi giải mã URL hai lần:', error);
  }
  
  console.log('Không tìm thấy ID từ URL');
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
  console.log(`Kiểm tra file trùng lặp với tên: "${fileName} (Processed)"`);
  
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
    
    console.log(`Query tìm file trùng lặp: ${query}`);
    
    try {
      // Tìm kiếm các file trùng lặp
      const response = await drive.files.list({
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive'
      });
      
      const duplicates = response.data.files;
      console.log(`Tìm thấy ${duplicates.length} file trùng lặp`);
      
      // Xóa các file trùng lặp
      for (const file of duplicates) {
        console.log(`Đang xóa file trùng lặp: ${file.name} (ID: ${file.id})`);
        try {
          await drive.files.delete({
            fileId: file.id
          });
          console.log(`Đã xóa file trùng lặp: ${file.id}`);
        } catch (deleteError) {
          console.error(`Không thể xóa file ${file.id}:`, deleteError.message);
          // Tiếp tục với file tiếp theo
        }
      }
      
      return duplicates.length;
    } catch (listError) {
      console.error('Lỗi khi tìm kiếm file trùng lặp:', listError.message);
      // Không throw error, chỉ log và tiếp tục
      return 0;
    }
  } catch (error) {
    console.error('Lỗi khi kiểm tra và xóa file trùng lặp:', error);
    // Không throw error, chỉ log và tiếp tục
    return 0;
  }
}

// Kiểm tra quyền truy cập folder
export async function validateFolderAccess(drive, folderId) {
  console.log(`Kiểm tra quyền truy cập folder: ${folderId}`);
  
  try {
    const folderResponse = await drive.files.get({
      fileId: folderId,
      fields: 'id,name,mimeType,capabilities'
    });
    
    // Kiểm tra xem đây có phải là folder không
    if (folderResponse.data.mimeType !== 'application/vnd.google-apps.folder') {
      console.warn(`ID ${folderId} không phải là folder, đó là: ${folderResponse.data.mimeType}`);
      return {
        success: false,
        error: 'ID không phải là folder',
        details: folderResponse.data
      };
    }
    
    // Kiểm tra quyền truy cập
    const capabilities = folderResponse.data.capabilities || {};
    if (!capabilities.canAddChildren) {
      console.error(`Không có quyền thêm file vào folder: ${folderId}`);
      return {
        success: false,
        error: 'Không có quyền thêm file vào folder',
        details: capabilities
      };
    }
    
    console.log(`Folder hợp lệ: ${folderResponse.data.name} (${folderId})`);
    return {
      success: true,
      name: folderResponse.data.name,
      id: folderId,
      capabilities: capabilities
    };
  } catch (error) {
    console.error(`Lỗi khi kiểm tra folder ${folderId}:`, error.message);
    
    if (error.code === 404 || error.response?.status === 404) {
      return {
        success: false,
        error: 'Folder không tồn tại',
        details: error.message
      };
    }
    
    if (error.code === 403 || error.response?.status === 403) {
      return {
        success: false,
        error: 'Không có quyền truy cập folder',
        details: error.message
      };
    }
    
    return {
      success: false,
      error: 'Lỗi khi kiểm tra folder',
      details: error.message
    };
  }
}

// Kiểm tra token và refresh nếu cần
export async function validateAndRefreshToken(oauth2Client) {
  try {
    console.log('Kiểm tra token...');
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    const aboutResponse = await drive.about.get({
      fields: 'user'
    });
    
    console.log(`Token hợp lệ, người dùng: ${aboutResponse.data.user.emailAddress || 'không có email'}`);
    return {
      success: true,
      email: aboutResponse.data.user.emailAddress,
      drive: drive
    };
  } catch (error) {
    console.error('Lỗi khi kiểm tra token:', error.message);
    
    // Thử refresh token
    try {
      console.log('Thử refresh token...');
      await oauth2Client.refreshAccessToken();
      
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      const refreshedResponse = await drive.about.get({
        fields: 'user'
      });
      
      console.log(`Token đã được refresh, người dùng: ${refreshedResponse.data.user.emailAddress || 'không có email'}`);
      return {
        success: true,
        email: refreshedResponse.data.user.emailAddress,
        drive: drive
      };
    } catch (refreshError) {
      console.error('Không thể refresh token:', refreshError.message);
      return {
        success: false,
        error: 'Token không hợp lệ và không thể refresh',
        details: refreshError.message
      };
    }
  }
}

// Trích xuất URL từ nội dung cell
export function extractUrlFromCell(cellContent) {
  if (!cellContent || typeof cellContent !== 'string') return null;
  
  // Mẫu regex để tìm URL trong văn bản
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = cellContent.match(urlRegex);
  
  if (matches && matches.length > 0) {
    // Trả về URL đầu tiên tìm thấy
    return matches[0];
  }
  
  return null;
}

// Kiểm tra xem một URL có phải là Google Drive URL không
export function isDriveUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  // Kiểm tra các mẫu URL Google Drive phổ biến
  const drivePatterns = [
    /drive\.google\.com/i,
    /docs\.google\.com/i,
    /sheets\.google\.com/i,
    /slides\.google\.com/i,
    /forms\.google\.com/i
  ];
  
  return drivePatterns.some(pattern => pattern.test(url));
}

// Tạo công thức HYPERLINK cho Google Sheets
export function createHyperlinkFormula(originalCell, newUrl) {
  if (!newUrl) return originalCell;
  
  // Nếu cell đã có công thức HYPERLINK, thay thế URL
  if (typeof originalCell === 'string' && originalCell.toUpperCase().includes('HYPERLINK')) {
    // Tìm URL trong công thức HYPERLINK hiện tại
    const urlMatch = originalCell.match(/"(https?:\/\/[^"]+)"/);
    if (urlMatch && urlMatch[1]) {
      // Thay thế URL cũ bằng URL mới
      return originalCell.replace(urlMatch[1], newUrl);
    }
  }
  
  // Tạo công thức HYPERLINK mới
  // Nếu cell có nội dung, sử dụng nội dung đó làm nhãn hiển thị
  // Nếu không, sử dụng "Xem tài liệu"
  let displayText = originalCell || "Xem tài liệu";
  
  // Nếu displayText là URL, sử dụng "Xem tài liệu" thay thế
  if (typeof displayText === 'string' && displayText.match(/^https?:\/\//)) {
    displayText = "Xem tài liệu";
  }
  
  // Loại bỏ dấu ngoặc kép trong displayText để tránh lỗi công thức
  if (typeof displayText === 'string') {
    displayText = displayText.replace(/"/g, "'");
  }
  
  return `=HYPERLINK("${newUrl}","${displayText}")`;
}

// Xử lý một link với timeout và retry
export async function processLink(baseUrl, url, cookie = '', maxRetries = 2, timeoutMs = 60000, fileType = null, sheetName = null) {
  let retries = 0;
  
  while (retries <= maxRetries) {
    try {
      // Xác định API endpoint dựa trên loại file
      let apiEndpoint = '/api/drive/process-and-replace';
      let requestBody = { 
        driveLink: url 
      };
      
      // Thêm tên sheet vào request body nếu có
      if (sheetName) {
        requestBody.courseName = sheetName; // Sử dụng courseName để tương thích với API hiện tại
      }
      
      // Kiểm tra loại file chi tiết hơn
      const isVideoFile = fileType && (
        fileType.includes('video/') || 
        fileType.includes('mp4') || 
        fileType.includes('avi') || 
        fileType.includes('mov') ||
        fileType.includes('mkv') ||
        fileType.includes('webm')
      );
      
      const isAudioFile = fileType && (
        fileType.includes('audio/') || 
        fileType.includes('mp3') || 
        fileType.includes('wav') || 
        fileType.includes('ogg')
      );
      
      const isImageFile = fileType && (
        fileType.includes('image/') || 
        fileType.includes('jpg') || 
        fileType.includes('jpeg') || 
        fileType.includes('png') || 
        fileType.includes('gif')
      );
      
      // Nếu không phải PDF hoặc là file media (video, audio, hình ảnh), sử dụng API đơn giản hơn
      if (fileType && 
          (fileType !== 'application/pdf' && 
           fileType !== 'pdf' || 
           isVideoFile || 
           isAudioFile || 
           isImageFile)) {
        console.log(`File không phải PDF hoặc là file media (${fileType}), sử dụng API đơn giản hơn để xử lý`);
        apiEndpoint = '/api/drive/download-and-reupload';
        requestBody = { 
          driveLink: url,
          fileType: fileType,
          skipProcessing: true
        };
        
        // Thêm tên sheet vào request body nếu có
        if (sheetName) {
          requestBody.courseName = sheetName;
        }
      } else {
        console.log(`Xử lý file PDF: ${url}`);
        
        // Thêm tên sheet vào request body nếu có
        if (sheetName) {
          console.log(`Sẽ lưu file vào thư mục có tên: ${sheetName}`);
        }
      }
      
      console.log(`Gửi yêu cầu xử lý link đến API: ${baseUrl}${apiEndpoint} (lần thử ${retries + 1}/${maxRetries + 1})`);
      
      // Thêm timeout cho fetch request để tránh treo quá lâu
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      try {
        const processResponse = await fetch(`${baseUrl}${apiEndpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': cookie
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        
        // Clear the timeout
        clearTimeout(timeoutId);
        
        // Lấy dữ liệu phản hồi
        const responseData = await processResponse.json();
        
        if (!processResponse.ok) {
          // Kiểm tra lỗi file không tồn tại (404) - coi như đã xử lý thành công trước đó
          if (responseData.error && (
              responseData.error.includes('404') ||
              responseData.error.includes('không tồn tại') ||
              responseData.error.includes('Không tìm thấy file')
          )) {
            console.log(`File không tồn tại (404): ${url}. Coi như đã xử lý thành công trước đó.`);
            
            // Trả về kết quả thành công với link gốc
            return {
              success: true,
              originalLink: url,
              processedLink: url, // Sử dụng link gốc vì file không tồn tại
              processedFileId: extractDriveFileId(url).fileId,
              processedFileName: "File đã xử lý trước đó",
              wasProcessedBefore: true
            };
          }
          
          // Kiểm tra lỗi quyền truy cập
          if (responseData.error && (
              responseData.error.includes('Không có quyền truy cập') || 
              responseData.error.includes('Không có quyền tải xuống') ||
              responseData.error.includes('permission')
          )) {
            console.error(`Lỗi quyền truy cập: ${responseData.error}`);
            throw new Error(`Không có quyền truy cập file này. Vui lòng kiểm tra quyền chia sẻ của file.`);
          }
          
          throw new Error(responseData.error || 'Không thể xử lý file');
        }
        
        console.log(`Xử lý thành công link: ${url} -> ${responseData.processedFile.link}`);
        
        return {
          success: true,
          originalLink: url,
          processedLink: responseData.processedFile.link,
          processedFileId: responseData.processedFile.id,
          processedFileName: responseData.processedFile.name,
          fileType: fileType || 'pdf'
        };
      } catch (fetchError) {
        // Xóa timeout nếu có lỗi
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          console.error(`Timeout sau ${timeoutMs}ms khi xử lý link: ${url}`);
          throw new Error(`Timeout sau ${timeoutMs}ms khi xử lý link`);
        }
        
        throw fetchError;
      }
    } catch (error) {
      console.error(`Lỗi khi xử lý link (lần thử ${retries + 1}/${maxRetries + 1}):`, error.message);
      
      // Kiểm tra lỗi file không tồn tại (404) - coi như đã xử lý thành công trước đó
      if (error.message && (
          error.message.includes('404') ||
          error.message.includes('không tồn tại') ||
          error.message.includes('Không tìm thấy file')
      )) {
        console.log(`File không tồn tại (404): ${url}. Coi như đã xử lý thành công trước đó.`);
        
        // Trả về kết quả thành công với link gốc
        return {
          success: true,
          originalLink: url,
          processedLink: url, // Sử dụng link gốc vì file không tồn tại
          processedFileId: extractDriveFileId(url).fileId,
          processedFileName: "File đã xử lý trước đó",
          wasProcessedBefore: true
        };
      }
      
      // Kiểm tra các lỗi không nên thử lại
      if (error.message && (
          // Lỗi quyền truy cập
          error.message.includes('Không có quyền truy cập') || 
          error.message.includes('Không có quyền tải xuống') ||
          error.message.includes('permission')
      )) {
        console.error(`Lỗi không thể khắc phục bằng thử lại, bỏ qua các lần thử lại: ${error.message}`);
        throw error;
      }
      
      retries++;
      
      if (retries <= maxRetries) {
        console.log(`Thử lại sau 2 giây...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.error(`Đã thử ${maxRetries + 1} lần, không thể xử lý link: ${url}`);
        throw error;
      }
    }
  }
}

// Reexport processRecursiveFolder từ drive-service.js
export { processRecursiveFolder } from '@/app/api/drive/remove-watermark/lib/drive-service.js'; 