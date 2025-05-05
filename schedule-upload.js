// Script lên lịch tải video lên YouTube
import { scheduleYoutubeUpload } from './src/app/api/youtube/upload/automation.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Kiểm tra thông số đầu vào
const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('Sử dụng: node schedule-upload.js <courseId> <videoPath> <title> [description] [scheduleTime]');
  console.log('Ví dụ: node schedule-upload.js 5fa1b2c3d4e5f6a7b8c9d0e1 ./sample-video.mp4 "Video test" "Mô tả video" "2025-05-06 15:00:00"');
  process.exit(1);
}

const courseId = args[0];
const videoPath = args[1];
const title = args[2];
const description = args[3] || '';
const scheduleTimeStr = args[4] || '';

// Kiểm tra file video
if (!fs.existsSync(videoPath)) {
  console.error('Không tìm thấy file video:', videoPath);
  process.exit(1);
}

// Chuyển đổi thời gian lên lịch
let scheduleTime = null;
if (scheduleTimeStr) {
  scheduleTime = new Date(scheduleTimeStr);
  if (isNaN(scheduleTime.getTime())) {
    console.error('Thời gian lên lịch không hợp lệ. Sử dụng định dạng "YYYY-MM-DD HH:MM:SS"');
    process.exit(1);
  }
}

// Chuẩn bị tham số
const options = {
  courseId,
  videoPath,
  title,
  description,
  visibility: 'unlisted'
};

// Thêm thời gian lên lịch nếu có
if (scheduleTime) {
  options.scheduleTime = scheduleTime;
  console.log(`Đang lên lịch tải video "${title}" vào ${scheduleTime.toLocaleString()}...`);
} else {
  console.log(`Đang tải video "${title}" lên YouTube ngay bây giờ...`);
}

// Lên lịch tải video
scheduleYoutubeUpload(options)
  .then(result => {
    console.log('Kết quả:', result);
    console.log('Hoàn tất!');
  })
  .catch(error => {
    console.error('Lỗi lên lịch tải video:', error);
  }); 