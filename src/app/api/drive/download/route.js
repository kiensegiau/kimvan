/**
 * API tải xuống file từ Google Drive
 * 
 * API này sẽ:
 * 1. Tải xuống file từ Google Drive
 * 2. Trả về nội dung file hoặc đường dẫn tải xuống
 */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';

// API validation token - có thể thay đổi thành giá trị khác
const API_TOKEN = 'drive-download-api';

// Đường dẫn file lưu token
const TOKEN_PATH = path.join(process.cwd(), 'youtube_token.json');

// Đọc token từ file
function getStoredToken() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const tokenContent = fs.readFileSync(TOKEN_PATH, 'utf8');
      console.log('Đọc token từ file:', TOKEN_PATH);
      
      try {
        const parsedToken = JSON.parse(tokenContent);
        console.log('Phân tích token thành công');
        return parsedToken;
      } catch (parseError) {
        console.error('Lỗi phân tích JSON token:', parseError);
        return null;
      }
    } else {
      console.error('File token không tồn tại tại đường dẫn:', TOKEN_PATH);
    }
  } catch (error) {
    console.error('Lỗi đọc file token:', error);
  }
  return null;
}

// Extract file ID và resource key từ Google Drive link
function extractGoogleDriveInfo(url) {
  let fileId = null;
  let resourceKey = null;
  
  // Format: https://drive.google.com/file/d/{fileId}/view
  const filePattern = /\/file\/d\/([^\/\?&]+)/;
  const fileMatch = url.match(filePattern);
  
  if (fileMatch && fileMatch[1]) {
    fileId = fileMatch[1].split('?')[0]; // Loại bỏ các tham số URL
  }
  
  // Format: https://drive.google.com/open?id={fileId}
  const openPattern = /[?&]id=([^&]+)/;
  const openMatch = url.match(openPattern);
  
  if (openMatch && openMatch[1]) {
    fileId = openMatch[1].split('&')[0]; // Loại bỏ các tham số khác
  }
  
  // Format: https://docs.google.com/document/d/{fileId}/edit
  const docsPattern = /\/document\/d\/([^\/\?&]+)/;
  const docsMatch = url.match(docsPattern);
  
  if (docsMatch && docsMatch[1]) {
    fileId = docsMatch[1].split('?')[0]; // Loại bỏ các tham số URL
  }
  
  // Extract resourceKey from URL
  const resourceKeyPattern = /[?&]resourcekey=([^&]+)/i;
  const resourceKeyMatch = url.match(resourceKeyPattern);
  
  if (resourceKeyMatch && resourceKeyMatch[1]) {
    resourceKey = resourceKeyMatch[1];
    console.log(`Đã tìm thấy resource key: ${resourceKey}`);
  }
  
  if (!fileId) {
    throw new Error('Không thể trích xuất file ID từ URL Google Drive');
  }
  
  return { fileId, resourceKey };
}

// Tìm file bằng tên hoặc ID
async function findFileByNameOrId(drive, nameOrId) {
  console.log(`Đang tìm kiếm file trong Drive với tên hoặc ID: ${nameOrId}`);
  
  try {
    // Thử truy cập trực tiếp bằng ID trước
    try {
      const fileInfo = await drive.files.get({
        fileId: nameOrId,
        fields: 'id,name,mimeType,size,capabilities',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      });
      
      console.log(`Tìm thấy file trực tiếp bằng ID: ${fileInfo.data.name}`);
      return fileInfo.data;
    } catch (directError) {
      console.log(`Không thể truy cập trực tiếp, lỗi: ${directError.message}`);
      
      // Nếu không thể truy cập trực tiếp, thử tìm kiếm bằng tên/ID
      const response = await drive.files.list({
        q: `name contains '${nameOrId}' or fullText contains '${nameOrId}'`,
        fields: 'files(id,name,mimeType,size,capabilities)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        pageSize: 10
      });
      
      const files = response.data.files;
      if (files && files.length > 0) {
        console.log(`Tìm thấy ${files.length} file khớp với tìm kiếm:`);
        files.forEach((file, index) => {
          console.log(`${index + 1}. ${file.name} (${file.id})`);
        });
        
        // Trả về file đầu tiên tìm được
        return files[0];
      } else {
        throw new Error(`Không tìm thấy file nào khớp với: ${nameOrId}`);
      }
    }
  } catch (error) {
    console.error('Lỗi khi tìm kiếm file:', error.message);
    throw error;
  }
}

