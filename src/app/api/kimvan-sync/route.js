import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request) {
  try {
    const body = await request.json();
    const { sync } = body;

    // Kiểm tra xem người dùng có xác nhận đồng bộ không
    if (!sync) {
      return NextResponse.json({ 
        success: false, 
        message: 'Vui lòng xác nhận đồng bộ dữ liệu' 
      }, { status: 400 });
    }

    // Lấy danh sách khóa học từ Kimvan API
    const kimvanResponse = await fetch(`${request.nextUrl.origin}/api/kimvan-courses`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!kimvanResponse.ok) {
      throw new Error(`Lỗi khi lấy dữ liệu từ Kimvan API: ${kimvanResponse.status}`);
    }

    const kimvanData = await kimvanResponse.json();
    
    if (!kimvanData.success || !kimvanData.courses || !Array.isArray(kimvanData.courses)) {
      throw new Error('Định dạng dữ liệu không hợp lệ từ Kimvan API');
    }

    // Kết nối MongoDB
    const mongoClient = await clientPromise;
    const db = mongoClient.db('kimvan');
    const coursesCollection = db.collection('courses');

    // Đếm số khóa học đã có trong DB
    const existingCoursesCount = await coursesCollection.countDocuments({});

    // Đồng bộ từng khóa học
    const syncResults = {
      total: kimvanData.courses.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0
    };

    for (const course of kimvanData.courses) {
      try {
        // Kiểm tra xem khóa học đã tồn tại chưa (dựa vào kimvanId)
        const existingCourse = await coursesCollection.findOne({ kimvanId: course.kimvanId });

        if (existingCourse) {
          // Cập nhật khóa học hiện có
          await coursesCollection.updateOne(
            { kimvanId: course.kimvanId },
            {
              $set: {
                name: course.name,
                description: course.description,
                price: course.price,
                status: course.status,
                updatedAt: new Date(),
                originalData: course.originalData
              }
            }
          );
          syncResults.updated++;
        } else {
          // Tạo khóa học mới
          await coursesCollection.insertOne({
            kimvanId: course.kimvanId,
            name: course.name,
            description: course.description,
            price: course.price,
            status: course.status,
            createdAt: new Date(),
            originalData: course.originalData
          });
          syncResults.created++;
        }
      } catch (err) {
        console.error(`Lỗi khi đồng bộ khóa học ID ${course.kimvanId}:`, err);
        syncResults.errors++;
      }
    }

    // Lấy số khóa học sau khi đồng bộ
    const currentCoursesCount = await coursesCollection.countDocuments({});

    return NextResponse.json({
      success: true,
      message: 'Đồng bộ khóa học thành công',
      summary: {
        previousCount: existingCoursesCount,
        currentCount: currentCoursesCount,
        ...syncResults
      }
    });
  } catch (error) {
    console.error('Lỗi khi đồng bộ dữ liệu:', error);
    return NextResponse.json({
      success: false,
      message: 'Đã xảy ra lỗi khi đồng bộ dữ liệu. Vui lòng kiểm tra kết nối MongoDB.',
      error: error.message
    }, { status: 500 });
  }
} 