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
  const config = { ...DEFAULT_CONFIG, ...watermarkConfig };
  
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
      
      // Thêm hình nền nếu được cấu hình và không bỏ qua xử lý nền
      if (!config.skipBackground && config.backgroundImage && fs.existsSync(config.backgroundImage)) {
        console.log(`🖼️ Thêm hình nền tùy chỉnh: ${config.backgroundImage}`);
        await createPDFFromProcessedImages(processedImages, outputPath, config);
      } else {
        if (config.skipBackground) {
          console.log('⏩ Bỏ qua xử lý hình nền theo cấu hình');
        }
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
    let processedImages = [];
    
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
      backgroundOpacity: config.backgroundOpacity || 0.15,
      skipWatermarkRemoval: config.skipWatermarkRemoval || false,
      skipBackground: config.skipBackground || false
    };
    
    console.log(`🔧 Sử dụng cấu hình tối giản để giữ màu sắc gốc và xử lý nhẹ watermark ${simpleConfig.skipWatermarkRemoval ? '(bỏ qua xử lý watermark)' : ''} ${simpleConfig.skipBackground ? '(bỏ qua xử lý nền)' : ''}`);

    // Nếu bỏ qua xử lý watermark, sử dụng trực tiếp ảnh gốc
    if (simpleConfig.skipWatermarkRemoval) {
      console.log('⏩ Bỏ qua xử lý watermark, sử dụng ảnh gốc...');
      processedImages = sortedImages;
    } else {
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
        } catch (pageError) {
          console.error(`Lỗi xử lý trang thứ ${i+1}: ${pageError.message}`);
        }
      }
    }
    
    return processedImages;
  } catch (error) {
    console.error(`❌ Lỗi xử lý tất cả ảnh: ${error.message}`);
    throw error;
  }
} 