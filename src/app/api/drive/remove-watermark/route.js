/**
 * API xóa hình mờ file PDF từ Google Drive
 * 
 * API này sẽ:
 * 1. Tải xuống file PDF từ Google Drive
 * 2. Xử lý để xóa watermark
 * 3. Tùy chọn thêm hình nền tùy chỉnh
 * 4. Tải lên file đã xử lý lên Google Drive
 * 5. Trả về link đến file đã xử lý
 * 
 * Tham số:
 * - token: Token xác thực API
 * - driveLink: Link đến file PDF trên Google Drive
 * - backgroundImage (tùy chọn): Tên file hình nền (ví dụ: "nen.png") hoặc đường dẫn đầy đủ
 *   - Nếu chỉ cung cấp tên file, hệ thống sẽ tìm trong thư mục gốc của ứng dụng
 *   - Ví dụ: "nen.png" sẽ tự động trỏ đến "[thư mục ứng dụng]/nen.png"
 * - backgroundOpacity (tùy chọn): Độ trong suốt của hình nền (0.1 = 10%)
 */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import { PDFDocument } from 'pdf-lib';
import { execSync, exec } from 'child_process';

// Sửa import sharp để sử dụng phiên bản tương thích với Node.js
let sharp;
try {
  // Sử dụng dynamic import để tránh lỗi khi build
  sharp = require('sharp');
  
  // Sử dụng phiên bản legacy cho Node.js nếu cần
  if (process.env.NODE_ENV === 'production') {
    console.log('Sử dụng sharp với cấu hình cho môi trường production');
    // Các cấu hình cho môi trường production nếu cần
  }
} catch (error) {
  console.error('Lỗi khi import sharp:', error);
  // Fallback: Tạo một phiên bản giả của sharp nếu không thể import
  sharp = null;
}

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Đặt đường dẫn cho worker - cập nhật để sử dụng với Next.js
if (typeof window === 'undefined' && sharp) {
  try {
    // Vô hiệu hóa các tính năng yêu cầu canvas
    sharp.disableWorker = true;
    
    if (sharp.GlobalWorkerOptions) {
      // Ngăn sử dụng worker để tránh lỗi liên quan đến canvas
      sharp.GlobalWorkerOptions.disableWorker = true;
    }
    
    console.log('Đã cấu hình sharp không sử dụng worker');
  } catch (error) {
    console.error('Lỗi khi cấu hình sharp:', error);
  }
}

// API validation token
const API_TOKEN = 'api@test-watermark';

// Đường dẫn file lưu token
const TOKEN_PATH = path.join(process.cwd(), 'youtube_token.json');

// Thêm đường dẫn cho token upload và download
const TOKEN_PATHS = [
  path.join(process.cwd(), 'drive_token_upload.json'),   // Token tải lên - Upload
  path.join(process.cwd(), 'drive_token_download.json')  // Token tải xuống - Download
];

// Thông số xử lý mặc định
const DEFAULT_CONFIG = {
  dpi: 350,                // Độ phân giải
  brightness: 20,          // Độ sáng
  contrast: 35,            // Độ tương phản
  threshold: 0,            // Ngưỡng (0 = giữ màu sắc)
  gamma: 1.4,              // Gamma
  sharpening: 1.3,         // Độ sắc nét
  processCenter: false,    // Xử lý vùng trung tâm
  centerSize: 0.8,         // Kích thước vùng trung tâm (80% của trang)
  keepColors: true,        // Giữ màu sắc
  cleanupTempFiles: false, // Có xóa file tạm không
  maxWorkers: Math.max(1, os.cpus().length - 1), // Số lượng worker tối đa (số lượng CPU - 1)
  backgroundImage: null,   // Đường dẫn đến hình nền tùy chỉnh
  backgroundOpacity: 0.3,  // Giảm xuống 0.3 (30% đục)
};

