import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import { 
  extractDriveFileId, 
  createOAuth2Client, 
  checkAndDeleteDuplicates 
} from '@/utils/drive-utils';
import { processPDF } from '@/app/api/drive/remove-watermark/lib/drive-fix-blockdown.js';
import axios from 'axios';
import FormData from 'form-data';
// Import the API key management utilities
import { getNextApiKey, removeApiKey } from '@/utils/watermark-api-keys';

// Tải xuống file từ Google Drive
async function downloadFromGoogleDrive(fileId) {
  console.log(`Đang tải xuống file từ Google Drive với ID: ${fileId}`);
  
  // Tạo thư mục tạm nếu chưa tồn tại
  const tempDir = path.join(os.tmpdir(), 'drive-download-');
  const outputDir = fs.mkdtempSync(tempDir);
  
  try {
    // Tạo OAuth2 client với khả năng tự động refresh token
    const oauth2Client = createOAuth2Client(1); // Sử dụng token tải xuống (index 1)
    console.log('Sử dụng token tải xuống (drive_token_download.json)');
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    console.log('Kiểm tra quyền truy cập Drive...');
    
    // Lấy thông tin file
    let fileInfo;
    try {
      fileInfo = await drive.files.get({
        fileId: fileId,
        fields: 'name,mimeType,size,capabilities'
      });
      
      // Kiểm tra quyền truy cập
      if (fileInfo.data.capabilities && !fileInfo.data.capabilities.canDownload) {
        console.log('Phát hiện file không có quyền tải xuống, sẽ sử dụng phương pháp drive-fix-blockdown');
        // Sử dụng phương pháp đặc biệt cho file bị chặn
        const tempDir = path.join(os.tmpdir(), 'blocked-pdf-');
        const blockedTempDir = fs.mkdtempSync(tempDir);
        // Thêm tham số keepChromeOpen=true để giữ Chrome mở khi debug
        const result = await processPDF(null, null, {
          keepChromeOpen: true, // Giữ Chrome mở để debug
          debugMode: true // Bật chế độ debug
        }, true, fileId);
        
        if (!result.success) {
          throw new Error(`Không thể xử lý file bị chặn: ${result.error}`);
        }
        
        // Kiểm tra nếu không phát hiện trang nào
        if (result.pageCount === 0 || !result.filePath || result.emptyFile) {
          throw new Error(`Không phát hiện trang nào trong file PDF. Chrome đã được giữ mở để debug. File ID: ${fileId}`);
        }
        
        // Lấy tên file gốc
        let originalFileName;
        try {
          originalFileName = fileInfo.data.name;
          console.log(`Tên file gốc từ Drive: ${originalFileName}`);
        } catch (nameError) {
          console.warn(`Không thể lấy tên file gốc: ${nameError.message}`);
          originalFileName = result.fileName || `file_${fileId}.pdf`;
        }
        
        // Thêm logo vào file PDF đã tải xuống
        try {
          console.log('Thêm logo vào file PDF đã tải xuống bằng Chrome (không cắt)...');
          await addLogoToPDF(result.filePath, result.filePath);
          console.log('Đã thêm logo thành công vào file PDF đã tải xuống bằng Chrome');
        } catch (logoError) {
          console.error(`Không thể thêm logo vào file PDF: ${logoError.message}`);
        }
        
        return {
          success: true,
          filePath: result.filePath,
          fileName: originalFileName, // Sử dụng tên file gốc
          mimeType: 'application/pdf',
          outputDir: blockedTempDir
        };
      }
    } catch (error) {
      // Kiểm tra lỗi 404 - File không tồn tại
      if (error.code === 404 || error.response?.status === 404) {
        console.error(`File không tồn tại (404): ${fileId}. Không thử lại.`);
        throw new Error(`Không tìm thấy file với ID: ${fileId}. File có thể đã bị xóa hoặc không tồn tại.`);
      } 
      // Kiểm tra lỗi 403 - Không có quyền truy cập
      else if (error.code === 403 || error.response?.status === 403) {
        console.log(`Lỗi quyền truy cập (403): ${fileId}. Thử sử dụng Chrome để tải nhưng không xử lý watermark...`);
        
        try {
          // Sử dụng phương pháp đặc biệt cho file bị chặn
          const tempDir = path.join(os.tmpdir(), 'blocked-pdf-');
          const blockedTempDir = fs.mkdtempSync(tempDir);
          
          // Thử xử lý file bằng phương pháp đặc biệt nhưng tắt xử lý watermark
          console.log('Tải file bằng Chrome và BỎ QUA hoàn toàn bước xử lý watermark');
          const result = await processPDF(null, null, {
            keepChromeOpen: true,
            debugMode: true,
            skipWatermarkRemoval: true, // Bỏ qua bước xóa watermark
            skipImageProcessing: true,  // Bỏ qua bước xử lý ảnh
            preserveOriginal: true,     // Giữ nguyên nội dung gốc
            noProcessing: true          // Flag đặc biệt để đảm bảo không xử lý
          }, true, fileId);
          
          if (!result.success) {
            throw new Error(`Không thể tải file bị chặn: ${result.error}`);
          }
          
          // Kiểm tra nếu không phát hiện trang nào
          if (result.pageCount === 0 || !result.filePath || result.emptyFile) {
            throw new Error(`Không phát hiện trang nào trong file PDF. Chrome đã được giữ mở để debug. File ID: ${fileId}`);
          }
          
          // Lấy tên file gốc từ fileInfo nếu có
          let originalFileName;
          try {
            const fileInfoResponse = await drive.files.get({
              fileId: fileId,
              fields: 'name'
            });
            originalFileName = fileInfoResponse.data.name;
            console.log(`Tên file gốc từ Drive: ${originalFileName}`);
          } catch (nameError) {
            console.warn(`Không thể lấy tên file gốc: ${nameError.message}`);
            originalFileName = result.fileName || `file_${fileId}.pdf`;
          }
          
          // Thêm logo vào file PDF đã tải xuống
          try {
            console.log('Thêm logo vào file PDF đã tải xuống bằng Chrome (403 case)...');
            await addLogoToPDF(result.filePath, result.filePath);
            console.log('Đã thêm logo thành công vào file PDF đã tải xuống bằng Chrome (403 case)');
          } catch (logoError) {
            console.error(`Không thể thêm logo vào file PDF (403 case): ${logoError.message}`);
          }
          
          return {
            success: true,
            filePath: result.filePath,
            fileName: originalFileName, // Sử dụng tên file gốc
            mimeType: 'application/pdf',
            outputDir: blockedTempDir
          };
        } catch (blockError) {
          console.error(`Không thể tải file bị chặn: ${blockError.message}`);
          throw new Error(`Không có quyền truy cập file với ID: ${fileId}. Đã thử tải bằng Chrome nhưng không thành công: ${blockError.message}`);
        }
      }
      
      // Các lỗi khác
      throw error;
    }
    
    const fileName = fileInfo.data.name;
    const mimeType = fileInfo.data.mimeType;
    const outputPath = path.join(outputDir, fileName);
    
    console.log(`Tên file: ${fileName}`);
    console.log(`Loại MIME: ${mimeType}`);
    
    // Tải xuống file
    console.log(`Đang tải xuống file ${fileName}...`);
    
    try {
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
    } catch (downloadError) {
      if (downloadError.code === 403 || downloadError.response?.status === 403) {
        throw new Error('Không thể tải xuống file. Google Drive từ chối quyền truy cập. File có thể đã bị giới hạn bởi chủ sở hữu.');
      }
      throw downloadError;
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
async function processFile(filePath, mimeType, apiKey) {
  console.log(`Đang xử lý file: ${filePath}`);
  
  // Tạo đường dẫn cho file đã xử lý
  const fileDir = path.dirname(filePath);
  const fileExt = path.extname(filePath);
  const fileName = path.basename(filePath, fileExt);
  const processedPath = path.join(fileDir, `${fileName}_processed${fileExt}`);
  
  try {
    // Xác định loại file và áp dụng xử lý phù hợp
    if (mimeType.includes('pdf')) {
      // Xử lý file PDF - sử dụng API techhk.aoscdn.com để xóa watermark
      console.log('Đang xử lý file PDF với API xóa watermark...');
      
      // Lấy API key từ hệ thống quản lý API key
      // Nếu apiKey được truyền vào, sử dụng nó, nếu không, lấy key từ hệ thống
      const apiKeyToUse = apiKey || await getNextApiKey();
      
      if (!apiKeyToUse) {
        console.error('Không có API key khả dụng để xóa watermark');
        throw new Error('Không có API key khả dụng để xóa watermark');
      }
      
      console.log(`Sử dụng API key: ${apiKeyToUse.substring(0, 5)}... để xóa watermark`);
      
      // Kiểm tra kích thước file để cảnh báo nếu quá lớn
      const fileStats = fs.statSync(filePath);
      const fileSizeMB = fileStats.size / (1024 * 1024);
      if (fileSizeMB > 50) {
        console.log(`⚠️ Cảnh báo: File có kích thước lớn (${fileSizeMB.toFixed(2)} MB), quá trình xử lý có thể mất nhiều thời gian`);
        console.log(`Thời gian xử lý ước tính: ${Math.ceil(fileSizeMB * 15 / 60)} phút`);
      }
      
      // Gọi API xóa watermark
      let processingStartTime = Date.now();
      console.log(`Bắt đầu xử lý PDF lúc: ${new Date(processingStartTime).toLocaleTimeString()}`);
      
      try {
        await processPDFWatermark(filePath, processedPath, apiKeyToUse);
        console.log(`PDF đã được xử lý thành công với API xóa watermark sau ${Math.round((Date.now() - processingStartTime)/1000)} giây`);
      } catch (watermarkError) {
        // Kiểm tra nếu lỗi là do API key hết credit
        if (watermarkError.message.includes('API_KEY_NO_CREDIT') || 
            watermarkError.message.includes('hết credit') ||
            watermarkError.message.includes('401')) {
          
          console.log('Lỗi do API key hết credit, đang thử lại với key khác...');
          // Xóa key hiện tại
          if (apiKeyToUse) {
            removeApiKey(apiKeyToUse);
          }
          
          // Lấy key mới
          const newApiKey = await getNextApiKey();
          if (!newApiKey) {
            throw new Error('Không còn API key nào khả dụng sau khi xóa key hết credit');
          }
          
          console.log(`Thử lại với API key mới: ${newApiKey.substring(0, 5)}...`);
          await processPDFWatermark(filePath, processedPath, newApiKey);
          console.log(`PDF đã được xử lý thành công với API key mới sau ${Math.round((Date.now() - processingStartTime)/1000)} giây`);
        } else if (watermarkError.message.includes('timeout') || 
                  watermarkError.message.includes('Quá thời gian chờ')) {
          // Xử lý lỗi timeout
          console.log(`Lỗi timeout khi xử lý file lớn (${fileSizeMB.toFixed(2)} MB). Thử lại với timeout dài hơn...`);
          
          // Thử lại với timeout dài hơn
          await processPDFWatermark(filePath, processedPath, apiKeyToUse, 0);
          console.log(`PDF đã được xử lý thành công sau khi thử lại với timeout dài hơn (${Math.round((Date.now() - processingStartTime)/1000)} giây)`);
        } else {
          // Các lỗi khác
          throw watermarkError;
        }
      }
      
      // Xóa watermark dạng text ở header và footer và thêm logo
      await removeHeaderFooterWatermark(processedPath, processedPath);
      console.log(`Đã xóa watermark dạng text ở header và footer và thêm logo`);
    } else if (mimeType.includes('image')) {
      // Xử lý file hình ảnh - hiện tại chỉ sao chép
      console.log('Đang xử lý file hình ảnh...');
      fs.copyFileSync(filePath, processedPath);
    } else if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
      // Xử lý file bảng tính - hiện tại chỉ sao chép
      console.log('Đang xử lý file bảng tính...');
      fs.copyFileSync(filePath, processedPath);
    } else if (mimeType.includes('document') || mimeType.includes('word')) {
      // Xử lý file văn bản - hiện tại chỉ sao chép
      console.log('Đang xử lý file văn bản...');
      fs.copyFileSync(filePath, processedPath);
    } else if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
      // Xử lý file trình chiếu - hiện tại chỉ sao chép
      console.log('Đang xử lý file trình chiếu...');
      fs.copyFileSync(filePath, processedPath);
    } else if (mimeType.includes('video') || mimeType.includes('audio')) {
      // Xử lý file media - hiện tại chỉ sao chép
      console.log('Đang xử lý file media...');
      fs.copyFileSync(filePath, processedPath);
    } else {
      // Các loại file khác - chỉ sao chép
      console.log(`Không có xử lý đặc biệt cho loại file: ${mimeType}, thực hiện sao chép đơn giản`);
      fs.copyFileSync(filePath, processedPath);
    }
    
    console.log(`File đã được xử lý và lưu tại: ${processedPath}`);
    
    return {
      success: true,
      processedPath: processedPath
    };
  } catch (error) {
    console.error('Lỗi khi xử lý file:', error);
    throw new Error(`Không thể xử lý file: ${error.message}`);
  }
}

/**
 * Xóa watermark dạng text ở header và footer của PDF bằng cách cắt PDF và thêm logo
 * @param {string} inputPath - Đường dẫn đến file PDF cần xử lý
 * @param {string} outputPath - Đường dẫn lưu file PDF sau khi xử lý
 */
async function removeHeaderFooterWatermark(inputPath, outputPath) {
  try {
    // Sử dụng thư viện pdf-lib để đọc và xử lý PDF
    const { PDFDocument, rgb } = require('pdf-lib');
    
    // Đọc file PDF
    const pdfBytes = fs.readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // Đọc file logo
    const logoPath = path.join(process.cwd(), 'nen.png');
    const logoBytes = fs.readFileSync(logoPath);
    const logoImage = await pdfDoc.embedPng(logoBytes);
    const logoSize = logoImage.size();
    
    // Lấy số trang của PDF
    const pageCount = pdfDoc.getPageCount();
    console.log(`Số trang PDF: ${pageCount}`);
    
    // Xử lý từng trang PDF
    for (let i = 0; i < pageCount; i++) {
      const page = pdfDoc.getPage(i);
      const { width, height } = page.getSize();
      
      // Tính toán kích thước mới sau khi cắt header và footer
      const headerCut = height * 0.015; // Cắt 1% từ phía trên
      const footerCut = height * 0.015; // Cắt 1% từ phía dưới
      const newHeight = height - headerCut - footerCut;
      
      // Thiết lập CropBox mới để cắt header và footer
      page.setCropBox(0, footerCut, width, newHeight);
      
      // Thêm logo vào giữa trang với kích thước rất lớn
      const logoWidth = width * 0.8; // Logo chiếm 80% chiều rộng trang
      const logoHeight = (logoWidth / logoSize.width) * logoSize.height;
      const logoX = (width - logoWidth) / 2; // Căn giữa theo chiều ngang
      const logoY = (height - logoHeight) / 2; // Căn giữa theo chiều dọc
      
      page.drawImage(logoImage, {
        x: logoX,
        y: logoY,
        width: logoWidth,
        height: logoHeight,
        opacity: 0.15 // Độ mờ đục 15%
      });
    }
    
    // Lưu file PDF sau khi xử lý
    const modifiedPdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, modifiedPdfBytes);
    
    console.log(`Đã cắt header và footer của PDF và thêm logo: ${outputPath}`);
    return true;
  } catch (error) {
    console.error('Lỗi khi cắt header và footer và thêm logo:', error);
    throw new Error(`Không thể cắt header và footer và thêm logo: ${error.message}`);
  }
}

