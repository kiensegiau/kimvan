import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { mkdir } from 'fs/promises';
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
 * API để yêu cầu đăng nhập YouTube
 */
export async function GET(request) {
  try {
    // API giả lập - không thực sự đăng nhập YouTube
    return NextResponse.json({
      success: true,
      message: 'Tính năng đăng nhập YouTube tạm thời bị vô hiệu hóa',
      info: 'Chức năng này đang được bảo trì'
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
    // API giả lập - không kiểm tra trạng thái
    return NextResponse.json({
      success: false,
      loggedIn: false,
      message: 'Tính năng đăng nhập YouTube tạm thời bị vô hiệu hóa'
    });
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
    
    // Giả lập upload - tạo fake YouTube ID
    const fakeYoutubeId = `YT_${uuidv4().substring(0, 8)}`;
    
    // Lưu thông tin vào database
    const mongoClient = await clientPromise;
    const db = mongoClient.db('kimvan');
    const courseObjectId = new ObjectId(courseId);
    
    const videoData = {
      courseId: courseObjectId,
      youtubeId: fakeYoutubeId,
      title: title,
      description: description || '',
      visibility: visibility || 'unlisted',
      uploadDate: new Date(),
      fileName: videoFile.name || 'video.mp4',
      fileSize: Buffer.from(await videoFile.arrayBuffer()).length,
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
    return NextResponse.json({
      success: true,
      message: `Đã giả lập tải video "${title}" lên YouTube (tính năng đang được bảo trì)`,
      result: {
        video: {
          id: fakeYoutubeId,
          dbId: insertResult.insertedId,
          title: title,
          url: `https://youtube.com/watch?v=${fakeYoutubeId}`,
          embedUrl: `https://www.youtube.com/embed/${fakeYoutubeId}`,
          visibility: visibility || 'unlisted'
        }
      }
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
    console.error('Lỗi khi xóa video:', error);
    return NextResponse.json({
      success: false,
      message: 'Lỗi khi xóa video',
      error: error.message
    }, { status: 500 });
  }
}