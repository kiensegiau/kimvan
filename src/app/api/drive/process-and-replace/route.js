import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';

// Đường dẫn file lưu token
const TOKEN_PATHS = [
  path.join(process.cwd(), 'drive_token_upload.json'),   // Token tải lên - Upload
  path.join(process.cwd(), 'drive_token_download.json')  // Token tải xuống - Download
];

// Đọc token từ file
function getStoredToken(accountIndex) {
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

// Trích xuất ID từ URL Google Drive
function extractDriveFileId(url) {
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

// Tải xuống file từ Google Drive
async function downloadFromGoogleDrive(fileId) {
  console.log(`Đang tải xuống file từ Google Drive với ID: ${fileId}`);
  
  // Tạo thư mục tạm nếu chưa tồn tại
  const tempDir = path.join(os.tmpdir(), 'drive-download-');
  const outputDir = fs.mkdtempSync(tempDir);
  
  try {
    // Lấy token đã lưu
    const storedToken = getStoredToken(1); // Sử dụng token tải xuống (index 1)
    if (!storedToken) {
      throw new Error('Không tìm thấy token Google Drive. Vui lòng cấu hình API trong cài đặt.');
    }
    console.log('Sử dụng token tải xuống (drive_token_download.json)');
    
    // Tạo OAuth2 client và Drive API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials(storedToken);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    console.log('Kiểm tra quyền truy cập Drive...');
    
    // Lấy thông tin file
    let fileInfo;
    try {
      fileInfo = await drive.files.get({
        fileId: fileId,
        fields: 'name,mimeType,size,capabilities'
      });
      
      // Kiểm tra quyền truy cập
      if (fileInfo.data.capabilities && !fileInfo.data.capabilities.canDownload) {
        throw new Error('Không có quyền tải xuống file này. Vui lòng kiểm tra quyền truy cập.');
      }
    } catch (error) {
      if (error.code === 404 || error.response?.status === 404) {
        throw new Error(`Không tìm thấy file với ID: ${fileId}. File có thể đã bị xóa hoặc không tồn tại.`);
      } else if (error.code === 403 || error.response?.status === 403) {
        throw new Error(`Không có quyền truy cập file với ID: ${fileId}. Vui lòng kiểm tra quyền truy cập.`);
      }
      throw error;
    }
    
    const fileName = fileInfo.data.name;
    const mimeType = fileInfo.data.mimeType;
    const outputPath = path.join(outputDir, fileName);
    
    console.log(`Tên file: ${fileName}`);
    console.log(`Loại MIME: ${mimeType}`);
    
    // Tải xuống file
    console.log(`Đang tải xuống file ${fileName}...`);
    
    try {
      const response = await drive.files.get(
        {
          fileId: fileId,
          alt: 'media'
        },
        { responseType: 'stream' }
      );
      
      // Lưu file vào đĩa
      const dest = fs.createWriteStream(outputPath);
      
      let error = null;
      response.data
        .on('error', err => {
          error = err;
          console.error('Lỗi khi tải xuống:', err);
        })
        .pipe(dest);
      
      // Đợi cho đến khi tải xuống hoàn tất
      await new Promise((resolve, reject) => {
        dest.on('finish', () => {
          console.log(`File đã được tải xuống thành công vào: ${outputPath}`);
          resolve();
        });
        dest.on('error', err => {
          console.error('Lỗi khi ghi file:', err);
          error = err;
          reject(err);
        });
      });
      
      if (error) {
        throw error;
      }
    } catch (downloadError) {
      if (downloadError.code === 403 || downloadError.response?.status === 403) {
        throw new Error('Không thể tải xuống file. Google Drive từ chối quyền truy cập. File có thể đã bị giới hạn bởi chủ sở hữu.');
      }
      throw downloadError;
    }
    
    return {
      success: true,
      filePath: outputPath,
      fileName: fileName,
      mimeType: mimeType,
      outputDir: outputDir
    };
  } catch (error) {
    console.error('Lỗi khi tải xuống file từ Google Drive:', error);
    
    // Dọn dẹp thư mục tạm nếu có lỗi
    try {
      fs.rmdirSync(outputDir, { recursive: true });
    } catch (cleanupError) {
      console.error('Lỗi khi dọn dẹp thư mục tạm:', cleanupError);
    }
    
    throw error;
  }
}

// Xử lý file (ví dụ: loại bỏ watermark)
async function processFile(filePath, mimeType) {
  console.log(`Đang xử lý file: ${filePath}`);
  
  // Tạo đường dẫn cho file đã xử lý
  const fileDir = path.dirname(filePath);
  const fileExt = path.extname(filePath);
  const fileName = path.basename(filePath, fileExt);
  const processedPath = path.join(fileDir, `${fileName}_processed${fileExt}`);
  
  // Đây là nơi bạn sẽ thêm logic xử lý file tùy thuộc vào loại file
  // Ví dụ: loại bỏ watermark, chỉnh sửa nội dung, v.v.
  
  // Trong ví dụ này, chúng ta chỉ sao chép file
  fs.copyFileSync(filePath, processedPath);
  
  console.log(`File đã được xử lý và lưu tại: ${processedPath}`);
  
  return {
    success: true,
    processedPath: processedPath
  };
}

// Kiểm tra và xóa file trùng lặp trước khi tải lên
async function checkAndDeleteDuplicates(drive, fileName, folderId) {
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
      await drive.files.delete({
        fileId: file.id
      });
      console.log(`Đã xóa file trùng lặp: ${file.id}`);
    }
    
    return duplicates.length;
  } catch (error) {
    console.error('Lỗi khi kiểm tra và xóa file trùng lặp:', error);
    // Không throw error, chỉ log và tiếp tục
    return 0;
  }
}

