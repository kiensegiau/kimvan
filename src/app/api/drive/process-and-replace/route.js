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
      url,
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
      displayText,
      skipProcessing = false
    } = requestBody;

    // Chuẩn hóa các tham số
    const finalTargetFolderId = targetFolderId || folderId;
    const finalFolderName = folderName || courseName || sheetName || 'Unknown';

    // Validation các tham số bắt buộc
    if (!fileId && !url && !driveLink) {
      throw new Error('Thiếu fileId, url hoặc driveLink');
    }

    if (!finalTargetFolderId) {
      throw new Error('Thiếu folder ID đích (targetFolderId hoặc folderId)');
    }

    // Validation tham số cập nhật sheet
    let canUpdateSheet = false;
    if (updateSheet) {
      console.log(`\n📋 Thông tin cập nhật sheet được yêu cầu:`);
      console.log(`- courseId: ${courseId || 'không có'}`);
      console.log(`- sheetIndex: ${sheetIndex !== undefined ? sheetIndex : 'không có'}`);
      console.log(`- sheetId: ${sheetId || 'không có'}`);
      console.log(`- googleSheetName: ${googleSheetName || 'không có'}`);
      console.log(`- rowIndex: ${rowIndex !== undefined ? rowIndex : 'không có'}`);
      console.log(`- cellIndex: ${cellIndex !== undefined ? cellIndex : 'không có'}`);
      
      if (courseId) {
        if (sheetIndex === undefined || rowIndex === undefined || cellIndex === undefined) {
          console.warn(`⚠️ Thiếu thông tin cập nhật sheet (sheetIndex, rowIndex, cellIndex)`);
          canUpdateSheet = false;
        } else {
          console.log(`✅ Đủ thông tin để cập nhật sheet cho khóa học`);
          canUpdateSheet = true;
        }
      } else if (sheetId && googleSheetName) {
        if (rowIndex === undefined || cellIndex === undefined) {
          console.warn(`⚠️ Thiếu thông tin cập nhật Google Sheet (rowIndex, cellIndex)`);
          canUpdateSheet = false;
        } else {
          console.log(`✅ Đủ thông tin để cập nhật Google Sheet trực tiếp`);
          canUpdateSheet = true;
        }
      } else {
        console.warn(`⚠️ Thiếu thông tin sheet (courseId hoặc sheetId + googleSheetName)`);
        canUpdateSheet = false;
      }
    }
    
    // Ưu tiên sử dụng fileId trực tiếp nếu có
    let finalFileId = fileId;
    
    // Nếu không có fileId trực tiếp, trích xuất từ URL
    if (!finalFileId) {
      const urlToExtract = url || driveLink;
      if (urlToExtract) {
        try {
          // Xử lý URL từ Google Sheets (có dạng https://www.google.com/url?q=...)
          if (urlToExtract.includes('google.com/url?q=')) {
            // Trích xuất phần URL được mã hóa
            const match = urlToExtract.match(/[?&]q=([^&]+)/);
            if (match && match[1]) {
              // Giải mã URL
              const decodedUrl = decodeURIComponent(match[1]);
              console.log(`URL sau khi decode: ${decodedUrl}`);
              
              // Trích xuất ID từ URL đã giải mã
              const extracted = extractDriveFileId(decodedUrl);
              if (extracted && extracted.fileId) {
                finalFileId = extracted.fileId;
                console.log(`Đã trích xuất file ID từ URL đã giải mã: ${finalFileId}`);
              }
            }
          } else {
            // Xử lý URL thông thường
            const extracted = extractDriveFileId(urlToExtract);
            if (extracted && extracted.fileId) {
              finalFileId = extracted.fileId;
              console.log(`Đã trích xuất file ID từ URL: ${finalFileId}`);
            }
          }
        } catch (error) {
          console.error(`Lỗi khi trích xuất file ID từ URL: ${error.message}`);
        }
      }
    }
    
    if (!finalFileId) {
      throw new Error('Không thể lấy được file ID từ URL');
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
      
      // Import các hàm cần thiết trước khi sử dụng
      let getTokenByType, checkAllTokens;
      
      // Kiểm tra các token trước khi thực hiện xử lý folder
      try {
        const utils = await import('./lib/utils.js');
        getTokenByType = utils.getTokenByType;
        checkAllTokens = utils.checkAllTokens;
        
        const tokenStatus = await checkAllTokens();
        
        if (!tokenStatus.download || !tokenStatus.upload) {
          throw new Error('Token Google Drive không hợp lệ hoặc hết hạn. Vui lòng cập nhật token.');
        }
        
        console.log('✅ Các token Google Drive hợp lệ, tiếp tục xử lý folder');
      } catch (tokenError) {
        console.error(`❌ Lỗi kiểm tra token: ${tokenError.message}`);
        throw new Error(`Không thể xử lý folder: ${tokenError.message}`);
      }
      
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
      
      try {
        // Import cần thiết
        const { google } = require('googleapis');
        const path = require('path');
        const fs = require('fs');
        
        // Đảm bảo getTokenByType đã được định nghĩa
        if (!getTokenByType) {
          console.log('Đang import lại utils vì getTokenByType chưa được định nghĩa');
          const utils = await import('./lib/utils.js');
          getTokenByType = utils.getTokenByType;
        }
        
        // Lấy token upload và download
        const uploadToken = getTokenByType('upload');
        const downloadToken = getTokenByType('download');

        if (!uploadToken || !downloadToken) {
          throw new Error('Không thể lấy token Google Drive, vui lòng kiểm tra lại');
        }
        
        // Thiết lập OAuth clients
        const uploadOAuth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI
        );
        uploadOAuth2Client.setCredentials(uploadToken);
        
        const downloadOAuth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI
        );
        downloadOAuth2Client.setCredentials(downloadToken);
        
        // Khởi tạo Drive clients
        const uploadDrive = google.drive({ version: 'v3', auth: uploadOAuth2Client });
        const downloadDrive = google.drive({ version: 'v3', auth: downloadOAuth2Client });
        
        // Lấy thông tin về thư mục nguồn
        console.log(`📂 Lấy thông tin thư mục nguồn: ${finalFileId}`);
        const folder = await downloadDrive.files.get({
          fileId: finalFileId,
          fields: 'name,parents,mimeType',
          supportsAllDrives: true
        });
        
        console.log(`📂 Thông tin thư mục nguồn: ${folder.data.name} (${folder.data.mimeType})`);
        
        // Tìm hoặc tạo thư mục cha đích
        console.log(`📂 Tìm hoặc tạo thư mục đích trong: ${finalTargetFolderId}`);
        
        // Kiểm tra xem thư mục đã tồn tại trong đích chưa
        const escapedFolderName = folder.data.name.replace(/'/g, "\\'");
        const existingFolders = await uploadDrive.files.list({
          q: `'${finalTargetFolderId}' in parents and name = '${escapedFolderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id, name, webViewLink)',
          supportsAllDrives: true
        });
        
        let destinationFolder;
        if (existingFolders.data.files && existingFolders.data.files.length > 0) {
          destinationFolder = existingFolders.data.files[0];
          console.log(`📂 Sử dụng thư mục đã tồn tại: ${destinationFolder.name} (${destinationFolder.id})`);
        } else {
          // Tạo thư mục mới
          const folderMetadata = {
            name: folder.data.name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [finalTargetFolderId]
          };
          
          const newFolder = await uploadDrive.files.create({
            resource: folderMetadata,
            fields: 'id, name, webViewLink',
            supportsAllDrives: true
          });
          
          destinationFolder = newFolder.data;
          console.log(`📂 Đã tạo thư mục mới: ${destinationFolder.name} (${destinationFolder.id})`);
        }
        
        // Lấy danh sách file và thư mục con
        console.log(`📂 Lấy danh sách file và thư mục con trong thư mục nguồn`);
        const listResult = await downloadDrive.files.list({
          q: `'${finalFileId}' in parents and trashed = false`,
          fields: 'files(id, name, mimeType)',
          supportsAllDrives: true
        });
        
        const files = listResult.data.files || [];
        console.log(`📂 Tìm thấy ${files.length} file/folder trong thư mục nguồn`);
        
        // Xử lý từng file và thư mục con
        const processedFiles = [];
        const skippedFiles = [];
        const errorFiles = [];
        const subFolders = [];
        
        // Xử lý các thư mục con trước
        const folderItems = files.filter(file => file.mimeType === 'application/vnd.google-apps.folder');
        console.log(`📁 Tìm thấy ${folderItems.length} thư mục con`);
        
        for (const folderItem of folderItems) {
          try {
            console.log(`📁 Ghi nhận thư mục con: ${folderItem.name} (ID: ${folderItem.id})`);
            
            // Tạo thư mục con trong thư mục đích
            console.log(`📁 Thêm vào danh sách thư mục con để xử lý sau: ${folderItem.name}`);
            
            // Trong phiên bản đầu tiên, chúng ta chỉ ghi nhận thư mục con, không xử lý đệ quy
            // TODO: Thêm xử lý đệ quy trong phiên bản sau
            
            subFolders.push({
              id: folderItem.id,
              name: folderItem.name,
              link: `https://drive.google.com/drive/folders/${folderItem.id}`,
              // Đánh dấu là thư mục con cần xử lý sau
              needsProcessing: true
            });
          } catch (error) {
            console.error(`❌ Lỗi với thư mục con ${folderItem.name}: ${error.message}`);
            errorFiles.push({
              id: folderItem.id,
              name: folderItem.name,
              error: error.message,
              isFolder: true
            });
          }
        }
        
        // Xử lý các file
        const fileItems = files.filter(file => file.mimeType !== 'application/vnd.google-apps.folder');
        console.log(`📄 Tìm thấy ${fileItems.length} file để xử lý`);
        
        for (const fileItem of fileItems) {
          try {
            console.log(`📄 Đang phân tích file: ${fileItem.name} (ID: ${fileItem.id})`);
            
            // Kiểm tra MIME type
            let isPdf = false;
            let isVideo = false;
            let mimeTypeInfo = null;
            
            try {
              console.log(`📄 Kiểm tra MIME type cho file: ${fileItem.name} (ID: ${fileItem.id})`);
              const mimeTypeResult = await checkMimeType(fileItem.id).catch(e => {
                console.error(`⚠️ Lỗi khi gọi checkMimeType: ${e.message}`);
                return {
                  success: false,
                  mimeType: fileItem.mimeType,
                  isPdf: fileItem.mimeType === 'application/pdf' || fileItem.name.toLowerCase().endsWith('.pdf'),
                  isVideo: fileItem.mimeType.includes('video'),
                  error: e.message
                };
              });
              
              if (!mimeTypeResult.success) {
                console.log(`⚠️ checkMimeType không thành công, sử dụng thông tin mặc định`);
              }
              
              isPdf = mimeTypeResult.isPdf;
              isVideo = fileItem.mimeType.includes('video') || mimeTypeResult.mimeType?.includes('video');
              mimeTypeInfo = mimeTypeResult;
              
              console.log(`📄 Kết quả kiểm tra MIME: ${fileItem.name} - isPDF=${isPdf}, isVideo=${isVideo}, mimeType=${mimeTypeResult.mimeType || fileItem.mimeType}`);
            } catch (mimeError) {
              console.error(`❌ Lỗi kiểm tra MIME type cho ${fileItem.name}: ${mimeError.message}`);
              // Fallback dựa trên tên file và mime type
              isPdf = fileItem.mimeType === 'application/pdf' || fileItem.name.toLowerCase().endsWith('.pdf');
              isVideo = fileItem.mimeType.includes('video');
              console.log(`📄 Sử dụng fallback: ${fileItem.name} - isPDF=${isPdf}, isVideo=${isVideo}, mimeType=${fileItem.mimeType}`);
            }
            
            if (isPdf || isVideo) {
              console.log(`✅ Thêm vào danh sách file đã xử lý: ${fileItem.name} (${isPdf ? 'PDF' : 'Video'})`);
              processedFiles.push({
                id: fileItem.id,
                name: fileItem.name,
                type: isPdf ? 'pdf' : 'video',
                mimeType: mimeTypeInfo?.mimeType || fileItem.mimeType,
                processed: true
              });
            } else {
              console.log(`⚠️ Bỏ qua file không được hỗ trợ: ${fileItem.name} (${mimeTypeInfo?.mimeType || fileItem.mimeType})`);
              skippedFiles.push({
                id: fileItem.id,
                name: fileItem.name,
                reason: `Không phải file PDF hoặc video (${mimeTypeInfo?.mimeType || fileItem.mimeType})`
              });
            }
          } catch (error) {
            console.error(`❌ Lỗi xử lý file ${fileItem.name}: ${error.message}`);
            errorFiles.push({
              id: fileItem.id,
              name: fileItem.name,
              error: error.message
            });
          }
        }
        
        // Thực hiện cập nhật sheet nếu cần
        let sheetUpdateResult = null;
        if (updateSheet) {
          try {
            console.log(`\n📝 Cập nhật liên kết thư mục trong sheet...`);
            
            if (canUpdateSheet) {
              if (courseId && sheetIndex !== undefined && rowIndex !== undefined && cellIndex !== undefined) {
                sheetUpdateResult = await updateSheetCell(
                  courseId,
                  sheetIndex,
                  rowIndex,
                  cellIndex,
                  driveLink || `https://drive.google.com/drive/folders/${finalFileId}`,
                  destinationFolder.webViewLink,
                  displayText || folder.data.name,
                  request
                );
              } else if (sheetId && googleSheetName && rowIndex !== undefined && cellIndex !== undefined) {
                sheetUpdateResult = await updateGoogleSheetCell(
                  sheetId,
                  googleSheetName,
                  rowIndex,
                  cellIndex,
                  displayText || folder.data.name,
                  destinationFolder.webViewLink,
                  driveLink || `https://drive.google.com/drive/folders/${finalFileId}`,
                  request
                );
              }
            }
          } catch (sheetError) {
            console.error(`❌ Lỗi cập nhật sheet: ${sheetError.message}`);
          }
        }

        // Xây dựng kết quả
        const folderResult = {
          success: true,
          isFolder: true,
          folderId: finalFileId,
          folderName: folder.data.name,
          originalFolderLink: driveLink || `https://drive.google.com/drive/folders/${finalFileId}`,
          folderLink: destinationFolder.webViewLink,
          processedFolderLink: destinationFolder.webViewLink,
          processedFiles,
          skippedFiles,
          errors: errorFiles,
          subFolders,
          sheetUpdate: sheetUpdateResult
        };

      // Log total processing time
      const processingTime = Math.round((Date.now() - startTime) / 1000);
      console.log('\n=== HOÀN THÀNH XỬ LÝ THƯ MỤC ===');
      console.log(`⏱️ Tổng thời gian: ${processingTime} giây`);
        console.log(`📊 Tổng số file đã xử lý: ${processedFiles.length}`);
        console.log(`⚠️ Tổng số file đã bỏ qua: ${skippedFiles.length}`);
        console.log(`❌ Tổng số lỗi: ${errorFiles.length}`);

      return NextResponse.json({
        ...folderResult,
          processingTime,
          originalUrl: driveLink,
          urlType: 'folder'
      });
      } catch (folderError) {
        console.error(`❌ Lỗi xử lý thư mục: ${folderError.message}`);
        throw folderError;
      }
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
      updateSheet: canUpdateSheet, // Sử dụng biến canUpdateSheet thay vì updateSheet trực tiếp
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