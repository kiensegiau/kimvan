/**
 * Module hỗ trợ tải file PDF bị chặn từ Google Drive
 * Sử dụng puppeteer để chụp các trang PDF và tạo lại file
 * Tích hợp trực tiếp xử lý watermark trên các ảnh đã chụp
 */

import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import axios from 'axios';
import { cleanupTempFiles, processBatches } from './utils.js';
import { DEFAULT_CONFIG } from './config.js';

// Import các hàm xử lý watermark từ module watermark.js
import { 
  processImage, 
  addCustomBackground,
  createPDFFromProcessedImages,
  createPDFFromRawImages,
  cleanPdf
} from './watermark.js';

// Hằng số
const MAX_CONCURRENT = 2;
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;
const BATCH_SIZE = 5;

// Đường dẫn Chrome mặc định dựa trên hệ điều hành
function getChromePath() {
  try {
    switch (os.platform()) {
      case 'win32':
        return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
      case 'darwin': // macOS
        return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
      default: // Linux và các hệ điều hành khác
        return '/usr/bin/google-chrome';
    }
  } catch (error) {
    console.error(`Lỗi xác định đường dẫn Chrome: ${error.message}`);
    return 'chrome'; // Fallback to PATH
  }
}

// Tạo thư mục hồ sơ người dùng Chrome
function createChromeUserProfile() {
  try {
    // Sử dụng thư mục cố định thay vì tạo mới mỗi lần
    const profilePath = path.join(os.homedir(), 'drive-pdf-watermark-profile');
    try {
      fs.mkdirSync(profilePath, { recursive: true });
    } catch (mkdirError) {
      console.error(`Lỗi tạo thư mục hồ sơ Chrome: ${mkdirError.message}`);
    }
    
    console.log(`🔑 Sử dụng hồ sơ Chrome tại: ${profilePath}`);
    return profilePath;
  } catch (error) {
    console.error(`Lỗi tạo hồ sơ người dùng Chrome: ${error.message}`);
    // Fallback to temp directory
    const tempProfilePath = path.join(os.tmpdir(), `chrome-profile-${Date.now()}`);
    fs.mkdirSync(tempProfilePath, { recursive: true });
    return tempProfilePath;
  }
}

/**
 * Xử lý file PDF đồng nhất - sử dụng cho cả PDF thông thường và PDF bị chặn
 * Hàm này sẽ phân tích loại PDF và gọi phương thức xử lý phù hợp
 * @param {string} inputPath - Đường dẫn đến file PDF đầu vào
 * @param {string} outputPath - Đường dẫn để lưu file PDF đầu ra
 * @param {Object} config - Cấu hình xử lý watermark
 * @param {boolean} isBlocked - Có phải PDF bị chặn không
 * @param {string} fileId - ID của file Google Drive (nếu là PDF bị chặn)
 * @returns {Promise<{success: boolean, filePath: string, error: string}>}
 */
