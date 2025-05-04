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
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import { google } from 'googleapis';

// Import các module đã tách
import { API_TOKEN, DEFAULT_CONFIG } from './lib/config.js';
import { downloadFromGoogleDrive } from './lib/drive-service.js';
import { uploadToDrive } from './lib/drive-service.js';
import { cleanPdf } from './lib/watermark.js';
import { cleanupTempFiles, getTokenByType, findGhostscript } from './lib/utils.js';
import { processPage, convertPage } from './lib/workers.js';
import { 
  processDriveFolder, 
  createDriveFolder, 
  uploadFileToDriveFolder,
  downloadFileFromDrive 
} from './lib/drive-service.js';
import { downloadBlockedPDF } from './lib/drive-fix-blockdown.js';

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

// Next.js API route handler
export async function POST(request) {
  let tempDir = null;
  let processedFilePath = null;
  let processingFolders = [];
  
  try {
    // Parse request body
    const requestBody = await request.json();
    let { token, driveLink, backgroundImage, backgroundOpacity, skipTokenValidation, url } = requestBody;

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

    // Validate API token chỉ khi không có skipTokenValidation
    if (!skipTokenValidation && (!token || token !== API_TOKEN)) {
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
    
    if (isFolder) {
      console.log('Xử lý folder:', driveLink);
      // Xử lý nếu là folder
      const folderResponse = await handleDriveFolder(driveLink, backgroundImage, backgroundOpacity);
      
      // Không cần đọc response.json() ở đây vì sẽ làm stream bị khóa
      // Log được tạo trực tiếp trong hàm handleDriveFolder rồi
      console.log('Đã xử lý folder thành công, trả về kết quả...');
      
      return folderResponse;
    } else {
      console.log('Xử lý file đơn lẻ:', driveLink);
      // Xử lý nếu là file (PDF hoặc ảnh)
      return await handleDriveFile(driveLink, backgroundImage, backgroundOpacity);
    }
    
  } catch (error) {
    // Clean up temp files
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        cleanupTempFiles(tempDir);
      } catch (cleanupError) {
        // Handle cleanup error
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
    
    return NextResponse.json(
      { 
        success: false,
        error: `Không thể xử lý: ${error.message}` 
      },
      { status: 500 }
    );
  }
}

// Hàm xử lý một file đơn lẻ (PDF hoặc ảnh)
async function handleDriveFile(driveLink, backgroundImage, backgroundOpacity) {
  let tempDir = null;
  let processedFilePath = null;
  
  try {
    // Tải file từ Drive (hỗ trợ nhiều định dạng)
    let downloadResult;
    try {
      downloadResult = await downloadFileFromDrive(driveLink);
      tempDir = downloadResult.outputDir;
    } catch (downloadError) {
      console.log(`⚠️ Lỗi tải file từ Drive API: ${downloadError.message}`);
      
      // Kiểm tra xem có phải lỗi "cannot be downloaded" không
      if (downloadError.message.includes('cannot be downloaded') || 
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
          
          // Kiểm tra nếu là PDF thì dùng giải pháp tải file bị chặn
          if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
            console.log(`📑 Sử dụng giải pháp tải file PDF bị chặn...`);
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
            
            const unblockResult = await downloadBlockedPDF(fileId, fileName, tempDir, watermarkConfig);
            
            if (unblockResult.success) {
              downloadResult = {
                success: true,
                filePath: unblockResult.filePath,
                fileName: fileName,
                contentType: 'application/pdf',
                outputDir: tempDir,
                size: fs.statSync(unblockResult.filePath).size,
                isImage: false,
                isPdf: true,
                originalSize: unblockResult.originalSize || 0,
                processedSize: unblockResult.processedSize || fs.statSync(unblockResult.filePath).size,
                processingTime: unblockResult.processingTime || 0,
                alreadyProcessed: true // Đánh dấu đã xử lý watermark
              };
            } else {
              throw new Error(`Không thể tải file bị chặn: ${unblockResult.error}`);
            }
          } else {
            throw new Error(`Loại file ${mimeType} không hỗ trợ tải xuống khi bị chặn`);
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
      
    } else if (downloadResult.isImage) {
      // Nếu là ảnh, không xử lý, chỉ tải lên Drive
      let uploadResult;
      try {
        uploadResult = await uploadToDrive(downloadResult.filePath, downloadResult.fileName, downloadResult.contentType);
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
      
      // Return success response with link to uploaded image
      return NextResponse.json({
        success: true,
        message: 'Đã tải ảnh lên Google Drive thành công.',
        originalFilename: downloadResult.fileName,
        processedFilename: uploadResult.fileName,
        viewLink: uploadResult.webViewLink,
        downloadLink: uploadResult.downloadLink
      }, { status: 200 });
      
    } else {
      // Loại file không được hỗ trợ
      cleanupTempFiles(tempDir);
      
      return NextResponse.json(
        { error: 'Loại file không được hỗ trợ. API này chỉ hỗ trợ xử lý file PDF và ảnh.' },
        { status: 400 }
      );
    }
    
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
        error: `Không thể xử lý file: ${error.message}` 
      },
      { status: 500 }
    );
  }
}

// Hàm xử lý folder từ Google Drive
async function handleDriveFolder(driveFolderLink, backgroundImage, backgroundOpacity) {
  let folderResults = [];
  let processingFolders = [];
  let destinationFolderId = null;
  
  try {
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
    
    // Tạo folder đích trên Drive để lưu kết quả
    const destinationFolder = await createDriveFolder(folderInfo.folderName);
    destinationFolderId = destinationFolder.folderId;
    
    console.log(`Đã tạo folder đích: ${destinationFolder.folderName} (ID: ${destinationFolderId})`);
    
    // Xử lý từng file trong folder - lặp tuần tự để đảm bảo không gặp lỗi với nhiều file
    for (let i = 0; i < folderInfo.files.length; i++) {
      const file = folderInfo.files[i];
      console.log(`Bắt đầu xử lý file ${i+1}/${folderInfo.files.length}: ${file.name}`);
      
      // Tạo thư mục tạm riêng cho mỗi file
      const tempDirName = uuidv4();
      const outputDir = path.join(os.tmpdir(), tempDirName);
      fs.mkdirSync(outputDir, { recursive: true });
      processingFolders.push(outputDir);
      
      try {
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
              console.log(`📑 Sử dụng giải pháp tải file PDF bị chặn...`);
              
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
              
              const unblockResult = await downloadBlockedPDF(file.id, file.name, fileOutputDir, watermarkConfig);
              
              if (unblockResult.success) {
                downloadResult = {
                  success: true,
                  filePath: unblockResult.filePath,
                  fileName: file.name,
                  contentType: 'application/pdf',
                  outputDir: fileOutputDir,
                  size: fs.statSync(unblockResult.filePath).size,
                  isImage: false,
                  isPdf: true,
                  originalSize: unblockResult.originalSize || 0,
                  processedSize: unblockResult.processedSize || fs.statSync(unblockResult.filePath).size,
                  processingTime: unblockResult.processingTime || 0,
                  alreadyProcessed: true // Đánh dấu đã xử lý watermark
                };
                console.log(`✅ Đã tải và xử lý thành công file ${file.name} bằng phương pháp chụp PDF`);
              } else {
                throw new Error(`Không thể tải file bị chặn: ${unblockResult.error}`);
              }
            } else {
              folderResults.push({
                originalFile: file.name,
                skipped: true,
                reason: `Loại file ${file.mimeType} không hỗ trợ tải xuống khi bị chặn`
              });
              continue;
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
          // Với ảnh, không xử lý, tải thẳng lên folder đích
          console.log(`Đang tải lên Drive cho ảnh: ${file.name}`);
          const uploadResult = await uploadFileToDriveFolder(downloadResult.filePath, downloadResult.fileName, destinationFolderId);
          console.log(`Đã tải lên Drive thành công cho ảnh: ${file.name}`);
          
          folderResults.push({
            originalFile: file.name,
            processedFile: uploadResult.fileName,
            viewLink: uploadResult.webViewLink,
            downloadLink: uploadResult.downloadLink,
            fileType: 'image'
          });
          
        } else {
          console.log(`Bỏ qua file không được hỗ trợ: ${file.name}`);
          // Bỏ qua các loại file không được hỗ trợ
          folderResults.push({
            originalFile: file.name,
            skipped: true,
            reason: 'Loại file không được hỗ trợ'
          });
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
          cleanupTempFiles(outputDir);
          const index = processingFolders.indexOf(outputDir);
          if (index > -1) {
            processingFolders.splice(index, 1);
          }
          console.log(`Đã dọn dẹp thư mục tạm cho file: ${file.name}`);
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
    
    // Trả về kết quả với link đến folder đích
    return NextResponse.json({
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
    }, { status: 200 });
    
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