// Download file từ Google Drive
async function downloadFromGoogleDrive(driveLink) {
  let fileId, resourceKey;
  
  try {
    // Trích xuất thông tin từ link
    if (driveLink.includes('drive.google.com') || driveLink.includes('docs.google.com')) {
      console.log(`Đang trích xuất file ID từ link: ${driveLink}`);
      const extracted = extractGoogleDriveInfo(driveLink);
      fileId = extracted.fileId;
      resourceKey = extracted.resourceKey;
    } else {
      fileId = driveLink; // Giả sử là file ID trực tiếp
    }
    
    console.log(`Đang tải xuống file từ Google Drive với ID: ${fileId}`);
    if (resourceKey) {
      console.log(`Sử dụng resource key: ${resourceKey}`);
    }
    
    // Lấy token đã lưu
    const storedToken = getStoredToken();
    if (!storedToken) {
      throw new Error('Không tìm thấy token Google Drive. Vui lòng cấu hình API trong cài đặt.');
    }
    
    // Tạo OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    // Thiết lập credentials
    oauth2Client.setCredentials(storedToken);
    
    // Thiết lập hàm làm mới token nếu cần
    if (storedToken.refresh_token) {
      oauth2Client.on('tokens', (tokens) => {
        console.log('Token đã được làm mới tự động');
        // Lưu token mới nếu cần
        if (tokens.refresh_token) {
          const newToken = {...storedToken, ...tokens};
          fs.writeFileSync(TOKEN_PATH, JSON.stringify(newToken));
          console.log('Đã lưu token mới');
        }
      });
    }
    
    // Khởi tạo Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Kiểm tra token Drive
    const aboutResponse = await drive.about.get({
      fields: 'user'
    });
    
    console.log(`Token Drive hợp lệ. Người dùng: ${aboutResponse.data.user?.displayName || 'Không xác định'}`);
    
    // Tìm file
    const foundFile = await findFileByNameOrId(drive, fileId);
    
    if (!foundFile) {
      throw new Error(`Không tìm thấy file với ID: ${fileId}`);
    }
    
    console.log('Thông tin file Google Drive:');
    console.log(`- Tên: ${foundFile.name}`);
    console.log(`- Loại: ${foundFile.mimeType}`);
    console.log(`- Kích thước: ${foundFile.size || 'Không xác định'}`);
    
    // Cập nhật fileId nếu cần
    if (foundFile.id !== fileId) {
      console.log(`Sử dụng ID tìm được: ${foundFile.id} (thay cho ${fileId})`);
      fileId = foundFile.id;
    }
    
    // Tạo thư mục tạm thời nếu cần
    const tempDir = path.join(os.tmpdir(), 'drive-download-');
    const outputDir = fs.mkdtempSync(tempDir);
    
    // Download file
    let fileName = foundFile.name;
    let filePath = '';
    let contentType = foundFile.mimeType;
    let fileBuffer;
    
    // Nếu là Google Workspace file (Docs, Sheets, Slides...)
    if (foundFile.mimeType.includes('google-apps')) {
      console.log('File là Google Workspace, xuất ra PDF...');
      
      const exportResponse = await drive.files.export({
        fileId: fileId,
        mimeType: 'application/pdf',
        supportsAllDrives: true
      }, {
        responseType: 'arraybuffer'
      });
      
      fileBuffer = Buffer.from(exportResponse.data);
      fileName = `${fileName}.pdf`;
      contentType = 'application/pdf';
    } else {
      // File thông thường
      console.log(`Tải xuống file thông thường: ${fileName}`);
      
      // Tạo options cho việc tải xuống
      const downloadOptions = {
        fileId: fileId,
        alt: 'media',
        supportsAllDrives: true,
        acknowledgeAbuse: true
      };
      
      // Thêm resource key nếu có
      if (resourceKey) {
        downloadOptions.resourceKey = resourceKey;
      }
      
      const response = await drive.files.get(downloadOptions, {
        responseType: 'arraybuffer'
      });
      
      fileBuffer = Buffer.from(response.data);
    }
    
    console.log(`Đã tải xuống file thành công (${fileBuffer.length} bytes)`);
    
    // Lưu file tạm
    const uniqueFileName = `${uuidv4()}${path.extname(fileName) || ''}`;
    filePath = path.join(outputDir, uniqueFileName);
    fs.writeFileSync(filePath, fileBuffer);
    
    return {
      success: true,
      fileName: fileName,
      filePath: filePath,
      contentType: contentType,
      size: fileBuffer.length,
      buffer: fileBuffer,
      outputDir: outputDir
    };
  } catch (error) {
    console.error('Lỗi khi tải xuống file từ Google Drive:', error);
    throw error;
  }
}

