// Script test hệ thống tải video lên YouTube
const { initUploadCronJob, manualProcessUploads } = require('./src/app/api/youtube/upload/cron');
const fs = require('fs');
const path = require('path');

// Kiểm tra xem các thư mục cần thiết đã tồn tại chưa
const TEMP_DIR = path.join(process.cwd(), 'temp');
const LOG_DIR = path.join(process.cwd(), 'logs');
const COOKIES_PATH = path.join(process.cwd(), 'youtube_cookies.json');

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  console.log('Đã tạo thư mục temp');
}

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  console.log('Đã tạo thư mục logs');
}

// Kiểm tra cookies
if (!fs.existsSync(COOKIES_PATH)) {
  console.log('CẢNH BÁO: Chưa có file cookies YouTube. Bạn cần đăng nhập trước khi sử dụng.');
  console.log('Hãy tạo một script riêng để đăng nhập sử dụng thư viện node-apiless-youtube-upload');
} else {
  console.log('Đã tìm thấy file cookies YouTube');
}

// Khởi tạo cron job
console.log('Đang khởi tạo cron job...');
const job = initUploadCronJob();

// Xử lý thủ công
console.log('Đang chạy xử lý thủ công...');

manualProcessUploads()
  .then(result => {
    console.log('Kết quả xử lý thủ công:', result);
    
    console.log('Test hoàn tất! Nhấn Ctrl+C để thoát.');
  })
  .catch(error => {
    console.error('Lỗi xử lý thủ công:', error);
  }); 