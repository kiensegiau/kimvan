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
import { cleanupTempFiles } from './utils.js';
import { DEFAULT_CONFIG } from './config.js';

// Import các hàm xử lý watermark từ module watermark.js
import { 
  processImage, 
  addCustomBackground,
  createPDFFromProcessedImages,
  createPDFFromRawImages
} from './watermark.js';

// Hằng số
const MAX_CONCURRENT = 2;
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;
const BATCH_SIZE = 5;

// Đường dẫn Chrome mặc định dựa trên hệ điều hành
function getChromePath() {
  switch (os.platform()) {
    case 'win32':
      return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    case 'darwin': // macOS
      return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    default: // Linux và các hệ điều hành khác
      return '/usr/bin/google-chrome';
  }
}

// Tạo thư mục hồ sơ người dùng Chrome
function createChromeUserProfile() {
  // Sử dụng thư mục cố định thay vì tạo mới mỗi lần
  const profilePath = path.join(os.homedir(), 'drive-pdf-watermark-profile');
  fs.mkdirSync(profilePath, { recursive: true });
  console.log(`🔑 Sử dụng hồ sơ Chrome tại: ${profilePath}`);
  return profilePath;
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
    tempDir = path.join(os.tmpdir(), uuidv4());
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const imagesDir = path.join(tempDir, 'images');
  const processedDir = path.join(tempDir, 'processed');
  fs.mkdirSync(imagesDir, { recursive: true });
  fs.mkdirSync(processedDir, { recursive: true });
  
  // Tạo thư mục hồ sơ cho Chrome
  const profilePath = createChromeUserProfile();
  
  const outputPath = path.join(tempDir, `${path.basename(fileName, '.pdf')}_clean.pdf`);
  
  // Ghi lại thời gian bắt đầu
  const startTime = Date.now();
  
  // Kết hợp config mặc định với config được truyền vào
  const config = { ...DEFAULT_CONFIG, ...watermarkConfig };
  
  try {
    console.log(`🔍 Bắt đầu xử lý file bị chặn: ${fileName}`);
    
    // Cấu hình mở rộng cho Puppeteer
    const chromePath = getChromePath();
    console.log(`🌐 Sử dụng Chrome: ${chromePath}`);
    
    // Khởi tạo trình duyệt với cấu hình nâng cao
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
      ],
      defaultViewport: null,
      ignoreDefaultArgs: ["--enable-automation"],
      // Tăng timeout lên 120s cho máy yếu
      timeout: 120000,
      // Thêm slowMo để làm chậm puppeteer cho máy yếu
      slowMo: 100,
    });
    
    // Tạo tab mới
    page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);
    
    // Theo dõi các request ảnh
    await page.setRequestInterception(true);
    page.on('request', (request) => {
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
    });
    
    // Mở file PDF trên Google Drive
    console.log(`🌐 Mở PDF viewer cho file: ${fileId}`);
    await page.goto(`https://drive.google.com/file/d/${fileId}/view`, {
      waitUntil: 'networkidle2',
      timeout: 300000 // Tăng timeout cho trang để tải trọn vẹn
    });
    
    // Scroll để tải tất cả các trang
    console.log(`📜 Bắt đầu scroll để tải trang...`);
    await scrollToLoadAllPages(page, pageRequests);
    console.log(`📊 Đã phát hiện ${pageRequests.size} trang`);
    
    // Lưu cookies và userAgent để tải ảnh sau này
    cookies = await page.cookies();
    userAgent = await page.evaluate(() => navigator.userAgent);
    
    // Đóng page sau khi lấy thông tin
    await page.close();
    page = null;
    
    // Tải xuống các ảnh trang
    console.log(`📥 Tải xuống ${pageRequests.size} trang...`);
    downloadedImages = await downloadAllPageImages(pageRequests, cookies, userAgent, imagesDir);
    
    // Xử lý watermark trên từng ảnh - sử dụng hàm từ module watermark
    console.log(`🔧 Xử lý watermark trên ${downloadedImages.length} ảnh...`);
    // Chuyển đổi ảnh webp sang png trước khi xử lý watermark
    const pngImages = await convertAllImagesToPng(downloadedImages, imagesDir);
    // Sau đó xử lý watermark trên các ảnh đã chuyển đổi
    processedImages = await processAllImages(pngImages, processedDir, config);
    
    // Tạo file PDF từ các ảnh đã xử lý
    console.log(`📄 Tạo file PDF từ ${processedImages.length} ảnh đã xử lý...`);
    
    // Thêm hình nền nếu được cấu hình
    if (config.backgroundImage && fs.existsSync(config.backgroundImage)) {
      console.log(`🖼️ Thêm hình nền tùy chỉnh: ${config.backgroundImage}`);
      await createPDFFromProcessedImages(processedImages, outputPath, config);
    } else {
      await createPDFFromRawImages(processedImages, outputPath);
    }
    
    // Kiểm tra file PDF đã tạo
    if (!fs.existsSync(outputPath)) {
      throw new Error('Không thể tạo file PDF');
    }
    
    const fileSize = fs.statSync(outputPath).size;
    if (fileSize === 0) {
      throw new Error('File PDF được tạo nhưng kích thước bằng 0');
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
      await page.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
    
    // Dọn dẹp các file ảnh tạm
    try {
      for (const image of [...downloadedImages, ...processedImages]) {
        if (fs.existsSync(image)) {
          fs.unlinkSync(image);
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
      for (let i = 0; i < SPACE_PRESSES_PER_BATCH; i++) {
        await page.keyboard.press('Space');
        await new Promise(resolve => setTimeout(resolve, SCROLL_INTERVAL));
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
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Space');
      await new Promise(resolve => setTimeout(resolve, 1000));
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
  const downloadedImages = [];
  const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  
  // Sắp xếp các trang theo thứ tự tăng dần
  const pages = Array.from(pageRequests.entries()).sort(([a], [b]) => a - b);
  
  // Chia thành các batch để tránh quá tải
  for (let i = 0; i < pages.length; i += BATCH_SIZE) {
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
          fs.writeFileSync(imagePath, Buffer.from(response.data));
          console.log(`✅ Đã tải trang ${pageNum} (${extension})`);
          
          // Thêm vào danh sách ảnh đã tải
          downloadedImages[pageNum] = imagePath;
          break;
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
    await Promise.all(downloadPromises);
    
    // Đợi giữa các batch để tránh quá tải
    if (i + BATCH_SIZE < pages.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Trả về mảng chỉ chứa các đường dẫn hợp lệ
  return downloadedImages.filter(Boolean);
}

/**
 * Chuyển đổi tất cả ảnh sang định dạng PNG
 * @param {Array<string>} images - Mảng đường dẫn đến ảnh
 * @param {string} outputDir - Thư mục để lưu ảnh đã chuyển đổi
 * @returns {Promise<Array<string>>} - Mảng các đường dẫn đến ảnh đã chuyển đổi
 */
async function convertAllImagesToPng(images, outputDir) {
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
    const imagePath = sortedImages[i];
    const pageNum = parseInt(path.basename(imagePath).match(/page_(\d+)/)[1]);
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
  }
  
  return convertedImages;
}

/**
 * Xử lý tất cả các ảnh bằng cách sử dụng hàm processImage từ module watermark
 * @param {Array<string>} images - Mảng đường dẫn đến ảnh
 * @param {string} outputDir - Thư mục để lưu ảnh đã xử lý
 * @param {Object} config - Cấu hình xử lý watermark
 * @returns {Promise<Array<string>>} - Mảng các đường dẫn đến ảnh đã xử lý
 */
async function processAllImages(images, outputDir, config) {
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
  
  // Sử dụng cấu hình tối giản để tránh mất màu
  const simpleConfig = {
    backgroundOpacity: config.backgroundOpacity || 0.15
  };
  
  console.log(`🔧 Sử dụng cấu hình tối giản để giữ màu sắc gốc và xử lý nhẹ watermark`);
  
  // Xử lý từng ảnh
  for (let i = 0; i < sortedImages.length; i++) {
    const imagePath = sortedImages[i];
    const pageNum = parseInt(path.basename(imagePath).match(/page_(\d+)/)[1]);
    
    // Luôn sử dụng .png cho file đã xử lý để đảm bảo tương thích
    const processedPath = path.join(outputDir, `page_${String(pageNum).padStart(3, '0')}_processed.png`);
    
    try {
      console.log(`🔍 Xử lý watermark trang ${pageNum}...`);
      
      // Sử dụng hàm processImage từ module watermark trực tiếp trên ảnh gốc
      // Bỏ qua bước tiền xử lý để giữ màu sắc
      await processImage(imagePath, processedPath, simpleConfig);
      console.log(`✅ Đã xử lý xong trang ${pageNum}`);
      
      // Thêm vào danh sách ảnh đã xử lý
      processedImages.push(processedPath);
    } catch (error) {
      console.error(`❌ Lỗi xử lý watermark trang ${pageNum}: ${error.message}`);
      // Nếu xử lý thất bại, sử dụng ảnh gốc
      processedImages.push(imagePath);
    }
  }
  
  return processedImages;
} 