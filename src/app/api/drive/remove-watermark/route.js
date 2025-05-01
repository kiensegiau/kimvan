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
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { promisify } from 'util';

// Suppress Node.js deprecation warnings for punycode module
process.noDeprecation = true;
// If you still need specific warnings, you can handle them selectively
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && warning.message.includes('punycode')) {
    // Ignore punycode deprecation warnings
    return;
  }
  // Log other warnings if needed
  // console.warn(warning.name, warning.message);
});

const execPromise = promisify(exec);

// Sửa import sharp để sử dụng phiên bản tương thích với Node.js
let sharp;
try {
  sharp = require('sharp');
  
  if (process.env.NODE_ENV === 'production') {
    // Các cấu hình cho môi trường production nếu cần
  }
} catch (error) {
  sharp = null;
}

// Đặt đường dẫn cho worker - cập nhật để sử dụng với Next.js
if (typeof window === 'undefined' && sharp) {
  try {
    sharp.disableWorker = true;
    
    if (sharp.GlobalWorkerOptions) {
      sharp.GlobalWorkerOptions.disableWorker = true;
    }
  } catch (error) {
    // Handle error
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

// Cập nhật config để giảm số lượng worker, tránh tràn bộ nhớ
const DEFAULT_CONFIG = {
  dpi: 350,                // Giảm độ phân giải xuống
  brightness: 20,          // Độ sáng
  contrast: 35,            // Độ tương phản
  threshold: 0,            // Ngưỡng (0 = giữ màu sắc)
  gamma: 1.4,              // Gamma
  sharpening: 1.3,         // Độ sắc nét
  processCenter: false,    // Xử lý vùng trung tâm
  centerSize: 0.8,         // Kích thước vùng trung tâm (80% của trang)
  keepColors: true,        // Giữ màu sắc
  cleanupTempFiles: false, // Có xóa file tạm không
  maxWorkers: Math.max(1, Math.min(2, os.cpus().length - 1)), // Giảm worker xuống tối đa 2 luồng
  backgroundImage: null,   // Đường dẫn đến hình nền tùy chỉnh
  backgroundOpacity: 0.3,  // Giảm xuống 0.3 (30% đục),
  batchSize: 3,            // Số lượng trang xử lý cùng lúc
};

// Đọc token từ file
function getStoredToken() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const tokenContent = fs.readFileSync(TOKEN_PATH, 'utf8');
      
      if (tokenContent.length === 0) {
        return null;
      }
      
      try {
        const parsedToken = JSON.parse(tokenContent);
        return parsedToken;
      } catch (parseError) {
        return null;
      }
    }
  } catch (error) {
    // Handle error
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
      
      if (tokenContent.length === 0) {
        return null;
      }
      
      try {
        const parsedToken = JSON.parse(tokenContent);
        return parsedToken;
      } catch (parseError) {
        // Fallback to old token file
        return getStoredToken();
      }
    } else {
      // Fallback to old token file
      return getStoredToken();
    }
  } catch (error) {
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
  }
  
  if (!fileId) {
    throw new Error('Không thể trích xuất file ID từ URL Google Drive');
  }
  
  return { fileId, resourceKey };
}

// Thêm hàm tìm file bằng tên hoặc ID
async function findFileByNameOrId(drive, nameOrId) {
  try {
    // Thử truy cập trực tiếp bằng ID trước
    try {
      const fileInfo = await drive.files.get({
        fileId: nameOrId,
        fields: 'id,name,mimeType,size,capabilities',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      });
      
      return fileInfo.data;
    } catch (directError) {
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
        // Trả về file đầu tiên tìm được
        return files[0];
      } else {
        throw new Error(`Không tìm thấy file nào khớp với: ${nameOrId}`);
      }
    }
  } catch (error) {
    throw error;
  }
}

