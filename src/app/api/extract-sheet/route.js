import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

// Thư mục kết quả
const resultsDir = path.join(process.cwd(), 'results');

// Đảm bảo thư mục tồn tại
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

/**
 * Hàm tiện ích để chờ một khoảng thời gian
 * @param {number} ms - Số mili giây cần chờ
 * @returns {Promise<void>}
 */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Chuyển đổi URL Google Sheets sang chế độ preview
 * @param {string} url - URL Google Sheets
 * @returns {string} URL đã chuyển đổi
 */
function convertToPreviewMode(url) {
  if (!url) return url;
  
  if (url.includes('docs.google.com/spreadsheets')) {
    return url.replace(/\/edit(\?|#|$)/, '/preview$1');
  }
  
  return url;
}

/**
 * Tải trang Google Sheets và lưu HTML/screenshot
 * @param {string} url - URL của Google Sheets
 * @returns {Promise<Object>} Kết quả và đường dẫn đến tệp đã lưu
 */
async function captureSheetData(url) {
  let browser = null;
  
  try {
    console.log(`===== BẮT ĐẦU TẢI TRANG GOOGLE SHEETS =====`);
    console.log(`URL: ${url}`);
    
    // Chuyển đổi URL sang chế độ preview nếu cần
    const previewUrl = convertToPreviewMode(url);
    if (previewUrl !== url) {
      console.log(`Đã chuyển đổi sang URL preview: ${previewUrl}`);
      url = previewUrl;
    }
    
    // Tạo thư mục kết quả cho phiên này
    const timestamp = Date.now();
    const sessionDir = path.join(resultsDir, `session-${timestamp}`);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    
    // Khởi động trình duyệt
    console.log('Khởi động trình duyệt Chrome...');
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1280, height: 900 },
      args: ['--no-sandbox', '--start-maximized']
    });
    
    // Mở trang mới
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    
    // Điều hướng đến URL
    console.log(`Đang tải trang: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
    
    // Đợi thêm cho nội dung tải hoàn tất
    console.log('Đợi 5 giây để đảm bảo trang đã tải hoàn tất...');
    await wait(5000);
    
    // Lấy tiêu đề trang
    const title = await page.title();
    console.log(`Tiêu đề trang: ${title}`);
    
    // Chụp ảnh màn hình
    const screenshotPath = path.join(sessionDir, 'screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Đã lưu ảnh chụp màn hình: ${screenshotPath}`);
    
    // Lưu HTML của trang
    const htmlPath = path.join(sessionDir, 'page.html');
    const htmlContent = await page.content();
    fs.writeFileSync(htmlPath, htmlContent);
    console.log(`Đã lưu HTML của trang: ${htmlPath}`);
    
    // Tạo tệp thông tin
    const infoPath = path.join(sessionDir, 'info.json');
    const info = {
      url: url,
      title: title,
      timestamp: timestamp,
      userAgent: await page.evaluate(() => navigator.userAgent),
      viewportSize: await page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight
      }))
    };
    fs.writeFileSync(infoPath, JSON.stringify(info, null, 2));
    
    // Hiển thị thời gian chờ
    console.log('Đợi thêm 10 giây trước khi đóng trình duyệt...');
    await wait(10000);
    
    // Trả về kết quả thành công
    return {
      success: true,
      message: 'Đã tải trang Google Sheets thành công',
      sessionDir: sessionDir,
      title: title,
      timestamp: timestamp,
      files: {
        screenshot: path.relative(process.cwd(), screenshotPath),
        html: path.relative(process.cwd(), htmlPath),
        info: path.relative(process.cwd(), infoPath)
      }
    };
  } catch (error) {
    console.error('Lỗi khi tải trang:', error);
    return {
      success: false,
      error: error.message,
      timestamp: Date.now()
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log('Đã đóng trình duyệt');
      } catch (e) {
        console.error('Lỗi khi đóng trình duyệt:', e);
      }
    }
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
    
    // Gọi hàm tải trang
    const result = await captureSheetData(url);
    
    // Trả về kết quả
    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(
        { error: 'Không thể tải trang', detail: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Lỗi không xác định:', error);
    return NextResponse.json(
      { error: `Lỗi: ${error.message}` },
      { status: 500 }
    );
  }
}