/**
 * Chỉ thêm logo vào PDF mà không cắt header và footer
 * Sử dụng cho file PDF đã được tải bằng Chrome (đã bị cắt sẵn)
 * @param {string} inputPath - Đường dẫn đến file PDF cần xử lý
 * @param {string} outputPath - Đường dẫn lưu file PDF sau khi xử lý
 */
async function addLogoToPDF(inputPath, outputPath) {
  try {
    // Sử dụng thư viện pdf-lib để đọc và xử lý PDF
    const { PDFDocument, rgb } = require('pdf-lib');
    
    // Đọc file PDF
    const pdfBytes = fs.readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // Đọc file logo
    const logoPath = path.join(process.cwd(), 'nen.png');
    const logoBytes = fs.readFileSync(logoPath);
    const logoImage = await pdfDoc.embedPng(logoBytes);
    const logoSize = logoImage.size();
    
    // Lấy số trang của PDF
    const pageCount = pdfDoc.getPageCount();
    console.log(`Số trang PDF (chỉ thêm logo): ${pageCount}`);
    
    // Xử lý từng trang PDF - chỉ thêm logo, không cắt
    for (let i = 0; i < pageCount; i++) {
      const page = pdfDoc.getPage(i);
      const { width, height } = page.getSize();
      
      // Thêm logo vào giữa trang với kích thước rất lớn
      const logoWidth = width * 0.8; // Logo chiếm 80% chiều rộng trang
      const logoHeight = (logoWidth / logoSize.width) * logoSize.height;
      const logoX = (width - logoWidth) / 2; // Căn giữa theo chiều ngang
      const logoY = (height - logoHeight) / 2; // Căn giữa theo chiều dọc
      
      page.drawImage(logoImage, {
        x: logoX,
        y: logoY,
        width: logoWidth,
        height: logoHeight,
        opacity: 0.15 // Độ mờ đục 15%
      });
    }
    
    // Lưu file PDF sau khi xử lý
    const modifiedPdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, modifiedPdfBytes);
    
    console.log(`Đã thêm logo vào PDF (không cắt): ${outputPath}`);
    return true;
  } catch (error) {
    console.error('Lỗi khi thêm logo vào PDF:', error);
    throw new Error(`Không thể thêm logo vào PDF: ${error.message}`);
  }
}

