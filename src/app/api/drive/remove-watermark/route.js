/**
 * API xóa hình mờ file PDF từ Google Drive
 * 
 * API này sẽ:
 * 1. Tải xuống file PDF từ Google Drive
 * 2. Xử lý để xóa watermark
 * 3. Tải lên file đã xử lý lên Google Drive
 * 4. Trả về link đến file đã xử lý
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
  maxWorkers: Math.max(1, os.cpus().length - 1) // Số lượng worker tối đa (số lượng CPU - 1)
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
  
  // Kiểm tra xem input là file ID hay link
  if (typeof fileIdOrLink === 'string' && (fileIdOrLink.includes('drive.google.com') || fileIdOrLink.includes('docs.google.com'))) {
    console.log(`Đang trích xuất file ID từ link: ${fileIdOrLink}`);
    const extracted = extractGoogleDriveFileId(fileIdOrLink);
    fileId = extracted.fileId;
    resourceKey = extracted.resourceKey;
  } else {
    fileId = fileIdOrLink;
  }
  
  console.log(`Đang tải xuống file từ Google Drive với ID: ${fileId}`);
  if (resourceKey) {
    console.log(`Sử dụng resource key: ${resourceKey}`);
  }
  
  // Create temp directory if it doesn't exist
  const tempDir = path.join(os.tmpdir(), 'drive-download-');
  const outputDir = fs.mkdtempSync(tempDir);
  
  try {
    // Get stored token
    const storedToken = getStoredToken();
    if (!storedToken) {
      throw new Error('Không tìm thấy token Google Drive. Vui lòng cấu hình API trong cài đặt.');
    }
    
    // Create OAuth2 client and Drive API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
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
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    console.log('Kiểm tra quyền truy cập Drive...');
    
    // Check if token has Drive access
    const aboutResponse = await drive.about.get({
      fields: 'user'
    });
    
    console.log(`Token Drive hợp lệ. Người dùng: ${aboutResponse.data.user?.displayName || 'Không xác định'}`);
    console.log(`Email người dùng: ${aboutResponse.data.user?.emailAddress || 'Không xác định'}`);
    
    // Tìm file bằng ID hoặc tên
    console.log(`Đang tìm kiếm file Google Drive: ${fileId}`);
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
    
    const fileName = foundFile.name || `google-drive-${fileId}`;
    const contentType = foundFile.mimeType || 'application/octet-stream';
    
    // Check if can download
    if (foundFile.capabilities && !foundFile.capabilities.canDownload) {
      console.warn('CẢNH BÁO: Bạn không có quyền tải xuống file này!');
      throw new Error('Bạn không có quyền tải xuống file này. Hãy yêu cầu chủ sở hữu chia sẻ file với quyền chỉnh sửa.');
    }
    
    // Download file
    console.log(`Đang tải xuống file Google Drive: ${fileId}`);
    let fileBuffer;
    
    // Nếu là Google Workspace file (Docs, Sheets, Slides...)
    if (contentType.includes('google-apps')) {
      console.log('File là Google Workspace, xuất ra PDF...');
      
      try {
        const exportResponse = await drive.files.export({
          fileId: fileId,
          mimeType: 'application/pdf',
          supportsAllDrives: true
        }, {
          responseType: 'arraybuffer'
        });
        
        fileBuffer = Buffer.from(exportResponse.data);
      } catch (exportError) {
        console.error('Lỗi khi xuất file Google Workspace:', exportError.message);
        throw new Error(`Không thể xuất file Google Workspace: ${exportError.message}`);
      }
    } else {
      // File thông thường
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
    
    console.log(`Đã tải xuống file Google Drive thành công (${fileBuffer.length} bytes)`);
    
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
    
    // Lấy token đã lưu
    const storedToken = getStoredToken();
    if (!storedToken) {
      throw new Error('Không tìm thấy token Google Drive. Vui lòng thiết lập lại.');
    }
    
    // Tạo OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    // Thiết lập credentials
    oauth2Client.setCredentials(storedToken);
    
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

  console.log('Đang kiểm tra Ghostscript trong các đường dẫn cố định...');
  
  // Thử tìm trong các đường dẫn có thể
  for (const gsPath of possibleGsPaths) {
    try {
      if (fs.existsSync(gsPath)) {
        console.log(`Đã tìm thấy Ghostscript tại: ${gsPath}`);
        // Thử thực thi để kiểm tra
        try {
          const version = execSync(`"${gsPath}" -v`, { stdio: 'pipe', encoding: 'utf8' });
          console.log(`Ghostscript đã được xác nhận tại ${gsPath} - Phiên bản:`, version.trim().split('\n')[0]);
          return gsPath;
        } catch (error) {
          console.warn(`Ghostscript tồn tại tại ${gsPath} nhưng không thể thực thi:`, error.message);
          // Tiếp tục tìm đường dẫn khác
        }
      }
    } catch (error) {
      // Bỏ qua lỗi khi kiểm tra tồn tại
      console.warn(`Lỗi khi kiểm tra đường dẫn ${gsPath}:`, error.message);
    }
  }

  console.log('Đang kiểm tra Ghostscript trong PATH hệ thống...');
  
  // Thử thực thi các lệnh Ghostscript trực tiếp (sử dụng PATH)
  // Chú ý: Thử gswin64c trước vì bạn đã xác nhận lệnh này hoạt động
  try {
    const version = execSync('gswin64c -v', { stdio: 'pipe', encoding: 'utf8' });
    console.log('Đã tìm thấy gswin64c trong PATH hệ thống');
    console.log('Phiên bản Ghostscript:', version.trim().split('\n')[0]);
    return 'gswin64c';
  } catch (gswin64cError) {
    console.warn('Không tìm thấy gswin64c trong PATH:', gswin64cError.message);
    
    try {
      const version = execSync('gswin32c -v', { stdio: 'pipe', encoding: 'utf8' });
      console.log('Đã tìm thấy gswin32c trong PATH hệ thống');
      console.log('Phiên bản Ghostscript:', version.trim().split('\n')[0]);
      return 'gswin32c';
    } catch (gswin32cError) {
      console.warn('Không tìm thấy gswin32c trong PATH:', gswin32cError.message);
      
      try {
        const version = execSync('gs -v', { stdio: 'pipe', encoding: 'utf8' });
        console.log('Đã tìm thấy gs trong PATH hệ thống');
        console.log('Phiên bản Ghostscript:', version.trim().split('\n')[0]);
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
      console.log(`Đã tìm thấy Ghostscript tại đường dẫn đã biết: ${knownPath}`);
      return knownPath;
    }
  } catch (error) {
    console.warn('Lỗi khi kiểm tra đường dẫn đã biết:', error.message);
  }

  // Hiển thị thông báo lỗi chi tiết
  console.error(`
========= LỖI KHÔNG TÌM THẤY GHOSTSCRIPT =========
Ghostscript không được cài đặt hoặc không thể tìm thấy.
API này yêu cầu Ghostscript để xử lý PDF.

Hướng dẫn cài đặt:
- Windows: Tải và cài đặt từ https://ghostscript.com/releases/gsdnld.html
- Ubuntu/Debian: sudo apt-get install ghostscript
- Mac: brew install ghostscript

Sau khi cài đặt, đảm bảo Ghostscript được thêm vào PATH hệ thống hoặc cập nhật đường dẫn trong mã nguồn.

HƯỚNG DẪN THÊM VÀO PATH:
1. Windows:
   a. Nhấp chuột phải vào "This PC" hoặc "My Computer" > Properties
   b. Chọn "Advanced system settings"
   c. Nhấp vào "Environment Variables"
   d. Trong phần "System Variables", tìm biến "Path" và nhấp "Edit"
   e. Nhấp "New" và thêm đường dẫn đến thư mục bin của Ghostscript
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
Nếu Ghostscript đã được cài đặt đúng, lệnh này sẽ hiển thị phiên bản.

HOẶC CẬP NHẬT MÃ NGUỒN:
Thay vì thêm vào PATH, bạn có thể cập nhật hàm findGhostscript() trong file này
và thêm đường dẫn đầy đủ đến Ghostscript vào biến possibleGsPaths.
==================================================
  `);
  
  throw new Error('Ghostscript không được cài đặt hoặc không thể tìm thấy. Vui lòng cài đặt Ghostscript trước khi sử dụng API này.');
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

  console.log(`Đang đếm số trang PDF với Ghostscript: ${pdfPath}`);
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
async function addImageToPdf(pdfDoc, pngPath, index, totalPages) {
  if (!fs.existsSync(pngPath)) {
    console.warn(`Bỏ qua trang ${index + 1} vì file không tồn tại: ${pngPath}`);
    return false;
  }
  
  // Đọc dữ liệu PNG - sử dụng đệm buffer lớn hơn để giảm I/O
  const pngData = fs.readFileSync(pngPath, { 
    highWaterMark: 1024 * 1024 // 1MB buffer
  });
  
  // Nhúng hình ảnh vào PDF
  const image = await pdfDoc.embedPng(pngData);
  const pngDimensions = image.size();
  
  // Tạo trang mới với kích thước của hình ảnh
  const page = pdfDoc.addPage([pngDimensions.width, pngDimensions.height]);
  
  // Vẽ hình ảnh lên trang
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: pngDimensions.width,
    height: pngDimensions.height
  });
  
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
  
  // Tìm Ghostscript một lần và cache kết quả
  let gsPath;
  try {
    gsPath = findGhostscript();
    console.log('Đã tìm thấy Ghostscript tại:', gsPath);
  } catch (gsError) {
    console.error('CRITICAL ERROR: Không thể tìm thấy Ghostscript:', gsError.message);
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
    
    // Tách PDF thành từng trang - sử dụng tùy chọn tối ưu cho Ghostscript
    console.log('Đang tách PDF thành từng trang...');
    const gsCommand = `"${gsPath}" -dALLOWPSTRANSPARENCY -dBATCH -dNOPAUSE -q -dNumRenderingThreads=${optimalWorkers} -sDEVICE=pdfwrite -dSAFER ` +
            `-dFirstPage=1 -dLastPage=${numPages} ` +
            `-sOutputFile="${path.join(tempDir, 'page_%d.pdf')}" "${inputPath}"`;
    
    console.log('Thực thi lệnh Ghostscript:', gsCommand);
    execSync(gsCommand, { stdio: 'pipe' });
    
    // Kiểm tra kết quả nhanh hơn bằng cách dựa vào readdir và lọc
    const pdfFiles = fs.readdirSync(tempDir, { 
      withFileTypes: true 
    })
    .filter(entry => entry.isFile() && entry.name.endsWith('.pdf'))
    .map(entry => entry.name);
    
    console.log(`Đã tách thành ${pdfFiles.length} trang PDF`);
    
    if (pdfFiles.length === 0) {
      throw new Error('Không thể tách PDF thành các trang. Ghostscript không tạo ra file nào.');
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
          addImageToPdf(pdfDoc, pngPath, i + idx, processedPngPaths.length)
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
    const { token, driveLink } = requestBody;
    
    console.log('Thông tin request:', {
      token: token ? '***' : 'không có',
      driveLink: driveLink || 'không có'
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
      
      cleanResult = await cleanPdf(downloadResult.filePath, outputPath);
      processedFilePath = outputPath;
      
      console.log('Kết quả xử lý PDF:', cleanResult);
    } catch (cleanError) {
      console.error('LỖI XỬ LÝ PDF:', cleanError);
      console.error('Stack trace:', cleanError.stack);
      
      // Check if error is related to Ghostscript
      if (cleanError.message.includes('Ghostscript')) {
        console.error('LỖI LIÊN QUAN ĐẾN GHOSTSCRIPT - Kiểm tra cài đặt Ghostscript trên máy chủ');
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
  console.log('GET request đến API xóa watermark');
  
  // Kiểm tra môi trường
  try {
    console.log('Kiểm tra môi trường...');
    console.log('Node.js version:', process.version);
    console.log('OS:', process.platform, process.arch);
    console.log('Current directory:', process.cwd());
    
    // Kiểm tra Ghostscript
    console.log('Kiểm tra Ghostscript...');
    try {
      const gsPath = findGhostscript();
      console.log('Ghostscript tìm thấy tại:', gsPath);
    } catch (gsError) {
      console.warn('Cảnh báo: Không tìm thấy Ghostscript:', gsError.message);
    }
    
    // Kiểm tra Google Drive token
    console.log('Kiểm tra Google Drive token...');
    const storedToken = getStoredToken();
    if (storedToken) {
      console.log('Token Google Drive khả dụng');
    } else {
      console.warn('Cảnh báo: Không tìm thấy token Google Drive');
    }
  } catch (checkError) {
    console.error('Lỗi khi kiểm tra môi trường:', checkError);
  }
  
  return NextResponse.json(
    { 
      message: 'API xóa watermark cho file Google Drive đang hoạt động.',
      usage: 'Gửi yêu cầu POST với tham số token và driveLink',
      environment: {
        nodejs: process.version,
        platform: process.platform,
        arch: process.arch
      }
    },
    { status: 200 }
  );
} 