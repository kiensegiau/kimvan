import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

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
 * Tự động tải video lên YouTube (giả lập)
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
    // Giả lập tải lên YouTube
    console.log('Giả lập tải lên YouTube...', options.title);
    
    // Tạo fake YouTube ID
    const fakeYoutubeId = `YT_${uuidv4().substring(0, 8)}`;
    
    // Lưu thông tin vào database
    const mongoClient = await clientPromise;
    const db = mongoClient.db('kimvan');
    const courseObjectId = new ObjectId(options.courseId);
    
    // Lưu video vào database
    const videoData = {
      courseId: courseObjectId,
      youtubeId: fakeYoutubeId,
      title: options.title,
      description: options.description || '',
      visibility: options.visibility || 'unlisted',
      uploadDate: new Date(),
      fileName: options.videoName || 'video.mp4',
      fileSize: options.videoBuffer ? options.videoBuffer.length : 0,
      uploadType: 'simulated-upload'
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
    
    // Trả về kết quả giả lập
    return {
      videoId: fakeYoutubeId,
      success: true,
      dbId: insertResult.insertedId,
      url: `https://youtube.com/watch?v=${fakeYoutubeId}`,
      embedUrl: `https://www.youtube.com/embed/${fakeYoutubeId}`,
      message: `Đã giả lập tải video "${options.title}" lên YouTube`
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
    console.error('Lỗi lên lịch tải lên YouTube:', error);
    throw error;
  }
}

/**
 * Xử lý các video đã lên lịch
 */
export async function processScheduledUploads() {
  try {
    const mongoClient = await clientPromise;
    const db = mongoClient.db('kimvan');
    
    // Tìm các video đến hạn upload
    const now = new Date();
    const pendingUploads = await db.collection('scheduled_uploads')
      .find({
        status: 'pending',
        scheduleTime: { $lte: now }
      })
      .toArray();
    
    console.log(`Đang xử lý ${pendingUploads.length} video đã lên lịch...`);
    
    for (const upload of pendingUploads) {
      try {
        // Cập nhật trạng thái
        await db.collection('scheduled_uploads').updateOne(
          { _id: upload._id },
          { $set: { status: 'processing', processStartedAt: now } }
        );
        
        // Kiểm tra tệp video có tồn tại không
        if (!upload.videoPath || !fs.existsSync(upload.videoPath)) {
          throw new Error('Không tìm thấy file video');
        }
        
        // Đọc file video
        const videoBuffer = fs.readFileSync(upload.videoPath);
        let thumbnailBuffer = null;
        
        if (upload.thumbnailPath && fs.existsSync(upload.thumbnailPath)) {
          thumbnailBuffer = fs.readFileSync(upload.thumbnailPath);
        }
        
        // Tải lên YouTube (giả lập)
        const uploadResult = await autoUploadToYoutube({
          courseId: upload.courseId.toString(),
          title: upload.title,
          description: upload.description || '',
          videoBuffer: videoBuffer,
          videoName: path.basename(upload.videoPath),
          thumbnailBuffer: thumbnailBuffer,
          thumbnailName: upload.thumbnailPath ? path.basename(upload.thumbnailPath) : null,
          visibility: upload.visibility || 'unlisted'
        });
        
        // Cập nhật trạng thái
        await db.collection('scheduled_uploads').updateOne(
          { _id: upload._id },
          {
            $set: {
              status: 'completed',
              youtubeId: uploadResult.videoId,
              result: uploadResult,
              processCompletedAt: new Date()
            }
          }
        );
        
        console.log(`Đã upload video "${upload.title}" lên YouTube với ID: ${uploadResult.videoId}`);
        
        // Xóa file sau khi tải lên thành công
        if (fs.existsSync(upload.videoPath)) {
          fs.unlinkSync(upload.videoPath);
        }
        
        if (upload.thumbnailPath && fs.existsSync(upload.thumbnailPath)) {
          fs.unlinkSync(upload.thumbnailPath);
        }
        
      } catch (uploadError) {
        console.error(`Lỗi khi xử lý video "${upload.title}":`, uploadError);
        
        // Cập nhật trạng thái lỗi
        await db.collection('scheduled_uploads').updateOne(
          { _id: upload._id },
          {
            $set: {
              status: 'error',
              error: uploadError.message,
              processCompletedAt: new Date()
            }
          }
        );
      }
    }
    
    return { 
      success: true, 
      processed: pendingUploads.length,
      message: `Đã xử lý ${pendingUploads.length} video theo lịch trình`
    };
    
  } catch (error) {
    console.error('Lỗi xử lý video theo lịch:', error);
    return { 
      success: false, 
      error: error.message,
      message: `Lỗi xử lý video theo lịch: ${error.message}`
    };
  }
} 