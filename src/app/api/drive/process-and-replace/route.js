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
  
  // Mẫu URL Google Drive
  const patterns = [
    /\/d\/([a-zA-Z0-9-_]+)/,                // Format: /d/FILE_ID
    /id=([a-zA-Z0-9-_]+)/,                  // Format: id=FILE_ID
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9-_]+)/,  // Format: drive.google.com/file/d/FILE_ID
    /^([a-zA-Z0-9-_]+)$/                    // Direct ID
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
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
    const fileInfo = await drive.files.get({
      fileId: fileId,
      fields: 'name,mimeType,size'
    });
    
    const fileName = fileInfo.data.name;
    const mimeType = fileInfo.data.mimeType;
    const outputPath = path.join(outputDir, fileName);
    
    console.log(`Tên file: ${fileName}`);
    console.log(`Loại MIME: ${mimeType}`);
    
    // Tải xuống file
    console.log(`Đang tải xuống file ${fileName}...`);
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

// Tải lên file đã xử lý lên Google Drive
async function uploadToGoogleDrive(filePath, fileName, mimeType, folderId = null) {
  console.log(`Đang tải lên file đã xử lý: ${filePath}`);
  
  try {
    // Lấy token đã lưu
    const storedToken = getStoredToken(0); // Sử dụng token tải lên (index 0)
    if (!storedToken) {
      throw new Error('Không tìm thấy token Google Drive. Vui lòng cấu hình API trong cài đặt.');
    }
    
    // Tạo OAuth2 client và Drive API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials(storedToken);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    console.log('Kiểm tra quyền truy cập Drive...');
    
    // Tạo metadata cho file
    const fileMetadata = {
      name: `${fileName} (Processed)`,
      mimeType: mimeType
    };
    
    // Nếu có folder ID, thêm vào parent
    if (folderId) {
      fileMetadata.parents = [folderId];
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
      webViewLink: response.data.webViewLink
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
      folderId: folderId || 'không có'
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
      }
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