// Đọc token từ file
function getStoredToken() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const tokenContent = fs.readFileSync(TOKEN_PATH, 'utf8');
      console.log('Đọc token từ file:', TOKEN_PATH);
      if (tokenContent.length === 0) {
        console.error('File token tồn tại nhưng trống');
        return null;
      }
      
      try {
        const parsedToken = JSON.parse(tokenContent);
        console.log('Phân tích token thành công. Trường có sẵn:', Object.keys(parsedToken).join(', '));
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

// Thêm hàm đọc token tải lên/tải xuống
function getTokenByType(type = 'upload') {
  try {
    const tokenIndex = type === 'upload' ? 0 : 1;
    const tokenPath = TOKEN_PATHS[tokenIndex];
    
    if (fs.existsSync(tokenPath)) {
      const tokenContent = fs.readFileSync(tokenPath, 'utf8');
      console.log(`Đọc token ${type} từ file:`, tokenPath);
      
      if (tokenContent.length === 0) {
        console.error(`File token ${type} tồn tại nhưng trống`);
        return null;
      }
      
      try {
        const parsedToken = JSON.parse(tokenContent);
        console.log(`Phân tích token ${type} thành công. Trường có sẵn:`, Object.keys(parsedToken).join(', '));
        return parsedToken;
      } catch (parseError) {
        console.error(`Lỗi phân tích JSON token ${type}:`, parseError);
        return null;
      }
    } else {
      console.error(`File token ${type} không tồn tại tại đường dẫn:`, tokenPath);
      // Fallback to old token file
      return getStoredToken();
    }
  } catch (error) {
    console.error(`Lỗi đọc file token ${type}:`, error);
    // Fallback to old token file
    return getStoredToken();
  }
}

// Thay thế hàm extractGoogleDriveFileId bằng phiên bản mới
function extractGoogleDriveFileId(url) {
  // Handle different Drive URL formats
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

// Thêm hàm tìm file bằng tên hoặc ID
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

// Cập nhật hàm downloadFromGoogleDrive
async function downloadFromGoogleDrive(fileIdOrLink) {
  let fileId, resourceKey;
  
  try {
    // Create temp directory
    console.log('Tạo thư mục tạm để lưu file tải xuống...');
    const tempDirName = uuidv4();
    const outputDir = path.join(os.tmpdir(), tempDirName);
    fs.mkdirSync(outputDir, { recursive: true });
    
    // Extract file ID from link if needed
    if (typeof fileIdOrLink === 'string' && fileIdOrLink.includes('drive.google.com')) {
      try {
        const result = extractGoogleDriveFileId(fileIdOrLink);
        fileId = result.fileId;
        resourceKey = result.resourceKey;
        console.log(`Đã trích xuất ID file từ link: ${fileId}`);
        if (resourceKey) {
          console.log(`Với resource key: ${resourceKey}`);
        }
      } catch (error) {
        throw new Error(`Không thể trích xuất ID từ link Google Drive: ${error.message}`);
      }
    } else {
      fileId = fileIdOrLink;
      console.log(`Sử dụng ID file đã cung cấp: ${fileId}`);
    }
    
    try {
      // Get stored token for download
      const downloadToken = getTokenByType('download');
      if (!downloadToken) {
        throw new Error('Không tìm thấy token Google Drive. Vui lòng cấu hình API trong cài đặt.');
      }
      
      // Create OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      
      // Set credentials
      oauth2Client.setCredentials(downloadToken);
      
      // Handle token refresh if needed
      oauth2Client.on('tokens', (tokens) => {
        console.log('Token refreshed by Google API client');
        if (tokens.refresh_token) {
          const newToken = {...downloadToken, ...tokens};
          fs.writeFileSync(TOKEN_PATHS[1], JSON.stringify(newToken));
          console.log('Đã lưu token mới');
        }
      });
      
      // Initialize Google Drive API
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      
      // Get file metadata
      console.log(`Lấy thông tin metadata của file ${fileId}...`);
      const fileMetadata = await drive.files.get({
        fileId: fileId,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: 'name,mimeType,size'
      });
      
      console.log('Metadata file:', fileMetadata.data);
      
      // Check if file is a PDF (for watermark removal)
      const mimeType = fileMetadata.data.mimeType;
      if (mimeType !== 'application/pdf') {
        throw new Error(`File không phải là PDF. Loại file: ${mimeType}`);
      }
      
      // Download file content
      console.log('Đang tải xuống file...');
      const response = await drive.files.get(
        {
          fileId: fileId,
          alt: 'media',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          ...(resourceKey ? { resourceKey } : {})
        },
        { responseType: 'arraybuffer' }
      );
      
      // Convert response to buffer
      const fileBuffer = Buffer.from(response.data);
      console.log(`Đã tải xuống ${fileBuffer.length} bytes`);
      
      if (fileBuffer.length === 0) {
        throw new Error('File tải xuống rỗng (0 byte)');
      }
      
      const fileName = fileMetadata.data.name;
      const contentType = mimeType;
      
      // Create unique filename
      const fileExtension = path.extname(fileName) || getExtensionFromMimeType(contentType);
      const uniqueFileName = `${uuidv4()}${fileExtension}`;
      const filePath = path.join(outputDir, uniqueFileName);
      
      // Save file to temp directory
      fs.writeFileSync(filePath, fileBuffer);
      
      return {
        success: true,
        filePath: filePath,
        fileName: fileName,
        contentType: contentType,
        outputDir: outputDir,
        size: fileBuffer.length
      };
    } catch (error) {
      // Clean up temp directory on error
      cleanupTempFiles(outputDir);
      throw error;
    }
  } catch (error) {
    console.error('Lỗi khi tải xuống từ Google Drive:', error);
    throw error;
  }
}

// Upload processed file back to Google Drive
async function uploadToDrive(filePath, fileName, mimeType) {
  try {
    console.log('Bắt đầu tải lên Google Drive:', fileName);
    
    // Kiểm tra file tồn tại
    if (!fs.existsSync(filePath)) {
      throw new Error(`File không tồn tại: ${filePath}`);
    }
    
    const fileSize = fs.statSync(filePath).size;
    if (fileSize === 0) {
      throw new Error(`File rỗng (0 byte): ${filePath}`);
    }
    
    console.log(`File hợp lệ: ${filePath}, kích thước: ${fileSize} bytes`);
    
    // Lấy token tải lên (upload)
    const uploadToken = getTokenByType('upload');
    if (!uploadToken) {
      throw new Error('Không tìm thấy token tải lên Google Drive. Vui lòng thiết lập lại tài khoản tải lên.');
    }
    
    // Tạo OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    // Thiết lập credentials
    oauth2Client.setCredentials(uploadToken);
    
    // Khởi tạo Google Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Tạo metadata cho file
    const fileMetadata = {
      name: `${fileName.replace(/\.pdf$/i, '')}_clean.pdf`,
      description: 'File đã được xử lý xóa watermark bởi API',
      parents: ['root'] // Thêm vào My Drive (root folder)
    };
    
    // Tạo media object
    const media = {
      mimeType: mimeType,
      body: fs.createReadStream(filePath)
    };
    
    // Tải file lên Drive
    const driveResponse = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id,name,webViewLink,webContentLink',
      supportsAllDrives: true
    });
    
    console.log('Tải lên Google Drive thành công:', driveResponse.data);
    
    // Đặt quyền truy cập cho file (nếu cần)
    try {
      console.log('Đặt quyền truy cập cho file...');
      
      // Chia sẻ cho bất kỳ ai có link (không yêu cầu đăng nhập)
      await drive.permissions.create({
        fileId: driveResponse.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });
      
      console.log('Đã đặt quyền truy cập cho file thành công');
    } catch (permissionError) {
      console.warn('Không thể đặt quyền truy cập:', permissionError.message);
      // Không throw lỗi vì việc tải lên đã thành công
    }
    
    return {
      success: true,
      fileId: driveResponse.data.id,
      fileName: driveResponse.data.name,
      webViewLink: driveResponse.data.webViewLink,
      downloadLink: driveResponse.data.webContentLink || null
    };
  } catch (error) {
    console.error('Lỗi khi tải lên Google Drive:', error);
    throw error;
  }
}

// Get file extension from MIME type
function getExtensionFromMimeType(mimeType) {
  if (!mimeType) return '.bin';
  
  const mimeToExt = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'audio/mpeg': '.mp3',
    'text/plain': '.txt',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx'
  };
  
  for (const [mime, ext] of Object.entries(mimeToExt)) {
    if (mimeType.includes(mime)) return ext;
  }
  
  return '.bin';
}

// Clean up temporary files
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

// Kiểm tra nếu đang trong worker thread
if (!isMainThread) {
  const task = workerData.task;
  
  if (task === 'processPage') {
    // Xử lý ảnh trong worker thread
    processPage(workerData).then(result => {
      parentPort.postMessage(result);
    }).catch(error => {
      parentPort.postMessage({ success: false, error: error.message });
    });
  } else if (task === 'convertPage') {
    // Chuyển đổi PDF sang PNG trong worker thread
    convertPage(workerData).then(result => {
      parentPort.postMessage(result);
    }).catch(error => {
      parentPort.postMessage({ success: false, error: error.message });
    });
  }
}

