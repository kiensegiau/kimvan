/**
 * Module tự động hóa tải video lên YouTube sử dụng hồ sơ Chrome cố định
 * Tương tự như cách xử lý trong drive-fix-blockdown.js
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import puppeteer from 'puppeteer-core';
import { setTimeout } from 'timers/promises';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// Đường dẫn lưu cookies và hồ sơ Chrome
const COOKIES_PATH = path.join(process.cwd(), 'youtube_cookies.json');
const CHROME_PROFILE_PATH = path.join(os.homedir(), 'youtube-upload-profile');
// Thư mục lưu trữ tạm thời
const TEMP_DIR = path.join(process.cwd(), 'temp');

// Đảm bảo thư mục tạm tồn tại
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

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
 * Lưu file tạm thời
 */
async function saveTemporaryFile(fileBuffer, originalName = 'video.mp4') {
  const fileExtension = path.extname(originalName) || '.mp4';
  const fileName = `auto_${Date.now()}${fileExtension}`;
  const filePath = path.join(TEMP_DIR, fileName);
  
  fs.writeFileSync(filePath, fileBuffer);
  console.log(`Đã lưu file tạm: ${filePath} (${fileBuffer.length} bytes)`);
  
  return filePath;
}

/**
 * Tự động tải video lên YouTube sử dụng hồ sơ Chrome
 * @param {Object} options - Cấu hình tải lên
 * @param {String} options.courseId - ID khóa học
 * @param {String} options.title - Tiêu đề video
 * @param {String} options.description - Mô tả video
 * @param {Buffer} options.videoBuffer - Buffer dữ liệu video
 * @param {String} options.videoName - Tên file video
 * @param {Buffer} options.thumbnailBuffer - Buffer dữ liệu thumbnail (tùy chọn)
 * @param {String} options.thumbnailName - Tên file thumbnail (tùy chọn)
 * @param {String} options.visibility - Quyền riêng tư (public, private, unlisted)
 */