// Thêm các hàm cần thiết để xử lý watermark PDF
// Cấu hình API
const API_ENDPOINT = {
  CREATE_TASK: 'https://techhk.aoscdn.com/api/tasks/document/conversion',
  CHECK_STATUS: 'https://techhk.aoscdn.com/api/tasks/document/conversion/',
  CHECK_CREDITS: 'https://techhk.aoscdn.com/api/customers/coins'
};

// Thời gian tối đa chờ xử lý từ API (1800 giây = 30 phút)
const MAX_POLLING_TIME = 1800000;
// Khoảng thời gian giữa các lần kiểm tra trạng thái (15 giây)
const POLLING_INTERVAL = 15000;

/**
 * Tạo nhiệm vụ xóa watermark trên API bên ngoài
 * @param {string} filePath - Đường dẫn đến file PDF cần xử lý
 * @param {string} apiKey - API key cho dịch vụ
 * @returns {Promise<string>} - Task ID
 */
async function createWatermarkRemovalTask(filePath, apiKey) {
  const form = new FormData();
  form.append('format', 'doc-repair');
  form.append('file', fs.createReadStream(filePath));
  
  try {
    // Kiểm tra kích thước file
    const fileStats = fs.statSync(filePath);
    const fileSizeMB = fileStats.size / (1024 * 1024);
    
    // Tính toán timeout dựa trên kích thước file
    // - Tối thiểu 180 giây (3 phút)
    // - Thêm 120 giây (2 phút) cho mỗi 10MB
    // - Cho file lớn (>50MB), thêm 180 giây (3 phút) cho mỗi 10MB
    let dynamicTimeout;
    if (fileSizeMB > 50) {
      dynamicTimeout = Math.max(180000, 180000 * Math.ceil(fileSizeMB / 10));
    } else {
      dynamicTimeout = Math.max(180000, 120000 * Math.ceil(fileSizeMB / 10));
    }
    
    console.log(`Kích thước file: ${fileSizeMB.toFixed(2)} MB, đặt timeout: ${dynamicTimeout/1000} giây`);
    
    const response = await axios.post(API_ENDPOINT.CREATE_TASK, form, {
      headers: {
        ...form.getHeaders(),
        'X-API-KEY': apiKey
      },
      timeout: dynamicTimeout // Timeout động dựa trên kích thước file
    });
    
    if (response.data?.status === 200 && response.data?.data?.task_id) {
      return response.data.data.task_id;
    } else {
      throw new Error(`Lỗi khi tạo nhiệm vụ: ${response.data?.message || 'Không xác định'}`);
    }
  } catch (error) {
    // Kiểm tra lỗi 401 (hết credit)
    if (error.response?.status === 401 || 
        (error.response?.data?.message && (
          error.response.data.message.includes('quota') || 
          error.response.data.message.includes('credit') ||
          error.response.data.message.includes('coins')))) {
      console.log(`API key ${apiKey.substring(0, 5)}... đã hết credit hoặc không hợp lệ (lỗi 401)`);
      throw new Error('API_KEY_NO_CREDIT');
    }
    
    console.log(`Lỗi API khi tạo nhiệm vụ: ${error.message}`);
    throw new Error(`Lỗi API: ${error.message}`);
  }
}

/**
 * Kiểm tra trạng thái của nhiệm vụ
 * @param {string} taskId - ID của nhiệm vụ 
 * @param {string} apiKey - API key
 */
async function checkTaskStatus(taskId, apiKey) {
  try {
    const response = await axios.get(`${API_ENDPOINT.CHECK_STATUS}${taskId}`, {
      headers: {
        'X-API-KEY': apiKey
      },
      timeout: 300000 // 300 giây timeout (5 phút)
    });
    
    if (response.data?.status === 200) {
      return response.data.data;
    } else {
      throw new Error(`Lỗi khi kiểm tra trạng thái: ${response.data?.message || 'Không xác định'}`);
    }
  } catch (error) {
    // Kiểm tra lỗi 401 (hết credit)
    if (error.response?.status === 401 || 
        (error.response?.data?.message && (
          error.response.data.message.includes('quota') || 
          error.response.data.message.includes('credit') ||
          error.response.data.message.includes('coins')))) {
      console.log(`API key ${apiKey.substring(0, 5)}... đã hết credit hoặc không hợp lệ (lỗi 401)`);
      throw new Error('API_KEY_NO_CREDIT');
    }
    
    console.log(`Lỗi API khi kiểm tra trạng thái: ${error.message}`);
    throw new Error(`Lỗi API: ${error.message}`);
  }
}

