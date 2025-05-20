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
        status: 'active',
        originalData: item // Lưu dữ liệu gốc trong document
      }));
    }

    // Kết nối MongoDB
    const mongoClient = await clientPromise;
    const db = mongoClient.db('kimvan');
    const coursesCollection = db.collection('courses');

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

    // Lấy danh sách các kimvanId đã tồn tại
    const existingCourses = await coursesCollection.find(
      { kimvanId: { $in: coursesToSync.map(course => course.kimvanId) } },
      { projection: { kimvanId: 1 } }
    ).toArray();
    
    const existingKimvanIds = new Set(existingCourses.map(course => course.kimvanId));

    // Chỉ tạo các thao tác insert cho các khóa học chưa tồn tại
    const bulkOps = [];

    for (const course of coursesToSync) {
      try {
        if (!existingKimvanIds.has(course.kimvanId)) {
          // Chỉ thêm mới nếu khóa học chưa tồn tại
          bulkOps.push({
            insertOne: {
              document: {
                ...course,
                createdAt: new Date(),
                updatedAt: new Date()
              }
            }
          });
          syncResults.created++;
        } else {
          // Bỏ qua các khóa học đã tồn tại
          syncResults.skipped++;
        }
      } catch (err) {
        console.error(`Lỗi khi chuẩn bị đồng bộ khóa học ID ${course.kimvanId}:`, err);
        syncResults.errors++;
      }
    }

    // Thực hiện các thao tác hàng loạt nếu có
    if (bulkOps.length > 0) {
      await coursesCollection.bulkWrite(bulkOps);
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