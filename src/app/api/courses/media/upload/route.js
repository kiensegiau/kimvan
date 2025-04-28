import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(req) {
  try {
    // Lấy thông tin từ request
    const body = await req.json();
    const { courseId, media } = body;

    // Validate input
    if (!courseId) {
      return NextResponse.json(
        { success: false, message: 'Thiếu courseId' },
        { status: 400 }
      );
    }

    if (!media || !Array.isArray(media) || media.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Danh sách media không hợp lệ' },
        { status: 400 }
      );
    }

    // Kết nối đến database
    const { db } = await connectToDatabase();

    // Kiểm tra xem khóa học có tồn tại không
    const course = await db.collection('courses').findOne({
      _id: new ObjectId(courseId)
    });

    if (!course) {
      return NextResponse.json(
        { success: false, message: 'Không tìm thấy khóa học' },
        { status: 404 }
      );
    }

    // Mô phỏng việc tải lên YouTube
    // Trong thực tế, đây sẽ là nơi bạn xử lý việc tải lên thông qua YouTube API
    
    const results = [];
    let successCount = 0;
    
    // Xử lý từng media item
    for (const item of media) {
      // Mô phỏng thời gian xử lý
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mô phỏng tỉ lệ thành công 90%
      const isSuccess = Math.random() < 0.9;
      
      if (isSuccess) {
        successCount++;
        results.push({
          id: item.id,
          title: item.title,
          type: item.type,
          success: true,
          youtubeUrl: `https://youtube.com/watch?v=${Math.random().toString(36).substring(2, 12)}`,
          message: 'Tải lên YouTube thành công'
        });
      } else {
        results.push({
          id: item.id,
          title: item.title,
          type: item.type,
          success: false,
          message: 'Không thể tải lên YouTube, vui lòng thử lại sau'
        });
      }
    }

    // Cập nhật thông tin trong database
    await db.collection('courses').updateOne(
      { _id: new ObjectId(courseId) },
      { 
        $set: {
          lastUpdated: new Date()
        }
      }
    );

    // Trả về kết quả
    return NextResponse.json({
      success: true,
      message: `Đã tải lên ${successCount}/${media.length} tài liệu lên YouTube`,
      totalItems: media.length,
      successCount,
      failureCount: media.length - successCount,
      details: results
    });
    
  } catch (error) {
    console.error('Lỗi khi tải lên YouTube:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
} 