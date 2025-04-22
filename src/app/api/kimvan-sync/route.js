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

    // Kiểm tra trước và tạo danh sách các ID cần xử lý
    const existingCoursesMap = {};
    const existingCourses = await coursesCollection.find(
      { kimvanId: { $in: coursesToSync.map(course => course.kimvanId) } },
      { projection: { kimvanId: 1 } }
    ).toArray();
    
    existingCourses.forEach(course => {
      existingCoursesMap[course.kimvanId] = true;
    });

    // Tạo các thao tác upsert cho tất cả khóa học để thực hiện hàng loạt
    const bulkOps = [];

    for (const course of coursesToSync) {
      try {
        // Giữ lại dữ liệu gốc trong cùng document
        // Không cần tách ra collection riêng
        
        // Kiểm tra xem khóa học đã tồn tại chưa
        const exists = existingCoursesMap[course.kimvanId];
        
        if (exists) {
          // Cập nhật khóa học hiện có
          bulkOps.push({
            updateOne: {
              filter: { kimvanId: course.kimvanId },
              update: {
                $set: {
                  ...course, // Bao gồm cả originalData
                  updatedAt: new Date()
                }
              }
            }
          });
          
          syncResults.updated++;
        } else {
          // Tạo khóa học mới
          bulkOps.push({
            insertOne: {
              document: {
                ...course, // Bao gồm cả originalData
                createdAt: new Date()
              }
            }
          });
          
          syncResults.created++;
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