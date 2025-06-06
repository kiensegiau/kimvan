import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import puppeteer from 'puppeteer';

// Thư mục kết quả
const resultsDir = path.join(process.cwd(), 'results');

// Đảm bảo thư mục tồn tại
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

/**
 * Chuyển đổi URL Google Sheets từ mode edit sang preview nếu cần
 * @param {string} url - URL Google Sheets cần kiểm tra
 * @returns {string} URL đã được chuyển đổi sang chế độ preview
 */
function convertToPreviewMode(url) {
  if (!url) return url;
  
  // Kiểm tra xem URL có phải là Google Sheets không
  if (url.includes('docs.google.com/spreadsheets')) {
    // Chuyển đổi từ /edit sang /preview
    return url.replace(/\/edit(\?|#|$)/, '/preview$1');
  }
  
  return url;
}

/**
 * Mở trình duyệt Chrome và tải Google Sheets link
 * @param {string} url - URL của Google Sheets
 * @returns {Promise<Object>} Kết quả mở trình duyệt
 */
async function openBrowserWithGoogleSheets(url) {
  try {
    console.log(`===== BẮT ĐẦU MỞ TRÌNH DUYỆT VỚI GOOGLE SHEETS =====`);
    console.log(`URL gốc: ${url}`);
    
    // Chuyển đổi URL sang chế độ preview nếu là Google Sheets
    const previewUrl = convertToPreviewMode(url);
    if (previewUrl !== url) {
      console.log(`Đã chuyển đổi sang URL preview: ${previewUrl}`);
      url = previewUrl;
    }
    
    // Đường dẫn đến thư mục dữ liệu người dùng Chrome
    const userDataDir = path.join(process.cwd(), 'chrome-user-data');
    
    // Đảm bảo thư mục tồn tại
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
    
    // Khởi động trình duyệt với cấu hình an toàn
    console.log('Khởi động trình duyệt Chrome...');
    
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      userDataDir: userDataDir,
      args: [
        '--start-maximized',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080'
      ]
    });
    
    try {
      const page = await browser.newPage();
      
      // Cài đặt để tránh phát hiện là trình duyệt tự động
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        delete navigator.__proto__.webdriver;
        
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
        
        Object.defineProperty(navigator, 'userAgent', {
          get: () => "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        });
      });
      
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1280, height: 800 });
      
      // Hiển thị thông báo trong console của trang
      await page.evaluateOnNewDocument(() => {
        console.log('%cGoogle Sheets Viewer', 'font-size: 20px; color: blue; font-weight: bold');
        console.log('Đang mở Google Sheets ở chế độ Preview, vui lòng đợi...');
        console.log('Nếu cần đăng nhập, vui lòng đăng nhập Gmail trong cửa sổ này');
      });
      
      // Mở trang
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
      
      // Chụp ảnh màn hình để lưu kết quả
      const timestamp = Date.now();
      const screenshotName = `sheets-screenshot-${timestamp}.png`;
      const screenshotPath = path.join(resultsDir, screenshotName);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      
      console.log(`Đã chụp ảnh màn hình: ${screenshotPath}`);
      
      // Lấy tiêu đề trang
      const title = await page.title();
      
      // Chờ thêm một thời gian để người dùng có thể xem trang
      // Không đóng trình duyệt tự động để người dùng có thể tương tác
      
      return {
        success: true,
        message: 'Đã mở trình duyệt và tải Google Sheets thành công',
        title: title,
        screenshot: screenshotName,
        url: url,
        isPreviewMode: url.includes('/preview'),
        timestamp: timestamp
      };
    } catch (error) {
      console.error('Lỗi khi mở Google Sheets:', error);
      
      // Đóng trình duyệt khi có lỗi
      await browser.close();
      
      return {
        success: false,
        error: error.message,
        url: url,
        timestamp: Date.now()
      };
    }
  } catch (error) {
    console.error('Lỗi khi mở trình duyệt:', error);
    
    return {
      success: false,
      error: error.message,
      timestamp: Date.now()
    };
  }
}

export async function GET(request) {
  try {
    // Lấy URL từ query params
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    
    if (!url) {
      return NextResponse.json({ error: 'URL không được cung cấp' }, { status: 400 });
    }
    
    // Timestamp cho header
    const timestamp = Date.now();
    const responseHeaders = {
      'X-Timestamp': `${timestamp}`,
      'X-Cache-Control': 'no-cache'
    };
    
    console.log('==============================================');
    console.log(`Test mở trình duyệt với URL: ${url}`);
    console.log(`Timestamp: ${timestamp}`);
    console.log('==============================================');
    
    // Gọi hàm mở trình duyệt
    const result = await openBrowserWithGoogleSheets(url);
    
    if (result.success) {
      return NextResponse.json(result, {
        headers: responseHeaders
      });
    } else {
      return NextResponse.json(
        {
          error: 'Không thể mở trình duyệt với Google Sheets',
          detail: result.error,
          timestamp: timestamp
        },
        {
          status: 500,
          headers: responseHeaders
        }
      );
    }
  } catch (error) {
    console.error('Lỗi không xác định:', error);
    
    return NextResponse.json(
      { 
        error: `Lỗi: ${error.message}`,
        timestamp: Date.now()
      },
      { status: 500 }
    );
  }
} 