// Tải lên file đã xử lý lên Google Drive
async function uploadToGoogleDrive(filePath, fileName, mimeType, folderId = null) {
  console.log(`Đang tải lên file đã xử lý: ${filePath}`);
  
  try {
    // Lấy token đã lưu
    const storedToken = getStoredToken(0); // Sử dụng token tải lên (index 0 - drive_token_upload.json)
    if (!storedToken) {
      throw new Error('Không tìm thấy token Google Drive. Vui lòng cấu hình API trong cài đặt.');
    }
    console.log('Sử dụng token tải lên (drive_token_upload.json)');
    
    // Tạo OAuth2 client và Drive API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials(storedToken);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    console.log('Kiểm tra quyền truy cập Drive...');
    
    // Kiểm tra và xóa file trùng lặp trước khi tải lên
    const deletedCount = await checkAndDeleteDuplicates(drive, fileName, folderId);
    if (deletedCount > 0) {
      console.log(`Đã xóa ${deletedCount} file trùng lặp trước khi tải lên`);
    }
    
    // Tạo metadata cho file
    const fileMetadata = {
      name: `${fileName} (Processed)`,
      mimeType: mimeType
    };
    
    // Folder mặc định "tài liệu sheet" nếu không có folderId
    const defaultFolderId = "1Qs4Oi8OGZ-t2HKGX5PUH4-FMVcVYdI9N"; // ID của folder "tài liệu sheet"
    
    // Nếu có folder ID, thêm vào parent, nếu không dùng folder mặc định
    if (folderId) {
      fileMetadata.parents = [folderId];
      console.log(`Tải lên vào folder được chỉ định: ${folderId}`);
    } else {
      fileMetadata.parents = [defaultFolderId];
      console.log(`Tải lên vào folder mặc định "tài liệu sheet": ${defaultFolderId}`);
    }
    
    // Tạo media cho file
    const media = {
      mimeType: mimeType,
      body: fs.createReadStream(filePath)
    };
    
    // Tải lên file
    console.log('Đang tải lên file...');
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id,name,webViewLink'
    });
    
    console.log('File đã được tải lên thành công!');
    console.log(`ID: ${response.data.id}`);
    console.log(`Tên: ${response.data.name}`);
    console.log(`Link: ${response.data.webViewLink}`);
    
    return {
      success: true,
      fileId: response.data.id,
      fileName: response.data.name,
      webViewLink: response.data.webViewLink,
      duplicatesDeleted: deletedCount
    };
  } catch (error) {
    console.error('Lỗi khi tải lên file lên Google Drive:', error);
    throw error;
  }
}

// API Endpoint - POST
export async function POST(request) {
  console.log('============== BẮT ĐẦU API XỬ LÝ VÀ THAY THẾ FILE GOOGLE DRIVE ==============');
  
  let tempDir = null;
  
  try {
    // Parse request body
    const requestBody = await request.json();
    const { driveLink, folderId } = requestBody;
    
    console.log('Thông tin request:', {
      driveLink: driveLink || 'không có',
      folderId: folderId || 'sẽ dùng folder mặc định "tài liệu sheet"'
    });
    
    // Validate drive link
    if (!driveLink) {
      console.error('LỖI: Thiếu liên kết Google Drive');
      return NextResponse.json(
        { error: 'Thiếu liên kết Google Drive.' },
        { status: 400 }
      );
    }
    
    // Trích xuất file ID
    const fileId = extractDriveFileId(driveLink);
    if (!fileId) {
      console.error('LỖI: Không thể trích xuất ID file từ URL');
      return NextResponse.json(
        { error: 'Không thể trích xuất ID file từ URL. Vui lòng kiểm tra lại liên kết.' },
        { status: 400 }
      );
    }
    
    // Tải xuống file
    console.log(`Đang xử lý yêu cầu tải xuống: ${driveLink}`);
    const downloadResult = await downloadFromGoogleDrive(fileId);
    tempDir = downloadResult.outputDir;
    
    // Xử lý file
    const processResult = await processFile(downloadResult.filePath, downloadResult.mimeType);
    
    // Tải lên file đã xử lý
    const uploadResult = await uploadToGoogleDrive(
      processResult.processedPath,
      downloadResult.fileName,
      downloadResult.mimeType,
      folderId
    );
    
    // Dọn dẹp thư mục tạm
    try {
      fs.rmdirSync(tempDir, { recursive: true });
      console.log(`Đã xóa thư mục tạm: ${tempDir}`);
    } catch (cleanupError) {
      console.error('Lỗi khi dọn dẹp thư mục tạm:', cleanupError);
    }
    
    // Trả về kết quả
    return NextResponse.json({
      success: true,
      originalFile: {
        id: fileId,
        link: driveLink
      },
      processedFile: {
        id: uploadResult.fileId,
        name: uploadResult.fileName,
        link: uploadResult.webViewLink
      },
      duplicatesDeleted: uploadResult.duplicatesDeleted || 0
    });
  } catch (error) {
    console.error('Lỗi khi xử lý và thay thế file:', error);
    
    // Dọn dẹp thư mục tạm nếu có lỗi
    if (tempDir) {
      try {
        fs.rmdirSync(tempDir, { recursive: true });
        console.log(`Đã xóa thư mục tạm: ${tempDir}`);
      } catch (cleanupError) {
        console.error('Lỗi khi dọn dẹp thư mục tạm:', cleanupError);
      }
    }
    
    return NextResponse.json(
      { success: false, error: `Lỗi khi xử lý và thay thế file: ${error.message}` },
      { status: 500 }
    );
  }
}
