// Script đăng nhập YouTube và lưu cookies
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// ESM không hỗ trợ __dirname, sử dụng fileURLToPath
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  try {
    // Tạo thư mục logs nếu chưa có
    const LOG_DIR = join(process.cwd(), 'logs');
    
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
      console.log(`Đã tạo thư mục logs tại: ${LOG_DIR}`);
    }
    
    // Tải module YouTube uploader
    const YoutubeUploader = (await import('node-apiless-youtube-upload')).default;
    console.log('Đã khởi tạo module YouTube Uploader');
    
    const uploader = new YoutubeUploader();
    console.log('Đang mở trình duyệt để đăng nhập...');
    
    // Khởi động trình duyệt
    await uploader.launch();
    console.log('Đã mở trình duyệt thành công');
    
    // Mở trang đăng nhập YouTube
    await uploader.navigateToYoutube();
    console.log('Đã chuyển đến trang YouTube');
    
    console.log('⚠️ QUAN TRỌNG ⚠️');
    console.log('1. Đăng nhập vào tài khoản YouTube của bạn trong cửa sổ trình duyệt vừa mở');
    console.log('2. Sau khi đăng nhập thành công và thấy trang chủ YouTube, quay lại đây và nhấn Enter');
    
    // Đợi người dùng nhấn Enter sau khi đăng nhập
    process.stdout.write('Nhấn Enter sau khi đã đăng nhập thành công: ');
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
    
    // Lưu cookies
    const COOKIES_PATH = join(process.cwd(), 'youtube_cookies.json');
    await uploader.saveCookiesToDisk(COOKIES_PATH);
    
    console.log(`\nĐã lưu cookies thành công tại: ${COOKIES_PATH}`);
    console.log('Bạn có thể sử dụng hệ thống tự động tải video lên YouTube ngay bây giờ.');
    
    // Đóng trình duyệt
    await uploader.close();
    console.log('Đã đóng trình duyệt.');
    
  } catch (error) {
    console.error('Lỗi đăng nhập YouTube:', error);
  }
}

main(); 