/**
 * Kiểm tra trạng thái và chờ cho đến khi hoàn thành
 * @param {string} taskId - ID của nhiệm vụ
 * @param {string} apiKey - API key 
 * @param {number} startTime - Thời gian bắt đầu kiểm tra
 * @param {number} retryCount - Số lần đã thử lại (mặc định là 0)
 * @param {number} fileSizeMB - Kích thước file tính bằng MB (để điều chỉnh thời gian chờ)
 * @param {number} lastProgressUpdate - Thời gian của lần cập nhật tiến độ gần nhất
 * @param {number} lastProgress - Giá trị tiến độ gần nhất
 * @param {number} stuckCounter - Số lần tiến độ không thay đổi (mặc định là 0)
 */
async function pollTaskStatus(taskId, apiKey, startTime = Date.now(), retryCount = 0, fileSizeMB = 0, lastProgressUpdate = 0, lastProgress = 0, stuckCounter = 0) {
  // Tính toán thời gian chờ tối đa dựa trên kích thước file
  let maxPollingTime;
  if (fileSizeMB > 50) {
    // File rất lớn (>50MB): 30 giây cho mỗi MB
    maxPollingTime = Math.max(MAX_POLLING_TIME, fileSizeMB * 30000);
  } else if (fileSizeMB > 10) {
    // File lớn (>10MB): 25 giây cho mỗi MB
    maxPollingTime = Math.max(MAX_POLLING_TIME, fileSizeMB * 25000);
  } else {
    // File nhỏ: Sử dụng thời gian mặc định
    maxPollingTime = MAX_POLLING_TIME;
  }
  
  // Hiển thị thông tin về thời gian đã chờ
  const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
  const maxWaitSeconds = Math.round(maxPollingTime / 1000);
  
  // Kiểm tra nếu đã quá thời gian chờ
  if (Date.now() - startTime > maxPollingTime) {
    // Nếu chưa thử lại quá nhiều lần và chưa quá thời gian chờ quá nhiều
    if (retryCount < 5 && Date.now() - startTime < maxPollingTime * 1.5) {
      console.log(`Đã quá thời gian chờ xử lý từ API (${elapsedSeconds} giây / tối đa ${maxWaitSeconds} giây), thử lại lần ${retryCount + 1}...`);
      // Thử lại một lần nữa với thời gian bắt đầu mới
      return pollTaskStatus(taskId, apiKey, Date.now(), retryCount + 1, fileSizeMB, 0, lastProgress, 0);
    }
    throw new Error(`Quá thời gian chờ xử lý từ API (${elapsedSeconds} giây / tối đa ${maxWaitSeconds} giây)`);
  }
  
  let status;
  try {
    // Kiểm tra trạng thái
    status = await checkTaskStatus(taskId, apiKey);
    
    // Các mã trạng thái:
    // state < 0: Lỗi
    // state = 0: Đang xếp hàng
    // state = 1: Hoàn thành
    // state = 2-5: Đang xử lý
    if (status.state === 1) {
      // Hoàn thành
      console.log(`✅ Xử lý hoàn tất sau ${elapsedSeconds} giây`);
      return status;
    } else if (status.state < 0) {
      // Xử lý lỗi
      const errorMessages = {
        '-8': 'Xử lý vượt quá thời gian cho phép',
        '-7': 'File không hợp lệ',
        '-6': 'Mật khẩu không đúng',
        '-5': 'File vượt quá kích thước cho phép',
        '-4': 'Không thể gửi nhiệm vụ',
        '-3': 'Không thể tải xuống file',
        '-2': 'Không thể tải file lên',
        '-1': 'Xử lý thất bại'
      };
      
      throw new Error(`Xử lý thất bại: ${errorMessages[status.state] || 'Lỗi không xác định'}`);
    } else {
      // Đang xử lý hoặc đang xếp hàng
      const now = Date.now();
      const progressChanged = status.progress !== lastProgress;
      const timeSinceLastUpdate = now - lastProgressUpdate;
      
      // Kiểm tra xem tiến độ có bị kẹt không
      let newStuckCounter = stuckCounter;
      if (status.progress === lastProgress && lastProgress > 0) {
        newStuckCounter++;
        
        // Nếu tiến độ bị kẹt ở 21% quá lâu (khoảng 3 phút), thử khởi động lại
        if (status.progress === 21 && newStuckCounter >= 12) {
          console.log(`⚠️ Phát hiện tiến độ bị kẹt ở 21% trong ${Math.round(newStuckCounter * POLLING_INTERVAL / 1000)} giây. Thử khởi động lại quá trình...`);
          throw new Error('PROGRESS_STUCK_AT_21');
        }
        
        // Nếu tiến độ không thay đổi quá lâu (khoảng 10 phút), thử khởi động lại
        if (newStuckCounter >= 40) {
          console.log(`⚠️ Phát hiện tiến độ bị kẹt ở ${status.progress}% trong ${Math.round(newStuckCounter * POLLING_INTERVAL / 1000)} giây. Thử khởi động lại quá trình...`);
          throw new Error('PROGRESS_STUCK');
        }
      } else if (progressChanged) {
        // Nếu tiến độ thay đổi, đặt lại bộ đếm
        newStuckCounter = 0;
      }
      
      // Hiển thị tiến độ nếu có và chỉ khi có thay đổi hoặc đã qua 10 giây
      if (status.progress && (progressChanged || timeSinceLastUpdate > 10000)) {
        // Tính toán thời gian dự kiến còn lại dựa trên tiến độ
        if (status.progress > 0 && status.progress < 100) {
          const percentComplete = status.progress;
          const timeElapsed = now - startTime;
          const estimatedTotalTime = timeElapsed / (percentComplete / 100);
          const estimatedTimeRemaining = estimatedTotalTime - timeElapsed;
          
          console.log(`Tiến độ xử lý: ${status.progress}% - Đã chạy: ${Math.round(timeElapsed/1000)} giây - Còn lại ước tính: ${Math.round(estimatedTimeRemaining/1000)} giây`);
        } else {
          console.log(`Tiến độ xử lý: ${status.progress}% - Đã chạy: ${elapsedSeconds} giây`);
        }
        
        // Cập nhật thời gian và giá trị tiến độ gần nhất
        return pollTaskStatus(taskId, apiKey, startTime, retryCount, fileSizeMB, now, status.progress, newStuckCounter);
      } else if (status.state === 0) {
        // Đang xếp hàng
        if (timeSinceLastUpdate > 15000) { // Hiển thị thông báo mỗi 15 giây
          console.log(`⏳ Đang xếp hàng... (đã chờ ${elapsedSeconds} giây)`);
          return pollTaskStatus(taskId, apiKey, startTime, retryCount, fileSizeMB, now, lastProgress, newStuckCounter);
        }
      } else if (status.state >= 2 && status.state <= 5) {
        // Đang xử lý, không có thông tin tiến độ
        if (timeSinceLastUpdate > 15000) { // Hiển thị thông báo mỗi 15 giây
          console.log(`⚙️ Đang xử lý... (trạng thái: ${status.state}, đã chờ ${elapsedSeconds} giây)`);
          return pollTaskStatus(taskId, apiKey, startTime, retryCount, fileSizeMB, now, lastProgress, newStuckCounter);
        }
      }
    }
  } catch (error) {
    // Kiểm tra lỗi tiến độ bị kẹt
    if (error.message === 'PROGRESS_STUCK_AT_21' || error.message === 'PROGRESS_STUCK') {
      if (retryCount < 5) {
        console.log(`⚠️ Tiến độ bị kẹt, thử lại lần ${retryCount + 1}... (đã chờ ${elapsedSeconds} giây)`);
        // Chờ một khoảng thời gian dài hơn trước khi thử lại
        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL * 3));
        return pollTaskStatus(taskId, apiKey, Date.now(), retryCount + 1, fileSizeMB, 0, 0, 0);
      } else {
        throw new Error(`Tiến độ bị kẹt quá nhiều lần sau ${elapsedSeconds} giây, không thể tiếp tục xử lý`);
      }
    }
    
    // Nếu lỗi là timeout và chưa thử lại quá nhiều lần
    if ((error.message.includes('timeout') || error.code === 'ETIMEDOUT') && retryCount < 5) {
      console.log(`⏱️ Lỗi timeout khi kiểm tra trạng thái, thử lại lần ${retryCount + 1}...`);
      // Chờ một khoảng thời gian trước khi thử lại (tăng theo số lần thử)
      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL * (retryCount + 2)));
      return pollTaskStatus(taskId, apiKey, startTime, retryCount + 1, fileSizeMB, lastProgressUpdate, lastProgress, stuckCounter);
    }
    throw error;
  }
  
  // Chờ một khoảng thời gian trước khi kiểm tra lại
  await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
  // Gọi đệ quy với các tham số đã cập nhật
  return pollTaskStatus(taskId, apiKey, startTime, retryCount, fileSizeMB, lastProgressUpdate, lastProgress, stuckCounter);
}