// Cập nhật hàm downloadFromGoogleDrive
async function downloadFromGoogleDrive(fileIdOrLink) {
  let fileId, resourceKey;
  
  try {
    // Create temp directory
    const tempDirName = uuidv4();
    const outputDir = path.join(os.tmpdir(), tempDirName);
    fs.mkdirSync(outputDir, { recursive: true });
    
    // Extract file ID from link if needed
    if (typeof fileIdOrLink === 'string' && fileIdOrLink.includes('drive.google.com')) {
      try {
        const result = extractGoogleDriveFileId(fileIdOrLink);
        fileId = result.fileId;
        resourceKey = result.resourceKey;
      } catch (error) {
        throw new Error(`Không thể trích xuất ID từ link Google Drive: ${error.message}`);
      }
    } else {
      fileId = fileIdOrLink;
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
        if (tokens.refresh_token) {
          const newToken = {...downloadToken, ...tokens};
          fs.writeFileSync(TOKEN_PATHS[1], JSON.stringify(newToken));
        }
      });
      
      // Initialize Google Drive API
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      
      // Get file metadata
      const fileMetadata = await drive.files.get({
        fileId: fileId,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: 'name,mimeType,size'
      });
      
      // Check if file is a PDF (for watermark removal)
      const mimeType = fileMetadata.data.mimeType;
      if (mimeType !== 'application/pdf') {
        throw new Error(`File không phải là PDF. Loại file: ${mimeType}`);
      }
      
      // Download file content
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
    throw error;
  }
}

