import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { mkdir } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { autoUploadToYoutube } from './youtube-automation.js';

// Thư mục lưu trữ tạm thời
const TEMP_DIR = path.join(process.cwd(), 'temp');
// Đường dẫn lưu cookies
const COOKIES_PATH = path.join(process.cwd(), 'youtube_cookies.json');

// Đảm bảo thư mục tạm tồn tại
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * API để yêu cầu đăng nhập YouTube
 */
export async function GET(request) {
  try {
    // Kiểm tra xem đã cài đặt thư viện chưa
    let YoutubeUploader;
    try {
      // Tải thư viện động để tránh lỗi khi build hoặc deploy
      // Cách này cho phép loading động khi chạy ứng dụng
      const uploadModule = await import('node-apiless-youtube-upload');
      YoutubeUploader = uploadModule.default;
    } catch (importError) {
      console.error('Lỗi import thư viện:', importError);
      return NextResponse.json({
        success: false,
        message: 'Lỗi khi tải thư viện YouTube upload. Thư viện đã được cài đặt từ GitHub repository.',
        error: importError.message
      }, { status: 500 });
    }
    
    // Tạo đối tượng uploader mới
    const uploader = new YoutubeUploader();
    console.log('Đang yêu cầu đăng nhập YouTube...');
    
    // Mở cửa sổ trình duyệt để đăng nhập
    await uploader.promptLoginAndGetCookies();
    
    // Lưu cookies
    await uploader.saveCookiesToDisk(COOKIES_PATH);
    console.log('Đã lưu cookies YouTube tại:', COOKIES_PATH);
    
    return NextResponse.json({
      success: true,
      message: 'Đăng nhập YouTube thành công'
    });
  } catch (error) {
    console.error('Lỗi đăng nhập YouTube:', error);
    return NextResponse.json({
      success: false,
      message: 'Lỗi khi đăng nhập YouTube',
      error: error.message
    }, { status: 500 });
  }
}

/**
 * API để kiểm tra trạng thái đăng nhập
 */
export async function HEAD(request) {
  try {
    // Kiểm tra file cookies
    if (!fs.existsSync(COOKIES_PATH)) {
      return NextResponse.json({
        success: false,
        loggedIn: false,
        message: 'Chưa đăng nhập YouTube'
      }, { status: 401 });
    }
    
    // Tải thư viện động
    const uploadModule = await import('node-apiless-youtube-upload');
    const YoutubeUploader = uploadModule.default;
    
    // Tạo đối tượng uploader và tải cookies
    const uploader = new YoutubeUploader();
    await uploader.loadCookiesFromDisk(COOKIES_PATH);
    
    // Kiểm tra tính hợp lệ của cookies
    const isValid = await uploader.checkCookiesValidity();
    
    if (isValid) {
      return NextResponse.json({
        success: true,
        loggedIn: true,
        message: 'Đã đăng nhập YouTube'
      });
    } else {
      return NextResponse.json({
        success: false,
        loggedIn: false,
        message: 'Phiên đăng nhập YouTube đã hết hạn'
      }, { status: 401 });
    }
  } catch (error) {
    console.error('Lỗi kiểm tra đăng nhập YouTube:', error);
    return NextResponse.json({
      success: false,
      loggedIn: false,
      message: 'Lỗi kiểm tra đăng nhập',
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Lưu file tạm từ FormData
 */
async function saveTemporaryFile(fileData) {
  // Tạo file tạm
  const fileBuffer = Buffer.from(await fileData.arrayBuffer());
  const fileExtension = path.extname(fileData.name) || '.mp4';
  const tempFileName = `${uuidv4()}${fileExtension}`;
  const tempFilePath = path.join(TEMP_DIR, tempFileName);
  
  // Ghi file
  fs.writeFileSync(tempFilePath, fileBuffer);
  console.log(`Đã lưu file tạm: ${tempFilePath} (${fileBuffer.length} bytes)`);
  
  return tempFilePath;
}

/**
 * API upload video lên YouTube
 */
export async function POST(request) {
  try {
    // Xử lý FormData
    const formData = await request.formData();
    const courseId = formData.get('courseId');
    const title = formData.get('title');
    const description = formData.get('description') || '';
    const videoFile = formData.get('videoFile');
    const thumbnailFile = formData.get('thumbnailFile');
    const visibility = formData.get('visibility') || 'unlisted'; // public, private, unlisted
    
    // Kiểm tra dữ liệu
    if (!courseId || !title || !videoFile) {
      return NextResponse.json({
        success: false,
        message: 'Thiếu thông tin bắt buộc: courseId, title, videoFile'
      }, { status: 400 });
    }
    
    // Chuyển đổi file thành buffer
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    let thumbnailBuffer = null;
    
    if (thumbnailFile) {
      thumbnailBuffer = Buffer.from(await thumbnailFile.arrayBuffer());
    }
    
    // Gọi hàm tải lên YouTube
    const result = await autoUploadToYoutube({
      courseId,
      title,
      description,
      videoBuffer,
      videoName: videoFile.name,
      thumbnailBuffer,
      thumbnailName: thumbnailFile ? thumbnailFile.name : null,
      visibility
    });
    
    return NextResponse.json({
      success: true,
      message: `Đã tải video "${title}" lên YouTube thành công`,
      result
    });
    
  } catch (error) {
    console.error('Lỗi tải video lên YouTube:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Lỗi khi tải video lên YouTube',
      error: error.message
    }, { status: 500 });
  }
}

// Xóa video khỏi YouTube
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');
    const dbVideoId = searchParams.get('dbVideoId');
    
    if (!videoId && !dbVideoId) {
      return NextResponse.json({
        success: false,
        message: 'Cần cung cấp videoId hoặc dbVideoId để xóa video'
      }, { status: 400 });
    }
    
    // Xóa video trong database
    const mongoClient = await clientPromise;
    const db = mongoClient.db('kimvan');
    
    let videoData;
    
    if (dbVideoId) {
      const dbVideoObjectId = new ObjectId(dbVideoId);
      videoData = await db.collection('course_videos').findOne({ _id: dbVideoObjectId });
      
      if (!videoData) {
        return NextResponse.json({
          success: false,
          message: 'Không tìm thấy video trong cơ sở dữ liệu'
        }, { status: 404 });
      }
      
      // Xóa video khỏi danh sách khóa học
      await db.collection('courses').updateOne(
        { _id: videoData.courseId },
        { $pull: { videos: dbVideoObjectId } }
      );
      
      // Xóa video khỏi collection videos
      await db.collection('course_videos').deleteOne({ _id: dbVideoObjectId });
    } else if (videoId) {
      videoData = await db.collection('course_videos').findOne({ youtubeId: videoId });
      
      if (videoData) {
        // Xóa video khỏi danh sách khóa học
        await db.collection('courses').updateOne(
          { _id: videoData.courseId },
          { $pull: { videos: videoData._id } }
        );
        
        // Xóa video khỏi collection videos
        await db.collection('course_videos').deleteOne({ youtubeId: videoId });
      }
    }
    
    // Trả về kết quả
    return NextResponse.json({
      success: true,
      message: 'Đã xóa video thành công',
      videoData: videoData || { youtubeId: videoId }
    });
    
  } catch (error) {
    console.error('Lỗi xóa video:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Lỗi khi xóa video',
      error: error.message
    }, { status: 500 });
  }
} 