/**
 * Tải xuống file đã xử lý
 * @param {string} fileUrl - URL của file cần tải xuống
 * @param {string} outputPath - Đường dẫn lưu file
 */
async function downloadProcessedFile(fileUrl, outputPath) {
  try {
    const response = await axios({
      method: 'GET',
      url: fileUrl,
      responseType: 'stream',
      timeout: 600000 // 600 giây (10 phút) timeout cho tải xuống
    });
    
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  } catch (error) {
    throw new Error(`Lỗi khi tải file: ${error.message}`);
  }
}

/**
 * Xử lý file PDF để xóa watermark
 * @param {string} filePath - Đường dẫn đến file cần xử lý
 * @param {string} outputPath - Đường dẫn lưu file đã xử lý
 * @param {string} apiKey - API key
 * @param {number} retryCount - Số lần đã thử lại (mặc định là 0)
 * @param {boolean} useSimpleMethod - Sử dụng phương pháp đơn giản nếu phương pháp API không hoạt động
 */
async function processPDFWatermark(filePath, outputPath, apiKey, retryCount = 0, useSimpleMethod = false) {
  try {
    // Nếu được yêu cầu sử dụng phương pháp đơn giản hoặc đã thử lại quá nhiều lần
    if (useSimpleMethod || retryCount >= 5) {
      console.log(`⚠️ Sử dụng phương pháp đơn giản để xử lý file PDF (bỏ qua API xóa watermark)`);
      
      // Sao chép file và chỉ thêm logo
      fs.copyFileSync(filePath, outputPath);
      
      // Thêm logo vào file PDF
      await removeHeaderFooterWatermark(outputPath, outputPath);
      console.log(`✅ Đã xử lý file bằng phương pháp đơn giản (chỉ thêm logo)`);
      
      return {
        inputSize: fs.statSync(filePath).size,
        outputSize: fs.statSync(outputPath).size,
        pages: 0,
        simpleMethod: true
      };
    }
    
    // Kiểm tra kích thước file
    const fileStats = fs.statSync(filePath);
    const fileSizeMB = fileStats.size / (1024 * 1024);
    console.log(`Xử lý file PDF có kích thước: ${fileSizeMB.toFixed(2)} MB`);
    
    // Nếu file quá lớn, hiển thị cảnh báo
    if (fileSizeMB > 100) {
      console.log(`⚠️ Cảnh báo: File rất lớn (${fileSizeMB.toFixed(2)} MB), quá trình xử lý có thể mất rất nhiều thời gian`);
      console.log(`Thời gian xử lý ước tính: ${Math.ceil(fileSizeMB * 15 / 60)} phút hoặc lâu hơn`);
    }
    
    // Tạo nhiệm vụ xử lý
    let taskId;
    try {
      taskId = await createWatermarkRemovalTask(filePath, apiKey);
      console.log(`✅ Đã tạo nhiệm vụ xử lý với ID: ${taskId}`);
    } catch (createTaskError) {
      // Kiểm tra lỗi API_KEY_NO_CREDIT đặc biệt
      if (createTaskError.message === 'API_KEY_NO_CREDIT' || 
          createTaskError.message.includes('401') || 
          createTaskError.message.includes('credit') || 
          createTaskError.message.includes('quota')) {
        
        console.log(`❌ API key ${apiKey.substring(0, 5)}... đã hết credit. Xóa và thử key khác...`);
        
        // Xóa API key hiện tại
        removeApiKey(apiKey);
        
        // Lấy API key mới
        const newApiKey = await getNextApiKey();
        if (newApiKey) {
          console.log(`🔄 Thử lại với API key mới: ${newApiKey.substring(0, 5)}...`);
          return processPDFWatermark(filePath, outputPath, newApiKey, 0, useSimpleMethod);
        } else {
          throw new Error('Không còn API key nào khả dụng sau khi xóa key hết credit');
        }
      }
      
      // Nếu lỗi là timeout và chưa thử lại quá nhiều lần
      if ((createTaskError.message.includes('timeout') || createTaskError.code === 'ETIMEDOUT') && retryCount < 5) {
        console.log(`⏱️ Lỗi timeout khi tạo nhiệm vụ, thử lại lần ${retryCount + 1}...`);
        // Chờ một khoảng thời gian trước khi thử lại (tăng theo số lần thử)
        await new Promise(resolve => setTimeout(resolve, 10000 * (retryCount + 1)));
        return processPDFWatermark(filePath, outputPath, apiKey, retryCount + 1, useSimpleMethod);
      }
      
      throw createTaskError;
    }
    
    // Chờ và kiểm tra kết quả
    let result;
    try {
      result = await pollTaskStatus(taskId, apiKey, Date.now(), 0, fileSizeMB);
      console.log(`✅ Xử lý hoàn tất. Kích thước file đầu vào: ${result.input_size} bytes, đầu ra: ${result.output_size} bytes`);
    } catch (pollError) {
      // Kiểm tra lỗi tiến độ bị kẹt ở 21%
      if (pollError.message === 'PROGRESS_STUCK_AT_21') {
        console.log(`⚠️ Phát hiện tiến độ bị kẹt ở 21%. Chuyển sang phương pháp đơn giản...`);
        return processPDFWatermark(filePath, outputPath, apiKey, retryCount, true);
      }
      
      // Kiểm tra lỗi tiến độ bị kẹt
      if (pollError.message === 'PROGRESS_STUCK' || 
          pollError.message.includes('Tiến độ bị kẹt')) {
        
        console.log(`⚠️ Phát hiện tiến độ bị kẹt. Thử lại với API key khác...`);
        
        // Nếu chưa thử lại quá nhiều lần
        if (retryCount < 3) {
          // Lấy API key mới
          const newApiKey = await getNextApiKey();
          if (newApiKey && newApiKey !== apiKey) {
            console.log(`🔄 Thử lại với API key mới: ${newApiKey.substring(0, 5)}...`);
            return processPDFWatermark(filePath, outputPath, newApiKey, retryCount + 1, useSimpleMethod);
          }
        }
        
        // Nếu không có key mới hoặc đã thử lại quá nhiều lần, thử lại với cùng key
        console.log(`🔄 Thử lại với cùng API key: ${apiKey.substring(0, 5)}...`);
        return processPDFWatermark(filePath, outputPath, apiKey, retryCount + 1, useSimpleMethod);
      }
      
      // Kiểm tra lỗi API_KEY_NO_CREDIT đặc biệt
      if (pollError.message === 'API_KEY_NO_CREDIT' || 
          pollError.message.includes('401') || 
          pollError.message.includes('credit') || 
          pollError.message.includes('quota')) {
        
        console.log(`❌ API key ${apiKey.substring(0, 5)}... đã hết credit trong quá trình kiểm tra. Xóa và thử key khác...`);
        
        // Xóa API key hiện tại
        removeApiKey(apiKey);
        
        // Lấy API key mới
        const newApiKey = await getNextApiKey();
        if (newApiKey) {
          console.log(`🔄 Thử lại với API key mới: ${newApiKey.substring(0, 5)}...`);
          return processPDFWatermark(filePath, outputPath, newApiKey, 0, useSimpleMethod);
        } else {
          throw new Error('Không còn API key nào khả dụng sau khi xóa key hết credit');
        }
      }
      
      // Kiểm tra lỗi timeout
      if ((pollError.message.includes('timeout') || 
           pollError.message.includes('Quá thời gian chờ') || 
           pollError.code === 'ETIMEDOUT') && 
          retryCount < 5) {
        console.log(`⏱️ Lỗi timeout khi kiểm tra trạng thái, thử lại lần ${retryCount + 1}...`);
        // Chờ một khoảng thời gian trước khi thử lại (tăng theo số lần thử)
        await new Promise(resolve => setTimeout(resolve, 10000 * (retryCount + 1)));
        return processPDFWatermark(filePath, outputPath, apiKey, retryCount + 1, useSimpleMethod);
      }
      
      throw pollError;
    }
    
    // Tải xuống file đã xử lý
    try {
      await downloadProcessedFile(result.file, outputPath);
      console.log(`📥 Đã tải file đã xử lý về ${outputPath}`);
    } catch (downloadError) {
      // Kiểm tra lỗi timeout
      if ((downloadError.message.includes('timeout') || downloadError.code === 'ETIMEDOUT') && retryCount < 5) {
        console.log(`⏱️ Lỗi timeout khi tải xuống file, thử lại lần ${retryCount + 1}...`);
        // Chờ một khoảng thời gian trước khi thử lại (tăng theo số lần thử)
        await new Promise(resolve => setTimeout(resolve, 10000 * (retryCount + 1)));
        
        // Thử tải lại file
        await downloadProcessedFile(result.file, outputPath);
        console.log(`📥 Đã tải file đã xử lý về ${outputPath} sau khi thử lại`);
      } else {
        throw downloadError;
      }
    }
    
    return {
      inputSize: result.input_size,
      outputSize: result.output_size,
      pages: result.file_pages || 0
    };
  } catch (error) {
    // Nếu đã thử nhiều lần mà vẫn thất bại, sử dụng phương pháp đơn giản
    if (retryCount >= 4 && !useSimpleMethod) {
      console.log(`⚠️ Đã thử lại ${retryCount} lần không thành công. Chuyển sang phương pháp đơn giản...`);
      return processPDFWatermark(filePath, outputPath, apiKey, 0, true);
    }
    
    // Kiểm tra lỗi API_KEY_NO_CREDIT đặc biệt
    if (error.message === 'API_KEY_NO_CREDIT') {
      console.log(`❌ API key ${apiKey.substring(0, 5)}... đã hết credit. Xóa và thử key khác...`);
      
      // Xóa API key hiện tại
      removeApiKey(apiKey);
      
      // Lấy API key mới
      const newApiKey = await getNextApiKey();
      if (newApiKey) {
        console.log(`🔄 Thử lại với API key mới: ${newApiKey.substring(0, 5)}...`);
        return processPDFWatermark(filePath, outputPath, newApiKey, 0, useSimpleMethod);
      } else {
        throw new Error('Không còn API key nào khả dụng sau khi xóa key hết credit');
      }
    }
    
    // Kiểm tra lỗi timeout
    if ((error.message.includes('timeout') || 
         error.message.includes('Quá thời gian chờ') || 
         error.code === 'ETIMEDOUT') && 
        retryCount < 5) {
      console.log(`⏱️ Lỗi timeout khi xử lý PDF, thử lại lần ${retryCount + 1}...`);
      // Chờ một khoảng thời gian trước khi thử lại (tăng thời gian chờ theo số lần thử)
      await new Promise(resolve => setTimeout(resolve, 10000 * (retryCount + 1)));
      return processPDFWatermark(filePath, outputPath, apiKey, retryCount + 1, useSimpleMethod);
    }
    
    // Kiểm tra lỗi 401 (hết credit) từ các lỗi khác
    if (error.message.includes('401') || error.message.includes('quota') || 
        error.message.includes('credit') || error.message.includes('coins')) {
      console.log(`❌ API key ${apiKey.substring(0, 5)}... có thể đã hết credit. Xóa và thử key khác...`);
      
      // Xóa API key hiện tại
      removeApiKey(apiKey);
      
      // Lấy API key mới
      const newApiKey = await getNextApiKey();
      if (newApiKey) {
        console.log(`🔄 Thử lại với API key mới: ${newApiKey.substring(0, 5)}...`);
        return processPDFWatermark(filePath, outputPath, newApiKey, 0, useSimpleMethod);
      } else {
        throw new Error('Không còn API key nào khả dụng sau khi xóa key hết credit');
      }
    }
    
    throw new Error(`Lỗi khi xử lý PDF: ${error.message}`);
  }
}

