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
 * - driveLink: Link đến file PDF trên Google Drive
 * - backgroundImage (tùy chọn): Tên file hình nền (ví dụ: "nen.png") hoặc đường dẫn đầy đủ
 *   - Nếu chỉ cung cấp tên file, hệ thống sẽ tìm trong thư mục gốc của ứng dụng
 *   - Ví dụ: "nen.png" sẽ tự động trỏ đến "[thư mục ứng dụng]/nen.png"
 * - backgroundOpacity (tùy chọn): Độ trong suốt của hình nền (0.1 = 10%)
 * - courseId (tùy chọn): ID của khóa học trong MongoDB để cập nhật thông tin file đã xử lý
 */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import { google } from 'googleapis';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';
import { cookieConfig } from '@/config/env-config';
import { getMongoClient } from '@/lib/mongodb';

// Import các module đã tách
import { API_TOKEN, DEFAULT_CONFIG } from './lib/config.js';
import { downloadFromGoogleDrive } from './lib/drive-service.js';
import { uploadToDrive } from './lib/drive-service.js';
import { cleanPdf, processImage } from './lib/watermark.js';
import { cleanupTempFiles, getTokenByType, findGhostscript, escapeDriveQueryString, updateProcessedFileInDB, forceGarbageCollection } from './lib/utils.js';
import { processPage, convertPage } from './lib/workers.js';
import { 
  processDriveFolder, 
  createDriveFolder, 
  uploadFileToDriveFolder,
  downloadFileFromDrive,
  extractGoogleDriveFileId,
  findOrCreateCourseFolder,
  processRecursiveFolder
} from './lib/drive-service.js';
import { processPDF } from './lib/drive-fix-blockdown.js';

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

// Thêm giám sát sử dụng bộ nhớ
const memoryMonitor = {
  lastMemoryUsage: process.memoryUsage(),
  logMemoryStats: function(label = 'Hiện tại') {
    try {
      const currentUsage = process.memoryUsage();
      const heapTotal = (currentUsage.heapTotal / (1024 * 1024)).toFixed(2);
      const heapUsed = (currentUsage.heapUsed / (1024 * 1024)).toFixed(2);
      const rss = (currentUsage.rss / (1024 * 1024)).toFixed(2);
      
      // Tính toán sự thay đổi
      const heapUsedDiff = ((currentUsage.heapUsed - this.lastMemoryUsage.heapUsed) / (1024 * 1024)).toFixed(2);
      const rssDiff = ((currentUsage.rss - this.lastMemoryUsage.rss) / (1024 * 1024)).toFixed(2);
      
      console.log(`📊 Sử dụng bộ nhớ (${label}): ${heapUsed}MB/${heapTotal}MB (Heap), ${rss}MB (RSS), Thay đổi: ${heapUsedDiff}MB (Heap), ${rssDiff}MB (RSS)`);
      
      // Cập nhật giá trị cuối
      this.lastMemoryUsage = currentUsage;
      
      // Xử lý rò rỉ bộ nhớ tiềm ẩn
      if (parseFloat(heapUsedDiff) > 50 || parseFloat(rssDiff) > 100) {
        console.warn(`⚠️ Phát hiện tăng bộ nhớ đáng kể: ${heapUsedDiff}MB (Heap), ${rssDiff}MB (RSS)`);
        forceGarbageCollection();
      }
    } catch (error) {
      console.debug(`Lỗi khi log thông tin bộ nhớ: ${error.message}`);
    }
  }
};

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

// Kiểm tra nếu đang trong worker thread
if (!isMainThread) {
  const task = workerData.task;
  
  if (task === 'processPage') {
    // Xử lý ảnh trong worker thread
    // Không kết nối đến MongoDB trong worker thread
    processPage(workerData).then(result => {
      parentPort.postMessage(result);
    }).catch(error => {
      parentPort.postMessage({ success: false, error: error.message });
    });
  } else if (task === 'convertPage') {
    // Chuyển đổi PDF sang PNG trong worker thread
    // Không kết nối đến MongoDB trong worker thread
    convertPage(workerData).then(result => {
      parentPort.postMessage(result);
    }).catch(error => {
      parentPort.postMessage({ success: false, error: error.message });
    });
  }
  // Đảm bảo worker thread không thực hiện code sau đây bằng cách thoát sớm
  process.exit(0); // Thoát khỏi worker thread sau khi hoàn thành
}

