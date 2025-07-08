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
const MAX_RETRIES = 1;
const RETRY_DELAY = 5000;
const BATCH_SIZE = 5;
const PROCESS_TIMEOUT = 30 * 60 * 1000; // 30 phút timeout

// Thêm biến toàn cục để quản lý các phiên Chrome đang hoạt động
const activeBrowsers = new Map();
const MAX_CONCURRENT_BROWSERS = 3; // Số lượng trình duyệt Chrome tối đa được phép chạy song song

// Đường dẫn Chrome mặc định dựa trên hệ điều hành
function getChromePath() {
  try {
    switch (os.platform()) {
      case 'win32':
        // Kiểm tra các đường dẫn phổ biến
        const windowsPaths = [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Users\\PC\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'
        ];
        
        for (const path of windowsPaths) {
          if (fs.existsSync(path)) {
            console.log(`✅ Tìm thấy Chrome tại: ${path}`);
            return path;
          }
        }
        
        // Đường dẫn mặc định nếu không tìm thấy
        console.log(`⚠️ Không tìm thấy Chrome trong các đường dẫn phổ biến, sử dụng đường dẫn mặc định`);
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

    // Kiểm tra kích thước file nếu là file bị chặn
    if (isBlocked && fileId) {
      try {
        // Import hàm getTokenByType từ utils
        const { getTokenByType } = await import('./utils.js');
        
        // Lấy token tải xuống
        const downloadToken = getTokenByType('download');
        if (!downloadToken) {
          throw new Error('Không tìm thấy token Google Drive');
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
        
        // Lấy thông tin file
        const fileInfo = await drive.files.get({
          fileId: fileId,
          fields: 'size',
          supportsAllDrives: true
        });
        
        // Tính kích thước MB
        const fileSizeMB = parseInt(fileInfo.data.size) / (1024 * 1024);
        
        // Nếu file lớn hơn 100MB, bỏ qua xử lý
        if (fileSizeMB > 100) {
          console.log(`⚠️ File quá lớn (${fileSizeMB.toFixed(2)} MB), bỏ qua xử lý tự động`);
          return {
            success: false,
            error: `File quá lớn (${fileSizeMB.toFixed(2)} MB). Vui lòng xử lý thủ công file này.`,
            fileSizeMB: fileSizeMB,
            skipReason: 'FILE_TOO_LARGE'
          };
        }
        
        console.log(`📊 Kích thước file: ${fileSizeMB.toFixed(2)} MB`);
      } catch (error) {
        console.error(`❌ Lỗi khi kiểm tra kích thước file: ${error.message}`);
        // Tiếp tục xử lý nếu không lấy được kích thước
      }
    }
    
    // Nếu không cung cấp đường dẫn đầu ra, tạo đường dẫn mặc định
    if (!outputPath) {
      if (inputPath) {
        outputPath = inputPath.replace('.pdf', '_clean.pdf');
      } else if (isBlocked && fileId) {
        // Tạo đường dẫn mặc định cho file bị chặn
        const tempDir = path.join(os.tmpdir(), uuidv4());
        fs.mkdirSync(tempDir, { recursive: true });
        
        // Kiểm tra xem có bỏ qua xử lý watermark không
        const skipProcessing = config && (config.skipWatermarkRemoval || config.skipImageProcessing || config.preserveOriginal || config.noProcessing);
        const suffix = skipProcessing ? '_original' : '_clean';
        
        outputPath = path.join(tempDir, `TÀI LIỆU${fileId}${suffix}.pdf`);
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
      const fileName = inputPath ? path.basename(inputPath) : `TÀI LIỆU${fileId}.pdf`;
      
      try {
        console.log(`Bắt đầu tải PDF bị chặn...`);
        
        // Thiết lập timeout cho toàn bộ quá trình
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Quá thời gian xử lý (${PROCESS_TIMEOUT/60000} phút)`)), PROCESS_TIMEOUT);
        });
        
        // Chạy quá trình tải với timeout
        result = await Promise.race([
          downloadBlockedPDF(fileId, fileName, path.dirname(outputPath), config),
          timeoutPromise
        ]);
        
        // Kiểm tra kết quả
        if (result) {
          // Nếu là video, trả về ngay
          if (!result.success && result.isVideo) {
            console.log(`🎥 Xác nhận file video`);
            return result;
          }
          
          // Nếu thành công hoặc lỗi Chrome không khởi động được
          if (result.success || result.chromeStartFailed) {
            return result;
          }
        }
        
        // Các trường hợp lỗi khác
        throw new Error(result?.error || 'Không thể tải PDF bị chặn');
      } catch (downloadError) {
        console.error(`❌ Lỗi khi tải PDF bị chặn: ${downloadError.message}`);
        
        // Nếu lỗi là do file video, trả về ngay
        if (downloadError.message === 'NO_PDF_PAGES_DETECTED' && result?.isVideo) {
          console.log(`🎥 Xác nhận file video từ lỗi`);
          return result;
        }
        
        throw downloadError;
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
    
    // Kiểm tra xem có phát hiện trang nào không
    const pageCount = result.processedSize > 0 ? 1 : 0;
    
    // Thêm kiểm tra nếu không có trang nào, có thể là file video
    if (pageCount === 0) {
      console.log(`⚠️ Không phát hiện trang PDF nào, có thể là file video`);
      return {
        success: false,
        error: 'NO_PDF_PAGES_DETECTED',
        isVideo: true,
        fileId: fileId,
        fileName: result.fileName,
        shouldRetry: false // Thêm flag để không retry
      };
    }
    
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

// Hàm kiểm tra và lấy browser đang hoạt động hoặc tạo mới
async function getOrCreateBrowser(profilePath, debugMode = false) {
  try {
    // Tạo ID duy nhất cho profilePath
    const profileId = profilePath.replace(/[^a-zA-Z0-9]/g, '_');
    
    // Kiểm tra xem đã có browser cho profile này chưa
    if (activeBrowsers.has(profileId)) {
      const browserInfo = activeBrowsers.get(profileId);
      
      // Kiểm tra xem browser còn hoạt động không
      try {
        // Thử lấy danh sách pages để kiểm tra browser còn sống không
        const pages = await browserInfo.browser.pages();
        console.log(`✅ Tái sử dụng phiên Chrome đang hoạt động với ${pages.length} tab`);
        
        // Tăng số lượng tham chiếu
        browserInfo.refCount += 1;
        return { browser: browserInfo.browser, isNew: false, profileId };
      } catch (checkError) {
        console.log(`⚠️ Phiên Chrome cũ không còn hoạt động, tạo mới: ${checkError.message}`);
        // Browser không còn hoạt động, xóa khỏi map
        activeBrowsers.delete(profileId);
      }
    }
    
    // Kiểm tra số lượng browser đang hoạt động
    if (activeBrowsers.size >= MAX_CONCURRENT_BROWSERS) {
      console.log(`⚠️ Đã đạt giới hạn ${MAX_CONCURRENT_BROWSERS} phiên Chrome đang chạy, đợi...`);
      
      // Tìm browser ít được sử dụng nhất để đóng
      let leastUsedBrowser = null;
      let minRefCount = Infinity;
      
      for (const [id, info] of activeBrowsers.entries()) {
        if (info.refCount < minRefCount) {
          minRefCount = info.refCount;
          leastUsedBrowser = id;
        }
      }
      
      // Đóng browser ít sử dụng nhất
      if (leastUsedBrowser) {
        try {
          const browserToClose = activeBrowsers.get(leastUsedBrowser);
          console.log(`🔄 Đóng phiên Chrome ít sử dụng nhất để giải phóng tài nguyên`);
          await browserToClose.browser.close();
          activeBrowsers.delete(leastUsedBrowser);
        } catch (closeError) {
          console.warn(`⚠️ Lỗi khi đóng phiên Chrome ít sử dụng: ${closeError.message}`);
          activeBrowsers.delete(leastUsedBrowser);
        }
      }
    }
    
    // Tạo browser mới
    const chromePath = getChromePath();
    console.log(`🌐 Khởi động Chrome mới: ${chromePath}`);
    
    const browser = await puppeteer.launch({
      headless: debugMode ? false : 'new',
      channel: os.platform() === 'win32' ? 'chrome' : undefined,
      executablePath: chromePath,
      args: [
        "--start-maximized",
        `--user-data-dir=${profilePath}`,
        "--enable-extensions",
        "--remote-debugging-port=0", // Sử dụng cổng ngẫu nhiên để tránh xung đột
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
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        "--allow-file-access-from-files",
        "--allow-insecure-localhost",
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "--disable-blink-features=AutomationControlled"
      ],
      defaultViewport: null,
      ignoreDefaultArgs: ["--enable-automation"],
      timeout: 180000,
      slowMo: debugMode ? 100 : 50
    });
    
    // Lưu browser vào map
    activeBrowsers.set(profileId, {
      browser,
      refCount: 1,
      createdAt: Date.now()
    });
    
    return { browser, isNew: true, profileId };
  } catch (error) {
    console.error(`❌ Lỗi khi tạo/lấy phiên Chrome: ${error.message}`);
    throw error;
  }
}

// Hàm giải phóng browser khi không còn sử dụng
async function releaseBrowser(profileId, forceClose = false) {
  if (!activeBrowsers.has(profileId)) return;
  
  const browserInfo = activeBrowsers.get(profileId);
  browserInfo.refCount -= 1;
  
  // Nếu không còn tham chiếu hoặc yêu cầu đóng cưỡng bức
  if (browserInfo.refCount <= 0 || forceClose) {
    try {
      console.log(`🔄 Đóng phiên Chrome không còn sử dụng (profileId: ${profileId})`);
      await browserInfo.browser.close();
    } catch (closeError) {
      console.warn(`⚠️ Lỗi khi đóng phiên Chrome: ${closeError.message}`);
    } finally {
      activeBrowsers.delete(profileId);
    }
  }
}

// Hàm dọn dẹp các browser không sử dụng sau một thời gian
setInterval(() => {
  const now = Date.now();
  const MAX_IDLE_TIME = 10 * 60 * 1000; // 10 phút
  
  for (const [profileId, browserInfo] of activeBrowsers.entries()) {
    // Nếu không còn tham chiếu và đã tồn tại quá lâu
    if (browserInfo.refCount <= 0 && (now - browserInfo.createdAt > MAX_IDLE_TIME)) {
      releaseBrowser(profileId, true).catch(err => {
        console.warn(`⚠️ Lỗi khi dọn dẹp browser: ${err.message}`);
      });
    }
  }
}, 5 * 60 * 1000); // Kiểm tra mỗi 5 phút

/**
 * Tải file PDF từ Google Drive bị chặn tải xuống
 * Sử dụng puppeteer để mở PDF viewer và chụp lại các trang
 * @param {string} fileId - ID của file Google Drive
 * @param {string} fileName - Tên file để lưu
 * @param {string} tempDir - Thư mục tạm để lưu các file trung gian
 * @param {Object} watermarkConfig - Cấu hình xử lý watermark (tùy chọn)
 * @returns {Promise<{success: boolean, filePath: string, error: string}>}
 */
export async function downloadBlockedPDF(fileId, fileName, tempDir, watermarkConfig = {}) {
  console.log(`🚀 [CHROME] Bắt đầu xử lý file bị chặn: fileId=${fileId}, fileName=${fileName}`);
  
  // Kiểm tra MIME type của file trước khi xử lý
  try {
    const { google } = require('googleapis');
    const { createOAuth2Client } = require('@/utils/drive-utils');
    const oAuth2Client = await createOAuth2Client();
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });

    const file = await drive.files.get({
      fileId: fileId,
      fields: 'id,name,mimeType',
      supportsAllDrives: true
    });

    // Kiểm tra nếu file là video
    if (file.data.mimeType.includes('video')) {
      console.log(`🎥 Phát hiện file video: ${file.data.mimeType}`);
      return {
        success: false,
        error: 'NO_PDF_PAGES_DETECTED',
        isVideo: true,
        fileId: fileId,
        fileName: fileName,
        shouldRetry: false
      };
    }
  } catch (error) {
    console.warn(`⚠️ Không thể kiểm tra MIME type: ${error.message}`);
    // Tiếp tục xử lý nếu không kiểm tra được MIME type
  }
  
  let browser = null;
  let page = null;
  let downloadedImages = [];
  let processedImages = [];
  const pageRequests = new Map();
  let cookies = null;
  let userAgent = null;
  let chromeStartFailed = false;
  let browserProfileId = null;
  
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
  
  // Lưu thông tin cấu hình
  const debugMode = watermarkConfig && watermarkConfig.debugMode === true;
  
  // Log thông tin về chế độ debug
  if (debugMode) {
    console.log(`🔍 CHẾ ĐỘ DEBUG: Chrome sẽ được hiển thị (KHÔNG chạy ở chế độ headless)`);
  }
  
  const outputPath = path.join(tempDir, `${path.basename(fileName, '.pdf')}_clean.pdf`);
  
  // Ghi lại thời gian bắt đầu
  const startTime = Date.now();
  
  // Kiểm tra xem có bỏ qua xử lý watermark không
  const skipProcessing = watermarkConfig && (
    watermarkConfig.skipWatermarkRemoval || 
    watermarkConfig.skipImageProcessing || 
    watermarkConfig.preserveOriginal || 
    watermarkConfig.noProcessing
  );
  
  // Log rõ ràng về chế độ xử lý
  if (skipProcessing) {
    console.log(`⚠️ CHẾ ĐỘ KHÔNG XỬ LÝ WATERMARK: Sẽ tải file gốc không xử lý watermark`);
  } else {
    console.log(`🔧 CHẾ ĐỘ XỬ LÝ WATERMARK: Sẽ xử lý watermark trên file`);
  }
  
  // Kết hợp config mặc định với config được truyền vào
  const config = { 
    ...DEFAULT_CONFIG, 
    ...watermarkConfig,
    isBlockedFile: true,
    enhancedMode: !skipProcessing,
    brightnessBoost: skipProcessing ? 1.0 : (watermarkConfig.brightnessBoost || 1.05),
    contrastBoost: skipProcessing ? 1.0 : (watermarkConfig.contrastBoost || 1.25),
    sharpenAmount: skipProcessing ? 0 : (watermarkConfig.sharpenAmount || 1.8),
    saturationAdjust: skipProcessing ? 1.0 : (watermarkConfig.saturationAdjust || 1.3),
    preserveColors: skipProcessing ? true : (watermarkConfig.preserveColors !== undefined ? watermarkConfig.preserveColors : true),
    extraWhitening: skipProcessing ? false : (watermarkConfig.extraWhitening || false),
    aggressiveWatermarkRemoval: skipProcessing ? false : (watermarkConfig.aggressiveWatermarkRemoval || false),
    skipProcessing: skipProcessing
  };
  
  let fileSize = 0;
  
  try {
    console.log(`🔍 Bắt đầu xử lý file bị chặn: ${fileName}`);
    
    // Sử dụng hàm getOrCreateBrowser thay vì khởi tạo trực tiếp
    try {
      const browserResult = await getOrCreateBrowser(profilePath, debugMode);
      browser = browserResult.browser;
      browserProfileId = browserResult.profileId;
      console.log(`🌐 ${browserResult.isNew ? 'Tạo mới' : 'Tái sử dụng'} phiên Chrome thành công`);
    } catch (browserError) {
      console.error(`Lỗi khởi tạo trình duyệt: ${browserError.message}`);
      chromeStartFailed = true;
      throw new Error(`Không thể khởi động Chrome: ${browserError.message}`);
    }
    
    // Tạo tab mới
    try {
      page = await browser.newPage();
      await page.setDefaultNavigationTimeout(120000);
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
        timeout: 300000
      });

      // Kiểm tra xem có phải là file video không
      const isVideo = await page.evaluate(() => {
        // Kiểm tra các element đặc trưng của trình xem video
        const videoPlayer = document.querySelector('.drive-viewer-video-player') || 
                          document.querySelector('video') ||
                          document.querySelector('[aria-label*="video"]');
        return !!videoPlayer;
      });

      if (isVideo) {
        console.log(`🎥 Phát hiện file video qua Chrome`);
        return {
          success: false,
          error: 'NO_PDF_PAGES_DETECTED',
          isVideo: true,
          fileId: fileId,
          fileName: fileName,
          shouldRetry: false
        };
      }

    } catch (navigationError) {
      console.error(`Lỗi mở file từ Drive: ${navigationError.message}`);
      throw new Error(`Không thể mở file từ Google Drive: ${navigationError.message}`);
    }
    
    // Scroll để tải tất cả các trang
    try {
      console.log(`📜 Bắt đầu scroll để tải trang...`);
      await scrollToLoadAllPages(page, pageRequests);
      console.log(`📊 Đã phát hiện ${pageRequests.size} trang`);

      // Kiểm tra số trang ngay sau khi scroll
      if (pageRequests.size === 0) {
        console.log(`⚠️ Không phát hiện trang PDF nào, có thể là file video`);
        return {
          success: false,
          error: 'NO_PDF_PAGES_DETECTED',
          isVideo: true,
          fileId: fileId,
          fileName: fileName,
          shouldRetry: false // Thêm flag để không retry
        };
      }
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
    
    // Chuyển đổi định dạng ảnh trước khi xử lý
    const pngImages = await convertAllImagesToPng(downloadedImages, imagesDir);
    
    // Xác định có cần xử lý watermark hay không
    if (true) {
      // Bỏ qua xử lý watermark và sử dụng ảnh gốc trực tiếp
      console.log(`⏭️ BỎ QUA bước xử lý watermark theo cấu hình...`);
      processedImages = pngImages;
    } else {
      // Xử lý watermark
      try {
        console.log(`🔧 Bắt đầu xử lý watermark cho ${pngImages.length} trang...`);
        processedImages = await processAllImages(pngImages, processedDir, config);
        console.log(`✅ Đã xử lý watermark cho ${processedImages.length} trang`);
      } catch (processError) {
        console.error(`❌ Lỗi xử lý watermark: ${processError.message}`);
        console.log(`⚠️ Sử dụng ảnh gốc không xử lý watermark do lỗi`);
        // Fallback sử dụng ảnh gốc nếu xử lý thất bại
        processedImages = pngImages;
      }
    }
    
    // Tạo file PDF từ các ảnh đã xử lý
    try {
      console.log(`📄 Tạo file PDF từ ${processedImages.length} ảnh đã xử lý...`);
      
      // Kiểm tra xem có bỏ qua bước xử lý watermark không
      if (config.preserveOriginal || config.skipWatermarkRemoval) {
        console.log(`⏭️ Tạo PDF gốc không thêm logo theo yêu cầu...`);
        await createPDFFromRawImages(processedImages, outputPath);
      } 
      else {
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
      
      fileSize = fs.statSync(outputPath).size;
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
      originalSize: 0,
      processedSize: fileSize,
      processingTime: processingTime.toFixed(2),
      pageCount: processedImages.length,
      emptyFile: processedImages.length === 0,
      chromeStartFailed: chromeStartFailed
    };
  } catch (error) {
    console.error(`❌ Lỗi tải file bị chặn: ${error.message}`);
    return {
      success: false,
      error: error.message,
      chromeStartFailed: chromeStartFailed
    };
  } finally {
    // Giải phóng browser thay vì đóng trực tiếp
    if (browserProfileId) {
      try {
        // Đóng page nếu còn mở
        if (page) {
          try {
            await page.close().catch(() => {});
          } catch (closeError) {
            console.warn(`Lỗi đóng tab: ${closeError.message}`);
          }
        }
        
        // Giải phóng browser
        await releaseBrowser(browserProfileId, false);
      } catch (releaseError) {
        console.warn(`⚠️ Lỗi khi giải phóng phiên Chrome: ${releaseError.message}`);
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
    
    // Giữ lại thư mục hồ sơ Chrome
    try {
      console.log(`✅ Giữ lại hồ sơ Chrome để lưu đăng nhập cho lần sau: ${profilePath}`);
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
    const MAX_NO_NEW_PAGES = 3;
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
    
    // Kiểm tra xem có bỏ qua xử lý không
    if (config.noProcessing || config.skipWatermarkRemoval || config.skipImageProcessing || config.preserveOriginal) {
      console.log(`⏭️ Bỏ qua hoàn toàn bước xử lý watermark theo yêu cầu...`);
      
      // Tạo bản sao của ảnh với tên file đã xử lý để duy trì luồng xử lý
      for (let i = 0; i < sortedImages.length; i++) {
        const imagePath = sortedImages[i];
        let pageNum;
        try {
          pageNum = parseInt(path.basename(imagePath).match(/page_(\d+)/)[1]);
        } catch (parseError) {
          pageNum = i + 1;
        }
        
        const processedPath = path.join(outputDir, `page_${String(pageNum).padStart(3, '0')}_processed.png`);
        fs.copyFileSync(imagePath, processedPath);
        console.log(`✅ Đã sao chép trang ${pageNum} (không xử lý watermark)`);
        processedImages.push(processedPath);
      }
      
      return processedImages;
    }
    
    // Sử dụng cấu hình nâng cao để xử lý mạnh hơn với file bị khóa
    const enhancedConfig = {
      // Giữ độ mờ nền từ cấu hình gốc
      backgroundOpacity: config.backgroundOpacity || 0.15,
      // Thêm các tham số xử lý nâng cao
      enhancedMode: true,
      contrastBoost: config.contrastBoost || 1.25,     // Tăng từ 1.2 lên 1.25 để tăng độ nét
      brightnessBoost: config.brightnessBoost || 1.05,   // Giữ nguyên để giữ nội dung
      sharpenAmount: config.sharpenAmount || 1.8,        // Tăng từ 1.5 lên 1.8 để tăng độ nét tối đa
      saturationAdjust: config.saturationAdjust || 1.3,  // Giữ nguyên để giữ màu sắc
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
              // Thay thế sharpen bằng phương pháp thay thế
              .linear(1.3, -0.1)
              .recomb([
                [1.1, 0, 0],
                [0, 1.1, 0],
                [0, 0, 1.1]
              ]);
              
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
                // Thay thế sharpen bằng phương pháp thay thế
                .linear(1.2, -0.05)
                .recomb([
                  [1.05, 0, 0],
                  [0, 1.05, 0],
                  [0, 0, 1.05]
                ])
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
                // Thay thế sharpen bằng phương pháp thay thế
                .linear(1.25, -0.08)
                .recomb([
                  [1.08, 0, 0],
                  [0, 1.08, 0],
                  [0, 0, 1.08]
                ])
                .png({ quality: 100 })
                .toBuffer();
            }
            
            // Xử lý đặc biệt cho watermark khi giữ màu sắc
            if (enhancedConfig.preserveColors) {
              console.log(`🎨 Áp dụng xử lý giữ màu sắc cho trang ${pageNum}...`);
              
              // Sử dụng phương pháp giữ màu sắc và loại bỏ watermark
              processedBuffer = await sharp(processedBuffer)
                // Thay thế sharpen bằng phương pháp thay thế
                .linear(1.3, -0.12)
                .recomb([
                  [1.12, 0, 0],
                  [0, 1.12, 0],
                  [0, 0, 1.12]
                ])
                // Tăng độ tương phản nhẹ để làm rõ văn bản
                .linear(
                  1.25, // Tăng từ 1.2 lên 1.25
                  -0.03 // Giữ nguyên
                )
                // Tăng độ bão hòa màu một chút nữa
                .modulate({
                  saturation: 1.3, // Giữ nguyên
                  brightness: 1.05 // Giữ nguyên
                })
                // Thêm bước xử lý cuối cùng để tăng độ nét
                .recomb([
                  [1.1, 0, 0],    // Tăng kênh đỏ lên 10%
                  [0, 1.1, 0],    // Tăng kênh xanh lá lên 10%
                  [0, 0, 1.1]     // Tăng kênh xanh dương lên 10%
                ])
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