// Tải lên file đã xử lý lên Google Drive
async function uploadToGoogleDrive(filePath, fileName, mimeType, folderId = null) {
  console.log(`Đang tải lên file đã xử lý: ${filePath}`);
  
  try {
    // Kiểm tra file có tồn tại không
    if (!fs.existsSync(filePath)) {
      console.error(`Lỗi: File không tồn tại tại đường dẫn ${filePath}`);
      throw new Error(`File không tồn tại tại đường dẫn ${filePath}`);
    }
    
    // Kiểm tra kích thước file
    const stats = fs.statSync(filePath);
    const fileSizeInBytes = stats.size;
    const fileSizeInMB = fileSizeInBytes / (1024 * 1024);
    console.log(`Kích thước file: ${fileSizeInBytes} bytes (${fileSizeInMB.toFixed(2)} MB)`);
    
    if (fileSizeInMB > 100) {
      console.warn(`Cảnh báo: File có kích thước lớn (${fileSizeInMB.toFixed(2)} MB), có thể gặp vấn đề khi tải lên`);
    }
    
    // Kiểm tra tên file có ký tự đặc biệt không
    console.log(`Tên file gốc: "${fileName}"`);
    
    // Xóa trùng đuôi file (ví dụ: .pdf.pdf hoặc .pdf.pdf.pdf)
    let sanitizedFileName = fileName;
    
    // Tìm tất cả các đuôi file trong tên
    const extensionMatch = fileName.match(/(\.[a-zA-Z0-9]+)(\1+)$/);
    if (extensionMatch) {
      // Nếu có đuôi file trùng lặp, chỉ giữ lại một đuôi
      const duplicateExtension = extensionMatch[0];
      const singleExtension = extensionMatch[1];
      sanitizedFileName = fileName.replace(duplicateExtension, singleExtension);
      console.log(`Đã xóa đuôi file trùng lặp: "${duplicateExtension}" -> "${singleExtension}"`);
    }
    
    console.log(`Tên file sau khi làm sạch: "${sanitizedFileName}"`);
    
    // Tạo OAuth2 client với khả năng tự động refresh token
    const oauth2Client = createOAuth2Client(0); // Sử dụng token tải lên (index 0)
    console.log('Sử dụng token tải lên (drive_token_upload.json)');
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Kiểm tra token
    try {
      console.log('Kiểm tra token...');
      const aboutResponse = await drive.about.get({
        fields: 'user'
      });
      console.log(`Token hợp lệ, người dùng: ${aboutResponse.data.user.emailAddress || 'không có email'}`);
    } catch (tokenError) {
      console.error('Lỗi khi kiểm tra token:', tokenError);
      throw new Error(`Token không hợp lệ hoặc đã hết hạn: ${tokenError.message}`);
    }
    
    console.log('Kiểm tra quyền truy cập Drive...');
    
    // Folder mặc định nếu không có folderId
    const defaultFolderId = "1Lt10aHyWp9VtPaImzInE0DmIcbrjJgpN"; // ID của folder mới
    
    // Xác định folder ID sẽ sử dụng
    let targetFolderId = null;
    let folderExists = false;
    let folderName = "";
    
    // Kiểm tra folder được chỉ định
    if (folderId) {
      try {
        console.log(`Kiểm tra folder ID: ${folderId}`);
        const folderResponse = await drive.files.get({
          fileId: folderId,
          fields: 'id,name,mimeType'
        });
        
        // Kiểm tra xem đây có phải là folder không
        if (folderResponse.data.mimeType === 'application/vnd.google-apps.folder') {
          targetFolderId = folderId;
          folderExists = true;
          folderName = folderResponse.data.name;
          console.log(`Folder tồn tại, sẽ sử dụng folder ID: ${targetFolderId} (${folderName})`);
        } else {
          console.warn(`ID ${folderId} không phải là folder, đó là: ${folderResponse.data.mimeType}`);
        }
      } catch (folderError) {
        if (folderError.code === 404 || folderError.response?.status === 404) {
          console.log(`Folder ID ${folderId} không tồn tại.`);
        } else {
          console.error(`Lỗi khi kiểm tra folder ${folderId}:`, folderError.message);
        }
      }
    }
    
    // Nếu folder không tồn tại hoặc không phải là folder, thử dùng folder mặc định
    if (!folderExists) {
      try {
        console.log(`Kiểm tra folder mặc định: ${defaultFolderId}`);
        const defaultFolderResponse = await drive.files.get({
          fileId: defaultFolderId,
          fields: 'id,name,mimeType'
        });
        
        if (defaultFolderResponse.data.mimeType === 'application/vnd.google-apps.folder') {
          targetFolderId = defaultFolderId;
          folderExists = true;
          folderName = defaultFolderResponse.data.name;
          console.log(`Sử dụng folder mặc định: ${targetFolderId} (${folderName})`);
        } else {
          console.warn(`ID mặc định ${defaultFolderId} không phải là folder`);
        }
      } catch (defaultFolderError) {
        console.error(`Lỗi khi kiểm tra folder mặc định:`, defaultFolderError.message);
      }
    }
    
    // Nếu cả hai folder đều không tồn tại, tạo folder mới
    if (!folderExists) {
      try {
        const folderDate = new Date().toISOString().split('T')[0];
        const newFolderName = `Processed Files ${folderDate}`;
        console.log(`Không tìm thấy folder hợp lệ, tạo folder mới: ${newFolderName}`);
        
        const newFolder = await drive.files.create({
          requestBody: {
            name: newFolderName,
            mimeType: 'application/vnd.google-apps.folder'
          },
          fields: 'id,name'
        });
        
        targetFolderId = newFolder.data.id;
        folderExists = true;
        folderName = newFolder.data.name;
        console.log(`Đã tạo folder mới: ${targetFolderId} (${folderName})`);
      } catch (createFolderError) {
        console.error('Lỗi khi tạo folder mới:', createFolderError);
        throw new Error(`Không thể tạo folder: ${createFolderError.message}`);
      }
    }
    
    // Kiểm tra xem đã có folder ID hợp lệ chưa
    if (!targetFolderId) {
      throw new Error('Không thể xác định folder để tải lên file');
    }
    
    console.log(`Folder đích: ${folderName} (${targetFolderId})`);
    
    // Sử dụng tên file đã làm sạch mà không thêm timestamp
    const processedFileName = sanitizedFileName;
    
    console.log(`Tên file cuối cùng sẽ tải lên: "${processedFileName}"`);
    
    // Kiểm tra MIME type
    if (!mimeType) {
      console.warn('MIME type không được cung cấp, sử dụng application/octet-stream');
      mimeType = 'application/octet-stream';
    }
    console.log(`MIME type: ${mimeType}`);
    
    // Tạo metadata cho file
    const fileMetadata = {
      name: processedFileName,
      parents: [targetFolderId]
    };
    
    console.log(`Tải lên vào folder: ${targetFolderId}`);
    console.log(`Metadata file:`, JSON.stringify(fileMetadata, null, 2));
    
    // Tạo media cho file
    let fileStream;
    try {
      fileStream = fs.createReadStream(filePath);
      console.log('Đã tạo stream đọc file thành công');
      
      // Kiểm tra stream
      fileStream.on('error', (streamError) => {
        console.error('Lỗi khi đọc file stream:', streamError);
      });
    } catch (streamError) {
      console.error('Lỗi khi tạo stream đọc file:', streamError);
      throw new Error(`Không thể đọc file: ${streamError.message}`);
    }
    
    // Tải lên file
    console.log('Đang tải lên file...', {
      fileName: fileMetadata.name,
      mimeType: mimeType,
      folderId: targetFolderId
    });
    
    try {
      console.log('Bắt đầu quá trình tải lên...');
      
      // Thử tải lên với simple upload
      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: {
          mimeType: mimeType,
          body: fileStream
        },
        fields: 'id,name,webViewLink',
        supportsAllDrives: true
      });
      
      console.log('File đã được tải lên thành công!');
      console.log(`ID: ${response.data.id}`);
      console.log(`Tên: ${response.data.name}`);
      console.log(`Link: ${response.data.webViewLink}`);
      
      return {
        success: true,
        fileId: response.data.id,
        fileName: response.data.name,
        webViewLink: response.data.webViewLink,
        duplicatesDeleted: 0
      };
    } catch (uploadError) {
      console.error('Lỗi chi tiết khi tải lên file:', JSON.stringify({
        message: uploadError.message,
        code: uploadError.code,
        errors: uploadError.errors,
        response: uploadError.response?.data
      }, null, 2));
      
      // Thử phương án thay thế với tên file đơn giản
      try {
        console.log('Thử phương án thay thế với tên file đơn giản...');
        
        // Tạo tên file đơn giản không có ký tự đặc biệt
        const fileExt = mimeType.split('/')[1] || 'bin';
        const simpleFileName = `file_${Date.now()}.${fileExt}`;
        console.log(`Tên file đơn giản: ${simpleFileName}`);
        
        // Tạo metadata đơn giản
        const simpleMetadata = {
          name: simpleFileName,
          parents: [targetFolderId]
        };
        
        // Tạo stream đọc file mới
        const newFileStream = fs.createReadStream(filePath);
        
        // Thử tải lên với cấu hình tối giản
        const simpleResponse = await drive.files.create({
          requestBody: simpleMetadata,
          media: {
            mimeType: mimeType,
            body: newFileStream
          },
          fields: 'id,name,webViewLink'
        });
        
        console.log('File đã được tải lên thành công với tên đơn giản!');
        console.log(`ID: ${simpleResponse.data.id}`);
        console.log(`Tên: ${simpleResponse.data.name}`);
        console.log(`Link: ${simpleResponse.data.webViewLink}`);
        
        return {
          success: true,
          fileId: simpleResponse.data.id,
          fileName: simpleResponse.data.name,
          webViewLink: simpleResponse.data.webViewLink,
          duplicatesDeleted: 0
        };
      } catch (fallbackError) {
        console.error('Lỗi khi thử phương án thay thế:', fallbackError);
        
        // Thử phương án cuối cùng: sử dụng resumable upload
        try {
          console.log('Thử phương án cuối cùng với resumable upload...');
          
          const finalFileName = `backup_${Date.now()}.${mimeType.split('/')[1] || 'bin'}`;
          const finalMetadata = {
            name: finalFileName,
            parents: [targetFolderId]
          };
          
          // Sử dụng resumable upload
          const finalResponse = await drive.files.create({
            requestBody: finalMetadata,
            media: {
              mimeType: mimeType,
              body: fs.createReadStream(filePath) // Tạo stream mới
            },
            fields: 'id,name,webViewLink',
            uploadType: 'resumable'
          });
          
          console.log('File đã được tải lên thành công với phương án cuối cùng!');
          return {
            success: true,
            fileId: finalResponse.data.id,
            fileName: finalResponse.data.name,
            webViewLink: finalResponse.data.webViewLink,
            duplicatesDeleted: 0
          };
        } catch (finalError) {
          console.error('Tất cả các phương án tải lên đều thất bại:', finalError);
          throw new Error(`Không thể tải lên file: ${finalError.message}`);
        }
      }
    }
  } catch (error) {
    console.error('Lỗi khi tải lên file lên Google Drive:', error);
    throw error;
  }
}