// Hàm chuyển đổi PDF sang PNG trong worker thread
async function convertPage(data) {
  const { gsPath, pdfPath, pngPath, page, numPages, dpi } = data;
  
  try {
    // Tối ưu lệnh chuyển đổi với các tùy chọn hiệu suất cao hơn
    await execPromise(`"${gsPath}" -dALLOWPSTRANSPARENCY -dQUIET -dBATCH -dNOPAUSE -dNOPAUSE -dMaxBitmap=500000000 -dNOGC -dBufferSpace=1000000 -sDEVICE=png16m -r${dpi} -o "${pngPath}" "${pdfPath}"`);
    return { success: true, page, pngPath };
  } catch (error) {
    return { success: false, page, error: error.message };
  }
}

// Hàm xử lý trang trong worker thread
async function processPage(data) {
  const { pngPath, processedPngPath, page, numPages, config } = data;
  
  try {
    // Xử lý hình ảnh với Sharp
    console.log(`Đang xử lý hình ảnh trang ${page}/${numPages}...`);
    
    // Đọc hình ảnh
    const image = sharp(pngPath);
    const metadata = await image.metadata();
    
    if (config.processCenter) {
      // Xử lý vùng trung tâm
      const centerX = Math.floor(metadata.width * 0.1);
      const centerY = Math.floor(metadata.height * 0.1);
      const centerWidth = Math.floor(metadata.width * config.centerSize);
      const centerHeight = Math.floor(metadata.height * config.centerSize);
      
      const center = await image
        .clone()
        .extract({
          left: centerX,
          top: centerY,
          width: centerWidth,
          height: centerHeight
        })
        .modulate({
          brightness: 1 + (config.brightness / 100)
        })
        .linear(
          1 + (config.contrast / 100),
          -(config.contrast / 2)
        )
        .toBuffer();
      
      let processedCenter = sharp(center);
      if (config.threshold > 0 && !config.keepColors) {
        processedCenter = processedCenter.threshold(config.threshold * 100);
      }
      
      const processedCenterBuffer = await processedCenter.toBuffer();
      
      await sharp(pngPath)
        .composite([{
          input: processedCenterBuffer,
          left: centerX,
          top: centerY
        }])
        .toFile(processedPngPath);
    } else {
      // Xử lý toàn bộ hình ảnh
      let processedImage = image
        .modulate({
          brightness: 1 + (config.brightness / 100)
        })
        .linear(
          1 + (config.contrast / 100),
          -(config.contrast / 2)
        );
      
      // Chỉ áp dụng threshold nếu không giữ màu sắc
      if (config.threshold > 0 && !config.keepColors) {
        processedImage = processedImage.threshold(config.threshold * 100);
      }
      
      // Nếu giữ màu sắc, có thể áp dụng các phương pháp khác để xóa watermark
      if (config.keepColors) {
        // Có thể thêm các phương pháp xử lý màu sắc nâng cao ở đây nếu cần
        processedImage = processedImage.gamma(config.gamma);
        processedImage = processedImage.sharpen(config.sharpening);
      }
      
      await processedImage.toFile(processedPngPath);
    }
    
    return { success: true, page, processedPngPath };
  } catch (error) {
    return { success: false, page, error: error.message };
  }
}

// Kiểm tra và tìm GhostScript với thông tin chi tiết hơn
function findGhostscript() {
  const possibleGsPaths = [
    // Đường dẫn Windows phổ biến
    'C:\\Program Files\\gs\\gs10.05.0\\bin\\gswin64c.exe', // Thêm phiên bản 10.05.0 vào đầu danh sách
    'C:\\Program Files\\gs\\gs10.02.0\\bin\\gswin64c.exe',
    'C:\\Program Files\\gs\\gs10.01.2\\bin\\gswin64c.exe',
    'C:\\Program Files\\gs\\gs10.00.0\\bin\\gswin64c.exe',
    'C:\\Program Files\\gs\\gs9.56.1\\bin\\gswin64c.exe',
    'C:\\Program Files\\gs\\gs9.55.0\\bin\\gswin64c.exe',
    'C:\\Program Files\\gs\\gs9.54.0\\bin\\gswin64c.exe',
    'C:\\Program Files\\gs\\gs9.53.3\\bin\\gswin64c.exe',
    // Đường dẫn 32-bit
    'C:\\Program Files (x86)\\gs\\gs10.05.0\\bin\\gswin32c.exe', // Thêm phiên bản 10.05.0
    'C:\\Program Files (x86)\\gs\\gs10.02.0\\bin\\gswin32c.exe',
    'C:\\Program Files (x86)\\gs\\gs9.56.1\\bin\\gswin32c.exe',
    // Đường dẫn Linux/Mac
    '/usr/bin/gs',
    '/usr/local/bin/gs',
    '/opt/homebrew/bin/gs'
  ];

  console.log('Đang kiểm tra GhostScript trong các đường dẫn cố định...');
  
  // Thử tìm trong các đường dẫn có thể
  for (const gsPath of possibleGsPaths) {
    try {
      if (fs.existsSync(gsPath)) {
        console.log(`Đã tìm thấy GhostScript tại: ${gsPath}`);
        // Thử thực thi để kiểm tra
        try {
          const version = execSync(`"${gsPath}" -v`, { stdio: 'pipe', encoding: 'utf8' });
          console.log(`GhostScript đã được xác nhận tại ${gsPath} - Phiên bản:`, version.trim().split('\n')[0]);
          return gsPath;
        } catch (error) {
          console.warn(`GhostScript tồn tại tại ${gsPath} nhưng không thể thực thi:`, error.message);
          // Tiếp tục tìm đường dẫn khác
        }
      }
    } catch (error) {
      // Bỏ qua lỗi khi kiểm tra tồn tại
      console.warn(`Lỗi khi kiểm tra đường dẫn ${gsPath}:`, error.message);
    }
  }

  console.log('Đang kiểm tra GhostScript trong PATH hệ thống...');
  
  // Thử thực thi các lệnh GhostScript trực tiếp (sử dụng PATH)
  // Chú ý: Thử gswin64c trước vì bạn đã xác nhận lệnh này hoạt động
  try {
    const version = execSync('gswin64c -v', { stdio: 'pipe', encoding: 'utf8' });
    console.log('Đã tìm thấy gswin64c trong PATH hệ thống');
    console.log('Phiên bản GhostScript:', version.trim().split('\n')[0]);
    return 'gswin64c';
  } catch (gswin64cError) {
    console.warn('Không tìm thấy gswin64c trong PATH:', gswin64cError.message);
    
    try {
      const version = execSync('gswin32c -v', { stdio: 'pipe', encoding: 'utf8' });
      console.log('Đã tìm thấy gswin32c trong PATH hệ thống');
      console.log('Phiên bản GhostScript:', version.trim().split('\n')[0]);
      return 'gswin32c';
    } catch (gswin32cError) {
      console.warn('Không tìm thấy gswin32c trong PATH:', gswin32cError.message);
      
      try {
        const version = execSync('gs -v', { stdio: 'pipe', encoding: 'utf8' });
        console.log('Đã tìm thấy gs trong PATH hệ thống');
        console.log('Phiên bản GhostScript:', version.trim().split('\n')[0]);
        return 'gs';
      } catch (gsError) {
        console.warn('Không tìm thấy gs trong PATH:', gsError.message);
      }
    }
  }

  // Thử truy cập trực tiếp đường dẫn đã biết hoạt động
  try {
    console.log('Thử sử dụng đường dẫn đã biết hoạt động từ dòng lệnh...');
    // Sử dụng đường dẫn bạn đã biết chắc chắn hoạt động
    const knownPath = 'C:\\Program Files\\gs\\gs10.05.0\\bin\\gswin64c.exe';
    if (fs.existsSync(knownPath)) {
      console.log(`Đã tìm thấy GhostScript tại đường dẫn đã biết: ${knownPath}`);
      return knownPath;
    }
  } catch (error) {
    console.warn('Lỗi khi kiểm tra đường dẫn đã biết:', error.message);
  }

  // Hiển thị thông báo lỗi chi tiết
  console.error(`
========= LỖI KHÔNG TÌM THẤY GHOSTSCRIPT =========
GhostScript không được cài đặt hoặc không thể tìm thấy.
API này yêu cầu GhostScript để xử lý PDF.

Hướng dẫn cài đặt:
- Windows: Tải và cài đặt từ https://ghostscript.com/releases/gsdnld.html
- Ubuntu/Debian: sudo apt-get install ghostscript
- Mac: brew install ghostscript

Sau khi cài đặt, đảm bảo GhostScript được thêm vào PATH hệ thống hoặc cập nhật đường dẫn trong mã nguồn.

HƯỚNG DẪN THÊM VÀO PATH:
1. Windows:
   a. Nhấp chuột phải vào "This PC" hoặc "My Computer" > Properties
   b. Chọn "Advanced system settings"
   c. Nhấp vào "Environment Variables"
   d. Trong phần "System Variables", tìm biến "Path" và nhấp "Edit"
   e. Nhấp "New" và thêm đường dẫn đến thư mục bin của GhostScript
      (Thường là C:\\Program Files\\gs\\gs{version}\\bin)
   f. Nhấp "OK" để lưu các thay đổi

2. macOS:
   a. Mở Terminal
   b. Thực hiện lệnh: echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zshrc
      (hoặc ~/.bash_profile nếu dùng bash)
   c. Tải lại profile: source ~/.zshrc (hoặc ~/.bash_profile)

3. Linux:
   a. Mở Terminal
   b. Thực hiện lệnh: echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.bashrc
   c. Tải lại profile: source ~/.bashrc

KIỂM TRA CÀI ĐẶT:
Mở Terminal hoặc Command Prompt và thực hiện lệnh: gswin64c -v (Windows) hoặc gs -v (Mac/Linux)
Nếu GhostScript đã được cài đặt đúng, lệnh này sẽ hiển thị phiên bản.

HOẶC CẬP NHẬT MÃ NGUỒN:
Thay vì thêm vào PATH, bạn có thể cập nhật hàm findGhostscript() trong file này
và thêm đường dẫn đầy đủ đến GhostScript vào biến possibleGsPaths.
==================================================
  `);
  
  throw new Error('GhostScript không được cài đặt hoặc không thể tìm thấy. Vui lòng cài đặt GhostScript trước khi sử dụng API này.');
}

