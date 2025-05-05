// Script tạo cookies cho YouTube sử dụng Puppeteer
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Tạo các thư mục cần thiết
const COOKIES_PATH = path.join(process.cwd(), 'youtube_cookies.json');
const LOGS_DIR = path.join(process.cwd(), 'logs');

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  console.log(`Đã tạo thư mục logs tại: ${LOGS_DIR}`);
}

async function createYouTubeCookies() {
  console.log('Khởi động trình duyệt...');
  
  // Khởi động puppeteer
  const browser = await puppeteer.launch({
    headless: false, // Hiển thị trình duyệt để người dùng có thể thao tác
    defaultViewport: null,
    args: ['--start-maximized'] // Mở cửa sổ toàn màn hình
  });
  
  const page = await browser.newPage();
  
  try {
    // Mở trang YouTube
    console.log('Đang mở trang YouTube...');
    await page.goto('https://www.youtube.com/', { waitUntil: 'networkidle2' });
    
    // Tìm và nhấp vào nút đăng nhập
    console.log('Đang tìm nút đăng nhập...');
    await page.waitForSelector('ytd-button-renderer a, ytd-button-renderer button, a.sign-in, .sign-in button', { timeout: 5000 })
      .then(async (button) => {
        console.log('Nhấp vào nút đăng nhập...');
        await button.click();
      })
      .catch(() => {
        console.log('Không tìm thấy nút đăng nhập. Có thể đã ở trang đăng nhập hoặc đã đăng nhập rồi.');
      });
    
    // Thông báo cho người dùng
    console.log('\n⚠️ HƯỚNG DẪN ⚠️');
    console.log('1. Hãy đăng nhập vào tài khoản YouTube của bạn trong cửa sổ trình duyệt vừa mở');
    console.log('2. Sau khi đăng nhập thành công và thấy trang chủ YouTube, quay lại đây và nhấn Enter');
    
    // Đợi người dùng nhấn Enter sau khi đăng nhập
    process.stdout.write('Nhấn Enter sau khi đã đăng nhập thành công: ');
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
    
    // Lấy cookies
    console.log('Đang lấy cookies...');
    const cookies = await page.cookies();
    
    // Lưu cookies vào file
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    console.log(`Đã lưu cookies thành công vào: ${COOKIES_PATH}`);
    
    return cookies;
  } catch (error) {
    console.error('Đã xảy ra lỗi:', error);
    throw error;
  } finally {
    // Đóng trình duyệt
    await browser.close();
    console.log('Đã đóng trình duyệt');
  }
}

// Thực thi chính
createYouTubeCookies()
  .then(() => {
    console.log('Quá trình tạo cookies hoàn tất! Bạn có thể sử dụng hệ thống tự động tải video lên YouTube.');
  })
  .catch((error) => {
    console.error('Lỗi khi tạo cookies:', error);
  }); 