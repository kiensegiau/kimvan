// Script tạo và duy trì đăng nhập YouTube liên tục
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Đường dẫn hồ sơ Chrome cố định
const CHROME_PROFILE_PATH = path.join(os.homedir(), 'youtube-upload-profile');
// Đường dẫn lưu cookies
const COOKIES_PATH = path.join(process.cwd(), 'youtube_cookies.json');
// Đường dẫn Chrome mặc định theo hệ điều hành
const CHROME_PATH = getChromePath();

/**
 * Lấy đường dẫn Chrome dựa trên hệ điều hành
 */
function getChromePath() {
  switch (os.platform()) {
    case 'win32':
      return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    case 'darwin': // macOS
      return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    default: // Linux
      return '/usr/bin/google-chrome';
  }
}

/**
 * Tạo thư mục hồ sơ Chrome nếu chưa tồn tại
 */
function createProfileDir() {
  if (!fs.existsSync(CHROME_PROFILE_PATH)) {
    console.log(`Tạo thư mục hồ sơ Chrome: ${CHROME_PROFILE_PATH}`);
    fs.mkdirSync(CHROME_PROFILE_PATH, { recursive: true });
  }
  return CHROME_PROFILE_PATH;
}

/**
 * Mở Chrome và đăng nhập YouTube
 */
async function openAndLoginYouTube() {
  console.log('Khởi tạo trình duyệt với hồ sơ cố định...');
  
  // Đảm bảo thư mục hồ sơ tồn tại
  createProfileDir();
  
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: CHROME_PATH,
    userDataDir: CHROME_PROFILE_PATH,
    args: [
      '--start-maximized',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--disable-notifications',
      // Thêm các cờ để ngăn cảnh báo bảo mật
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--disable-features=IsolateOrigins',
      '--disable-site-isolation-trials',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--allow-file-access-from-files',
      '--allow-insecure-localhost',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-popup-blocking',
      '--allow-running-insecure-content'
    ],
    defaultViewport: null,
    ignoreDefaultArgs: ['--enable-automation']
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('Mở trang YouTube...');
    await page.goto('https://youtube.com', { waitUntil: 'networkidle2' });
    
    // Kiểm tra trạng thái đăng nhập 
    const isLoggedIn = await page.evaluate(() => {
      // Tìm avatar người dùng - dấu hiệu đã đăng nhập
      return !!document.querySelector('img#avatar, #avatar-btn, yt-img-shadow');
    });
    
    if (isLoggedIn) {
      console.log('✅ Bạn đã đăng nhập YouTube! Đang lưu cookies...');
    } else {
      console.log('⚠️ Bạn chưa đăng nhập. Vui lòng đăng nhập trong cửa sổ trình duyệt.');
      console.log('\n🔑 HƯỚNG DẪN:');
      console.log('1. Đăng nhập vào tài khoản YouTube của bạn trong cửa sổ trình duyệt vừa mở');
      console.log('2. Sau khi đăng nhập thành công, quay lại đây và nhấn Enter');
      
      // Đợi người dùng nhấn Enter sau khi đăng nhập
      process.stdout.write('Nhấn Enter sau khi đã đăng nhập thành công: ');
      await new Promise(resolve => {
        process.stdin.once('data', () => resolve());
      });
      
      // Tải lại trang để kiểm tra đăng nhập
      await page.reload({ waitUntil: 'networkidle2' });
      
      // Kiểm tra lại
      const loggedInAfterReload = await page.evaluate(() => {
        return !!document.querySelector('img#avatar, #avatar-btn, yt-img-shadow');
      });
      
      if (loggedInAfterReload) {
        console.log('✅ Đăng nhập thành công!');
      } else {
        console.log('❌ Chưa đăng nhập thành công. Vui lòng thử lại sau.');
        throw new Error('Đăng nhập thất bại');
      }
    }
    
    // Lưu cookies
    const cookies = await page.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    console.log(`✅ Đã lưu cookies thành công vào: ${COOKIES_PATH}`);
    
    console.log('🎉 Hoàn tất! Hồ sơ Chrome đã được lưu tại:');
    console.log(CHROME_PROFILE_PATH);
    console.log('\n🔹 LƯU Ý QUAN TRỌNG:');
    console.log('- Hệ thống sẽ sử dụng hồ sơ Chrome này cho mọi tác vụ tự động');
    console.log('- Khi token hết hạn, chỉ cần chạy lại script này để làm mới');
    console.log('- KHÔNG xóa thư mục hồ sơ Chrome nếu muốn duy trì đăng nhập');
    
    return { success: true, profilePath: CHROME_PROFILE_PATH, cookiesPath: COOKIES_PATH };
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    return { success: false, error: error.message };
  } finally {
    // Đóng page và browser
    await page.close();
    await browser.close();
  }
}

// Thực thi chính
openAndLoginYouTube()
  .then(result => {
    if (result.success) {
      console.log('\n✅ Đã cấu hình xong hồ sơ YouTube. Bạn có thể dùng hệ thống tự động ngay bây giờ!');
    } else {
      console.error('\n❌ Không thể cài đặt hồ sơ YouTube:', result.error);
    }
  })
  .catch(error => {
    console.error('❌ Lỗi không xác định:', error);
  }); 