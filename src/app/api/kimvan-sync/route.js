import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request) {
  try {
    const body = await request.json();
    const { sync, courses } = body;

    // Kiểm tra xem người dùng có xác nhận đồng bộ không
    if (!sync) {
      return NextResponse.json({ 
        success: false, 
        message: 'Vui lòng xác nhận đồng bộ dữ liệu' 
      }, { status: 400 });
    }

    // Sử dụng danh sách khóa học từ client nếu có
    let coursesToSync = [];
    
    if (courses && Array.isArray(courses) && courses.length > 0) {
      // Sử dụng danh sách khóa học từ client
      coursesToSync = courses;
    } else {
      // Nếu không có danh sách từ client, gọi API để lấy danh sách
      const kimvanResponse = await fetch(`${request.nextUrl.origin}/api/spreadsheets/create/fullcombokhoa2k8`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!kimvanResponse.ok) {
        throw new Error(`Lỗi khi lấy dữ liệu từ Kimvan API: ${kimvanResponse.status}`);
      }

      const kimvanData = await kimvanResponse.json();
      
      if (!Array.isArray(kimvanData)) {
        throw new Error('Định dạng dữ liệu không hợp lệ từ Kimvan API');
      }
      
      // Lưu danh sách khóa học gốc từ Kimvan
      coursesToSync = kimvanData.map((item) => ({
        kimvanId: item.id,
        name: item.name,
        description: `Khóa học ${item.name}`,
        price: 500000,
        status: 'active'
        // Không lưu originalData tại đây để tránh dữ liệu quá lớn
      }));
    }

    // Kết nối MongoDB
    const mongoClient = await clientPromise;
    const db = mongoClient.db('kimvan');
    const coursesCollection = db.collection('courses');
    const kimvanDataCollection = db.collection('kimvan_data');

    // Đếm số khóa học đã có trong DB
    const existingCoursesCount = await coursesCollection.countDocuments({});

    // Đồng bộ từng khóa học
    const syncResults = {
      total: coursesToSync.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0
    };

    for (const course of coursesToSync) {
      try {
        const originalData = course.originalData;
        
        // Loại bỏ dữ liệu gốc từ đối tượng khóa học để giảm kích thước
        const courseToSave = { ...course };
        delete courseToSave.originalData;
        
        // Kiểm tra xem khóa học đã tồn tại chưa (dựa vào kimvanId)
        const existingCourse = await coursesCollection.findOne({ kimvanId: course.kimvanId });

        if (existingCourse) {
          // Cập nhật khóa học hiện có
          await coursesCollection.updateOne(
            { kimvanId: course.kimvanId },
            {
              $set: {
                ...courseToSave,
                updatedAt: new Date()
              }
            }
          );
          
          // Lưu hoặc cập nhật dữ liệu gốc lớn trong collection riêng biệt
          if (originalData) {
            await kimvanDataCollection.updateOne(
              { kimvanId: course.kimvanId },
              { 
                $set: { 
                  kimvanId: course.kimvanId,
                  originalData: originalData,
                  updatedAt: new Date()
                }
              },
              { upsert: true }
            );
          }
          
          syncResults.updated++;
        } else {
          // Tạo khóa học mới
          await coursesCollection.insertOne({
            ...courseToSave,
            createdAt: new Date()
          });
          
          // Lưu dữ liệu gốc lớn trong collection riêng biệt
          if (originalData) {
            await kimvanDataCollection.insertOne({
              kimvanId: course.kimvanId,
              originalData: originalData,
              createdAt: new Date()
            });
          }
          
          syncResults.created++;
        }
      } catch (err) {
        console.error(`Lỗi khi đồng bộ khóa học ID ${course.kimvanId}:`, err);
        syncResults.errors++;
      }
    }

    // Lấy số khóa học sau khi đồng bộ
    const currentCoursesCount = await coursesCollection.countDocuments({});
    const kimvanDataCount = await kimvanDataCollection.countDocuments({});

    return NextResponse.json({
      success: true,
      message: 'Đồng bộ khóa học thành công',
      summary: {
        previousCount: existingCoursesCount,
        currentCount: currentCoursesCount,
        kimvanDataCount: kimvanDataCount,
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