// Dọn dẹp file tạm
function cleanupTempFiles(tempDir) {
  console.log('Đang dọn dẹp các file tạm...');
  if (fs.existsSync(tempDir)) {
    const files = fs.readdirSync(tempDir);
    for (const file of files) {
      fs.unlinkSync(path.join(tempDir, file));
    }
    fs.rmdirSync(tempDir, { recursive: true });
  }
}

// API Endpoint - POST
export async function POST(request) {
  console.log('============== BẮT ĐẦU API TẢI XUỐNG GOOGLE DRIVE ==============');
  
  let tempDir = null;
  
  try {
    // Parse request body
    const requestBody = await request.json();
    const { token, driveLink, downloadType } = requestBody;
    
    console.log('Thông tin request:', {
      token: token ? '***' : 'không có',
      driveLink: driveLink || 'không có', 
      downloadType: downloadType || 'direct' // 'direct' hoặc 'link'
    });
    
    // Validate token
    if (!token || token !== API_TOKEN) {
      console.error('LỖI: Token API không hợp lệ');
      return NextResponse.json(
        { error: 'Không được phép. Token API không hợp lệ.' },
        { status: 401 }
      );
    }
    
    // Validate drive link
    if (!driveLink) {
      console.error('LỖI: Thiếu liên kết Google Drive');
      return NextResponse.json(
        { error: 'Thiếu liên kết Google Drive.' },
        { status: 400 }
      );
    }
    
    // Download file
    console.log(`Đang xử lý yêu cầu tải xuống: ${driveLink}`);
    const downloadResult = await downloadFromGoogleDrive(driveLink);
    tempDir = downloadResult.outputDir;
    
    // Nếu downloadType là direct, trả về file trực tiếp
    if (downloadType === 'direct') {
      console.log('Đang trả về file trực tiếp cho client...');
      
      // Đọc file buffer
      const fileBuffer = downloadResult.buffer;
      
      // Dọn dẹp file tạm
      cleanupTempFiles(tempDir);
      
      // Trả về file trực tiếp
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': downloadResult.contentType,
          'Content-Disposition': `attachment; filename="${encodeURIComponent(downloadResult.fileName)}"`,
          'Content-Length': downloadResult.size.toString()
        }
      });
    } else {
      // Trả về thông tin file để client tải xuống bằng link
      console.log('Đang trả về thông tin file cho client...');
      
      // Dọn dẹp file tạm
      cleanupTempFiles(tempDir);
      
      return NextResponse.json({
        success: true,
        fileName: downloadResult.fileName,
        fileSize: downloadResult.size,
        contentType: downloadResult.contentType,
        message: 'File đã được tải xuống thành công'
      }, { status: 200 });
    }
  } catch (error) {
    console.error('LỖI:', error);
    
    // Dọn dẹp file tạm nếu có
    if (tempDir && fs.existsSync(tempDir)) {
      cleanupTempFiles(tempDir);
    }
    
    return NextResponse.json(
      { error: `Không thể tải xuống file: ${error.message}` },
      { status: 500 }
    );
  } finally {
    console.log('============== KẾT THÚC API TẢI XUỐNG GOOGLE DRIVE ==============');
  }
}

// API Endpoint - GET (Kiểm tra)
export async function GET() {
  return NextResponse.json(
    { 
      message: 'API tải xuống file Google Drive đang hoạt động',
      usage: 'Gửi POST request với các tham số: token, driveLink, và downloadType (direct hoặc link)'
    },
    { status: 200 }
  );
} 