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

// Import các module đã tách
import { API_TOKEN, DEFAULT_CONFIG } from './lib/config';
import { downloadFromGoogleDrive } from './lib/drive-service';
import { uploadToDrive } from './lib/drive-service';
import { cleanPdf } from './lib/watermark';
import { cleanupTempFiles, getTokenByType, findGhostscript } from './lib/utils';
import { processPage, convertPage } from './lib/workers';

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