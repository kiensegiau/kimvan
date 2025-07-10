import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { extractDriveFileId } from '@/utils/drive-utils';
import { 
  checkMimeType, 
  processSingleFile, 
  processFolder,
  processAndUploadFile,
  addToProcessingQueue,
  checkFileInfo
} from './lib';

export const maxDuration = 3600; // 60 phút timeout (thay vì 30 phút)
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * API endpoint để xử lý và thay thế file từ Google Drive
 * Endpoint này xử lý cả file đơn lẻ và folder đệ quy
 */
export async function POST(request) {
  const startTime = Date.now();
  const tempDir = path.join(os.tmpdir(), uuidv4());
  
  // Tạo response stream để gửi updates
  const encoder = new TextEncoder();
  const customStream = new TransformStream();
  const writer = customStream.writable.getWriter();
  
  // Hàm helper để gửi updates
  const sendUpdate = async (message) => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
    } catch (e) {
      console.error('Lỗi khi gửi update:', e);
    }
  };

  try {
    console.log('\n=== BẮT ĐẦU XỬ LÝ REQUEST PROCESS-AND-REPLACE ===');
    
    // Parse request body
    const requestBody = await request.json();
    
    // Log request body để debug (ẩn apiKey)
    console.log('📝 Request body:', JSON.stringify({
      ...requestBody,
      apiKey: requestBody.apiKey ? '[HIDDEN]' : undefined
    }, null, 2));
    
    // Trích xuất các thông số từ request
    const {
      fileId,
      driveLink,
      targetFolderId,
      folderId,
      folderName,
      courseName,
      sheetName,
      apiKey,
      updateSheet = false,
      courseId,
      sheetIndex,
      rowIndex,
      cellIndex,
      sheetId,
      googleSheetName,
      displayText
    } = requestBody;

    // Chuẩn hóa các tham số
    const finalTargetFolderId = targetFolderId || folderId;
    const finalFolderName = folderName || courseName || sheetName || 'Unknown';

    // Validation các tham số bắt buộc
    if (!fileId && !driveLink) {
      throw new Error('Thiếu fileId hoặc driveLink');
    }

    if (!finalTargetFolderId) {
      throw new Error('Thiếu folder ID đích (targetFolderId hoặc folderId)');
    }

    // Validation tham số cập nhật sheet
    if (updateSheet) {
      if (courseId) {
        if (sheetIndex === undefined || rowIndex === undefined || cellIndex === undefined) {
          throw new Error('Thiếu thông tin cập nhật sheet (sheetIndex, rowIndex, cellIndex)');
        }
      } else if (sheetId && googleSheetName) {
        if (rowIndex === undefined || cellIndex === undefined) {
          throw new Error('Thiếu thông tin cập nhật Google Sheet (rowIndex, cellIndex)');
        }
      } else {
        throw new Error('Thiếu thông tin sheet (courseId hoặc sheetId + googleSheetName)');
      }
    }

    // Lấy ID file từ driveLink nếu không có fileId
    const finalFileId = fileId || extractDriveFileId(driveLink);
    if (!finalFileId) {
      throw new Error('Không thể lấy được file ID');
    }

    // Kiểm tra loại file
    console.log('🔍 Kiểm tra loại file...');
    const mimeTypeResult = await checkMimeType(finalFileId);

    // Lấy thêm thông tin file chi tiết để lấy tên file chính xác
    let originalFileName = null;
    try {
      const fileInfoResult = await checkFileInfo(finalFileId);
      if (fileInfoResult.success) {
        originalFileName = fileInfoResult.fileName || fileInfoResult.fileInfo?.name;
        console.log(`Tên file gốc từ Drive API (chi tiết): ${originalFileName || 'Không có'}`);
      }
    } catch (fileInfoError) {
      console.error('Lỗi khi lấy thông tin file chi tiết:', fileInfoError);
    }
    
    // Nếu chưa có tên file từ thông tin chi tiết, sử dụng kết quả từ checkMimeType
    if (!originalFileName && mimeTypeResult.success) {
      originalFileName = mimeTypeResult.fileName;
      console.log(`Tên file gốc từ Drive API (MIME): ${originalFileName || 'Không có'}`);
    }

    // Xử lý kết quả kiểm tra MIME type
    if (!mimeTypeResult.success) {
      console.log(`⚠️ Lỗi khi kiểm tra MIME type: ${mimeTypeResult.error}`);
      
      // Chuyển thẳng sang xử lý bằng Chrome
      console.log('🌐 Chuyển sang sử dụng Chrome để tải và xử lý file...');
      
      // Xác định loại lỗi để ghi log
      const errorType = mimeTypeResult.statusCode === 403 ? '403' : (mimeTypeResult.statusCode || 'unknown');
      console.log(`⚠️ Loại lỗi: ${errorType}`);
      
      // Thêm vào hàng đợi xử lý Chrome
      const chromeResult = await addToProcessingQueue({
        fileId: finalFileId,
        fileName: originalFileName || displayText || `file_${finalFileId}`,
        driveLink,
        targetFolderId: finalTargetFolderId,
        targetFolderName: finalFolderName,
        errorType: errorType.toString(),
        updateSheet,
        courseId: null,
        sheetIndex,
        rowIndex,
        cellIndex,
        sheetId,
        googleSheetName,
        displayText: originalFileName || displayText,
        request,
        tempDir
      });
      
      if (chromeResult) {
        return NextResponse.json({
          ...chromeResult,
          processingMode: `chrome_${errorType}`
        });
      }
      
      return NextResponse.json({ 
        status: 'queued',
        message: 'File đã được thêm vào hàng đợi xử lý Chrome'
      });
    }

    // Nếu là thư mục, xử lý đệ quy
    if (mimeTypeResult.isFolder) {
      console.log('\n📂 PHÁT HIỆN THƯ MỤC - BẮT ĐẦU XỬ LÝ ĐỆ QUY');
      
      // Tạo các options cho việc xử lý thư mục
      const folderOptions = {
        targetFolderId: finalTargetFolderId,
        apiKey,
        updateSheet,
        courseId,
        sheetIndex,
        rowIndex,
        cellIndex,
        sheetId,
        googleSheetName,
        displayText,
        request,
        originalFolderLink: driveLink,
        sheetFolderName: finalFolderName
      };
      
      // Gọi hàm xử lý thư mục đệ quy
      const folderResult = await processFolder(finalFileId, folderOptions);

      // Log total processing time
      const processingTime = Math.round((Date.now() - startTime) / 1000);
      console.log('\n=== HOÀN THÀNH XỬ LÝ THƯ MỤC ===');
      console.log(`⏱️ Tổng thời gian: ${processingTime} giây`);
      console.log(`📊 Tổng số file đã xử lý: ${folderResult.processedFiles.length}`);
      console.log(`⚠️ Tổng số file đã bỏ qua: ${folderResult.skippedFiles.length}`);
      console.log(`❌ Tổng số lỗi: ${folderResult.errors.length}`);

      return NextResponse.json({
        ...folderResult,
        processingTime
      });
    }

    // Check if it's a Google Doc
    if (mimeTypeResult.isGoogleDoc) {
      throw new Error('Không thể xử lý Google Doc, chỉ file PDF được hỗ trợ');
    }

    // Nếu không phải PDF, bỏ qua xử lý watermark
    // Kiểm tra cả MIME type và đuôi file
    const isPDF = mimeTypeResult.isPdf || driveLink.toLowerCase().endsWith('.pdf') || 
                (displayText && displayText.toLowerCase().endsWith('.pdf'));
                
    // Xử lý mọi loại file, không chỉ PDF
    // Bỏ qua kiểm tra isPDF
    /*
    if (!isPDF) {
      console.log(`⚠️ File không phải là PDF (${mimeTypeResult.mimeType}), bỏ qua xử lý watermark`);
      return NextResponse.json({
        success: true,
        skipped: true,
        message: `File không phải là PDF (${mimeTypeResult.mimeType}), bỏ qua xử lý watermark`,
        originalFile: {
          id: finalFileId,
          link: driveLink
        }
      });
    }
    */

    // Tạo thư mục tạm nếu chưa có
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Xử lý file đơn lẻ
    const fileOptions = {
      targetFolderId: finalTargetFolderId,
      apiKey,
      updateSheet,
      courseId,
      sheetIndex,
      rowIndex,
      cellIndex,
      sheetId,
      googleSheetName,
      displayText: originalFileName || displayText, // Ưu tiên sử dụng tên file gốc
      request
    };
    
    try {
      console.log('\n📄 XỬ LÝ FILE ĐƠN LẺ');
      
      // Thêm xử lý lỗi với catch để xử lý các trường hợp đặc biệt
      const fileResult = await processSingleFile(
        {
          id: finalFileId,
          name: originalFileName || displayText || `file_${finalFileId}`, // Ưu tiên sử dụng tên file gốc
          mimeType: mimeTypeResult.mimeType
        },
        fileOptions
      ).catch(async error => {
        console.error(`❌ Lỗi trong quá trình xử lý file: ${error.message}`);
        
        // Kiểm tra lỗi từ API xử lý watermark
        if (error.message.includes('Lỗi khi xử lý PDF') || 
            error.message.includes('Xử lý thất bại') || 
            error.message.includes('Không thể xử lý PDF')) {
          
          console.log(`⚠️ Phát hiện lỗi từ API xử lý watermark, thử dùng Chrome...`);
          
          // Chuyển sang Chrome nếu có lỗi API watermark
          return { 
            error: error.message, 
            useChrome: true 
          };
        }
        
        // Nếu là lỗi 403 hoặc lỗi download, chuyển sang Chrome
        if (error.message.includes('403') || 
            error.message.includes('cannotDownloadFile') || 
            error.message.includes('download failed') ||
            error.message.includes('không thể tải')) {
          
          console.log(`⚠️ Lỗi tải xuống file, chuyển sang dùng Chrome...`);
          return { 
            error: error.message, 
            useChrome: true 
          };
        }
        
        // Nếu là lỗi khác không xử lý được, ném ra để xử lý ở catch bên ngoài
        throw error;
      });
      
      // Nếu cần sử dụng Chrome để xử lý
      if (fileResult && fileResult.error && fileResult.useChrome) {
        console.log('🌐 Chuyển sang Chrome để tải và xử lý file...');
        
        // Thêm vào hàng đợi xử lý Chrome
        const chromeResult = await addToProcessingQueue({
          fileId: finalFileId,
          fileName: originalFileName || displayText || `file_${finalFileId}`, // Ưu tiên sử dụng tên file gốc
          driveLink,
          targetFolderId: finalTargetFolderId,
          targetFolderName: finalFolderName,
          errorType: '403',
          updateSheet,
            courseId,
            sheetIndex,
            rowIndex,
            cellIndex,
            sheetId,
            googleSheetName,
          displayText: originalFileName || displayText, // Ưu tiên sử dụng tên file gốc
          request,
          tempDir
        });
        
        if (chromeResult) {
          return NextResponse.json({
            ...chromeResult,
            processingMode: 'chrome_after_error',
            originalError: fileResult.error
          });
      }
      
      return NextResponse.json({
          status: 'queued',
          message: 'File đã được thêm vào hàng đợi xử lý Chrome sau khi gặp lỗi API',
          originalError: fileResult.error
        });
      }
      
      // Tính thời gian xử lý
      const processingTime = Math.round((Date.now() - startTime) / 1000);
      console.log(`\n✅ Hoàn thành xử lý file: ${processingTime} giây`);
      
      return NextResponse.json({
        ...fileResult,
        processingTime
      });
    } catch (error) {
      // Nếu lỗi 403, thử dùng Chrome
      if (error.message.includes('HTTP 403') || error.message.includes('cannotDownloadFile')) {
        console.log('⚠️ 403 được phát hiện - File bị chặn tải xuống');
        console.log('🌐 Chuyển sang Chrome để tải và xử lý file...');
        
        // Thêm vào hàng đợi xử lý Chrome
        const chromeResult = await addToProcessingQueue({
          fileId: finalFileId,
          fileName: originalFileName || displayText || `file_${finalFileId}`, // Ưu tiên sử dụng tên file gốc
          driveLink,
          targetFolderId: finalTargetFolderId,
          targetFolderName: finalFolderName,
          errorType: '403',
          updateSheet,
          courseId,
          sheetIndex,
          rowIndex,
          cellIndex,
          sheetId,
          googleSheetName,
          displayText: originalFileName || displayText, // Ưu tiên sử dụng tên file gốc
          request,
          tempDir
        });
        
        if (chromeResult) {
          return NextResponse.json(chromeResult);
        }
        
        return NextResponse.json({ 
          status: 'queued',
          message: 'File đã được thêm vào hàng đợi xử lý Chrome'
        });
      }
      
      // Nếu là lỗi khác, ném lỗi để xử lý ở catch
      throw error;
    }
  } catch (error) {
    console.error(`❌ Lỗi xử lý file: ${error.message}`);
    
    // Gửi thông báo lỗi
    await sendUpdate({
      type: 'error',
      error: error.message
    });
    
    // Đóng stream
    await writer.close();
    
    return new Response(
      JSON.stringify({ error: `Lỗi xử lý file: ${error.message}` }), 
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  } finally {
    // Dọn dẹp thư mục tạm
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log(`🧹 Đã xóa thư mục tạm: ${tempDir}`);
      } catch (cleanupError) {
        console.error(`⚠️ Lỗi dọn dẹp thư mục tạm: ${cleanupError.message}`);
      }
    }
    
    // Đảm bảo stream được đóng
    try {
      await writer.close();
    } catch (e) {
      console.error('Lỗi đóng stream:', e);
    }
  }
  
  // Trả về stream response
  return new Response(customStream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}