export async function processPDF(inputPath, outputPath, config = DEFAULT_CONFIG, isBlocked = false, fileId = null) {
  try {
    console.log(`🔄 Bắt đầu xử lý PDF: ${inputPath || 'PDF bị chặn từ Google Drive'}`);
    
    // Kiểm tra file tồn tại (chỉ khi không phải PDF bị chặn)
    if (!isBlocked && !inputPath) {
      throw new Error(`Đường dẫn file đầu vào không được cung cấp`);
    }
    
    if (!isBlocked && !fs.existsSync(inputPath)) {
      throw new Error(`File không tồn tại: ${inputPath}`);
    }
    
    // Nếu không cung cấp đường dẫn đầu ra, tạo đường dẫn mặc định
    if (!outputPath) {
      if (inputPath) {
        outputPath = inputPath.replace('.pdf', '_clean.pdf');
      } else if (isBlocked && fileId) {
        // Tạo đường dẫn mặc định cho file bị chặn
        const tempDir = path.join(os.tmpdir(), uuidv4());
        fs.mkdirSync(tempDir, { recursive: true });
        outputPath = path.join(tempDir, `blocked_${fileId}_clean.pdf`);
      } else {
        throw new Error('Không thể xác định đường dẫn đầu ra');
      }
    }
    
    // Ghi lại thời gian bắt đầu
    const startTime = Date.now();
    
    let result;
    
    // Xử lý dựa trên loại PDF
    if (isBlocked && fileId) {
      // Xử lý PDF bị chặn từ Google Drive
      console.log(`🔒 Phát hiện PDF bị chặn từ Google Drive, sử dụng phương pháp đặc biệt...`);
      const fileName = inputPath ? path.basename(inputPath) : `blocked_${fileId}.pdf`;
      
      // Thêm xử lý timeout và retry
      let retryCount = 0;
      const maxRetries = 2;
      let lastError = null;
      
      while (retryCount <= maxRetries) {
        try {
          console.log(`Thử tải PDF bị chặn lần ${retryCount + 1}...`);
          
          // Thiết lập timeout cho toàn bộ quá trình
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Quá thời gian xử lý (10 phút)')), 10 * 60 * 1000);
          });
          
          // Chạy quá trình tải với timeout
          result = await Promise.race([
            downloadBlockedPDF(fileId, fileName, path.dirname(outputPath), config),
            timeoutPromise
          ]);
          
          // Nếu thành công, thoát khỏi vòng lặp
          if (result && result.success) {
            break;
          } else {
            throw new Error(result?.error || 'Không thể tải PDF bị chặn');
          }
        } catch (downloadError) {
          lastError = downloadError;
          retryCount++;
          
          // Nếu đã hết số lần thử lại, throw lỗi
          if (retryCount > maxRetries) {
            console.error(`❌ Đã thử ${maxRetries + 1} lần nhưng không thành công: ${downloadError.message}`);
            throw downloadError;
          }
          
          console.log(`⚠️ Lỗi khi tải PDF bị chặn: ${downloadError.message}. Thử lại sau 5 giây...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      
      // Nếu không có kết quả thành công sau tất cả các lần thử
      if (!result || !result.success) {
        throw new Error(lastError?.message || 'Không thể tải PDF bị chặn sau nhiều lần thử');
      }
    } else {
      // Xử lý PDF thông thường
      console.log(`📄 Xử lý PDF thông thường với phương pháp loại bỏ watermark...`);
      
      // Sử dụng hàm cleanPdf từ module watermark.js
      try {
        await cleanPdf(inputPath, outputPath, {
          ...config,
          // Đảm bảo logo luôn được thêm vào file PDF thông thường
          forceAddLogo: true
        });
        
        // Kiểm tra kết quả
        if (fs.existsSync(outputPath)) {
          const fileSize = fs.statSync(outputPath).size;
          const processingTime = (Date.now() - startTime) / 1000;
          
          result = {
            success: true,
            filePath: outputPath,
            fileName: path.basename(outputPath),
            originalSize: fs.statSync(inputPath).size,
            processedSize: fileSize,
            processingTime: processingTime.toFixed(2)
          };
        } else {
          throw new Error('Không thể tạo file PDF đã xử lý');
        }
      } catch (cleanError) {
        console.error(`❌ Lỗi khi xử lý PDF thông thường: ${cleanError.message}`);
        throw cleanError;
      }
    }
    
    // Thêm hình nền nếu được cấu hình
    if (result.success && config.backgroundImage && fs.existsSync(config.backgroundImage)) {
      try {
        console.log(`🖼️ Thêm hình nền tùy chỉnh: ${config.backgroundImage}`);
        const bgOutputPath = await addCustomBackground(result.filePath, config.backgroundImage, config);
        
        // Cập nhật kết quả với file mới có hình nền
        if (fs.existsSync(bgOutputPath)) {
          result.filePath = bgOutputPath;
          result.fileName = path.basename(bgOutputPath);
          result.processedSize = fs.statSync(bgOutputPath).size;
        }
      } catch (bgError) {
        console.warn(`⚠️ Không thể thêm hình nền: ${bgError.message}`);
        // Tiếp tục sử dụng file đã xử lý mà không có hình nền
      }
    } else if (!isBlocked && result.success) {
      // Đảm bảo file PDF thường (không bị khóa) luôn có logo
      try {
        console.log(`🖼️ Thêm logo vào file PDF thường: ${config.backgroundImage}`);
        // Kiểm tra xem có hình nền được cấu hình không
        if (config.backgroundImage && fs.existsSync(config.backgroundImage)) {
          const bgOutputPath = await addCustomBackground(result.filePath, config.backgroundImage, {
            ...config,
            backgroundOpacity: 0.15 // Đặt độ mờ mặc định cho logo
          });
          
          // Cập nhật kết quả với file mới có hình nền
          if (fs.existsSync(bgOutputPath)) {
            result.filePath = bgOutputPath;
            result.fileName = path.basename(bgOutputPath);
            result.processedSize = fs.statSync(bgOutputPath).size;
          }
        } else {
          console.warn(`⚠️ Không tìm thấy file logo: ${config.backgroundImage}`);
        }
      } catch (logoError) {
        console.warn(`⚠️ Không thể thêm logo: ${logoError.message}`);
      }
    }
    
    // Tính toán thời gian xử lý tổng cộng
    const totalProcessingTime = (Date.now() - startTime) / 1000;
    result.processingTime = totalProcessingTime.toFixed(2);
    
    return result;
  } catch (error) {
    console.error(`❌ Lỗi xử lý PDF: ${error.message}`);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * Tải xuống file PDF bị chặn từ Google Drive và xử lý watermark
 * @param {string} fileId - ID của file Google Drive
 * @param {string} fileName - Tên file
 * @param {string} tempDir - Thư mục tạm để lưu file
 * @param {Object} watermarkConfig - Cấu hình xử lý watermark (tùy chọn)
 * @returns {Promise<{success: boolean, filePath: string, error: string}>}
 */
export async function downloadBlockedPDF(fileId, fileName, tempDir, watermarkConfig = {}) {
  let browser = null;
  let page = null;
  let downloadedImages = [];
  let processedImages = [];
  const pageRequests = new Map();
  let cookies = null;
  let userAgent = null;
  
  // Tạo thư mục tạm nếu chưa tồn tại
  if (!tempDir) {
    try {
      tempDir = path.join(os.tmpdir(), uuidv4());
      fs.mkdirSync(tempDir, { recursive: true });
    } catch (mkdirError) {
      console.error(`Lỗi tạo thư mục tạm: ${mkdirError.message}`);
      throw new Error(`Không thể tạo thư mục tạm: ${mkdirError.message}`);
    }
  }
  
  const imagesDir = path.join(tempDir, 'images');
  const processedDir = path.join(tempDir, 'processed');
  try {
    fs.mkdirSync(imagesDir, { recursive: true });
    fs.mkdirSync(processedDir, { recursive: true });
  } catch (mkdirError) {
    console.error(`Lỗi tạo thư mục con: ${mkdirError.message}`);
    throw new Error(`Không thể tạo thư mục con: ${mkdirError.message}`);
  }
  
  // Tạo thư mục hồ sơ cho Chrome
  let profilePath;
  try {
    profilePath = createChromeUserProfile();
  } catch (profileError) {
    console.error(`Lỗi tạo hồ sơ Chrome: ${profileError.message}`);
    profilePath = path.join(tempDir, 'chrome-profile');
    fs.mkdirSync(profilePath, { recursive: true });
  }
  
  const outputPath = path.join(tempDir, `${path.basename(fileName, '.pdf')}_clean.pdf`);
  
  // Ghi lại thời gian bắt đầu
  const startTime = Date.now();
  
  // Kết hợp config mặc định với config được truyền vào
  const config = { 
    ...DEFAULT_CONFIG, 
    ...watermarkConfig,
    // Thêm cài đặt đặc biệt cho file bị khóa
    isBlockedFile: true,
    enhancedMode: true,
    // Điều chỉnh các thông số để tăng độ nét và giảm mức độ xử lý watermark
    brightnessBoost: watermarkConfig.brightnessBoost || 1.05,   // Giảm từ 1.1 xuống 1.05 để giữ nội dung
    contrastBoost: watermarkConfig.contrastBoost || 1.2,        // Giảm từ 1.35 xuống 1.2 để không mất chi tiết
    sharpenAmount: watermarkConfig.sharpenAmount || 1.5,        // Tăng từ 1.2 lên 1.5 để tăng độ nét
    saturationAdjust: watermarkConfig.saturationAdjust || 1.3,  // Tăng từ 1.2 lên 1.3 để tăng màu sắc
    preserveColors: true,                                       // Giữ nguyên tham số giữ màu sắc
    extraWhitening: false,                                      // Tắt chế độ làm trắng thêm
    aggressiveWatermarkRemoval: false                           // Tắt chế độ xử lý mạnh nhất
  };
  
  let fileSize = 0; // Khai báo fileSize ở phạm vi rộng hơn
  
  try {
    console.log(`🔍 Bắt đầu xử lý file bị chặn: ${fileName}`);
    
    // Cấu hình mở rộng cho Puppeteer
    let chromePath;
    try {
      chromePath = getChromePath();
      console.log(`🌐 Sử dụng Chrome: ${chromePath}`);
    } catch (chromePathError) {
      console.error(`Lỗi tìm Chrome: ${chromePathError.message}`);
      throw new Error(`Không tìm thấy Chrome: ${chromePathError.message}`);
    }
    
    // Khởi tạo trình duyệt với cấu hình nâng cao
    try {
      browser = await puppeteer.launch({
        headless: false,
        channel: "chrome",
        executablePath: chromePath,
        args: [
          "--start-maximized",
          `--user-data-dir=${profilePath}`,
          "--enable-extensions",
          "--remote-debugging-port=9222",
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-web-security",
          "--disable-features=IsolateOrigins,site-per-process",
          "--disable-site-isolation-trials",
          "--disable-features=BlockInsecurePrivateNetworkRequests",
          "--disable-features=SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure",
          "--no-first-run",
          "--no-default-browser-check",
          "--disable-popup-blocking",
          "--disable-notifications",
          "--disable-infobars",
          "--disable-translate",
          "--allow-running-insecure-content",
          "--password-store=basic",
          // Thêm các flag mới để ngăn thông báo bảo mật
          "--use-fake-ui-for-media-stream",
          "--use-fake-device-for-media-stream",
          "--allow-file-access-from-files",
          "--allow-insecure-localhost",
          "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
          "--disable-blink-features=AutomationControlled"
        ],
        defaultViewport: null,
        ignoreDefaultArgs: ["--enable-automation"],
        // Tăng timeout lên 120s cho máy yếu
        timeout: 120000,
        // Thêm slowMo để làm chậm puppeteer cho máy yếu
        slowMo: 100,
      });
    } catch (browserError) {
      console.error(`Lỗi khởi tạo trình duyệt: ${browserError.message}`);
      throw new Error(`Không thể khởi động Chrome: ${browserError.message}`);
    }
    
    // Tạo tab mới
    try {
      page = await browser.newPage();
      await page.setDefaultNavigationTimeout(60000);
    } catch (pageError) {
      console.error(`Lỗi tạo tab mới: ${pageError.message}`);
      throw new Error(`Không thể tạo tab trình duyệt: ${pageError.message}`);
    }
    
    // Theo dõi các request ảnh
    try {
      await page.setRequestInterception(true);
      
      page.on('request', (request) => {
        try {
          const url = request.url();
          
          // Kiểm tra cả 2 pattern: viewerng/img và viewer2/prod
          const isViewerNg = url.includes('viewerng/img');
          const isViewer2 = url.includes('viewer2/prod');
          
          if ((isViewerNg || isViewer2) && url.includes('page=')) {
            const pageMatch = url.match(/[?&]page=(\d+)/);
            if (pageMatch) {
              const pageNum = parseInt(pageMatch[1]);
              if (!pageRequests.has(pageNum)) {
                pageRequests.set(pageNum, url);
              }
            }
          }
          request.continue();
        } catch (requestError) {
          console.warn(`Lỗi xử lý request: ${requestError.message}`);
          request.continue();
        }
      });
    } catch (interceptError) {
      console.error(`Lỗi thiết lập chặn request: ${interceptError.message}`);
    }
    
    // Mở file PDF trên Google Drive
    try {
      console.log(`🌐 Mở PDF viewer cho file: ${fileId}`);
      await page.goto(`https://drive.google.com/file/d/${fileId}/view`, {
        waitUntil: 'networkidle2',
        timeout: 300000 // Tăng timeout cho trang để tải trọn vẹn
      });
    } catch (navigationError) {
      console.error(`Lỗi mở file PDF từ Drive: ${navigationError.message}`);
      throw new Error(`Không thể mở file PDF từ Google Drive: ${navigationError.message}`);
    }
    
    // Scroll để tải tất cả các trang
    try {
      console.log(`📜 Bắt đầu scroll để tải trang...`);
      await scrollToLoadAllPages(page, pageRequests);
      console.log(`📊 Đã phát hiện ${pageRequests.size} trang`);
    } catch (scrollError) {
      console.error(`Lỗi scroll để tải trang: ${scrollError.message}`);
      throw new Error(`Không thể tải tất cả các trang PDF: ${scrollError.message}`);
    }
    
    // Lưu cookies và userAgent để tải ảnh sau này
    try {
      cookies = await page.cookies();
      userAgent = await page.evaluate(() => navigator.userAgent);
    } catch (cookieError) {
      console.error(`Lỗi lấy cookies và userAgent: ${cookieError.message}`);
    }
    
    // Đóng page sau khi lấy thông tin
    try {
      await page.close();
      page = null;
    } catch (closeError) {
      console.warn(`Lỗi đóng tab: ${closeError.message}`);
      page = null;
    }
    
    // Tải xuống các ảnh trang
    try {
      console.log(`📥 Tải xuống ${pageRequests.size} trang...`);
      downloadedImages = await downloadAllPageImages(pageRequests, cookies, userAgent, imagesDir);
    } catch (downloadError) {
      console.error(`Lỗi tải ảnh trang: ${downloadError.message}`);
      throw new Error(`Không thể tải ảnh từ các trang PDF: ${downloadError.message}`);
    }
    
    // Xử lý watermark trên từng ảnh - sử dụng hàm từ module watermark
    try {
      console.log(`🔧 Xử lý watermark trên ${downloadedImages.length} ảnh...`);
      // Chuyển đổi ảnh webp sang png trước khi xử lý watermark
      const pngImages = await convertAllImagesToPng(downloadedImages, imagesDir);
      // Sau đó xử lý watermark trên các ảnh đã chuyển đổi
      processedImages = await processAllImages(pngImages, processedDir, config);
    } catch (processError) {
      console.error(`Lỗi xử lý watermark: ${processError.message}`);
      throw new Error(`Không thể xử lý watermark trên ảnh: ${processError.message}`);
    }
    
    // Tạo file PDF từ các ảnh đã xử lý
    try {
      console.log(`📄 Tạo file PDF từ ${processedImages.length} ảnh đã xử lý...`);
      
      // Kiểm tra xem ảnh đã được xử lý watermark chưa
      const hasProcessedImages = processedImages.some(img => img.includes('_processed'));
      
      if (hasProcessedImages && config.backgroundImage && fs.existsSync(config.backgroundImage)) {
        console.log(`⚠️ Ảnh đã được xử lý trước đó, sẽ tạo PDF không thêm logo để tránh lặp`);
        // Sử dụng createPDFFromRawImages thay vì createPDFFromProcessedImages để tránh thêm logo lần nữa
        await createPDFFromRawImages(processedImages, outputPath);
      } 
      // Trường hợp ảnh chưa được xử lý hoặc không có hình nền
      else if (config.backgroundImage && fs.existsSync(config.backgroundImage)) {
        console.log(`🖼️ Thêm hình nền tùy chỉnh: ${config.backgroundImage}`);
        await createPDFFromProcessedImages(processedImages, outputPath, config);
      } else {
        await createPDFFromRawImages(processedImages, outputPath);
      }
    } catch (createPdfError) {
      console.error(`Lỗi tạo PDF từ ảnh: ${createPdfError.message}`);
      throw new Error(`Không thể tạo file PDF từ ảnh đã xử lý: ${createPdfError.message}`);
    }
    
    // Kiểm tra file PDF đã tạo
    try {
      if (!fs.existsSync(outputPath)) {
        throw new Error('Không thể tạo file PDF');
      }
      
      fileSize = fs.statSync(outputPath).size; // Sử dụng biến đã khai báo bên ngoài
      if (fileSize === 0) {
        throw new Error('File PDF được tạo nhưng kích thước bằng 0');
      }
    } catch (checkError) {
      console.error(`Lỗi kiểm tra file PDF: ${checkError.message}`);
      throw checkError;
    }
    
    // Tính thời gian xử lý
    const processingTime = (Date.now() - startTime) / 1000;
    
    console.log(`✅ Đã tạo file PDF thành công: ${outputPath} (${(fileSize / 1024 / 1024).toFixed(2)}MB) trong ${processingTime.toFixed(2)} giây`);
    
    return {
      success: true,
      filePath: outputPath,
      fileName: `${path.basename(fileName, '.pdf')}_clean.pdf`,
      originalSize: 0, // Không thể biết kích thước gốc
      processedSize: fileSize,
      processingTime: processingTime.toFixed(2)
    };
  } catch (error) {
    console.error(`❌ Lỗi tải file bị chặn: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  } finally {
    // Đóng browser nếu còn mở
    if (page) {
      try {
        await page.close().catch(() => {});
      } catch (closeError) {
        console.warn(`Lỗi đóng tab: ${closeError.message}`);
      }
    }
    if (browser) {
      try {
        await browser.close().catch(() => {});
      } catch (closeError) {
        console.warn(`Lỗi đóng trình duyệt: ${closeError.message}`);
      }
    }
    
    // Dọn dẹp các file ảnh tạm
    try {
      for (const image of [...downloadedImages, ...processedImages]) {
        if (fs.existsSync(image)) {
          try {
            fs.unlinkSync(image);
          } catch (unlinkError) {
            console.warn(`Lỗi xóa file ảnh tạm ${image}: ${unlinkError.message}`);
          }
        }
      }
    } catch (cleanupError) {
      console.warn(`⚠️ Lỗi khi dọn dẹp ảnh tạm: ${cleanupError.message}`);
    }
    
    // Dọn dẹp thư mục hồ sơ Chrome
    try {
      // Không xóa thư mục hồ sơ Chrome nữa để giữ lại dữ liệu đăng nhập
      console.log(`✅ Giữ lại hồ sơ Chrome để lưu đăng nhập cho lần sau: ${profilePath}`);
      // cleanupTempFiles(profilePath);
    } catch (cleanupError) {
      console.warn(`⚠️ Lỗi khi dọn dẹp thư mục hồ sơ Chrome: ${cleanupError.message}`);
    }
  }
}

/**
 * Scroll để tải tất cả các trang của PDF
 * @param {Page} page - Puppeteer page
 * @param {Map} pageRequests - Map lưu trữ các request trang
 */
async function scrollToLoadAllPages(page, pageRequests) {
  try {
    let lastPageCount = 0;
    let noNewPagesCount = 0;
    const MAX_NO_NEW_PAGES = 10;
    const SCROLL_INTERVAL = 200;
    const SPACE_PRESSES_PER_BATCH = 2;
    const BATCH_INTERVAL = 500;
    const MAX_SCROLL_ATTEMPTS = 100;
    let scrollAttempts = 0;
    
    // Scroll bằng cách nhấn phím Space
    while (noNewPagesCount < MAX_NO_NEW_PAGES && scrollAttempts < MAX_SCROLL_ATTEMPTS) {
      try {
        for (let i = 0; i < SPACE_PRESSES_PER_BATCH; i++) {
          try {
            await page.keyboard.press('Space');
          } catch (keyError) {
            console.warn(`Lỗi nhấn phím Space lần ${i+1}: ${keyError.message}`);
          }
          await new Promise(resolve => setTimeout(resolve, SCROLL_INTERVAL));
        }
      } catch (batchError) {
        console.warn(`Lỗi trong batch scroll: ${batchError.message}`);
      }
      
      scrollAttempts++;
      await new Promise(resolve => setTimeout(resolve, BATCH_INTERVAL));
      
      const currentPageCount = pageRequests.size;
      
      if (currentPageCount > lastPageCount) {
        console.log(`📄 Đã phát hiện: ${currentPageCount} trang (+${currentPageCount - lastPageCount})`);
        lastPageCount = currentPageCount;
        noNewPagesCount = 0;
      } else {
        noNewPagesCount++;
      }
      
      if (currentPageCount > 0 && noNewPagesCount >= MAX_NO_NEW_PAGES) {
        console.log(`✅ Không phát hiện trang mới sau ${noNewPagesCount} lần thử, kết thúc scroll`);
        break;
      }
    }
    
    // Thêm vài lần nhấn space cuối để đảm bảo đã tải hết
    try {
      for (let i = 0; i < 5; i++) {
        try {
          await page.keyboard.press('Space');
        } catch (finalKeyError) {
          console.warn(`Lỗi nhấn phím Space cuối cùng lần ${i+1}: ${finalKeyError.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (finalScrollError) {
      console.warn(`Lỗi scroll cuối cùng: ${finalScrollError.message}`);
    }
    
    console.log(`✅ Đã hoàn thành scroll với ${pageRequests.size} trang`);
  } catch (error) {
    console.error(`❌ Lỗi khi scroll: ${error.message}`);
    throw error;
  }
}

/**
 * Tải xuống tất cả ảnh trang
 * @param {Map} pageRequests - Map các URL trang
 * @param {Array} cookies - Cookies để xác thực
 * @param {string} userAgent - User-Agent để request
 * @param {string} imagesDir - Thư mục để lưu ảnh
 * @returns {Promise<Array<string>>} - Mảng các đường dẫn đến ảnh đã tải
 */
async function downloadAllPageImages(pageRequests, cookies, userAgent, imagesDir) {
  try {
    const downloadedImages = [];
    const cookieStr = cookies ? cookies.map(c => `${c.name}=${c.value}`).join('; ') : '';
    
    // Sắp xếp các trang theo thứ tự tăng dần
    const pages = Array.from(pageRequests.entries()).sort(([a], [b]) => a - b);
    
    // Chia thành các batch để tránh quá tải
    for (let i = 0; i < pages.length; i += BATCH_SIZE) {
      try {
        const batch = pages.slice(i, i + BATCH_SIZE);
        console.log(`📥 Đang tải batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pages.length / BATCH_SIZE)}...`);
        
        // Tải song song trong batch
        const downloadPromises = batch.map(async ([pageNum, url]) => {
          let retries = MAX_RETRIES;
          
          while (retries > 0) {
            try {
              console.log(`📄 Tải trang ${pageNum}...`);
              
              const response = await axios({
                method: 'get',
                url: url,
                responseType: 'arraybuffer',
                timeout: 30000,
                headers: {
                  'Cookie': cookieStr,
                  'User-Agent': userAgent,
                  'Referer': 'https://drive.google.com/',
                  'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
                }
              });
              
              // Xác định định dạng ảnh từ Content-Type
              const contentType = response.headers['content-type'];
              let extension = 'png'; // Mặc định là png
              
              if (contentType) {
                if (contentType.includes('jpeg') || contentType.includes('jpg')) {
                  extension = 'jpg';
                } else if (contentType.includes('webp')) {
                  extension = 'webp';
                }
              }
              
              // Tạo tên file với đuôi phù hợp
              const imagePath = path.join(imagesDir, `page_${String(pageNum).padStart(3, '0')}.${extension}`);
              
              // Lưu file
              try {
                fs.writeFileSync(imagePath, Buffer.from(response.data));
                console.log(`✅ Đã tải trang ${pageNum} (${extension})`);
                
                // Thêm vào danh sách ảnh đã tải
                downloadedImages[pageNum] = imagePath;
                break;
              } catch (writeError) {
                console.error(`Lỗi lưu file ảnh trang ${pageNum}: ${writeError.message}`);
                retries--;
                if (retries <= 0) {
                  console.error(`❌ Không thể lưu ảnh trang ${pageNum} sau ${MAX_RETRIES} lần thử`);
                } else {
                  await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                }
              }
            } catch (error) {
              retries--;
              console.warn(`⚠️ Lỗi tải trang ${pageNum} (còn ${retries} lần thử): ${error.message}`);
              
              if (retries <= 0) {
                console.error(`❌ Không thể tải trang ${pageNum} sau ${MAX_RETRIES} lần thử`);
              } else {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
              }
            }
          }
        });
        
        // Chờ tất cả trong batch hoàn thành
        try {
          await Promise.all(downloadPromises);
        } catch (batchError) {
          console.error(`Lỗi tải batch ảnh: ${batchError.message}`);
        }
        
        // Đợi giữa các batch để tránh quá tải
        if (i + BATCH_SIZE < pages.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (batchError) {
        console.error(`Lỗi xử lý batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batchError.message}`);
      }
    }
    
    // Trả về mảng chỉ chứa các đường dẫn hợp lệ
    return downloadedImages.filter(Boolean);
  } catch (error) {
    console.error(`❌ Lỗi tải ảnh trang: ${error.message}`);
    throw error;
  }
}

/**
 * Chuyển đổi tất cả ảnh sang định dạng PNG
 * @param {Array<string>} images - Mảng đường dẫn đến ảnh
 * @param {string} outputDir - Thư mục để lưu ảnh đã chuyển đổi
 * @returns {Promise<Array<string>>} - Mảng các đường dẫn đến ảnh đã chuyển đổi
 */
async function convertAllImagesToPng(images, outputDir) {
  try {
    const convertedImages = [];
    
    // Sắp xếp ảnh theo thứ tự trang
    const sortedImages = images.sort((a, b) => {
      try {
        const pageA = parseInt(path.basename(a).match(/page_(\d+)/)[1]);
        const pageB = parseInt(path.basename(b).match(/page_(\d+)/)[1]);
        return pageA - pageB;
      } catch (error) {
        return 0;
      }
    });
    
    // Chuyển đổi từng ảnh sang png nếu cần
    for (let i = 0; i < sortedImages.length; i++) {
      try {
        const imagePath = sortedImages[i];
        let pageNum;
        try {
          pageNum = parseInt(path.basename(imagePath).match(/page_(\d+)/)[1]);
        } catch (parseError) {
          console.warn(`Không thể phân tích số trang từ ${imagePath}: ${parseError.message}`);
          pageNum = i + 1;
        }
        
        const extension = path.extname(imagePath);
        
        // Nếu đã là png, không cần chuyển đổi
        if (extension.toLowerCase() === '.png') {
          convertedImages.push(imagePath);
          continue;
        }
        
        // Chuyển đổi sang png
        const pngPath = path.join(outputDir, `page_${String(pageNum).padStart(3, '0')}.png`);
        
        try {
          console.log(`🔄 Chuyển đổi trang ${pageNum} từ ${extension} sang png...`);
          await sharp(imagePath)
            .toFormat('png')
            .toFile(pngPath);
          console.log(`✅ Đã chuyển đổi trang ${pageNum} sang png`);
          convertedImages.push(pngPath);
        } catch (error) {
          console.error(`❌ Lỗi chuyển đổi trang ${pageNum} sang png: ${error.message}`);
          // Nếu không chuyển đổi được, giữ ảnh gốc
          convertedImages.push(imagePath);
        }
      } catch (imageError) {
        console.error(`Lỗi xử lý ảnh thứ ${i+1}: ${imageError.message}`);
      }
    }
    
    return convertedImages;
  } catch (error) {
    console.error(`❌ Lỗi chuyển đổi ảnh sang PNG: ${error.message}`);
    throw error;
  }
}

/**
 * Xử lý tất cả các ảnh bằng cách sử dụng hàm processImage từ module watermark
 * @param {Array<string>} images - Mảng đường dẫn đến ảnh
 * @param {string} outputDir - Thư mục để lưu ảnh đã xử lý
 * @param {Object} config - Cấu hình xử lý watermark
 * @returns {Promise<Array<string>>} - Mảng các đường dẫn đến ảnh đã xử lý
 */
async function processAllImages(images, outputDir, config) {
  try {
    const processedImages = [];
    
    // Sắp xếp ảnh theo thứ tự trang
    const sortedImages = images.sort((a, b) => {
      try {
        const pageA = parseInt(path.basename(a).match(/page_(\d+)/)[1]);
        const pageB = parseInt(path.basename(b).match(/page_(\d+)/)[1]);
        return pageA - pageB;
      } catch (error) {
        return 0;
      }
    });
    
    // Sử dụng cấu hình nâng cao để xử lý mạnh hơn với file bị khóa
    const enhancedConfig = {
      // Giữ độ mờ nền từ cấu hình gốc
      backgroundOpacity: config.backgroundOpacity || 0.15,
      // Thêm các tham số xử lý nâng cao
      enhancedMode: true,
      contrastBoost: config.contrastBoost || 1.2,     // Giảm từ 1.35 xuống 1.2 để không mất chi tiết
      brightnessBoost: config.brightnessBoost || 1.05,   // Giảm từ 1.1 xuống 1.05 để giữ nội dung
      sharpenAmount: config.sharpenAmount || 1.5,        // Tăng từ 1.2 lên 1.5 để tăng độ nét
      saturationAdjust: config.saturationAdjust || 1.3,  // Tăng từ 1.2 lên 1.3 để tăng màu sắc
      preserveColors: true,                                       // Giữ nguyên tham số giữ màu sắc
      extraWhitening: false,                                      // Tắt chế độ làm trắng thêm
      aggressiveWatermarkRemoval: false                           // Tắt chế độ xử lý mạnh nhất
    };
    
    console.log(`🔧 Áp dụng xử lý nâng cao cho file PDF bị khóa với ${sortedImages.length} trang`);
    
    // Xử lý từng ảnh
    for (let i = 0; i < sortedImages.length; i++) {
      try {
        const imagePath = sortedImages[i];
        let pageNum;
        try {
          pageNum = parseInt(path.basename(imagePath).match(/page_(\d+)/)[1]);
        } catch (parseError) {
          console.warn(`Không thể phân tích số trang từ ${imagePath}: ${parseError.message}`);
          pageNum = i + 1;
        }
        
        // Luôn sử dụng .png cho file đã xử lý để đảm bảo tương thích
        const processedPath = path.join(outputDir, `page_${String(pageNum).padStart(3, '0')}_processed.png`);
        
        try {
          console.log(`🔍 Xử lý nâng cao watermark trang ${pageNum}...`);
          
          // Thử xử lý watermark với phương pháp nâng cao trước
          try {
            // Đọc ảnh gốc vào buffer
            const imageBuffer = fs.readFileSync(imagePath);
            
            // Tạo một pipeline xử lý nâng cao với sharp
            let processedBuffer = await sharp(imageBuffer)
              // Tăng độ sáng và độ tương phản nhẹ nhàng hơn
              .modulate({
                brightness: enhancedConfig.brightnessBoost,
                saturation: enhancedConfig.saturationAdjust // Tăng độ bão hòa để giữ màu sắc
              })
              // Tăng độ tương phản vừa phải
              .linear(
                enhancedConfig.contrastBoost, // Độ dốc (a) vừa phải
                -(128 * enhancedConfig.contrastBoost - 128) / 255 // Điểm cắt (b)
              )
              // Tăng độ sắc nét nhẹ nhàng
              .sharpen({
                sigma: enhancedConfig.sharpenAmount,
                m1: 0.2,
                m2: 0.4,
                x1: 2,
                y2: 5,
                y3: 5
              });
              
            // Nếu cần giữ màu sắc, bỏ qua bước normalise
            if (!enhancedConfig.preserveColors) {
              // Cân bằng màu - có thể làm mất màu sắc
              processedBuffer = await processedBuffer.normalise().toBuffer();
            } else {
              // Lưu ra buffer mà không cân bằng màu để giữ màu sắc
              processedBuffer = await processedBuffer.toBuffer();
            }
              
            // Nếu có tham số extraWhitening, áp dụng xử lý thêm để loại bỏ watermark
            if (enhancedConfig.extraWhitening) {
              console.log(`🔍 Áp dụng xử lý làm trắng thêm cho trang ${pageNum} (chế độ cân bằng)...`);
              
              // Sử dụng phương pháp cân bằng để giữ lại văn bản
              processedBuffer = await sharp(processedBuffer)
                // Sử dụng ngưỡng cao hơn để chỉ loại bỏ watermark mờ
                .threshold(240)
                // Giảm độ tương phản để giữ lại văn bản
                .linear(
                  1.2, // Độ dốc thấp hơn
                  -0.1 // Điểm cắt âm nhỏ hơn
                )
                // Giảm nhiễu nhẹ
                .median(2)
                // Tăng độ sắc nét một chút
                .sharpen({
                  sigma: 0.8,
                  m1: 0.2,
                  m2: 0.5
                })
                .png({ quality: 100 })
                .toBuffer();
            }
            
            // Nếu chế độ xử lý mạnh được bật (đã tắt trong config)
            if (enhancedConfig.aggressiveWatermarkRemoval) {
              console.log(`🔥 Áp dụng xử lý mạnh để loại bỏ watermark cho trang ${pageNum}...`);
              
              // Xử lý thêm một lần nữa với các thông số mạnh hơn
              processedBuffer = await sharp(processedBuffer)
                // Áp dụng bộ lọc màu để giảm độ xám của watermark
                .tint({ r: 255, g: 255, b: 255 }) // Tăng thành phần trắng
                // Tăng độ tương phản cao hơn nữa
                .linear(
                  1.3, // Giảm độ dốc xuống
                  -0.1 // Giảm điểm cắt âm
                )
                // Làm mịn ảnh để giảm nhiễu
                .blur(0.2)
                // Tăng độ sắc nét lần cuối
                .sharpen({
                  sigma: 1.0,
                  m1: 0.3,
                  m2: 0.5
                })
                .png({ quality: 100 })
                .toBuffer();
            }
            
            // Xử lý đặc biệt cho watermark khi giữ màu sắc
            if (enhancedConfig.preserveColors) {
              console.log(`🎨 Áp dụng xử lý giữ màu sắc cho trang ${pageNum}...`);
              
              // Sử dụng phương pháp giữ màu sắc và loại bỏ watermark
              processedBuffer = await sharp(processedBuffer)
                // Tăng độ sắc nét để làm rõ nội dung
                .sharpen({
                  sigma: 1.5,  // Tăng từ 1.2 lên 1.5
                  m1: 0.5,     // Tăng từ 0.4 lên 0.5
                  m2: 0.7      // Tăng từ 0.6 lên 0.7
                })
                // Tăng độ tương phản nhẹ để làm rõ văn bản
                .linear(
                  1.2, // Giảm từ 1.25 xuống 1.2 để giữ chi tiết
                  -0.03 // Giảm từ -0.05 xuống -0.03 để giữ chi tiết
                )
                // Tăng độ bão hòa màu một chút nữa
                .modulate({
                  saturation: 1.3, // Tăng từ 1.1 lên 1.3
                  brightness: 1.05 // Thêm tham số độ sáng nhẹ
                })
                .png({ quality: 100 })
                .toBuffer();
            }
            
            // Lưu ảnh đã xử lý
            fs.writeFileSync(processedPath, processedBuffer);
            console.log(`✅ Đã xử lý nâng cao watermark trang ${pageNum}`);
            
            // Thêm vào danh sách ảnh đã xử lý
            processedImages.push(processedPath);
          } catch (advancedError) {
            console.error(`❌ Lỗi xử lý nâng cao trang ${pageNum}: ${advancedError.message}`);
            console.log(`⚠️ Chuyển sang phương pháp xử lý đơn giản...`);
            
            // Nếu phương pháp nâng cao thất bại, sử dụng phương pháp đơn giản
            await processImage(imagePath, processedPath, enhancedConfig);
            console.log(`✅ Đã xử lý xong trang ${pageNum} với phương pháp đơn giản`);
            
            // Thêm vào danh sách ảnh đã xử lý
            processedImages.push(processedPath);
          }
        } catch (error) {
          console.error(`❌ Lỗi xử lý watermark trang ${pageNum}: ${error.message}`);
          // Nếu xử lý thất bại, sử dụng ảnh gốc
          processedImages.push(imagePath);
        }
      } catch (pageError) {
        console.error(`Lỗi xử lý trang thứ ${i+1}: ${pageError.message}`);
      }
    }
    
    return processedImages;
  } catch (error) {
    console.error(`❌ Lỗi xử lý tất cả ảnh: ${error.message}`);
    throw error;
  }
} 