// Hàm tạo worker để chuyển đổi PDF sang PNG
function createConvertWorker(gsPath, pdfPath, pngPath, page, numPages, dpi) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: {
        task: 'convertPage',
        gsPath,
        pdfPath,
        pngPath,
        page,
        numPages,
        dpi
      }
    });
    
    worker.on('message', (result) => {
      if (result.success) {
        console.log(`✓ Trang ${page}/${numPages} đã chuyển đổi sang PNG`);
        resolve(result);
      } else {
        console.error(`✗ Lỗi chuyển đổi trang ${page}/${numPages}:`, result.error);
        reject(new Error(result.error));
      }
    });
    
    worker.on('error', (err) => {
      console.error(`✗ Lỗi worker chuyển đổi trang ${page}/${numPages}:`, err);
      reject(err);
    });
    
    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`✗ Worker chuyển đổi trang ${page}/${numPages} dừng với mã lỗi ${code}`);
      }
    });
  });
}

// Hàm tạo worker để xử lý một trang
function createProcessWorker(pngPath, page, numPages, config) {
  return new Promise((resolve, reject) => {
    const processedPngPath = path.join(path.dirname(pngPath), `page_${page}_processed.png`);
    
    const worker = new Worker(__filename, {
      workerData: {
        task: 'processPage',
        pngPath,
        processedPngPath,
        page,
        numPages,
        config
      }
    });
    
    worker.on('message', (result) => {
      if (result.success) {
        console.log(`✓ Trang ${page}/${numPages} đã xử lý xong`);
        resolve({ ...result, index: page - 1 });
      } else {
        console.error(`✗ Lỗi xử lý trang ${page}/${numPages}:`, result.error);
        reject(new Error(result.error));
      }
    });
    
    worker.on('error', (err) => {
      console.error(`✗ Lỗi worker trang ${page}/${numPages}:`, err);
      reject(err);
    });
    
    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`✗ Worker trang ${page}/${numPages} dừng với mã lỗi ${code}`);
      }
    });
  });
}

// Thêm cache cho kết quả đếm trang PDF
const pageCountCache = new Map();