// Upload processed file back to Google Drive
async function uploadToDrive(filePath, fileName, mimeType) {
  try {
    // Kiểm tra file tồn tại
    if (!fs.existsSync(filePath)) {
      throw new Error(`File không tồn tại: ${filePath}`);
    }
    
    const fileSize = fs.statSync(filePath).size;
    if (fileSize === 0) {
      throw new Error(`File rỗng (0 byte): ${filePath}`);
    }
    
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
    
    // Đặt quyền truy cập cho file (nếu cần)
    try {
      // Chia sẻ cho bất kỳ ai có link (không yêu cầu đăng nhập)
      await drive.permissions.create({
        fileId: driveResponse.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });
    } catch (permissionError) {
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
        resolve(result);
      } else {
        reject(new Error(result.error));
      }
    });
    
    worker.on('error', (err) => {
      reject(err);
    });
    
    worker.on('exit', (code) => {
      if (code !== 0) {
        // Handle non-zero exit code
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
        resolve({ ...result, index: page - 1 });
      } else {
        reject(new Error(result.error));
      }
    });
    
    worker.on('error', (err) => {
      reject(err);
    });
    
    worker.on('exit', (code) => {
      if (code !== 0) {
        // Handle non-zero exit code
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
    return pageCountCache.get(cacheKey);
  }

  try {
    // Chuẩn hóa đường dẫn và escape đúng cho cú pháp PostScript
    const normalizedPath = pdfPath.replace(/\\/g, '/');
    const escapedPath = normalizedPath.replace(/[\(\)]/g, '\\$&');
    
    // Đơn giản hóa lệnh để tăng hiệu suất
    const command = `"${gsPath}" -q -dNODISPLAY -c "(${escapedPath}) (r) file runpdfbegin pdfpagecount = quit"`;
    
    const output = execSync(command, { encoding: 'utf8' }).trim();
    const numPages = parseInt(output);
    
    if (!isNaN(numPages)) {
      // Lưu vào cache
      pageCountCache.set(cacheKey, numPages);
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

// Tối ưu xử lý song song để cải thiện hiệu suất và tránh tràn bộ nhớ
async function processBatches(items, processFunc, maxConcurrent) {
  const results = [];
  
  // Giảm kích thước batch để tránh sử dụng quá nhiều bộ nhớ cùng lúc
  const safeBatchSize = Math.min(maxConcurrent, 3); // Tối đa 3 item cùng lúc
  
  for (let i = 0; i < items.length; i += safeBatchSize) {
    // Xử lý theo batch nhỏ
    const currentBatch = items.slice(i, i + safeBatchSize);
    
    // Bắt đầu xử lý batch hiện tại
    const batch = currentBatch.map(processFunc);
    const batchResults = await Promise.allSettled(batch);
    
    // Thêm kết quả vào mảng kết quả
    results.push(...batchResults);
    
    // Đợi GC chạy sau mỗi batch
    global.gc && global.gc();
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
}

// Tối ưu hàm vẽ hình ảnh vào PDF
async function addImageToPdf(pdfDoc, pngPath, index, totalPages, config = DEFAULT_CONFIG) {
  if (!fs.existsSync(pngPath)) {
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
      // Đọc hình nền
      const backgroundData = fs.readFileSync(config.backgroundImage);
      
      // Xác định loại file và nhúng phù hợp
      let backgroundImage;
      if (config.backgroundImage.toLowerCase().endsWith('.png')) {
        backgroundImage = await pdfDoc.embedPng(backgroundData);
      } else if (config.backgroundImage.toLowerCase().endsWith('.jpg') || 
                config.backgroundImage.toLowerCase().endsWith('.jpeg')) {
        backgroundImage = await pdfDoc.embedJpg(backgroundData);
      } else {
        return true; // Vẫn tiếp tục mà không có hình nền
      }
      
      if (backgroundImage) {
        const bgDimensions = backgroundImage.size();
        
        // CHỈ THÊM MỘT HÌNH NỀN LỚN Ở GIỮA TRANG
        // Tính toán để hình nền chiếm khoảng 70% diện tích trang
        const targetWidth = pngDimensions.width * 0.7;
        const targetHeight = pngDimensions.height * 0.7;
        
        // Tính tỷ lệ phù hợp để giữ nguyên tỷ lệ hình ảnh
        const scaleWidth = targetWidth / bgDimensions.width;
        const scaleHeight = targetHeight / bgDimensions.height;
        const scale = Math.min(scaleWidth, scaleHeight);
        
        // Tính kích thước và vị trí hình nền
        const bgWidth = bgDimensions.width * scale;
        const bgHeight = bgDimensions.height * scale;
        const xOffset = (pngDimensions.width - bgWidth) / 2; // Giữa trang theo chiều ngang
        const yOffset = (pngDimensions.height - bgHeight) / 2; // Giữa trang theo chiều dọc
        
        // Vẽ một hình nền duy nhất ở giữa
        page.drawImage(backgroundImage, {
          x: xOffset,
          y: yOffset,
          width: bgWidth,
          height: bgHeight,
          opacity: config.backgroundOpacity || 0.3,
        });
      }
    } catch (backgroundError) {
      // Just continue without background on error
    }
  }
  
  return true;
}

// Tối ưu hàm chính để xóa watermark
async function cleanPdf(inputPath, outputPath, config = DEFAULT_CONFIG) {
  if (!isMainThread) return; // Đảm bảo chỉ chạy trong main thread
  
  const startTime = Date.now();
  console.log('🔄 Bắt đầu xử lý xóa watermark...');
  
  // Kiểm tra xem sharp có khả dụng không
  if (!sharp) {
    throw new Error('Thư viện xử lý hình ảnh (Sharp) không khả dụng trên máy chủ này. Vui lòng liên hệ quản trị viên.');
  }
  
  // Tìm GhostScript một lần và cache kết quả
  let gsPath;
  try {
    gsPath = findGhostscript();
  } catch (gsError) {
    throw gsError;
  }

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
  
  // Tạo thư mục temp hiệu quả hơn
  const tempDir = path.join(os.tmpdir(), `pdf-watermark-removal-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  
  try {
    // Đếm số trang với cache
    console.log('🔍 Đang phân tích số trang của PDF...');
    const numPages = await countPdfPagesWithGhostscript(inputPath, gsPath);
    console.log(`📄 Phát hiện ${numPages} trang, đang tách PDF...`);
    
    // Tối ưu biến cho số lượng công nhân
    const optimalWorkers = Math.min(
      config.maxWorkers,
      Math.max(1, Math.min(os.cpus().length - 1, numPages))
    );
    
    // Tách PDF thành từng trang - sử dụng tùy chọn tối ưu cho GhostScript
    const gsCommand = `"${gsPath}" -dALLOWPSTRANSPARENCY -dBATCH -dNOPAUSE -q -dNumRenderingThreads=${optimalWorkers} -sDEVICE=pdfwrite -dSAFER ` +
            `-dFirstPage=1 -dLastPage=${numPages} ` +
            `-sOutputFile="${path.join(tempDir, 'page_%d.pdf')}" "${inputPath}"`;
    
    execSync(gsCommand, { stdio: 'pipe' });
    
    // Kiểm tra kết quả nhanh hơn bằng cách dựa vào readdir và lọc
    const pdfFiles = fs.readdirSync(tempDir, { 
      withFileTypes: true 
    })
    .filter(entry => entry.isFile() && entry.name.endsWith('.pdf'))
    .map(entry => entry.name);
    
    if (pdfFiles.length === 0) {
      throw new Error('Không thể tách PDF thành các trang. GhostScript không tạo ra file nào.');
    }
    
    // Chuẩn bị danh sách công việc hiệu quả hơn
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

    if (conversionTasks.length === 0) {
      throw new Error('Không có trang PDF nào để chuyển đổi!');
    }

    // Chuyển đổi PDF sang PNG theo batch nhỏ, không phải song song toàn bộ
    console.log('🔄 Bước 1/3: Chuyển đổi PDF sang hình ảnh...');
    const batchSize = config.batchSize || 3; // Xử lý tối đa 3 trang cùng lúc để tránh tràn bộ nhớ
    
    // Chia trang thành các batch nhỏ hơn để xử lý
    const convertResults = [];
    for (let i = 0; i < conversionTasks.length; i += batchSize) {
      const currentBatch = conversionTasks.slice(i, i + batchSize);
      const progress = Math.round((i / conversionTasks.length) * 100);
      console.log(`🔄 Chuyển đổi PDF sang hình ảnh: ${progress}% (${i}/${conversionTasks.length} trang)`);
      
      // Xử lý batch hiện tại
      const batchPromises = currentBatch.map(task => 
        createConvertWorker(gsPath, task.pdfPath, task.pngPath, task.page, numPages, config.dpi)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      convertResults.push(...batchResults);
      
      // Thúc đẩy GC sau mỗi batch
      global.gc && global.gc();
      
      // Tạm dừng để cho GC có cơ hội chạy và giải phóng bộ nhớ
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    console.log(`🔄 Chuyển đổi PDF sang hình ảnh: 100% (${conversionTasks.length}/${conversionTasks.length} trang)`);
    
    // Lọc và giải phóng bộ nhớ sớm hơn
    const successfulConversions = convertResults
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);
    
    if (successfulConversions.length === 0) {
      throw new Error('Không có trang nào được chuyển đổi thành công!');
    }
    
    // Xử lý các PNG theo từng batch nhỏ
    console.log('🔄 Bước 2/3: Xử lý xóa watermark trên hình ảnh...');
    const processResults = [];
    
    for (let i = 0; i < successfulConversions.length; i += batchSize) {
      const currentBatch = successfulConversions.slice(i, i + batchSize);
      const progress = Math.round((i / successfulConversions.length) * 100);
      console.log(`🔄 Xử lý xóa watermark: ${progress}% (${i}/${successfulConversions.length} trang)`);
      
      // Xử lý batch hiện tại
      const batchPromises = currentBatch.map(conversion => 
        createProcessWorker(conversion.pngPath, conversion.page, numPages, config)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      processResults.push(...batchResults);
      
      // Thúc đẩy GC sau mỗi batch
      global.gc && global.gc();
      
      // Tạm dừng để cho GC có cơ hội chạy và giải phóng bộ nhớ
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    console.log(`🔄 Xử lý xóa watermark: 100% (${successfulConversions.length}/${successfulConversions.length} trang)`);
    
    // Lọc và sắp xếp hiệu quả hơn
    const successfulProcessing = processResults
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value)
      .sort((a, b) => a.index - b.index);
    
    // Lấy danh sách đường dẫn PNG đã xử lý
    const processedPngPaths = successfulProcessing.map(result => result.processedPngPath);
    
    if (processedPngPaths.length === 0) {
      throw new Error('Không có trang nào được xử lý thành công!');
    }
    
    // Ghép các trang PNG thành PDF hiệu quả hơn
    console.log('🔄 Bước 3/3: Ghép các trang thành PDF kết quả...');
    
    // Tạo PDF hiệu quả hơn
    const pdfDoc = await PDFDocument.create();
    
    // Xử lý từng trang một để tránh tràn bộ nhớ - thay vì song song
    for (let i = 0; i < processedPngPaths.length; i++) {
      const progress = Math.round((i / processedPngPaths.length) * 100);
      if (i % 5 === 0 || i === processedPngPaths.length - 1) { // Log every 5 pages to reduce output
        console.log(`🔄 Tạo PDF: ${progress}% (${i}/${processedPngPaths.length} trang)`);
      }
      
      await addImageToPdf(pdfDoc, processedPngPaths[i], i, processedPngPaths.length, config);
      
      // Xóa file PNG đã xử lý để giải phóng bộ nhớ
      try {
        fs.unlinkSync(processedPngPaths[i]);
        fs.unlinkSync(processedPngPaths[i].replace('_processed.png', '.png'));
      } catch (error) {
        // Ignore error
      }
      
      // Thúc đẩy GC sau mỗi trang
      global.gc && global.gc();
    }
    
    // Lưu PDF với tùy chọn nén tối ưu
    console.log('💾 Lưu file PDF kết quả...');
    const pdfBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false
    });
    
    fs.writeFileSync(outputPath, pdfBytes);
    
    // Dọn dẹp file tạm ngay khi có thể để tiết kiệm bộ nhớ
    if (config.cleanupTempFiles) {
      cleanupTempFiles(tempDir);
    }
    
    // Sau khi hoàn thành
    const endTime = Date.now();
    const processingTime = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`✅ Hoàn thành xử lý trong ${processingTime} giây`);
    
    return { 
      success: true, 
      outputPath, 
      processingTime,
      originalSize: fileSizeInMB.toFixed(2) + ' MB',
      processedSize: fs.existsSync(outputPath) ? (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2) + ' MB' : 'Unknown'
    };
  } catch (error) {
    console.log(`❌ Lỗi: ${error.message}`);
    
    // Dọn dẹp file tạm
    try {
      cleanupTempFiles(tempDir);
    } catch (cleanupError) {
      // Ignore error
    }
    
    throw error;
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

  // Thử tìm trong các đường dẫn có thể
  for (const gsPath of possibleGsPaths) {
    try {
      if (fs.existsSync(gsPath)) {
        // Thử thực thi để kiểm tra
        try {
          const version = execSync(`"${gsPath}" -v`, { stdio: 'pipe', encoding: 'utf8' });
          return gsPath;
        } catch (error) {
          // Tiếp tục tìm đường dẫn khác
        }
      }
    } catch (error) {
      // Bỏ qua lỗi khi kiểm tra tồn tại
    }
  }

  // Thử thực thi các lệnh GhostScript trực tiếp (sử dụng PATH)
  try {
    const version = execSync('gswin64c -v', { stdio: 'pipe', encoding: 'utf8' });
    return 'gswin64c';
  } catch (gswin64cError) {
    try {
      const version = execSync('gswin32c -v', { stdio: 'pipe', encoding: 'utf8' });
      return 'gswin32c';
    } catch (gswin32cError) {
      try {
        const version = execSync('gs -v', { stdio: 'pipe', encoding: 'utf8' });
        return 'gs';
      } catch (gsError) {
        // No GS in PATH
      }
    }
  }

  // Thử truy cập trực tiếp đường dẫn đã biết hoạt động
  try {
    // Sử dụng đường dẫn bạn đã biết chắc chắn hoạt động
    const knownPath = 'C:\\Program Files\\gs\\gs10.05.0\\bin\\gswin64c.exe';
    if (fs.existsSync(knownPath)) {
      return knownPath;
    }
  } catch (error) {
    // Handle error
  }
  
  throw new Error('GhostScript không được cài đặt hoặc không thể tìm thấy. Vui lòng cài đặt GhostScript trước khi sử dụng API này.');
}

// Next.js API route handler
export async function POST(request) {
  let tempDir = null;
  let processedFilePath = null;
  
  try {
    // Parse request body
    const requestBody = await request.json();
    let { token, driveLink, backgroundImage, backgroundOpacity } = requestBody;

    // Sử dụng "nen.png" làm hình nền mặc định
    if (!backgroundImage) {
      backgroundImage = path.join(process.cwd(), "nen.png");
    }
    if (backgroundOpacity === undefined) {
      backgroundOpacity = 0.3; // Giảm xuống 0.3
    }

    // Validate API token
    if (!token || token !== API_TOKEN) {
      return NextResponse.json(
        { error: 'Không được phép. Token API không hợp lệ.' },
        { status: 401 }
      );
    }

    // Validate drive link
    if (!driveLink) {
      return NextResponse.json(
        { error: 'Thiếu liên kết Google Drive.' },
        { status: 400 }
      );
    }
    
    // Download file from Drive
    let downloadResult;
    try {
      downloadResult = await downloadFromGoogleDrive(driveLink);
      tempDir = downloadResult.outputDir;
    } catch (downloadError) {
      return NextResponse.json(
        { error: `Không thể tải file từ Google Drive: ${downloadError.message}` },
        { status: 500 }
      );
    }
    
    // Check if file is PDF
    if (downloadResult.contentType !== 'application/pdf' && !downloadResult.fileName.toLowerCase().endsWith('.pdf')) {
      // Clean up temp files
      cleanupTempFiles(tempDir);
      
      return NextResponse.json(
        { error: 'File không phải là PDF. API này chỉ hỗ trợ xử lý file PDF.' },
        { status: 400 }
      );
    }
    
    // Process the PDF to remove watermark
    let cleanResult;
    try {
      const outputPath = path.join(tempDir, `${path.basename(downloadResult.fileName, '.pdf')}_clean.pdf`);
      
      // Tạo config với tham số từ request
      const config = { ...DEFAULT_CONFIG };
      
      // Thêm hình nền nếu có
      if (backgroundImage) {
        // Xử lý đường dẫn hình nền để làm cho nó di động
        let backgroundImagePath = backgroundImage;
        
        // Nếu không phải đường dẫn tuyệt đối, coi như nó là đường dẫn tương đối từ thư mục gốc
        if (!path.isAbsolute(backgroundImage) && 
            !backgroundImage.includes(':/') && 
            !backgroundImage.includes(':\\')) {
          backgroundImagePath = path.join(process.cwd(), backgroundImage);
        }
        
        // Kiểm tra file có tồn tại không
        const fileExists = fs.existsSync(backgroundImagePath);
        
        if (fileExists) {
          config.backgroundImage = backgroundImagePath;
          
          if (backgroundOpacity !== undefined) {
            config.backgroundOpacity = parseFloat(backgroundOpacity);
          }
        }
      }
      
      cleanResult = await cleanPdf(downloadResult.filePath, outputPath, config);
      processedFilePath = outputPath;
    } catch (cleanError) {
      // Check if error is related to GhostScript
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
    let uploadResult;
    try {
      uploadResult = await uploadToDrive(processedFilePath, downloadResult.fileName, 'application/pdf');
    } catch (uploadError) {
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
      cleanupTempFiles(tempDir);
      tempDir = null;
    } catch (cleanupError) {
      // Handle cleanup error
    }
    
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
    // Clean up temp files
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        cleanupTempFiles(tempDir);
      } catch (cleanupError) {
        // Handle cleanup error
      }
    }
    
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
  try {
    // Kiểm tra Google Drive token
    const uploadToken = getTokenByType('upload');
    const downloadToken = getTokenByType('download');
    
    const tokenStatus = {
      upload: uploadToken ? true : false,
      download: downloadToken ? true : false
    };
    
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
    return NextResponse.json({
      success: false,
      error: error.message || 'Lỗi không xác định khi kiểm tra API'
    }, { status: 500 });
  }
}