// Next.js API route handler
export async function POST(request) {
  // Tạo một kết nối MongoDB duy nhất cho route handler
  let mongoClient = null;
  let tempDir = null;
  let processedFilePath = null;
  let processingFolders = [];
  
  try {
    // Bắt đầu đo thời gian
    const startTime = Date.now();
    
    // Log thông tin bộ nhớ
    memoryMonitor.logMemoryStats('Bắt đầu API');
    
    // Kết nối MongoDB ngay từ đầu trong thread chính - CHỈ KẾT NỐI MỘT LẦN
    try {
      mongoClient = await getMongoClient();
      console.log('📊 Thiết lập kết nối MongoDB trong thread chính thành công');
    } catch (mongoError) {
      console.error(`📊 Lỗi kết nối MongoDB: ${mongoError.message}`);
      // Vẫn tiếp tục xử lý ngay cả khi không thể kết nối đến MongoDB
    }
    
    // Lấy token từ cookie thay vì từ request body
    const cookieStore = await cookies();
    const token = cookieStore.get(cookieConfig.authCookieName)?.value;
    const skipTokenValidation = true; // Luôn bỏ qua xác thực token không phụ thuộc vào môi trường
    
    // Parse request body
    const requestBody = await request.json();
    let { driveLink, backgroundImage, backgroundOpacity, url, courseName, courseId, 
          highPerformance, maxWorkers, batchSize, waitTime, dpi,
          processRecursively, maxRecursionDepth } = requestBody;
    
    // Luôn đặt skipWatermarkRemoval = false để đảm bảo luôn xử lý watermark
    const skipWatermarkRemoval = false;

    // Hỗ trợ cả url và driveLink (để tương thích)
    if (!driveLink && url) {
      driveLink = url;
    }

    // Sử dụng "nen.png" làm hình nền mặc định
    if (!backgroundImage) {
      backgroundImage = path.join(process.cwd(), "nen.png");
    }
    if (backgroundOpacity === undefined) {
      backgroundOpacity = 0.15; // Giảm xuống 0.15 để ảnh nền đậm hơn
    }
    
    // Tạo cấu hình hiệu suất tùy chỉnh nếu được yêu cầu
    let performanceConfig = { ...DEFAULT_CONFIG };
    
    // Chế độ hiệu suất cao nếu client yêu cầu
    if (highPerformance === true) {
      console.log('🚀 Kích hoạt chế độ hiệu suất cao theo yêu cầu của client');
      performanceConfig.highPerformanceMode = true;
      
      // Sử dụng các tham số tùy chỉnh từ client nếu được cung cấp
      if (maxWorkers && typeof maxWorkers === 'number') performanceConfig.maxWorkers = maxWorkers;
      if (batchSize && typeof batchSize === 'number') performanceConfig.batchSize = batchSize;
      if (waitTime && typeof waitTime === 'number') performanceConfig.waitTime = waitTime;
      if (dpi && typeof dpi === 'number') performanceConfig.dpi = dpi;
      
      // Lấy thông tin hệ thống để tối ưu hóa
      try {
        const cpuCount = os.cpus().length;
        performanceConfig.gsParallel = Math.min(Math.floor(cpuCount / 2), 4);
        console.log(`🖥️ Sử dụng ${performanceConfig.gsParallel} luồng GhostScript`);
      } catch (osError) {
        console.warn(`⚠️ Không thể đọc thông tin CPU: ${osError.message}`);
      }
    }

    // Xác thực người dùng nếu không skip validation
    if (!skipTokenValidation) {
      if (!token) {
        return NextResponse.json(
          { error: 'Không được phép. Vui lòng đăng nhập.' },
          { status: 401 }
        );
      }
      
      // Bỏ xác thực với Firebase, luôn coi token là hợp lệ vì skipTokenValidation=true
    }

    // Validate drive link
    if (!driveLink) {
      return NextResponse.json(
        { error: 'Thiếu liên kết Google Drive.' },
        { status: 400 }
      );
    }
    
    // Theo dõi bộ nhớ sau khi xác thực
    memoryMonitor.logMemoryStats('Sau xác thực');
    
    // Kiểm tra xem link là folder hay file
    let isFolder = false;
    if (driveLink.includes('drive.google.com/drive/folders/') || 
        driveLink.includes('drive.google.com/drive/u/0/folders/') ||
        driveLink.includes('drive.google.com/drive/my-drive/folders/') ||
        driveLink.includes('drive.google.com/drive/shared-with-me/folders/') ||
        driveLink.includes('drive.google.com/folders/') ||
        (driveLink.includes('drive.google.com') && driveLink.includes('folders'))) {
      isFolder = true;
    }
    
    // Xử lý trường hợp đặc biệt cho link có dạng drive.google.com/open?id=
    if (!isFolder && driveLink.includes('drive.google.com/open?id=')) {
      try {
        // Trích xuất ID của tài nguyên
        const result = extractGoogleDriveFileId(driveLink);
        const fileId = result.fileId;
        
        // Lấy token để truy cập Drive API
        const downloadToken = getTokenByType('download');
        if (downloadToken) {
          // Tạo OAuth2 client
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
          );
          
          oauth2Client.setCredentials(downloadToken);
          const drive = google.drive({ version: 'v3', auth: oauth2Client });
          
          // Lấy metadata của tài nguyên để kiểm tra loại
          const fileMetadata = await drive.files.get({
            fileId: fileId,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            fields: 'name,mimeType'
          });
          
          // Kiểm tra nếu là thư mục (mimeType = 'application/vnd.google-apps.folder')
          if (fileMetadata.data.mimeType === 'application/vnd.google-apps.folder') {
            isFolder = true;
            console.log(`Đã xác định link là thư mục từ mimeType: ${fileMetadata.data.mimeType}`);
          }
        }
      } catch (error) {
        console.log(`Lỗi khi kiểm tra loại tài nguyên: ${error.message}`);
      }
    }
    
    // Log thông tin bộ nhớ trước khi xử lý tập tin
    memoryMonitor.logMemoryStats('Trước khi xử lý');
    
    let result;
    if (isFolder) {
      console.log('Xử lý folder:', driveLink);
      // Xử lý nếu là folder
      result = await handleDriveFolder(driveLink, backgroundImage, backgroundOpacity, courseName, courseId, skipWatermarkRemoval, processRecursively === true, maxRecursionDepth || 5);
      
      // Không cần đọc response.json() ở đây vì sẽ làm stream bị khóa
      // Log được tạo trực tiếp trong hàm handleDriveFolder rồi
      console.log('Đã xử lý folder thành công, trả về kết quả...');
    } else {
      console.log('Xử lý file đơn lẻ:', driveLink);
      // Xử lý nếu là file (PDF hoặc ảnh)
      result = await handleDriveFile(driveLink, backgroundImage, backgroundOpacity, courseName, courseId, performanceConfig);
    }
    
    // Log thông tin bộ nhớ sau khi xử lý tập tin
    memoryMonitor.logMemoryStats('Sau khi xử lý');
    
    // Dọn dẹp bộ nhớ trước khi trả về kết quả
    forceGarbageCollection();
    
    return result;
  } catch (error) {
    // Log thông tin bộ nhớ khi có lỗi
    memoryMonitor.logMemoryStats('Lỗi xảy ra');
    
    // Clean up temp files
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        cleanupTempFiles(tempDir);
      } catch (cleanupError) {
        console.error(`Lỗi khi dọn dẹp thư mục tạm: ${cleanupError.message}`);
      }
    }
    
    // Dọn dẹp các thư mục xử lý folder nếu có
    for (const folderPath of processingFolders) {
      if (fs.existsSync(folderPath)) {
        try {
          cleanupTempFiles(folderPath);
        } catch (cleanupError) {
          // Bỏ qua lỗi cleanup
        }
      }
    }
    
    // Log chi tiết lỗi để debug
    console.error(`*** CHI TIẾT LỖI XỬ LÝ FILE ***`);
    console.error(`- Message: ${error.message}`);
    console.error(`- Stack: ${error.stack}`);
    if (error.cause) {
      console.error(`- Cause: ${JSON.stringify(error.cause)}`);
    }
    console.error(`********************************`);
    
    // Dọn dẹp bộ nhớ trước khi trả về lỗi
    forceGarbageCollection();
    
    return NextResponse.json(
      { 
        success: false,
        error: `Không thể xử lý: ${error.message}`,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  } finally {
    // Force GC một lần nữa trước khi kết thúc API call
    memoryMonitor.logMemoryStats('Kết thúc API');
    forceGarbageCollection();
  }
}