// API Endpoint - POST
export async function POST(request) {
  console.log('============== BẮT ĐẦU API XỬ LÝ VÀ THAY THẾ FILE GOOGLE DRIVE ==============');
  
  let tempDir = null;
  // Đặt timeout cho toàn bộ quá trình (60 phút)
  const GLOBAL_TIMEOUT = 60 * 60 * 1000;
  const startTime = Date.now();
  
  // Tạo promise với timeout
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Quá trình xử lý vượt quá thời gian cho phép (${GLOBAL_TIMEOUT / 60000} phút)`));
    }, GLOBAL_TIMEOUT);
  });
  
  try {
    // Parse request body
    const requestBody = await request.json();
    const { driveLink, folderId, apiKey } = requestBody;
    
    console.log('Thông tin request:', {
      driveLink: driveLink || 'không có',
      folderId: folderId || 'sẽ dùng folder mặc định "1Lt10aHyWp9VtPaImzInE0DmIcbrjJgpN"',
      apiKey: apiKey ? 'Đã cung cấp' : 'Sử dụng từ hệ thống quản lý API key'
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
    
    // Tạo promise cho quá trình xử lý
    const processingPromise = (async () => {
      let downloadResult;
      try {
        downloadResult = await downloadFromGoogleDrive(fileId);
        tempDir = downloadResult.outputDir;
        
        let processedFilePath;
        let processedFileName = downloadResult.fileName;
        
        // Kiểm tra xem file có phải là file bị chặn đã được xử lý bởi drive-fix-blockdown không
        const isBlockedFileProcessed = downloadResult.fileName && downloadResult.fileName.includes('blocked_') && downloadResult.fileName.includes('_clean');
        
        if (isBlockedFileProcessed) {
          console.log('File đã được xử lý bởi drive-fix-blockdown, bỏ qua bước xử lý thông thường');
          processedFilePath = downloadResult.filePath;
        } else {
          // Kiểm tra kích thước file trước khi xử lý
          const fileStats = fs.statSync(downloadResult.filePath);
          const fileSizeMB = fileStats.size / (1024 * 1024);
          
          if (fileSizeMB > 200) {
            console.log(`⚠️ CẢNH BÁO: File rất lớn (${fileSizeMB.toFixed(2)} MB), có thể gặp vấn đề khi xử lý`);
            console.log(`Thời gian xử lý ước tính: ${Math.ceil(fileSizeMB * 15 / 60)} phút hoặc lâu hơn`);
            console.log(`Đang tiếp tục xử lý, nhưng có thể mất nhiều thời gian...`);
          }
          
          // Xử lý file thông thường
          const processResult = await processFile(downloadResult.filePath, downloadResult.mimeType, apiKey);
          processedFilePath = processResult.processedPath;
        }
        
        // Tải lên file đã xử lý
        const uploadResult = await uploadToGoogleDrive(
          processedFilePath,
          processedFileName,
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
        
        // Tính toán thời gian xử lý
        const processingTime = Math.round((Date.now() - startTime) / 1000);
        console.log(`✅ Hoàn tất xử lý sau ${processingTime} giây`);
        
        // Trả về kết quả
        return {
          success: true,
          originalFile: {
            id: fileId,
            link: driveLink
          },
          processedFile: {
            id: uploadResult.fileId,
            name: uploadResult.fileName,
            link: uploadResult.webViewLink
          },
          duplicatesDeleted: uploadResult.duplicatesDeleted || 0,
          processingTime: processingTime
        };
      } catch (error) {
        console.error('Lỗi khi tải xuống hoặc xử lý file:', error);
        
        // Kiểm tra lỗi 404 - File không tồn tại
        if (error.message && (error.message.includes('404') || error.message.includes('không tồn tại'))) {
          console.error(`File không tồn tại (404): ${fileId}. Không thử lại.`);
          return {
            success: false, 
            error: `Không tìm thấy file với ID: ${fileId}. File có thể đã bị xóa hoặc không tồn tại.`,
            status: 404
          };
        }
        
        // Dọn dẹp thư mục tạm nếu có lỗi
        if (tempDir) {
          try {
            fs.rmdirSync(tempDir, { recursive: true });
            console.log(`Đã xóa thư mục tạm: ${tempDir}`);
          } catch (cleanupError) {
            console.error('Lỗi khi dọn dẹp thư mục tạm:', cleanupError);
          }
        }
        
        return {
          success: false, 
          error: `Lỗi khi xử lý và thay thế file: ${error.message}`,
          status: 500
        };
      }
    })();
    
    // Chạy với timeout
    const result = await Promise.race([processingPromise, timeoutPromise]);
    
    // Nếu kết quả có status code, sử dụng nó
    if (result.status) {
      return NextResponse.json(
        { success: result.success, error: result.error },
        { status: result.status }
      );
    }
    
    // Trả về kết quả thành công
    return NextResponse.json(result);
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
    
    // Kiểm tra nếu lỗi là do timeout
    if (error.message && error.message.includes('Quá trình xử lý vượt quá thời gian')) {
      return NextResponse.json(
        { 
          success: false, 
          error: error.message,
          timeout: true,
          message: "File quá lớn hoặc quá phức tạp, không thể xử lý trong thời gian cho phép. Vui lòng thử lại với file nhỏ hơn."
        },
        { status: 504 } // Gateway Timeout
      );
    }
    
    return NextResponse.json(
      { success: false, error: `Lỗi khi xử lý và thay thế file: ${error.message}` },
      { status: 500 }
    );
  }
}