// Tối ưu hàm đếm số trang PDF
async function countPdfPagesWithGhostscript(pdfPath, gsPath) {
  // Kiểm tra cache trước
  const cacheKey = pdfPath;
  if (pageCountCache.has(cacheKey)) {
    console.log(`Lấy số trang từ cache cho: ${pdfPath}`);
    return pageCountCache.get(cacheKey);
  }

  console.log(`Đang đếm số trang PDF với GhostScript: ${pdfPath}`);
  try {
    // Chuẩn hóa đường dẫn và escape đúng cho cú pháp PostScript
    const normalizedPath = pdfPath.replace(/\\/g, '/');
    const escapedPath = normalizedPath.replace(/[\(\)]/g, '\\$&');
    
    // Đơn giản hóa lệnh để tăng hiệu suất
    const command = `"${gsPath}" -q -dNODISPLAY -c "(${escapedPath}) (r) file runpdfbegin pdfpagecount = quit"`;
    console.log(`Thực thi lệnh: ${command}`);
    
    const output = execSync(command, { encoding: 'utf8' }).trim();
    const numPages = parseInt(output);
    
    if (!isNaN(numPages)) {
      // Lưu vào cache
      pageCountCache.set(cacheKey, numPages);
      console.log(`Số trang PDF: ${numPages} (đã lưu vào cache)`);
      return numPages;
    }

    // Thay vì thử nhiều phương pháp tuần tự, sử dụng Promise.any để chạy song song
    const results = await Promise.any([
      // Phương pháp thay thế 1
      (async () => {
        const altCommand = `"${gsPath}" -q -dNODISPLAY -dNOSAFER -c "(${escapedPath}) << /SubFileDecode true >> (r) file pdfdict begin pdfinitfile Trailer/Root get/Pages get/Count get == quit"`;
        const altOutput = execSync(altCommand, { encoding: 'utf8' }).trim();
        const pages = parseInt(altOutput);
        if (isNaN(pages)) throw new Error('Không thể phân tích kết quả');
        return pages;
      })(),
      
      // Phương pháp thay thế 2: pdf-lib
      (async () => {
        const pdfBuffer = fs.readFileSync(pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        return pdfDoc.getPageCount();
      })()
    ]);
    
    // Lưu kết quả vào cache
    pageCountCache.set(cacheKey, results);
    return results;
  } catch (error) {
    console.error('Lỗi khi đếm số trang PDF:', error);
    
    // Fallback - đọc trực tiếp từ file thay vì chạy nhiều lệnh
    try {
      const pdfBuffer = fs.readFileSync(pdfPath);
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pageCount = pdfDoc.getPageCount();
      
      // Lưu vào cache
      pageCountCache.set(cacheKey, pageCount);
      return pageCount;
    } catch {
      return 1; // Fallback cuối cùng
    }
  }
}

// Tối ưu xử lý song song để cải thiện hiệu suất
async function processBatches(items, processFunc, maxConcurrent) {
  const results = [];
  
  // Sử dụng Promise.all thay vì Promise.allSettled khi có thể
  for (let i = 0; i < items.length; i += maxConcurrent) {
    const batch = items.slice(i, i + maxConcurrent).map(processFunc);
    const batchResults = await Promise.allSettled(batch);
    
    // Tối ưu để giảm overhead khi nối mảng lớn
    results.push(...batchResults);
    
    // Tạm dừng ngắn để cho phép GC chạy và tránh OOM
    if (items.length > 50 && i % 50 === 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  
  return results;
}

// Tối ưu hàm vẽ hình ảnh vào PDF
async function addImageToPdf(pdfDoc, pngPath, index, totalPages, config = DEFAULT_CONFIG) {
  if (!fs.existsSync(pngPath)) {
    console.warn(`Bỏ qua trang ${index + 1} vì file không tồn tại: ${pngPath}`);
    return false;
  }
  
  // Đọc dữ liệu PNG - sử dụng đệm buffer lớn hơn để giảm I/O
  const pngData = fs.readFileSync(pngPath, { 
    highWaterMark: 1024 * 1024 // 1MB buffer
  });
  
  // Nhúng hình ảnh nội dung vào PDF
  const contentImage = await pdfDoc.embedPng(pngData);
  const pngDimensions = contentImage.size();
  
  // Tạo trang mới với kích thước của hình ảnh
  const page = pdfDoc.addPage([pngDimensions.width, pngDimensions.height]);
  
  // Vẽ hình ảnh nội dung lên trang
  page.drawImage(contentImage, {
    x: 0,
    y: 0,
    width: pngDimensions.width,
    height: pngDimensions.height
  });
  
  // Bây giờ thêm hình nền *SAU* nội dung (để hiển thị trên cùng)
  if (config.backgroundImage && fs.existsSync(config.backgroundImage)) {
    try {
      console.log(`==== THÊM HÌNH NỀN - TRANG ${index + 1} ====`);
      console.log(`- Đang thêm hình nền vào trang ${index + 1}...`);
      console.log(`- Đường dẫn hình nền: ${config.backgroundImage}`);
      console.log(`- Độ trong suốt: ${config.backgroundOpacity}`);
      
      // Đọc hình nền
      const backgroundData = fs.readFileSync(config.backgroundImage);
      console.log(`- Đã đọc file hình nền (${backgroundData.length} bytes)`);
      
      // Xác định loại file và nhúng phù hợp
      let backgroundImage;
      if (config.backgroundImage.toLowerCase().endsWith('.png')) {
        console.log('- Loại file: PNG');
        backgroundImage = await pdfDoc.embedPng(backgroundData);
      } else if (config.backgroundImage.toLowerCase().endsWith('.jpg') || 
                config.backgroundImage.toLowerCase().endsWith('.jpeg')) {
        console.log('- Loại file: JPG/JPEG');
        backgroundImage = await pdfDoc.embedJpg(backgroundData);
      } else {
        console.warn(`- Định dạng file hình nền không được hỗ trợ: ${config.backgroundImage}`);
        return true; // Vẫn tiếp tục mà không có hình nền
      }
      
      if (backgroundImage) {
        const bgDimensions = backgroundImage.size();
        console.log(`- Kích thước hình nền: ${bgDimensions.width}x${bgDimensions.height}`);
        console.log(`- Kích thước trang PDF: ${pngDimensions.width}x${pngDimensions.height}`);
        
        // CHỈ THÊM MỘT HÌNH NỀN LỚN Ở GIỮA TRANG
        // Tính toán để hình nền chiếm khoảng 70% diện tích trang
        const targetWidth = pngDimensions.width * 0.7;
        const targetHeight = pngDimensions.height * 0.7;
        
        // Tính tỷ lệ phù hợp để giữ nguyên tỷ lệ hình ảnh
        const scaleWidth = targetWidth / bgDimensions.width;
        const scaleHeight = targetHeight / bgDimensions.height;
        const scale = Math.min(scaleWidth, scaleHeight);
        
        console.log(`- Tỷ lệ co giãn: ${scale.toFixed(2)}`);
        
        // Tính kích thước và vị trí hình nền
        const bgWidth = bgDimensions.width * scale;
        const bgHeight = bgDimensions.height * scale;
        const xOffset = (pngDimensions.width - bgWidth) / 2; // Giữa trang theo chiều ngang
        const yOffset = (pngDimensions.height - bgHeight) / 2; // Giữa trang theo chiều dọc
        
        console.log(`- Vị trí: (${xOffset.toFixed(2)}, ${yOffset.toFixed(2)}), Kích thước: ${bgWidth.toFixed(2)}x${bgHeight.toFixed(2)}`);
        
        // Vẽ một hình nền duy nhất ở giữa
        page.drawImage(backgroundImage, {
          x: xOffset,
          y: yOffset,
          width: bgWidth,
          height: bgHeight,
          opacity: config.backgroundOpacity || 0.3,
        });
        
        console.log(`- Đã thêm hình nền lớn ở trung tâm vào trang ${index + 1} với độ đục ${config.backgroundOpacity || 0.3}`);
      } else {
        console.warn(`- Không thể nhúng hình nền vào trang ${index + 1}`);
      }
      console.log(`==== KẾT THÚC THÊM HÌNH NỀN - TRANG ${index + 1} ====`);
    } catch (backgroundError) {
      console.warn(`LỖI khi thêm hình nền vào trang ${index + 1}:`, backgroundError);
      console.warn(`Chi tiết lỗi:`, backgroundError.message);
      console.warn(`Stack trace:`, backgroundError.stack);
    }
  }
  
  console.log(`✓ Trang ${index + 1}/${totalPages} đã được thêm vào PDF`);
  return true;
}

// Tối ưu hàm chính để xóa watermark
async function cleanPdf(inputPath, outputPath, config = DEFAULT_CONFIG) {
  if (!isMainThread) return; // Đảm bảo chỉ chạy trong main thread
  
  const startTime = Date.now();
  console.log('Bắt đầu xử lý xóa watermark...');
  
  // Kiểm tra xem sharp có khả dụng không
  if (!sharp) {
    console.error('CRITICAL ERROR: Thư viện Sharp không khả dụng. Không thể xử lý hình ảnh.');
    throw new Error('Thư viện xử lý hình ảnh (Sharp) không khả dụng trên máy chủ này. Vui lòng liên hệ quản trị viên.');
  }
  
  // Tìm GhostScript một lần và cache kết quả
  let gsPath;
  try {
    gsPath = findGhostscript();
    console.log('Đã tìm thấy GhostScript tại:', gsPath);
  } catch (gsError) {
    console.error('CRITICAL ERROR: Không thể tìm thấy GhostScript:', gsError.message);
    throw gsError;
  }

  console.log('=== XỬ LÝ XÓA WATERMARK ===');
  console.log(`Thông số: DPI=${config.dpi}, Brightness=${config.brightness}, Contrast=${config.contrast}, KeepColors=${config.keepColors}, Workers=${config.maxWorkers}`);
  
  if (!inputPath) {
    throw new Error('Không có đường dẫn file đầu vào');
  }
  
  outputPath = outputPath || inputPath.replace('.pdf', '_clean.pdf');
  
  if (!fs.existsSync(inputPath)) {
    throw new Error(`File không tồn tại: ${inputPath}`);
  }
  
  // Kiểm tra kích thước file
  const stats = fs.statSync(inputPath);
  const fileSizeInMB = stats.size / (1024 * 1024);
  console.log(`Kích thước file: ${fileSizeInMB.toFixed(2)} MB`);
  
  // Tạo thư mục temp hiệu quả hơn
  const tempDir = path.join(os.tmpdir(), `pdf-watermark-removal-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  console.log('Đã tạo thư mục xử lý tạm thời:', tempDir);
  
  try {
    // Đếm số trang với cache
    console.log('Đang đếm số trang...');
    const numPages = await countPdfPagesWithGhostscript(inputPath, gsPath);
    
    // Tối ưu biến cho số lượng công nhân
    const optimalWorkers = Math.min(
      config.maxWorkers,
      Math.max(1, Math.min(os.cpus().length - 1, numPages))
    );
    console.log(`Sử dụng ${optimalWorkers} worker cho ${numPages} trang`);
    
    // Tách PDF thành từng trang - sử dụng tùy chọn tối ưu cho GhostScript
    console.log('Đang tách PDF thành từng trang...');
    const gsCommand = `"${gsPath}" -dALLOWPSTRANSPARENCY -dBATCH -dNOPAUSE -q -dNumRenderingThreads=${optimalWorkers} -sDEVICE=pdfwrite -dSAFER ` +
            `-dFirstPage=1 -dLastPage=${numPages} ` +
            `-sOutputFile="${path.join(tempDir, 'page_%d.pdf')}" "${inputPath}"`;
    
    console.log('Thực thi lệnh GhostScript:', gsCommand);
    execSync(gsCommand, { stdio: 'pipe' });
    
    // Kiểm tra kết quả nhanh hơn bằng cách dựa vào readdir và lọc
    const pdfFiles = fs.readdirSync(tempDir, { 
      withFileTypes: true 
    })
    .filter(entry => entry.isFile() && entry.name.endsWith('.pdf'))
    .map(entry => entry.name);
    
    console.log(`Đã tách thành ${pdfFiles.length} trang PDF`);
    
    if (pdfFiles.length === 0) {
      throw new Error('Không thể tách PDF thành các trang. GhostScript không tạo ra file nào.');
    }
    
    // Chuẩn bị danh sách công việc hiệu quả hơn
    console.log('Chuẩn bị danh sách công việc chuyển đổi PDF sang PNG...');
    const conversionTasks = [];
    
    // Sử dụng cách tối ưu hơn để tạo nhiệm vụ
    for (let page = 1; page <= numPages; page++) {
      const pdfPath = path.join(tempDir, `page_${page}.pdf`);
      if (fs.existsSync(pdfPath)) {
        conversionTasks.push({
          pdfPath,
          pngPath: path.join(tempDir, `page_${page}.png`),
          page
        });
      }
    }

    console.log(`Đã chuẩn bị ${conversionTasks.length} công việc chuyển đổi`);
    if (conversionTasks.length === 0) {
      throw new Error('Không có trang PDF nào để chuyển đổi!');
    }

    // Chuyển đổi PDF sang PNG song song với số lượng worker tối ưu
    console.log(`Đang chuyển đổi song song ${conversionTasks.length} trang PDF sang PNG...`);
    const convertResults = await processBatches(conversionTasks, 
      (task) => createConvertWorker(gsPath, task.pdfPath, task.pngPath, task.page, numPages, config.dpi),
      optimalWorkers
    );
    
    // Lọc và giải phóng bộ nhớ sớm hơn
    const successfulConversions = convertResults
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);
    
    console.log(`Số trang chuyển đổi thành công: ${successfulConversions.length}/${convertResults.length}`);
    
    if (successfulConversions.length === 0) {
      throw new Error('Không có trang nào được chuyển đổi thành công!');
    }
    
    // Xử lý các PNG song song hiệu quả hơn
    console.log(`Đang xử lý song song ${successfulConversions.length} trang...`);
    const processResults = await processBatches(successfulConversions,
      (conversion) => createProcessWorker(conversion.pngPath, conversion.page, numPages, config),
      optimalWorkers
    );
    
    // Lọc và sắp xếp hiệu quả hơn
    const successfulProcessing = processResults
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value)
      .sort((a, b) => a.index - b.index);
    
    console.log(`Số trang xử lý thành công: ${successfulProcessing.length}/${processResults.length}`);
    
    // Lấy danh sách đường dẫn PNG đã xử lý
    const processedPngPaths = successfulProcessing.map(result => result.processedPngPath);
    
    if (processedPngPaths.length === 0) {
      throw new Error('Không có trang nào được xử lý thành công!');
    }
    
    // Ghép các trang PNG thành PDF hiệu quả hơn
    console.log('Đang ghép các trang thành PDF cuối cùng...');
    
    // Tạo PDF hiệu quả hơn
    const pdfDoc = await PDFDocument.create();
    
    // Xử lý song song việc thêm hình ảnh vào PDF (tối đa 3 trang cùng lúc để tránh OOM)
    const addImageBatchSize = 3;
    for (let i = 0; i < processedPngPaths.length; i += addImageBatchSize) {
      const batch = processedPngPaths.slice(i, i + addImageBatchSize);
      await Promise.all(
        batch.map((pngPath, idx) => 
          addImageToPdf(pdfDoc, pngPath, i + idx, processedPngPaths.length, config)
        )
      );
    }
    
    // Lưu PDF với tùy chọn nén tối ưu
    console.log('Lưu PDF kết quả với nén tối ưu...');
    const pdfBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false
    });
    
    fs.writeFileSync(outputPath, pdfBytes);
    
    // Dọn dẹp file tạm ngay khi có thể để tiết kiệm bộ nhớ
    if (config.cleanupTempFiles) {
      console.log('Dọn dẹp các file tạm...');
      cleanupTempFiles(tempDir);
    }
    
    // Sau khi hoàn thành
    const endTime = Date.now();
    const processingTime = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`Xử lý hoàn tất trong ${processingTime} giây`);
    
    return { 
      success: true, 
      outputPath, 
      processingTime,
      originalSize: fileSizeInMB.toFixed(2) + ' MB',
      processedSize: fs.existsSync(outputPath) ? (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2) + ' MB' : 'Unknown'
    };
  } catch (error) {
    console.error('LỖI NGHIÊM TRỌNG khi xử lý PDF:', error.message);
    
    // Dọn dẹp file tạm
    try {
      cleanupTempFiles(tempDir);
    } catch (cleanupError) {
      console.warn('Không thể dọn dẹp file tạm:', cleanupError.message);
    }
    
    throw error;
  }
}

// Next.js API route handler
export async function POST(request) {
  let tempDir = null;
  let processedFilePath = null;
  
  console.log('============== BẮT ĐẦU API XÓA WATERMARK ==============');
  console.log('Thời gian bắt đầu:', new Date().toISOString());
  console.log('Node.js version:', process.version);
  console.log('OS platform:', process.platform);
  console.log('OS arch:', process.arch);
  
  try {
    // Parse request body
    console.log('Đang phân tích body request...');
    const requestBody = await request.json();
    let { token, driveLink, backgroundImage, backgroundOpacity } = requestBody;

    // Sử dụng "nen.png" làm hình nền mặc định
    if (!backgroundImage) {
      backgroundImage = path.join(process.cwd(), "nen.png");
      console.log('Sử dụng hình nền mặc định:', backgroundImage);
    }
    if (backgroundOpacity === undefined) {
      backgroundOpacity = 0.3; // Giảm xuống 0.3
      console.log('Sử dụng độ đục mặc định giảm xuống:', backgroundOpacity);
    }

    // Thêm log chi tiết về các tham số nhận được
    console.log('=============================================');
    console.log('CHI TIẾT REQUEST:');
    console.log('- Request Body:', JSON.stringify(requestBody));
    console.log('- token:', token ? '***' : 'undefined');
    console.log('- driveLink:', driveLink || 'undefined');
    console.log('- backgroundImage (raw):', backgroundImage);
    console.log('- backgroundImage (type):', typeof backgroundImage);
    console.log('- backgroundOpacity (raw):', backgroundOpacity);
    console.log('- backgroundOpacity (type):', typeof backgroundOpacity);
    console.log('=============================================');

    console.log('Thông tin request:', {
      token: token ? '***' : 'không có',
      driveLink: driveLink || 'không có',
      backgroundImage: backgroundImage ? 'có' : 'không có',
      backgroundOpacity: backgroundOpacity || 0.1
    });

    // Validate API token
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

    console.log(`Đang xử lý yêu cầu với Drive link: ${driveLink}`);
    
    // Download file from Drive
    console.log('Bước 1: Tải xuống file từ Google Drive...');
    let downloadResult;
    try {
      downloadResult = await downloadFromGoogleDrive(driveLink);
      tempDir = downloadResult.outputDir;
      console.log('Kết quả tải xuống:', {
        filePath: downloadResult.filePath,
        fileName: downloadResult.fileName,
        contentType: downloadResult.contentType,
        size: downloadResult.size,
        tempDir: tempDir
      });
    } catch (downloadError) {
      console.error('LỖI TẢI XUỐNG:', downloadError);
      console.error('Stack trace:', downloadError.stack);
      return NextResponse.json(
        { error: `Không thể tải file từ Google Drive: ${downloadError.message}` },
        { status: 500 }
      );
    }
    
    // Check if file is PDF
    if (downloadResult.contentType !== 'application/pdf' && !downloadResult.fileName.toLowerCase().endsWith('.pdf')) {
      console.error('LỖI: File không phải là PDF', {
        contentType: downloadResult.contentType,
        fileName: downloadResult.fileName
      });
      // Clean up temp files
      cleanupTempFiles(tempDir);
      
      return NextResponse.json(
        { error: 'File không phải là PDF. API này chỉ hỗ trợ xử lý file PDF.' },
        { status: 400 }
      );
    }
    
    // Process the PDF to remove watermark
    console.log('Bước 2: Xử lý xóa watermark...');
    let cleanResult;
    try {
      const outputPath = path.join(tempDir, `${path.basename(downloadResult.fileName, '.pdf')}_clean.pdf`);
      console.log('Đường dẫn file đầu ra:', outputPath);
      
      // Log thông tin file đầu vào
      const inputStats = fs.statSync(downloadResult.filePath);
      console.log('Thông tin file đầu vào:', {
        path: downloadResult.filePath,
        size: inputStats.size,
        sizeInMB: (inputStats.size / (1024 * 1024)).toFixed(2) + ' MB'
      });
      
      // Tạo config với tham số từ request
      const config = { ...DEFAULT_CONFIG };
      
      // Thêm hình nền nếu có
      if (backgroundImage) {
        console.log('==== DEBUG BACKGROUND ====');
        console.log('- Phát hiện tham số backgroundImage:', backgroundImage);
        console.log('- Độ trong suốt backgroundOpacity:', backgroundOpacity);
        
        // Xử lý đường dẫn hình nền để làm cho nó di động
        let backgroundImagePath = backgroundImage;
        
        // Nếu không phải đường dẫn tuyệt đối, coi như nó là đường dẫn tương đối từ thư mục gốc
        if (!path.isAbsolute(backgroundImage) && 
            !backgroundImage.includes(':/') && 
            !backgroundImage.includes(':\\')) {
          backgroundImagePath = path.join(process.cwd(), backgroundImage);
          console.log('- Đã chuyển đổi sang đường dẫn tương đối:', backgroundImagePath);
        }
        
        // Kiểm tra file có tồn tại không
        const fileExists = fs.existsSync(backgroundImagePath);
        console.log('- File hình nền tồn tại:', fileExists);
        console.log('- Đường dẫn đầy đủ:', backgroundImagePath);
        
        if (fileExists) {
          console.log('- Sử dụng hình nền:', backgroundImagePath);
          // Kiểm tra kích thước file
          const stats = fs.statSync(backgroundImagePath);
          console.log('- Kích thước file hình nền:', (stats.size / 1024).toFixed(2) + ' KB');
          
          config.backgroundImage = backgroundImagePath;
          
          if (backgroundOpacity !== undefined) {
            config.backgroundOpacity = parseFloat(backgroundOpacity);
            console.log('- Độ trong suốt đã cấu hình:', config.backgroundOpacity);
          } else {
            console.log('- Sử dụng độ trong suốt mặc định:', config.backgroundOpacity);
          }
        } else {
          console.warn(`CẢNH BÁO: Không tìm thấy file hình nền tại đường dẫn: ${backgroundImagePath}`);
          console.log('- Danh sách file trong thư mục hiện tại:');
          try {
            const files = fs.readdirSync(path.dirname(backgroundImagePath));
            console.log(files);
          } catch (err) {
            console.log('- Không thể đọc thư mục:', err.message);
          }
        }
        console.log('==== KẾT THÚC DEBUG BACKGROUND ====');
      } else {
        console.log('Không có tham số backgroundImage trong request');
      }
      
      cleanResult = await cleanPdf(downloadResult.filePath, outputPath, config);
      processedFilePath = outputPath;
      
      console.log('Kết quả xử lý PDF:', cleanResult);
    } catch (cleanError) {
      console.error('LỖI XỬ LÝ PDF:', cleanError);
      console.error('Stack trace:', cleanError.stack);
      
      // Check if error is related to GhostScript
      if (cleanError.message.includes('GhostScript')) {
        console.error('LỖI LIÊN QUAN ĐẾN GHOSTSCRIPT - Kiểm tra cài đặt GhostScript trên máy chủ');
      }
      
      // Clean up temp files
      if (tempDir && fs.existsSync(tempDir)) {
        cleanupTempFiles(tempDir);
      }
      
      return NextResponse.json(
        { error: `Không thể xử lý PDF: ${cleanError.message}` },
        { status: 500 }
      );
    }
    
    // Upload processed file back to Drive
    console.log('Bước 3: Tải lên file đã xử lý lên Google Drive...');
    let uploadResult;
    try {
      // Log thông tin file đã xử lý
      const processedStats = fs.statSync(processedFilePath);
      console.log('Thông tin file đã xử lý:', {
        path: processedFilePath,
        size: processedStats.size,
        sizeInMB: (processedStats.size / (1024 * 1024)).toFixed(2) + ' MB'
      });
      
      uploadResult = await uploadToDrive(processedFilePath, downloadResult.fileName, 'application/pdf');
      console.log('Kết quả tải lên Google Drive:', uploadResult);
    } catch (uploadError) {
      console.error('LỖI TẢI LÊN DRIVE:', uploadError);
      console.error('Stack trace:', uploadError.stack);
      
      // Clean up temp files
      if (tempDir && fs.existsSync(tempDir)) {
        cleanupTempFiles(tempDir);
      }
      
      return NextResponse.json(
        { error: `Không thể tải file lên Google Drive: ${uploadError.message}` },
        { status: 500 }
      );
    }
    
    // Clean up temp files
    try {
      console.log('Dọn dẹp file tạm tại:', tempDir);
      cleanupTempFiles(tempDir);
      tempDir = null;
    } catch (cleanupError) {
      console.warn('Cảnh báo: Không thể dọn dẹp file tạm:', cleanupError.message);
    }
    
    console.log('Xử lý thành công, trả về kết quả');
    console.log('============== KẾT THÚC API XÓA WATERMARK ==============');
    
    // Return success response with link to processed file
    return NextResponse.json({
      success: true,
      message: 'Đã xử lý xóa watermark thành công.',
      originalFilename: downloadResult.fileName,
      processedFilename: uploadResult.fileName,
      viewLink: uploadResult.webViewLink,
      downloadLink: uploadResult.downloadLink,
      processingDetails: {
        originalSize: cleanResult.originalSize,
        processedSize: cleanResult.processedSize,
        processingTime: cleanResult.processingTime + ' giây'
      }
    }, { status: 200 });
    
  } catch (error) {
    console.error('LỖI KHÔNG XỬ LÝ ĐƯỢC:', error);
    console.error('Chi tiết lỗi:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    
    // Clean up temp files
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        cleanupTempFiles(tempDir);
      } catch (cleanupError) {
        console.error('Không thể dọn dẹp file tạm:', cleanupError.message);
      }
    }
    
    console.log('============== KẾT THÚC API XÓA WATERMARK (LỖI) ==============');
    
    return NextResponse.json(
      { 
        success: false,
        error: `Không thể xóa watermark: ${error.message}` 
      },
      { status: 500 }
    );
  }
}

// Test endpoint
export async function GET() {
  console.log('Kiểm tra API tích hợp...');
  try {
    // Kiểm tra Google Drive token
    console.log('Kiểm tra Google Drive token...');
    const uploadToken = getTokenByType('upload');
    const downloadToken = getTokenByType('download');
    
    const tokenStatus = {
      upload: uploadToken ? true : false,
      download: downloadToken ? true : false
    };
    
    if (uploadToken && downloadToken) {
      console.log('Token tải lên và tải xuống Google Drive khả dụng');
    } else if (!uploadToken && !downloadToken) {
      console.log('Không tìm thấy token Google Drive');
    } else {
      console.log('Thiếu token:', !uploadToken ? 'tải lên' : 'tải xuống');
    }
    
    // Kiểm tra Ghostscript
    const gsPath = findGhostscript();
    const gsStatus = gsPath ? true : false;
    
    return NextResponse.json({
      success: true,
      status: {
        drive: tokenStatus,
        ghostscript: gsStatus,
        gsPath: gsPath || null,
        sharp: sharp ? true : false
      }
    });
  } catch (error) {
    console.error('Lỗi khi kiểm tra API:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Lỗi không xác định khi kiểm tra API'
    }, { status: 500 });
  }
} 