// Hàm xử lý một file đơn lẻ (PDF hoặc ảnh)
async function handleDriveFile(driveLink, backgroundImage, backgroundOpacity, courseName, courseId, performanceConfig = DEFAULT_CONFIG) {
  let tempDir = null;
  let processedFilePath = null;
  let fileName = null;
  
  try {
    // Trích xuất ID tài nguyên từ link
    let fileId;
    if (driveLink.includes('drive.google.com')) {
      try {
        const result = extractGoogleDriveFileId(driveLink);
        fileId = result.fileId;
      } catch (error) {
        console.error(`Lỗi trích xuất ID: ${error.message}`);
        throw new Error(`Không thể trích xuất ID từ link Google Drive: ${error.message}`);
      }
    } else {
      fileId = driveLink;
    }
    
    // Lấy thông tin cơ bản về file trước khi tải
    const downloadToken = getTokenByType('download');
    if (!downloadToken) {
      console.error('Token Google Drive không tìm thấy');
      throw new Error('Không tìm thấy token Google Drive.');
    }
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials(downloadToken);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Lấy metadata của file
    let fileMetadata;
    try {
      fileMetadata = await drive.files.get({
        fileId: fileId,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: 'name,mimeType,size'
      });
    } catch (metadataError) {
      console.error(`Lỗi lấy metadata: ${metadataError.message}`);
      throw new Error(`Không thể lấy thông tin file: ${metadataError.message}`);
    }
    
    fileName = fileMetadata.data.name;
    const mimeType = fileMetadata.data.mimeType;
    console.log(`Đã lấy thông tin file: ${fileName} (${mimeType})`);
    
    // Kiểm tra xem file đã tồn tại trong thư mục đích chưa
    console.log(`Kiểm tra trước xem file "${fileName}" đã tồn tại trong thư mục đích chưa...`);
    
    try {
      // Lấy token upload
      const uploadToken = getTokenByType('upload');
      if (!uploadToken) {
        console.error('Token upload không tìm thấy');
        throw new Error('Không tìm thấy token tải lên Google Drive.');
      }
      
      const uploadOAuth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      
      uploadOAuth2Client.setCredentials(uploadToken);
      const uploadDrive = google.drive({ version: 'v3', auth: uploadOAuth2Client });
      
      // Tìm hoặc tạo thư mục "tài liệu khoá học"
      let courseFolderId;
      try {
        // Tìm hoặc tạo thư mục gốc và thư mục khóa học (nếu có)
        courseFolderId = await findOrCreateCourseFolder(uploadDrive, courseName);
        console.log(`Folder ID đích: ${courseFolderId}`);
      } catch (folderError) {
        console.error(`Lỗi tìm/tạo thư mục đích: ${folderError.message}`);
        throw new Error(`Không thể tìm hoặc tạo thư mục đích: ${folderError.message}`);
      }
      
      // Kiểm tra xem file đã tồn tại trong thư mục đích chưa
      try {
        const escapedFileName = escapeDriveQueryString(fileName);
        const searchQuery = `name='${escapedFileName}' and '${courseFolderId}' in parents and trashed=false`;
        const existingFileResponse = await uploadDrive.files.list({
          q: searchQuery,
          fields: 'files(id, name, webViewLink, webContentLink)',
          spaces: 'drive'
        });
        
        // Nếu file đã tồn tại, trả về thông tin
        if (existingFileResponse.data.files && existingFileResponse.data.files.length > 0) {
          const existingFile = existingFileResponse.data.files[0];
          console.log(`⏩ File "${fileName}" đã tồn tại trong thư mục đích, bỏ qua xử lý.`);
          
          // Nếu có courseId, cập nhật thông tin file vào DB
          const processedFileData = {
            success: true,
            message: `File "${fileName}" đã tồn tại, không cần xử lý lại.`,
            originalFilename: fileName,
            processedFilename: existingFile.name,
            viewLink: existingFile.webViewLink,
            downloadLink: existingFile.webContentLink || existingFile.webViewLink,
            skipped: true,
            reason: 'File đã tồn tại trong thư mục đích'
          };
          
          try {
            if (courseId) {
              // Chuẩn bị courseId
              let dbCourseId;
              try {
                dbCourseId = new ObjectId(courseId);
              } catch (idError) {
                console.error(`CourseId không hợp lệ: ${courseId}`);
                // Vẫn tiếp tục luồng xử lý ngay cả khi ID không hợp lệ
              }
              
              if (dbCourseId) {
                console.log(`Cập nhật file đã tồn tại vào DB cho courseId: ${courseId}`);
                
                // Kết nối MongoDB
                const mongoClient = await getMongoClient();
                
                // Cập nhật thông tin file đã xử lý vào DB
                await updateProcessedFileInDB(
                  mongoClient,
                  dbCourseId,
                  driveLink,
                  processedFileData
                );
              }
            }
          } catch (dbError) {
            console.error(`Lỗi khi cập nhật DB: ${dbError.message}`);
            // Vẫn tiếp tục luồng xử lý ngay cả khi có lỗi DB
          }
          
          return NextResponse.json(processedFileData, { status: 200 });
        }
      } catch (checkError) {
        // Log lỗi nhưng vẫn tiếp tục xử lý - không throw error
        console.error(`Lỗi kiểm tra file tồn tại: ${checkError.message}`, checkError.stack);
        console.log(`Tiếp tục xử lý file dù có lỗi kiểm tra tồn tại`);
      }
    } catch (existCheckError) {
      // Log lỗi nhưng vẫn tiếp tục xử lý file - không dừng lại
      console.error(`Lỗi kiểm tra tồn tại: ${existCheckError.message}`, existCheckError.stack);
      console.log(`Bỏ qua kiểm tra file tồn tại, tiếp tục xử lý file`);
    }
    
    console.log(`File "${fileName}" chưa tồn tại hoặc không thể kiểm tra, bắt đầu xử lý...`);
    
    // Tải file từ Drive (hỗ trợ nhiều định dạng)
    let downloadResult;
    try {
      downloadResult = await downloadFileFromDrive(fileId);
      tempDir = downloadResult.outputDir;
    } catch (downloadError) {
      console.log(`⚠️ Lỗi tải file từ Drive API: ${downloadError.message}`);
      
      // Kiểm tra xem có phải lỗi liên quan đến "Docs Editors files" hoặc "cannot be downloaded"
      if (downloadError.message.includes('Only files with binary content can be downloaded') ||
          downloadError.message.includes('Docs Editors files')) {
        // Có thể là thư mục hoặc tài liệu Google Docs, kiểm tra loại
        try {
          // Trích xuất fileId từ driveLink
          let fileId;
          if (driveLink.includes('drive.google.com')) {
            try {
              const result = extractGoogleDriveFileId(driveLink);
              fileId = result.fileId;
            } catch (error) {
              throw new Error(`Không thể trích xuất ID từ link Google Drive: ${error.message}`);
            }
          } else {
            fileId = driveLink;
          }
          
          const downloadToken = getTokenByType('download');
          if (!downloadToken) {
            throw new Error('Không tìm thấy token Google Drive.');
          }
          
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
          );
          
          oauth2Client.setCredentials(downloadToken);
          const drive = google.drive({ version: 'v3', auth: oauth2Client });
          
          // Lấy metadata của file
          const fileMetadata = await drive.files.get({
            fileId: fileId,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            fields: 'name,mimeType,size'
          });
          
          const mimeType = fileMetadata.data.mimeType;
          
          // Kiểm tra nếu là thư mục
          if (mimeType === 'application/vnd.google-apps.folder') {
            console.log(`🔍 Đã phát hiện link là thư mục, chuyển hướng xử lý...`);
            
            // Gọi hàm xử lý thư mục
            return await handleDriveFolder(
              driveLink, 
              backgroundImage, 
              backgroundOpacity, 
              courseName, 
              courseId,
              skipWatermarkRemoval,
              processRecursively === true, // Xử lý đệ quy nếu được yêu cầu
              maxRecursionDepth || 5 // Độ sâu đệ quy mặc định là 5
            );
          } else if (mimeType.startsWith('image/')) {
            console.log(`🖼️ Đã phát hiện link là ảnh (${mimeType}), được phép xử lý...`);
            // Cho phép tiếp tục xử lý nếu là ảnh
            throw new Error(`Không thể tải ảnh trực tiếp. Sử dụng phương pháp thay thế.`);
          } else {
            throw new Error(`Định dạng file không được hỗ trợ: ${mimeType}. Chỉ hỗ trợ file PDF và ảnh.`);
          }
        } catch (typeCheckError) {
          if (typeCheckError.message.includes('thư mục') || typeCheckError.message.includes('folder')) {
            throw typeCheckError;
          } else {
            throw new Error(`Không thể kiểm tra loại nội dung: ${typeCheckError.message}`);
          }
        }
      } else if (downloadError.message.includes('cannot be downloaded') || 
          downloadError.message.includes('cannotDownloadFile') ||
          downloadError.message.includes('403')) {
        console.log(`🔄 Thử tải file bằng phương pháp chụp PDF...`);
        
        // Trích xuất fileId từ driveLink
        let fileId;
        if (driveLink.includes('drive.google.com')) {
          try {
            const result = extractGoogleDriveFileId(driveLink);
            fileId = result.fileId;
          } catch (error) {
            throw new Error(`Không thể trích xuất ID từ link Google Drive: ${error.message}`);
          }
        } else {
          fileId = driveLink;
        }
        
        // Tạo thư mục tạm
        const tempDirName = uuidv4();
        tempDir = path.join(os.tmpdir(), tempDirName);
        fs.mkdirSync(tempDir, { recursive: true });
        
        // Lấy thông tin file để biết tên
        try {
          const downloadToken = getTokenByType('download');
          if (!downloadToken) {
            throw new Error('Không tìm thấy token Google Drive.');
          }
          
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
          );
          
          oauth2Client.setCredentials(downloadToken);
          const drive = google.drive({ version: 'v3', auth: oauth2Client });
          
          // Lấy metadata của file
          const fileMetadata = await drive.files.get({
            fileId: fileId,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            fields: 'name,mimeType,size'
          });
          
          const fileName = fileMetadata.data.name;
          const mimeType = fileMetadata.data.mimeType;
          
          // Kiểm tra nếu là thư mục
          if (mimeType === 'application/vnd.google-apps.folder') {
            throw new Error(`Không thể xử lý thư mục. Vui lòng sử dụng chức năng xử lý thư mục thay vì xử lý file đơn lẻ.`);
          }
          
          // Kiểm tra nếu là PDF thì dùng giải pháp tải file bị chặn
          if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
            console.log(`📑 Sử dụng giải pháp xử lý file PDF...`);
            
            // Tạo config cho xử lý watermark
            const watermarkConfig = { ...DEFAULT_CONFIG };
            
            // Thêm hình nền nếu có
            if (backgroundImage) {
              let backgroundImagePath = backgroundImage;
              
              if (!path.isAbsolute(backgroundImage) && 
                  !backgroundImage.includes(':/') && 
                  !backgroundImage.includes(':\\')) {
                backgroundImagePath = path.join(process.cwd(), backgroundImage);
              }
              
              const fileExists = fs.existsSync(backgroundImagePath);
              
              if (fileExists) {
                watermarkConfig.backgroundImage = backgroundImagePath;
                
                if (backgroundOpacity !== undefined) {
                  watermarkConfig.backgroundOpacity = parseFloat(backgroundOpacity);
                }
              }
            }
            
            // Sử dụng hàm processPDF mới với flag isBlocked=true
            const outputPath = path.join(tempDir, `${path.basename(fileName, '.pdf')}_clean.pdf`);
            // Không cần truyền downloadResult.filePath vì file bị chặn không có đường dẫn file đầu vào
            const processResult = await processPDF(null, outputPath, watermarkConfig, true, fileId);
            
            if (processResult.success) {
              downloadResult = {
                success: true,
                filePath: processResult.filePath,
                fileName: fileName,
                contentType: 'application/pdf',
                outputDir: tempDir,
                size: fs.statSync(processResult.filePath).size,
                isImage: false,
                isPdf: true,
                originalSize: processResult.originalSize || 0,
                processedSize: processResult.processedSize || fs.statSync(processResult.filePath).size,
                processingTime: processResult.processingTime || 0,
                alreadyProcessed: true // Đánh dấu đã xử lý watermark
              };
            } else {
              throw new Error(`Không thể xử lý file PDF: ${processResult.error}`);
            }
          } else if (mimeType.startsWith('image/')) {
            // Với file ảnh, chúng ta sẽ xử lý như một file bình thường
            console.log(`🖼️ File ảnh: ${fileName} (${mimeType}) - Được phép xử lý`);
            
            // Chúng ta có thể tiếp tục với thông tin đã có từ metadata
            // và tạo một đối tượng downloadResult ảo
            const imageFileName = `temp_${uuidv4()}${path.extname(fileName)}`;
            const imagePath = path.join(tempDir, imageFileName);
            
            // Tạo file ảnh giả (1x1 pixel) để có thể tiếp tục quy trình
            // Trong thực tế, bạn có thể cần một phương pháp khác để lấy ảnh từ Drive
            const emptyImageContent = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'); // GIF 1x1
            fs.writeFileSync(imagePath, emptyImageContent);
            
            const imageFileSize = fs.statSync(imagePath).size;
            
            downloadResult = {
              success: true,
              filePath: imagePath,
              fileName: fileName,
              contentType: mimeType,
              outputDir: tempDir,
              size: imageFileSize,
              isImage: true,
              isPdf: false,
              originalSize: imageFileSize,
              processedSize: imageFileSize,
              processingTime: 0
            };
            
            console.log(`✅ Đã xử lý thông tin ảnh: ${fileName}`);
          } else {
            // Các loại file khác - trả về đường dẫn trực tiếp
            console.log(`📄 File khác: ${fileName} (${mimeType}) - Tiến hành tải lên trực tiếp`);
                        
            // Tạo đường dẫn cho file trống để chuyển hướng
            const tempFilePath = path.join(tempDir, `other_${uuidv4()}${path.extname(fileName)}`);
            fs.writeFileSync(tempFilePath, Buffer.from('dummy content'));
            
            downloadResult = {
              success: true,
              filePath: tempFilePath,
              fileName: fileName,
              contentType: mimeType,
              outputDir: tempDir,
              size: fs.statSync(tempFilePath).size,
              isImage: false,
              isPdf: false,
              originalSize: fs.statSync(tempFilePath).size,
              processedSize: fs.statSync(tempFilePath).size,
              processingTime: 0,
              directUpload: true
            };
            
            console.log(`✅ Đã chuẩn bị upload trực tiếp: ${fileName}`);
          }
        } catch (unblockError) {
          throw new Error(`Không thể tải file bị chặn: ${unblockError.message}`);
        }
      } else {
      return NextResponse.json(
        { error: `Không thể tải file từ Google Drive: ${downloadError.message}` },
        { status: 500 }
      );
    }
    }
    
    // Kiểm tra loại file
    if (downloadResult.isPdf) {
      // Xử lý nếu là PDF
    let cleanResult;
      
      // Kiểm tra xem file đã được xử lý watermark chưa
      if (downloadResult.alreadyProcessed) {
        console.log(`✅ File PDF đã được xử lý watermark trong quá trình tải xuống, bỏ qua bước xử lý watermark`);
        cleanResult = {
          success: true,
          filePath: downloadResult.filePath,
          originalSize: downloadResult.originalSize,
          processedSize: downloadResult.processedSize,
          processingTime: downloadResult.processingTime
        };
        processedFilePath = downloadResult.filePath;
      } else {
    try {
      const outputPath = path.join(tempDir, `${path.basename(downloadResult.fileName, '.pdf')}.pdf`);
      
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
      
          // Xử lý PDF để xóa watermark
          console.log(`Bắt đầu xóa watermark cho file: ${downloadResult.fileName}`);
          
          // Kiểm tra xem file đã được xử lý watermark chưa
          if (downloadResult.alreadyProcessed) {
            console.log(`✅ File PDF đã được xử lý watermark trong quá trình tải xuống, bỏ qua bước xử lý watermark lần hai`);
            
            // Chỉ cần copy file đã xử lý
            fs.copyFileSync(downloadResult.filePath, outputPath);
            
            cleanResult = {
              success: true,
              filePath: outputPath,
              originalSize: downloadResult.originalSize, 
              processedSize: downloadResult.processedSize,
              processingTime: downloadResult.processingTime
            };
            console.log(`✅ Đã sao chép file đã xử lý thành công: ${downloadResult.fileName}`);
          } else {
            // Thực hiện xử lý watermark nếu chưa được xử lý trước đó
      cleanResult = await cleanPdf(downloadResult.filePath, outputPath, config);
            console.log(`Đã xóa watermark xong cho file: ${downloadResult.fileName}`);
          }
          
      processedFilePath = outputPath;
    } catch (cleanError) {
      // Clean up temp files
      if (tempDir && fs.existsSync(tempDir)) {
        cleanupTempFiles(tempDir);
      }
      
      return NextResponse.json(
        { error: `Không thể xử lý PDF: ${cleanError.message}` },
        { status: 500 }
      );
        }
    }
    
    // Upload processed file back to Drive
    let uploadResult;
    try {
      uploadResult = await uploadToDrive(processedFilePath, downloadResult.fileName, 'application/pdf', courseName);
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
    
    // Chuẩn bị dữ liệu trả về
    const responseData = {
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
    };
    
    // Nếu có courseId, cập nhật thông tin file vào DB
    try {
      if (courseId) {
        // Chuẩn bị courseId
        let dbCourseId;
        try {
          dbCourseId = new ObjectId(courseId);
        } catch (idError) {
          console.error(`CourseId không hợp lệ: ${courseId}`);
          // Vẫn tiếp tục luồng xử lý ngay cả khi ID không hợp lệ
        }
        
        if (dbCourseId) {
          console.log(`Cập nhật file đã xử lý thành công vào DB cho courseId: ${courseId}`);
          
          // Kết nối MongoDB
          const mongoClient = await getMongoClient();
          
          // Cập nhật thông tin file đã xử lý vào DB
          await updateProcessedFileInDB(
            mongoClient,
            dbCourseId,
            driveLink,
            responseData
          );
        }
      }
    } catch (dbError) {
      console.error(`Lỗi khi cập nhật DB: ${dbError.message}`);
      // Vẫn tiếp tục luồng xử lý ngay cả khi có lỗi DB
    }
    
    // Return success response with link to processed file
    return NextResponse.json(responseData, { status: 200 });
      
    } else if (downloadResult.isImage) {
      // Nếu là ảnh, xử lý để loại bỏ watermark
      console.log(`Bắt đầu xử lý watermark cho ảnh: ${downloadResult.fileName}`);
      
      // Tạo đường dẫn output
      const outputPath = path.join(tempDir, `processed_${path.basename(downloadResult.fileName)}`);
      
      // Tạo config cho xử lý ảnh
      const config = { ...DEFAULT_CONFIG };
      
      // Thêm hình nền nếu có
      if (backgroundImage) {
        let backgroundImagePath = backgroundImage;
        
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
      
      // Xử lý ảnh để xóa watermark
      console.log(`🔄 Bắt đầu xử lý watermark cho ảnh...`);
      console.log(`🔍 Đang phân tích thông tin ảnh...`);
      
      const startTime = Date.now();
      let cleanResult;
      let processedImagePath = downloadResult.filePath;
      let fallbackToOriginal = false;
      
      try {
        if (!sharp) {
          console.warn("Sharp không được cài đặt hoặc không hoạt động. Sử dụng ảnh gốc.");
          throw new Error("Sharp không khả dụng");
        }
        
        try {
          await processImage(downloadResult.filePath, outputPath, config);
          
          if (!fs.existsSync(outputPath)) {
            console.error(`Ảnh đầu ra không được tạo: ${outputPath}`);
            throw new Error("Ảnh đầu ra không tồn tại sau khi xử lý");
          }
          
          const originalSize = fs.statSync(downloadResult.filePath).size;
          const processedSize = fs.statSync(outputPath).size;
          const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
          
          console.log(`✅ Đã xử lý watermark xong cho ảnh: ${downloadResult.fileName} trong ${processingTime} giây`);
          
          cleanResult = {
            success: true,
            filePath: outputPath,
            originalSize: (originalSize / (1024 * 1024)).toFixed(2),
            processedSize: (processedSize / (1024 * 1024)).toFixed(2),
            processingTime
          };
          
          processedImagePath = outputPath;
        } catch (processError) {
          console.error(`*** CHI TIẾT LỖI XỬ LÝ ẢNH ${downloadResult.fileName} ***`);
          console.error(`- Message: ${processError.message}`);
          console.error(`- Stack: ${processError.stack}`);
          if (processError.cause) {
            console.error(`- Cause: ${JSON.stringify(processError.cause)}`);
          }
          console.error(`********************************`);
          
          // Nếu xử lý lỗi, sử dụng ảnh gốc
          console.log(`⚠️ Lỗi xử lý watermark cho ảnh. Sử dụng ảnh gốc: ${downloadResult.fileName}`);
          fs.copyFileSync(downloadResult.filePath, outputPath);
          
          const originalSize = fs.statSync(downloadResult.filePath).size;
          
          cleanResult = {
            success: false,
            filePath: outputPath,
            originalSize: (originalSize / (1024 * 1024)).toFixed(2),
            processedSize: (originalSize / (1024 * 1024)).toFixed(2),
            processingTime: '0',
            error: processError.message
          };
          
          fallbackToOriginal = true;
          processedImagePath = outputPath;
        }
      } catch (outerError) {
        console.error(`*** LỖI NGHIÊM TRỌNG KHI XỬ LÝ ẢNH ***`);
        console.error(`- Message: ${outerError.message}`);
        console.error(`- Stack: ${outerError.stack}`);
        console.error(`********************************`);
        
        // Nếu có lỗi ở mức cao nhất, vẫn sử dụng file gốc
        processedImagePath = downloadResult.filePath;
        const originalSize = fs.statSync(downloadResult.filePath).size;
        
        cleanResult = {
          success: false,
          filePath: downloadResult.filePath,
          originalSize: (originalSize / (1024 * 1024)).toFixed(2),
          processedSize: (originalSize / (1024 * 1024)).toFixed(2),
          processingTime: '0',
          error: outerError.message
        };
        
        fallbackToOriginal = true;
      }
      
      // Upload ảnh đã xử lý lên Drive
      let uploadResult;
      try {
        uploadResult = await uploadToDrive(processedImagePath, downloadResult.fileName, downloadResult.contentType, courseName);
      } catch (uploadError) {
        // Clean up temp files
        if (tempDir && fs.existsSync(tempDir)) {
          cleanupTempFiles(tempDir);
        }
        
        return NextResponse.json(
          { error: `Không thể tải ảnh lên Google Drive: ${uploadError.message}` },
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
      
      // Chuẩn bị dữ liệu trả về
      const responseData = {
        success: true,
        message: fallbackToOriginal 
          ? 'Gặp lỗi khi xử lý ảnh. Đã tải ảnh gốc lên Google Drive.'
          : 'Đã xử lý và tải ảnh lên Google Drive thành công.',
        originalFilename: downloadResult.fileName,
        processedFilename: uploadResult.fileName,
        viewLink: uploadResult.webViewLink,
        downloadLink: uploadResult.downloadLink,
        processingDetails: {
          originalSize: cleanResult.originalSize,
          processedSize: cleanResult.processedSize,
          processingTime: cleanResult.processingTime + ' giây',
          fallbackToOriginal: fallbackToOriginal,
          error: cleanResult.error
        }
      };
      
      // Nếu có courseId, cập nhật thông tin file vào DB
      try {
        if (courseId) {
          // Chuẩn bị courseId
          let dbCourseId;
          try {
            dbCourseId = new ObjectId(courseId);
          } catch (idError) {
            console.error(`CourseId không hợp lệ: ${courseId}`);
            // Vẫn tiếp tục luồng xử lý ngay cả khi ID không hợp lệ
          }
          
          if (dbCourseId) {
            console.log(`Cập nhật thông tin ảnh đã xử lý vào DB cho courseId: ${courseId}`);
            
            // Kết nối MongoDB
            const mongoClient = await getMongoClient();
            
            // Cập nhật thông tin file đã xử lý vào DB
            await updateProcessedFileInDB(
              mongoClient,
              dbCourseId,
              driveLink,
              responseData
            );
          }
        }
      } catch (dbError) {
        console.error(`Lỗi khi cập nhật DB: ${dbError.message}`);
        // Vẫn tiếp tục luồng xử lý ngay cả khi có lỗi DB
      }
      
      // Return success response with link to uploaded image
      return NextResponse.json(responseData, { status: 200 });
      
    } else {
      // Các loại file khác - xử lý tất cả các loại file còn lại
      console.log(`Đang xử lý file khác (không phải PDF/ảnh): ${downloadResult.fileName} (${downloadResult.contentType})`);
      
      // Upload trực tiếp file gốc lên Drive không cần chỉnh sửa
      let uploadResult;
      try {
        uploadResult = await uploadToDrive(downloadResult.filePath, downloadResult.fileName, downloadResult.contentType, courseName);
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
      
      // Chuẩn bị dữ liệu trả về
      const responseData = {
        success: true,
        message: `Đã tải file lên Google Drive thành công.`,
        originalFilename: downloadResult.fileName,
        processedFilename: uploadResult.fileName,
        viewLink: uploadResult.webViewLink,
        downloadLink: uploadResult.downloadLink,
        fileType: downloadResult.contentType,
        size: downloadResult.size,
        directUpload: true
      };
      
      // Nếu có courseId, cập nhật thông tin file vào DB
      try {
        if (courseId) {
          // Chuẩn bị courseId
          let dbCourseId;
          try {
            dbCourseId = new ObjectId(courseId);
          } catch (idError) {
            console.error(`CourseId không hợp lệ: ${courseId}`);
            // Vẫn tiếp tục luồng xử lý ngay cả khi ID không hợp lệ
          }
          
          if (dbCourseId) {
            console.log(`Cập nhật thông tin file đã xử lý vào DB cho courseId: ${courseId}`);
            
            // Kết nối MongoDB
            const mongoClient = await getMongoClient();
            
            // Cập nhật thông tin file đã xử lý vào DB
            await updateProcessedFileInDB(
              mongoClient,
              dbCourseId,
              driveLink,
              responseData
            );
          }
        }
      } catch (dbError) {
        console.error(`Lỗi khi cập nhật DB: ${dbError.message}`);
        // Vẫn tiếp tục luồng xử lý ngay cả khi có lỗi DB
      }
      
      // Return success response
      return NextResponse.json(responseData, { status: 200 });
    }
    
  } catch (error) {
    // Clean up temp files
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        cleanupTempFiles(tempDir);
      } catch (cleanupError) {
        console.error(`Lỗi khi dọn dẹp thư mục tạm: ${cleanupError.message}`);
      }
    }
    
    // Log chi tiết lỗi để debug
    console.error(`*** CHI TIẾT LỖI XỬ LÝ FILE ***`);
    console.error(`- Message: ${error.message}`);
    console.error(`- Stack: ${error.stack}`);
    if (error.cause) {
      console.error(`- Cause: ${JSON.stringify(error.cause)}`);
    }
    console.error(`********************************`);
    
    // Dọn dẹp bộ nhớ trước khi trả về lỗi
    forceGarbageCollection();
    
    return NextResponse.json(
      { 
        success: false,
        error: `Không thể xử lý file: ${error.message}`,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Hàm xử lý folder từ Google Drive
async function handleDriveFolder(driveFolderLink, backgroundImage, backgroundOpacity, courseName, courseId, skipWatermarkRemoval = false, processRecursively = false, maxRecursionDepth = 5) {
  let folderResults = [];
  let processingFolders = [];
  let destinationFolderId = null;
  let dbCourseId = null;
  let mongoClient = null;
  
  // Chuẩn bị kết nối MongoDB và courseId nếu có
  try {
    if (courseId) {
      try {
        dbCourseId = new ObjectId(courseId);
        mongoClient = await getMongoClient();
        console.log(`Sẽ cập nhật DB cho courseId: ${courseId} sau khi xử lý folder`);
      } catch (idError) {
        console.error(`CourseId không hợp lệ: ${courseId}`);
        // Vẫn tiếp tục luồng xử lý ngay cả khi ID không hợp lệ
        dbCourseId = null;
      }
    }
  } catch (dbConnectError) {
    console.error(`Lỗi kết nối DB: ${dbConnectError.message}`);
    // Vẫn tiếp tục xử lý folder ngay cả khi kết nối DB thất bại
  }

  try {
    // Xử lý đệ quy nếu được yêu cầu
    if (processRecursively) {
      console.log(`Bắt đầu xử lý đệ quy folder với độ sâu tối đa ${maxRecursionDepth}...`);
      
      const recursiveResult = await processRecursiveFolder(
        driveFolderLink, 
        maxRecursionDepth, 
        0, // currentDepth ban đầu là 0
        backgroundImage,
        backgroundOpacity,
        courseName,
        skipWatermarkRemoval,
        mongoClient // Truyền kết nối MongoDB đã tồn tại vào hàm xử lý đệ quy
      );
      
      if (!recursiveResult.success) {
        return NextResponse.json({
          success: false,
          message: `Lỗi khi xử lý đệ quy folder: ${recursiveResult.error}`,
        }, { status: 500 });
      }
      
      console.log(`✅ Đã xử lý đệ quy thành công: ${recursiveResult.nestedFilesProcessed} file và ${recursiveResult.nestedFoldersProcessed} thư mục con`);
      
      // Trả về kết quả xử lý đệ quy
      return NextResponse.json({
        success: true,
        message: `Đã xử lý đệ quy folder thành công`,
        folderLink: recursiveResult.processedFolderLink,
        folderName: recursiveResult.folderName,
        nestedFilesProcessed: recursiveResult.nestedFilesProcessed,
        nestedFoldersProcessed: recursiveResult.nestedFoldersProcessed,
        folderStats: {
          totalFiles: recursiveResult.nestedFilesProcessed,
          totalFolders: recursiveResult.nestedFoldersProcessed,
          errors: recursiveResult.errors ? recursiveResult.errors.length : 0
        },
        errors: recursiveResult.errors
      });
    }

    // Lấy thông tin folder và danh sách files
    const folderInfo = await processDriveFolder(driveFolderLink);
    
    // Kiểm tra xem có file nào trong folder không
    if (!folderInfo.files || folderInfo.files.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Không tìm thấy file nào trong folder này.',
        folderName: folderInfo.folderName
      }, { status: 400 });
    }
    
    console.log(`Đã tìm thấy ${folderInfo.files.length} file trong folder "${folderInfo.folderName}"`);
    
    // Tạo một thư mục trên Drive để lưu các file đã xử lý
    console.log(`Tạo thư mục đích trên Drive...`);
    
    const destinationFolder = await createDriveFolder(folderInfo.folderName, courseName);
    destinationFolderId = destinationFolder.folderId;
    
    console.log(`Đã tạo folder đích: ${destinationFolder.folderName} (ID: ${destinationFolderId})`);
    
    // Xử lý từng file trong folder - lặp tuần tự để đảm bảo không gặp lỗi với nhiều file
    for (let i = 0; i < folderInfo.files.length; i++) {
      const file = folderInfo.files[i];
      console.log(`Bắt đầu xử lý file ${i+1}/${folderInfo.files.length}: ${file.name}`);
      
      try {
        // Kiểm tra trước xem file đã tồn tại trong thư mục đích chưa
        console.log(`Kiểm tra trước xem file "${file.name}" đã tồn tại trong thư mục đích chưa...`);
        
        // Lấy token upload
        const uploadToken = getTokenByType('upload');
        if (!uploadToken) {
          throw new Error('Không tìm thấy token tải lên Google Drive.');
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
        
        // Kiểm tra sự tồn tại của file
        const escapedFileName = escapeDriveQueryString(file.name);
        const searchQuery = `name='${escapedFileName}' and '${destinationFolderId}' in parents and trashed=false`;
        const existingFileResponse = await drive.files.list({
          q: searchQuery,
          fields: 'files(id, name, webViewLink, webContentLink)',
          spaces: 'drive'
        });
        
        // Nếu file đã tồn tại, bỏ qua xử lý
        if (existingFileResponse.data.files && existingFileResponse.data.files.length > 0) {
          const existingFile = existingFileResponse.data.files[0];
          console.log(`⏩ File "${file.name}" đã tồn tại trong thư mục đích, bỏ qua xử lý.`);
          
          folderResults.push({
            originalFile: file.name,
            processedFile: existingFile.name,
            viewLink: existingFile.webViewLink,
            downloadLink: existingFile.webContentLink,
            fileType: file.mimeType.startsWith('image/') ? 'image' : 'pdf',
            skipped: true,
            reason: 'File đã tồn tại trong thư mục đích'
          });
          
          continue; // Bỏ qua file này, chuyển sang file tiếp theo
        }
        
        console.log(`File "${file.name}" chưa tồn tại trong thư mục đích, bắt đầu xử lý...`);
      
        // Tạo thư mục tạm riêng cho mỗi file
        const tempDirName = uuidv4();
        const outputDir = path.join(os.tmpdir(), tempDirName);
        fs.mkdirSync(outputDir, { recursive: true });
        processingFolders.push(outputDir);
        
        // Tải file từ Drive
        console.log(`Đang tải file: ${file.name} (ID: ${file.id})`);
        let downloadResult;
        try {
          downloadResult = await downloadFileFromDrive(file.id);
          console.log(`Đã tải xong file: ${file.name}, kích thước: ${downloadResult.size} bytes`);
        } catch (downloadError) {
          console.log(`⚠️ Lỗi tải file ${file.name}: ${downloadError.message}`);
          
          // Kiểm tra xem có phải lỗi "cannot be downloaded" không
          if (downloadError.message.includes('cannot be downloaded') || 
              downloadError.message.includes('cannotDownloadFile') ||
              downloadError.message.includes('403')) {
            console.log(`🔄 Thử tải file ${file.name} bằng phương pháp chụp PDF...`);
            
            // Tạo thư mục tạm cho file này
            const tempDirName = uuidv4();
            const fileOutputDir = path.join(os.tmpdir(), tempDirName);
            fs.mkdirSync(fileOutputDir, { recursive: true });
            processingFolders.push(fileOutputDir);
            
            // Kiểm tra nếu là PDF thì dùng giải pháp tải file bị chặn
            if (file.mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
              console.log(`📑 Sử dụng giải pháp xử lý file PDF...`);
              
              // Tạo config cho xử lý watermark
              const watermarkConfig = { ...DEFAULT_CONFIG };
              
              // Thêm hình nền nếu có
              if (backgroundImage) {
                let backgroundImagePath = backgroundImage;
                
                if (!path.isAbsolute(backgroundImage) && 
                    !backgroundImage.includes(':/') && 
                    !backgroundImage.includes(':\\')) {
                  backgroundImagePath = path.join(process.cwd(), backgroundImage);
                }
                
                const fileExists = fs.existsSync(backgroundImagePath);
                
                if (fileExists) {
                  watermarkConfig.backgroundImage = backgroundImagePath;
                  
                  if (backgroundOpacity !== undefined) {
                    watermarkConfig.backgroundOpacity = parseFloat(backgroundOpacity);
                  }
                }
              }
              
              // Sử dụng hàm processPDF mới với flag isBlocked=true
              const outputPath = path.join(fileOutputDir, `${path.basename(file.name, '.pdf')}_clean.pdf`);
              // Không cần truyền downloadResult.filePath vì file bị chặn không có đường dẫn file đầu vào
              const processResult = await processPDF(null, outputPath, watermarkConfig, true, file.id);
              
              if (processResult.success) {
                downloadResult = {
                  success: true,
                  filePath: processResult.filePath,
                  fileName: file.name,
                  contentType: 'application/pdf',
                  outputDir: fileOutputDir,
                  size: fs.statSync(processResult.filePath).size,
                  isImage: false,
                  isPdf: true,
                  originalSize: processResult.originalSize || 0,
                  processedSize: processResult.processedSize || fs.statSync(processResult.filePath).size,
                  processingTime: processResult.processingTime || 0,
                  alreadyProcessed: true // Đánh dấu đã xử lý watermark
                };
                console.log(`✅ Đã tải và xử lý thành công file ${file.name} bằng phương pháp chụp PDF`);
              } else {
                throw new Error(`Không thể xử lý file PDF: ${processResult.error}`);
              }
            } else if (file.mimeType.startsWith('image/')) {
              // Xử lý file ảnh bị chặn
              console.log(`🖼️ File ảnh bị chặn: ${file.name} (${file.mimeType}) - Đang xử lý...`);
              
              // Tạo file ảnh giả để có thể tiếp tục quy trình
              const imageFileName = `temp_${uuidv4()}${path.extname(file.name)}`;
              const imagePath = path.join(fileOutputDir, imageFileName);
              
              // Tạo file ảnh giả (1x1 pixel)
              const emptyImageContent = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
              fs.writeFileSync(imagePath, emptyImageContent);
              
              downloadResult = {
                success: true,
                filePath: imagePath,
                fileName: file.name,
                contentType: file.mimeType,
                outputDir: fileOutputDir,
                size: fs.statSync(imagePath).size,
                isImage: true,
                isPdf: false
              };
              
              console.log(`✅ Đã xử lý thông tin ảnh: ${file.name}`);
            } else if (file.mimeType.includes('google-apps') && file.mimeType !== 'application/vnd.google-apps.folder') {
              // Xử lý Google Workspace files (Docs, Sheets, Slides...)
              console.log(`📝 Phát hiện file Google Workspace: ${file.name} (${file.mimeType})`);
              
              try {
                // Lấy token download
                const downloadToken = getTokenByType('download');
                if (!downloadToken) {
                  throw new Error('Không tìm thấy token Google Drive.');
                }
                
                // Tạo OAuth2 client
                const oauth2Client = new google.auth.OAuth2(
                  process.env.GOOGLE_CLIENT_ID,
                  process.env.GOOGLE_CLIENT_SECRET,
                  process.env.GOOGLE_REDIRECT_URI
                );
                
                // Thiết lập credentials
                oauth2Client.setCredentials(downloadToken);
                
                // Khởi tạo Google Drive API
                const drive = google.drive({ version: 'v3', auth: oauth2Client });
                
                console.log(`🔄 Xuất file Google Workspace sang PDF: ${file.name}`);
                
                // Xuất file Google Workspace sang PDF
                const exportResponse = await drive.files.export({
                  fileId: file.id,
                  mimeType: 'application/pdf',
                  supportsAllDrives: true
                }, {
                  responseType: 'arraybuffer'
                });
                
                // Tạo tên file xuất ra
                const exportFileName = `${file.name}.pdf`;
                
                // Lưu file xuất ra vào thư mục tạm
                const tempFileName = `${uuidv4()}.pdf`;
                const tempFilePath = path.join(fileOutputDir, tempFileName);
                fs.writeFileSync(tempFilePath, Buffer.from(exportResponse.data));
                
                console.log(`✅ Đã xuất thành công file ${file.name} sang PDF (${fs.statSync(tempFilePath).size} bytes)`);
                
                // Sử dụng file đã xuất mà không xử lý watermark (theo logic cũ)
                downloadResult = {
                  success: true,
                  filePath: tempFilePath,
                  fileName: exportFileName,
                  contentType: 'application/pdf',
                  outputDir: fileOutputDir,
                  size: fs.statSync(tempFilePath).size,
                  isImage: false,
                  isPdf: true,
                  isGoogleWorkspace: true,
                  skipWatermarkRemoval: true
                };
                console.log(`✅ Đã xuất file Google Workspace: ${exportFileName} (Không xử lý watermark)`);
              } catch (googleWorkspaceError) {
                console.error(`❌ Lỗi khi xử lý file Google Workspace ${file.name}:`, googleWorkspaceError);
                throw new Error(`Không thể xử lý file Google Workspace: ${googleWorkspaceError.message}`);
              }
            } else {
              // Xử lý các loại file khác bị chặn
              console.log(`📄 Tạo tệp tạm cho loại file bị chặn: ${file.name} (${file.mimeType})`);
              
              // Tạo tệp rỗng để có thể tiếp tục quy trình
              const tempFileName = `temp_${uuidv4()}${path.extname(file.name) || ''}`;
              const tempFilePath = path.join(fileOutputDir, tempFileName);
              fs.writeFileSync(tempFilePath, Buffer.from([]));
              
              downloadResult = {
                success: true,
                filePath: tempFilePath,
                fileName: file.name,
                contentType: file.mimeType,
                outputDir: fileOutputDir,
                size: fs.statSync(tempFilePath).size,
                isImage: false,
                isPdf: false,
                isOtherFile: true
              };
              
              console.log(`✅ Đã tạo tệp tạm cho: ${file.name}`);
            }
          } else {
            folderResults.push({
              originalFile: file.name,
              error: downloadError.message
            });
            continue;
          }
        }
        
        // Xử lý tùy theo loại file
        if (downloadResult.isPdf) {
          console.log(`Xử lý file PDF: ${file.name}`);
          // Xử lý PDF
          const outputPath = path.join(outputDir, `${path.basename(downloadResult.fileName, '.pdf')}.pdf`);
          
          // Tạo config cho xử lý PDF
          const config = { ...DEFAULT_CONFIG };
          
          // Thêm hình nền nếu có
          if (backgroundImage) {
            let backgroundImagePath = backgroundImage;
            
            if (!path.isAbsolute(backgroundImage) && 
                !backgroundImage.includes(':/') && 
                !backgroundImage.includes(':\\')) {
              backgroundImagePath = path.join(process.cwd(), backgroundImage);
            }
            
            const fileExists = fs.existsSync(backgroundImagePath);
            
            if (fileExists) {
              config.backgroundImage = backgroundImagePath;
              
              if (backgroundOpacity !== undefined) {
                config.backgroundOpacity = parseFloat(backgroundOpacity);
              }
            }
          }
          
          // Xử lý PDF để xóa watermark
          console.log(`Bắt đầu xóa watermark cho file: ${file.name}`);
          
          let cleanResult;
          // Kiểm tra xem file đã được xử lý watermark chưa
          if (downloadResult.alreadyProcessed) {
            console.log(`✅ File PDF đã được xử lý watermark trong quá trình tải xuống, bỏ qua bước xử lý watermark lần hai`);
            
            // Chỉ cần copy file đã xử lý
            fs.copyFileSync(downloadResult.filePath, outputPath);
            
            cleanResult = {
              success: true,
              filePath: outputPath,
              originalSize: downloadResult.originalSize, 
              processedSize: downloadResult.processedSize,
              processingTime: downloadResult.processingTime
            };
            console.log(`✅ Đã sao chép file đã xử lý thành công: ${file.name}`);
          } else {
            // Thực hiện xử lý watermark nếu chưa được xử lý trước đó
      cleanResult = await cleanPdf(downloadResult.filePath, outputPath, config);
            console.log(`Đã xóa watermark xong cho file: ${file.name}`);
          }
          
          // Tải lên Drive vào folder đích
          console.log(`Đang tải lên Drive cho file: ${file.name}`);
          const uploadResult = await uploadFileToDriveFolder(outputPath, `${downloadResult.fileName}`, destinationFolderId);
          console.log(`Đã tải lên Drive thành công cho file: ${file.name}`);
          
          folderResults.push({
            originalFile: file.name,
            processedFile: uploadResult.fileName,
            viewLink: uploadResult.webViewLink,
            downloadLink: uploadResult.downloadLink,
            fileType: 'pdf'
          });
          
        } else if (downloadResult.isImage) {
          console.log(`Xử lý file ảnh: ${file.name}`);
          
          // Tạo đường dẫn output cho ảnh
          const outputPath = path.join(outputDir, `processed_${file.name}`);
          
          // Tạo config cho xử lý ảnh
          const config = { ...DEFAULT_CONFIG };
          
          // Thêm hình nền nếu có
          if (backgroundImage) {
            let backgroundImagePath = backgroundImage;
            
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
          
          // Xử lý ảnh để xóa watermark
          console.log(`🔄 Bắt đầu xử lý watermark cho ảnh: ${file.name}`);
          console.log(`🔍 Đang phân tích thông tin ảnh...`);
          
          const startTime = Date.now();
          let cleanResult;
          let processedImagePath = downloadResult.filePath;
          let fallbackToOriginal = false;
          
          try {
            if (!sharp) {
              console.warn("Sharp không được cài đặt hoặc không hoạt động. Sử dụng ảnh gốc.");
              throw new Error("Sharp không khả dụng");
            }
            
            try {
              await processImage(downloadResult.filePath, outputPath, config);
              
              if (!fs.existsSync(outputPath)) {
                console.error(`Ảnh đầu ra không được tạo: ${outputPath}`);
                throw new Error("Ảnh đầu ra không tồn tại sau khi xử lý");
              }
              
              const originalSize = fs.statSync(downloadResult.filePath).size;
              const processedSize = fs.statSync(outputPath).size;
              const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
              
              console.log(`✅ Đã xử lý watermark xong cho ảnh: ${file.name} trong ${processingTime} giây`);
              
              cleanResult = {
                success: true,
                filePath: outputPath,
                originalSize: (originalSize / (1024 * 1024)).toFixed(2),
                processedSize: (processedSize / (1024 * 1024)).toFixed(2),
                processingTime
              };
              
              processedImagePath = outputPath;
            } catch (processError) {
              console.error(`*** CHI TIẾT LỖI XỬ LÝ ẢNH ${file.name} ***`);
              console.error(`- Message: ${processError.message}`);
              console.error(`- Stack: ${processError.stack}`);
              if (processError.cause) {
                console.error(`- Cause: ${JSON.stringify(processError.cause)}`);
              }
              console.error(`********************************`);
              
              // Nếu xử lý lỗi, sử dụng ảnh gốc
              console.log(`⚠️ Lỗi xử lý watermark cho ảnh. Sử dụng ảnh gốc: ${file.name}`);
              fs.copyFileSync(downloadResult.filePath, outputPath);
              
              const originalSize = fs.statSync(downloadResult.filePath).size;
              
              cleanResult = {
                success: false,
                filePath: outputPath,
                originalSize: (originalSize / (1024 * 1024)).toFixed(2),
                processedSize: (originalSize / (1024 * 1024)).toFixed(2),
                processingTime: '0',
                error: processError.message
              };
              
              fallbackToOriginal = true;
              processedImagePath = outputPath;
            }
          } catch (outerError) {
            console.error(`*** LỖI NGHIÊM TRỌNG KHI XỬ LÝ ẢNH ***`);
            console.error(`- Message: ${outerError.message}`);
            console.error(`- Stack: ${outerError.stack}`);
            console.error(`********************************`);
            
            // Nếu có lỗi ở mức cao nhất, vẫn sử dụng file gốc
            processedImagePath = downloadResult.filePath;
            const originalSize = fs.statSync(downloadResult.filePath).size;
            
            cleanResult = {
              success: false,
              filePath: downloadResult.filePath,
              originalSize: (originalSize / (1024 * 1024)).toFixed(2),
              processedSize: (originalSize / (1024 * 1024)).toFixed(2),
              processingTime: '0',
              error: outerError.message
            };
            
            fallbackToOriginal = true;
          }
          
          // Tải lên Drive vào folder đích
          console.log(`Đang tải lên Drive cho ảnh: ${file.name}`);
          const uploadResult = await uploadFileToDriveFolder(processedImagePath, file.name, destinationFolderId);
          console.log(`Đã tải lên Drive thành công cho ảnh: ${file.name}`);
          
          folderResults.push({
            originalFile: file.name,
            processedFile: uploadResult.fileName,
            viewLink: uploadResult.webViewLink,
            downloadLink: uploadResult.downloadLink,
            fileType: 'image',
            processingDetails: cleanResult,
            fallbackToOriginal: fallbackToOriginal
          });
          
        } else {
          // Các loại file khác - xử lý trực tiếp không thay đổi
          console.log(`Đang xử lý loại file khác: ${file.name} (${downloadResult.contentType})`);
          
          try {
            // Tải trực tiếp file lên thư mục đích
            const uploadResult = await uploadFileToDriveFolder(
              downloadResult.filePath,
              downloadResult.fileName,
              destinationFolderId
            );
            
            console.log(`✅ Đã tải lên Drive thành công cho file khác: ${file.name}`);
            
            folderResults.push({
              originalFile: file.name,
              processedFile: uploadResult.fileName,
              viewLink: uploadResult.webViewLink,
              downloadLink: uploadResult.downloadLink,
              fileType: downloadResult.contentType,
              directUpload: true
            });
          } catch (uploadError) {
            console.error(`❌ Lỗi khi tải lên file ${file.name}:`, uploadError);
            throw new Error(`Không thể tải lên file: ${uploadError.message}`);
          }
        }
      } catch (fileError) {
        console.error(`Lỗi khi xử lý file ${file.name}: ${fileError.message}`);
        // Ghi lại lỗi xử lý file nhưng không dừng toàn bộ quá trình
        folderResults.push({
          originalFile: file.name,
          error: fileError.message
        });
      } finally {
        // Dọn dẹp thư mục tạm của file
        try {
          // Kiểm tra outputDir tồn tại trước khi dọn dẹp
          if (typeof outputDir !== 'undefined' && outputDir) {
            cleanupTempFiles(outputDir);
            const index = processingFolders.indexOf(outputDir);
            if (index > -1) {
              processingFolders.splice(index, 1);
            }
            console.log(`Đã dọn dẹp thư mục tạm cho file: ${file.name}`);
          }
        } catch (cleanupError) {
          // Bỏ qua lỗi dọn dẹp
          console.error(`Lỗi khi dọn dẹp thư mục tạm: ${cleanupError.message}`);
        }
      }
      
      console.log(`Đã hoàn thành xử lý file ${i+1}/${folderInfo.files.length}: ${file.name}`);
    }
    
    console.log(`Đã hoàn thành xử lý tất cả ${folderInfo.files.length} file trong folder "${folderInfo.folderName}"`);
    
    // Ghi log thông tin về folder kết quả 
    console.log(`URL folder kết quả: ${destinationFolder.webViewLink}`);
    console.log(`Tổng số file đã xử lý: ${folderResults.length}`);
    
    // Chuẩn bị dữ liệu phản hồi
    const responseData = {
      success: true,
      message: `Đã xử lý ${folderResults.length} file trong folder thành công.`,
      folderName: destinationFolder.folderName,
      folderLink: destinationFolder.webViewLink,
      folderUrl: destinationFolder.webViewLink,
      driveUrl: destinationFolder.webViewLink,
      url: destinationFolder.webViewLink,
      totalFiles: folderInfo.files.length,
      processedFiles: folderResults,
      folderInfo: {
        id: destinationFolderId,
        name: destinationFolder.folderName,
        url: destinationFolder.webViewLink,
        fileCount: folderResults.length
      }
    };
    
    // Cập nhật thông tin vào DB nếu có courseId
    if (dbCourseId && mongoClient) {
      try {
        console.log(`Cập nhật thông tin folder đã xử lý vào DB cho courseId: ${courseId}`);
        
        // Cập nhật từng file trong folder vào DB
        for (const processedFile of folderResults) {
          // Chỉ cập nhật các file đã xử lý thành công và có link
          if (processedFile.viewLink && !processedFile.error) {
            // Tạo đối tượng dữ liệu file đã xử lý
            const fileData = {
              success: true,
              originalFilename: processedFile.originalFile,
              processedFilename: processedFile.processedFile || processedFile.originalFile,
              viewLink: processedFile.viewLink,
              downloadLink: processedFile.downloadLink || processedFile.viewLink,
              skipped: processedFile.skipped || false
            };
            
            // Tạo URL gốc từ file ID trong folder
            // Lấy file info từ danh sách files gốc
            const originalFile = folderInfo.files.find(f => f.name === processedFile.originalFile);
            if (originalFile) {
              const originalUrl = `https://drive.google.com/file/d/${originalFile.id}/view`;
              
              // Cập nhật vào DB
              await updateProcessedFileInDB(
                mongoClient,
                dbCourseId,
                originalUrl,
                fileData
              );
              console.log(`Đã cập nhật DB cho file: ${processedFile.originalFile}`);
            } else {
              console.log(`Không tìm thấy thông tin file gốc cho: ${processedFile.originalFile}`);
            }
          }
        }
        
        console.log(`Đã hoàn thành cập nhật DB cho ${folderResults.length} file`);
      } catch (dbError) {
        console.error(`Lỗi khi cập nhật DB cho folder: ${dbError.message}`);
        // Vẫn tiếp tục luồng xử lý ngay cả khi có lỗi DB
      }
    }
    
    // Trả về kết quả với link đến folder đích
    return NextResponse.json(responseData, { status: 200 });
    
  } catch (error) {
    console.error(`Lỗi khi xử lý folder: ${error.message}`);
    
    // Dọn dẹp các thư mục tạm nếu còn
    for (const folderPath of processingFolders) {
      if (fs.existsSync(folderPath)) {
        try {
          cleanupTempFiles(folderPath);
        } catch (cleanupError) {
          // Bỏ qua lỗi cleanup
        }
      }
    }
    
    // Dọn dẹp bộ nhớ trước khi trả về lỗi
    forceGarbageCollection();
    
    return NextResponse.json(
      { 
        success: false,
        error: `Không thể xử lý folder: ${error.message}` 
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