export async function autoUploadToYoutube(options) {
  let browser = null;
  let page = null;
  let videoPath = null;
  let thumbnailPath = null;
  let videoId = null;
  
  try {
    // Kiểm tra hồ sơ Chrome
    if (!fs.existsSync(CHROME_PROFILE_PATH)) {
      throw new Error(`Chưa tìm thấy hồ sơ Chrome tại ${CHROME_PROFILE_PATH}. Vui lòng chạy script youtube-persistent-login.js để tạo hồ sơ.`);
    }
    
    // Xác minh các tham số bắt buộc
    if (!options.courseId || !options.title || !options.videoBuffer) {
      throw new Error('Thiếu thông tin bắt buộc: courseId, title, videoBuffer');
    }
    
    // Kiểm tra khóa học
    const mongoClient = await clientPromise;
    const db = mongoClient.db('kimvan');
    const courseObjectId = new ObjectId(options.courseId);
    const course = await db.collection('courses').findOne({ _id: courseObjectId });
    
    if (!course) {
      throw new Error('Không tìm thấy khóa học với ID đã cung cấp');
    }
    
    // Lưu file tạm
    videoPath = await saveTemporaryFile(options.videoBuffer, options.videoName);
    
    if (options.thumbnailBuffer) {
      thumbnailPath = await saveTemporaryFile(options.thumbnailBuffer, options.thumbnailName);
    }
    
    // Khởi động trình duyệt Chrome với hồ sơ cố định
    browser = await puppeteer.launch({
      headless: false, // Đặt true khi chạy trên server
      executablePath: getChromePath(),
      userDataDir: CHROME_PROFILE_PATH,
      args: [
        '--start-maximized',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ],
      defaultViewport: null
    });
    
    page = await browser.newPage();
    
    // Mở trang tải video YouTube Studio
    await page.goto('https://studio.youtube.com/channel/upload', { waitUntil: 'networkidle2' });
    
    // Kiểm tra xem đã đăng nhập chưa
    const isLoggedIn = await page.evaluate(() => {
      return !document.querySelector('form[action^="https://accounts.google.com/signin"]');
    });
    
    if (!isLoggedIn) {
      throw new Error('Đã hết hạn đăng nhập YouTube. Vui lòng chạy script youtube-persistent-login.js để đăng nhập lại.');
    }
    
    console.log('Đang tải video lên YouTube...');
    
    // Tải lên video
    const fileInput = await page.$('input[type="file"][accept="video/*"]');
    if (!fileInput) {
      throw new Error('Không tìm thấy nút tải lên video.');
    }
    
    // Tải lên video
    await fileInput.uploadFile(videoPath);
    
    // Đợi giao diện tải video xuất hiện
    await page.waitForSelector('#textbox', { timeout: 120000 });
    
    // Nhập tiêu đề
    await page.waitForSelector('div[aria-label="Add a title that describes your video"]');
    await page.click('div[aria-label="Add a title that describes your video"]');
    
    // Xóa tiêu đề mặc định
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    
    // Nhập tiêu đề mới
    await page.keyboard.type(options.title);
    
    // Nhập mô tả
    if (options.description) {
      await page.waitForSelector('div[aria-label="Tell viewers about your video"]');
      await page.click('div[aria-label="Tell viewers about your video"]');
      await page.keyboard.type(options.description);
    }
    
    // Chọn chế độ hiển thị
    await page.waitForSelector('#step-badge-3');
    await page.click('#step-badge-3');
    
    // Chọn visibility dựa trên options
    if (options.visibility === 'public') {
      await page.waitForSelector('#radio-container[name="PUBLIC"]');
      await page.click('#radio-container[name="PUBLIC"]');
    } else if (options.visibility === 'unlisted') {
      await page.waitForSelector('#radio-container[name="UNLISTED"]');
      await page.click('#radio-container[name="UNLISTED"]');
    } else {
      await page.waitForSelector('#radio-container[name="PRIVATE"]');
      await page.click('#radio-container[name="PRIVATE"]');
    }
    
    // Tải lên thumbnail nếu có
    if (thumbnailPath) {
      await page.waitForSelector('#step-badge-2');
      await page.click('#step-badge-2');
      
      const thumbnailInput = await page.$('input[type="file"][accept="image/*"]');
      if (thumbnailInput) {
        await thumbnailInput.uploadFile(thumbnailPath);
        // Đợi thumbnail được tải lên
        await page.waitForSelector('div.thumbnail-image', { timeout: 30000 });
      }
    }
    
    // Nhấn nút Tiếp theo và Xuất bản
    await page.waitForSelector('#next-button');
    await page.click('#next-button');
    
    // Đợi một chút để chắc chắn đã chuyển sang màn hình tiếp theo
    await setTimeout(2000);
    
    await page.waitForSelector('#next-button');
    await page.click('#next-button');
    
    // Đợi một chút để chắc chắn đã chuyển sang màn hình tiếp theo
    await setTimeout(2000);
    
    await page.waitForSelector('#next-button');
    await page.click('#next-button');
    
    // Nút Xuất bản cuối cùng
    await page.waitForSelector('#done-button');
    await page.click('#done-button');
    
    // Đợi xuất bản hoàn tất và lấy ID video
    await page.waitForSelector('a[href^="https://youtu.be/"]', { timeout: 120000 });
    
    videoId = await page.evaluate(() => {
      const link = document.querySelector('a[href^="https://youtu.be/"]');
      if (link) {
        const href = link.getAttribute('href');
        return href.split('/').pop();
      }
      return null;
    });
    
    console.log(`Video đã được tải lên thành công với ID: ${videoId}`);
    
    // Lưu thông tin vào database
    const videoData = {
      courseId: courseObjectId,
      youtubeId: videoId,
      title: options.title,
      description: options.description || '',
      visibility: options.visibility || 'unlisted',
      uploadDate: new Date(),
      fileName: options.videoName || 'auto_upload.mp4',
      fileSize: options.videoBuffer.length,
      uploadType: 'auto-chrome-profile'
    };
    
    const insertResult = await db.collection('course_videos').insertOne(videoData);
    
    // Cập nhật khóa học
    await db.collection('courses').updateOne(
      { _id: courseObjectId },
      { 
        $push: { videos: insertResult.insertedId },
        $set: { updatedAt: new Date() }
      }
    );
    
    // Cho hệ thống thời gian để xử lý video
    await setTimeout(5000);
    
    // Trả về kết quả
    return {
      success: true,
      message: 'Upload video lên YouTube thành công',
      video: {
        id: videoId,
        dbId: insertResult.insertedId,
        title: options.title,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        visibility: options.visibility || 'unlisted'
      }
    };
    
  } catch (error) {
    console.error('Lỗi tự động upload video:', error);
    throw error;
  } finally {
    // Xóa file tạm
    try {
      if (videoPath && fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
      if (thumbnailPath && fs.existsSync(thumbnailPath)) fs.unlinkSync(thumbnailPath);
    } catch (unlinkError) {
      console.error('Lỗi xóa file tạm:', unlinkError);
    }
    
    // Đóng trình duyệt
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

/**
 * Tải video lên YouTube theo lịch
 * @param {Object} options - Tham số cấu hình
 * @param {String} options.courseId - ID khóa học
 * @param {String} options.videoPath - Đường dẫn đến file video
 * @param {String} options.title - Tiêu đề video
 * @param {String} options.description - Mô tả video (tùy chọn)
 * @param {String} options.thumbnailPath - Đường dẫn đến file thumbnail (tùy chọn)
 * @param {String} options.visibility - Quyền riêng tư (public, private, unlisted)
 * @param {Date} options.scheduleTime - Thời gian lên lịch (tùy chọn)
 */
export async function scheduleYoutubeUpload(options) {
  try {
    // Kiểm tra tham số
    if (!options.courseId || !options.videoPath || !options.title) {
      throw new Error('Thiếu thông tin bắt buộc: courseId, videoPath, title');
    }
    
    // Đọc nội dung file
    if (!fs.existsSync(options.videoPath)) {
      throw new Error('Không tìm thấy file video');
    }
    
    const videoBuffer = fs.readFileSync(options.videoPath);
    let thumbnailBuffer = null;
    
    if (options.thumbnailPath && fs.existsSync(options.thumbnailPath)) {
      thumbnailBuffer = fs.readFileSync(options.thumbnailPath);
    }
    
    // Nếu có lịch đặt, tạo một bản ghi trong database
    if (options.scheduleTime) {
      const scheduleDate = new Date(options.scheduleTime);
      
      if (isNaN(scheduleDate.getTime())) {
        throw new Error('Thời gian lên lịch không hợp lệ');
      }
      
      // Lưu vào database để xử lý sau
      const mongoClient = await clientPromise;
      const db = mongoClient.db('kimvan');
      
      await db.collection('scheduled_uploads').insertOne({
        courseId: options.courseId,
        title: options.title,
        description: options.description || '',
        videoPath: options.videoPath,
        thumbnailPath: options.thumbnailPath || null,
        visibility: options.visibility || 'unlisted',
        scheduleTime: scheduleDate,
        status: 'pending',
        createdAt: new Date()
      });
      
      return {
        success: true,
        message: 'Đã lên lịch tải video lên YouTube',
        scheduleTime: scheduleDate
      };
    }
    
    // Nếu không có lịch đặt, upload ngay
    return await autoUploadToYoutube({
      courseId: options.courseId,
      title: options.title,
      description: options.description || '',
      videoBuffer: videoBuffer,
      videoName: path.basename(options.videoPath),
      thumbnailBuffer: thumbnailBuffer,
      thumbnailName: options.thumbnailPath ? path.basename(options.thumbnailPath) : null,
      visibility: options.visibility || 'unlisted'
    });
    
  } catch (error) {
    console.error('Lỗi lên lịch upload video:', error);
    throw error;
  }
}

/**
 * Xử lý các video đã lên lịch
 * Hàm này có thể được gọi từ một cron job
 */
export async function processScheduledUploads() {
  try {
    const mongoClient = await clientPromise;
    const db = mongoClient.db('kimvan');
    
    // Tìm các video đã lên lịch và đến thời gian upload
    const now = new Date();
    const pendingUploads = await db.collection('scheduled_uploads')
      .find({
        status: 'pending',
        scheduleTime: { $lte: now }
      })
      .toArray();
    
    console.log(`Tìm thấy ${pendingUploads.length} video cần được tải lên`);
    
    // Xử lý từng video
    for (const upload of pendingUploads) {
      try {
        console.log(`Đang xử lý video: ${upload.title}`);
        
        // Cập nhật trạng thái
        await db.collection('scheduled_uploads').updateOne(
          { _id: upload._id },
          { $set: { status: 'processing', processedAt: new Date() } }
        );
        
        // Đọc nội dung file
        if (!fs.existsSync(upload.videoPath)) {
          throw new Error('Không tìm thấy file video');
        }
        
        const videoBuffer = fs.readFileSync(upload.videoPath);
        let thumbnailBuffer = null;
        
        if (upload.thumbnailPath && fs.existsSync(upload.thumbnailPath)) {
          thumbnailBuffer = fs.readFileSync(upload.thumbnailPath);
        }
        
        // Upload video
        const result = await autoUploadToYoutube({
          courseId: upload.courseId,
          title: upload.title,
          description: upload.description,
          videoBuffer: videoBuffer,
          videoName: path.basename(upload.videoPath),
          thumbnailBuffer: thumbnailBuffer,
          thumbnailName: upload.thumbnailPath ? path.basename(upload.thumbnailPath) : null,
          visibility: upload.visibility
        });
        
        // Cập nhật trạng thái thành công
        await db.collection('scheduled_uploads').updateOne(
          { _id: upload._id },
          { 
            $set: { 
              status: 'completed',
              completedAt: new Date(),
              youtubeId: result.video.id,
              youtubeUrl: result.video.url
            }
          }
        );
        
        console.log(`Upload thành công: ${upload.title}`);
      } catch (error) {
        console.error(`Lỗi xử lý video ${upload.title}:`, error);
        
        // Cập nhật trạng thái lỗi
        await db.collection('scheduled_uploads').updateOne(
          { _id: upload._id },
          { 
            $set: { 
              status: 'failed',
              error: error.message,
              failedAt: new Date()
            }
          }
        );
      }
    }
    
    return {
      success: true,
      message: `Đã xử lý ${pendingUploads.length} video theo lịch`,
      processed: pendingUploads.length
    };
    
  } catch (error) {
    console.error('Lỗi xử lý video theo lịch:', error);
    throw error;
  }
} 