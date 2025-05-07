import { NextResponse } from 'next/server';
import { scheduleYoutubeUpload, processScheduledUploads } from '../upload/automation';
import { manualProcessUploads } from '../upload/cron';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';

/**
 * Lên lịch tải video lên YouTube
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
    const scheduleTime = formData.get('scheduleTime'); // ISO date string
    
    // Kiểm tra dữ liệu
    if (!courseId || !title || !videoFile) {
      return NextResponse.json({
        success: false,
        message: 'Thiếu thông tin bắt buộc: courseId, title, videoFile'
      }, { status: 400 });
    }
    
    // Tạo thư mục tạm để lưu file
    const TEMP_DIR = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
    
    // Lưu file tạm
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    const videoPath = path.join(TEMP_DIR, `schedule_${Date.now()}_${videoFile.name}`);
    fs.writeFileSync(videoPath, videoBuffer);
    
    let thumbnailPath = null;
    if (thumbnailFile) {
      const thumbnailBuffer = Buffer.from(await thumbnailFile.arrayBuffer());
      thumbnailPath = path.join(TEMP_DIR, `thumb_${Date.now()}_${thumbnailFile.name}`);
      fs.writeFileSync(thumbnailPath, thumbnailBuffer);
    }
    
    // Chuẩn bị tham số để lên lịch
    const scheduleOptions = {
      courseId,
      title,
      description,
      videoPath,
      thumbnailPath,
      visibility,
      scheduleTime: scheduleTime ? new Date(scheduleTime) : null
    };
    
    // Lên lịch hoặc tải video lên YouTube
    const result = await scheduleYoutubeUpload(scheduleOptions);
    
    return NextResponse.json({
      success: true,
      message: scheduleTime 
        ? `Đã lên lịch tải video "${title}" lên YouTube vào ${new Date(scheduleTime).toLocaleString()}`
        : `Đã tải video "${title}" lên YouTube`,
      result
    });
    
  } catch (error) {
    console.error('Lỗi lên lịch tải video:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Lỗi khi lên lịch tải video lên YouTube',
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Lấy danh sách video đã lên lịch
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const status = searchParams.get('status'); // pending, processing, completed, failed, all
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');
    
    // Kết nối database
    const mongoClient = await clientPromise;
    const db = mongoClient.db('kimvan');
    
    // Xử lý courseId 'auto'
    if (courseId === 'auto') {
      try {
        // Tạo khóa học mặc định cho testing
        const defaultCourse = {
          title: 'Khóa học mặc định',
          description: 'Khóa học được tạo tự động cho việc test tải video lên YouTube',
          createdAt: new Date(),
          updatedAt: new Date(),
          videos: [],
          status: 'testing'
        };
        
        const insertResult = await db.collection('courses').insertOne(defaultCourse);
        courseId = insertResult.insertedId.toString();
        console.log(`Đã tạo khóa học mặc định với ID: ${courseId}`);
      } catch (dbError) {
        console.error('Lỗi tạo khóa học mới:', dbError);
        return NextResponse.json({
          success: false,
          message: 'Lỗi tạo khóa học mới: ' + dbError.message
        }, { status: 500 });
      }
    }
    
    // Xây dựng query
    const query = {};
    
    if (courseId) {
      query.courseId = courseId;
    }
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Thực hiện truy vấn
    const scheduledUploads = await db.collection('scheduled_uploads')
      .find(query)
      .sort({ scheduleTime: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    
    // Đếm tổng số
    const total = await db.collection('scheduled_uploads').countDocuments(query);
    
    return NextResponse.json({
      success: true,
      uploads: scheduledUploads,
      pagination: {
        total,
        limit,
        skip
      }
    });
    
  } catch (error) {
    console.error('Lỗi lấy danh sách video lên lịch:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Lỗi khi lấy danh sách video lên lịch',
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Xử lý tác vụ với video đã lên lịch (thực thi thủ công, hủy, xóa)
 */
export async function PATCH(request) {
  try {
    const data = await request.json();
    const { action, uploadId } = data;
    
    // Kiểm tra dữ liệu
    if (!action) {
      return NextResponse.json({
        success: false,
        message: 'Thiếu tham số action'
      }, { status: 400 });
    }
    
    // Kết nối database
    const mongoClient = await clientPromise;
    const db = mongoClient.db('kimvan');
    
    // Xử lý các hành động
    switch (action) {
      case 'process-all':
        // Xử lý tất cả video đã lên lịch
        const result = await manualProcessUploads();
        return NextResponse.json({
          success: true,
          message: 'Đã kích hoạt xử lý tất cả video đã lên lịch',
          result
        });
        
      case 'cancel':
        // Hủy lịch upload video
        if (!uploadId) {
          return NextResponse.json({
            success: false,
            message: 'Thiếu ID video cần hủy lịch'
          }, { status: 400 });
        }
        
        await db.collection('scheduled_uploads').updateOne(
          { _id: new ObjectId(uploadId), status: 'pending' },
          { $set: { status: 'cancelled', cancelledAt: new Date() } }
        );
        
        return NextResponse.json({
          success: true,
          message: 'Đã hủy lịch tải video lên YouTube'
        });
        
      case 'delete':
        // Xóa bản ghi lên lịch
        if (!uploadId) {
          return NextResponse.json({
            success: false,
            message: 'Thiếu ID video cần xóa'
          }, { status: 400 });
        }
        
        // Tìm thông tin để xóa các file liên quan
        const uploadInfo = await db.collection('scheduled_uploads').findOne({ 
          _id: new ObjectId(uploadId) 
        });
        
        if (uploadInfo) {
          // Xóa files nếu có
          if (uploadInfo.videoPath && fs.existsSync(uploadInfo.videoPath)) {
            fs.unlinkSync(uploadInfo.videoPath);
          }
          
          if (uploadInfo.thumbnailPath && fs.existsSync(uploadInfo.thumbnailPath)) {
            fs.unlinkSync(uploadInfo.thumbnailPath);
          }
          
          // Xóa bản ghi
          await db.collection('scheduled_uploads').deleteOne({ 
            _id: new ObjectId(uploadId) 
          });
        }
        
        return NextResponse.json({
          success: true,
          message: 'Đã xóa bản ghi lên lịch tải video'
        });
        
      default:
        return NextResponse.json({
          success: false,
          message: 'Hành động không hợp lệ'
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Lỗi xử lý tác vụ với video lên lịch:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Lỗi khi xử lý tác vụ với video lên lịch',
      error: error.message
    }, { status: 500 });
  }
} 