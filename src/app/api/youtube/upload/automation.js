import fs from 'fs';
import path from 'path';
import { setTimeout } from 'timers/promises';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// Đường dẫn lưu cookies
const COOKIES_PATH = path.join(process.cwd(), 'youtube_cookies.json');
// Thư mục lưu trữ tạm thời
const TEMP_DIR = path.join(process.cwd(), 'temp');

// Đảm bảo thư mục tạm tồn tại
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
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
 * Tự động tải video lên YouTube
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
  try {
    // Kiểm tra xem cookies đã tồn tại chưa
    if (!fs.existsSync(COOKIES_PATH)) {
      throw new Error('Chưa đăng nhập YouTube. Vui lòng đăng nhập trước khi sử dụng tính năng tự động.');
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
    const videoPath = await saveTemporaryFile(options.videoBuffer, options.videoName);
    let thumbnailPath = null;
    
    if (options.thumbnailBuffer) {
      thumbnailPath = await saveTemporaryFile(options.thumbnailBuffer, options.thumbnailName);
    }
    
    // Tải thư viện động
    const uploadModule = await import('node-apiless-youtube-upload');
    const YoutubeUploader = uploadModule.default;
    
    // Chuẩn bị cấu hình upload
    const uploader = new YoutubeUploader();
    await uploader.loadCookiesFromDisk(COOKIES_PATH);
    
    // Kiểm tra lại cookies
    const isValid = await uploader.checkCookiesValidity();
    if (!isValid) {
      throw new Error('Phiên đăng nhập YouTube đã hết hạn, vui lòng đăng nhập lại');
    }
    
    console.log('Đang tự động upload video lên YouTube...');
    
    // Cấu hình upload
    const uploadOptions = {
      videoPath: videoPath,
      title: options.title,
      description: options.description || '',
      visibility: options.visibility || 'unlisted',
      monetization: false
    };
    
    // Thêm thumbnail nếu có
    if (thumbnailPath) {
      uploadOptions.thumbnailPath = thumbnailPath;
    }
    
    // Upload video
    const result = await uploader.uploadVideo(uploadOptions);
    
    console.log('Kết quả upload YouTube:', result);
    
    // Lưu thông tin vào database
    const videoData = {
      courseId: courseObjectId,
      youtubeId: result.videoId,
      title: options.title,
      description: options.description || '',
      visibility: options.visibility || 'unlisted',
      uploadDate: new Date(),
      fileName: options.videoName || 'auto_upload.mp4',
      fileSize: options.videoBuffer.length,
      uploadType: 'auto-selenium-upload'
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
    
    // Xóa file tạm
    try {
      fs.unlinkSync(videoPath);
      if (thumbnailPath) fs.unlinkSync(thumbnailPath);
    } catch (unlinkError) {
      console.error('Lỗi xóa file tạm:', unlinkError);
    }
    
    // Trả về kết quả
    return {
      success: true,
      message: 'Upload video lên YouTube thành công',
      video: {
        id: result.videoId,
        dbId: insertResult.insertedId,
        title: options.title,
        url: `https://www.youtube.com/watch?v=${result.videoId}`,
        embedUrl: `https://www.youtube.com/embed/${result.videoId}`,
        visibility: options.visibility || 'unlisted'
      }
    };
    
  } catch (error) {
    console.error('Lỗi tự động upload video:', error);
    throw error;
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