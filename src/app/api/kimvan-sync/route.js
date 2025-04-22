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
      // Sử dụng danh sách khóa học đã chuyển đổi từ client
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
      
      // Chuyển đổi dữ liệu từ Kimvan thành dạng khóa học phù hợp
      coursesToSync = kimvanData.map((item, index) => {
        // Trích xuất tên môn học từ tên khóa (thường có dạng "2K8 XPS | MÔN HỌC - GIÁO VIÊN")
        const nameParts = item.name.split('|');
        const course = nameParts.length > 1 ? nameParts[1].trim() : item.name;
        
        // Trích xuất tên lớp từ phần đầu
        const className = nameParts.length > 0 ? nameParts[0].trim() : '';
        
        // Tìm tên giáo viên (thường sau dấu -)
        const teacherName = course.includes('-') ? course.split('-')[1].trim() : '';
        
        // Tìm tên môn học (thường trước dấu -)
        const subjectName = course.includes('-') ? course.split('-')[0].trim() : course;
        
        return {
          kimvanId: item.id,
          name: `Khóa học ${subjectName} - ${teacherName}`,
          description: `Khóa học ${subjectName} cho ${className} do giáo viên ${teacherName} giảng dạy`,
          price: 500000 + (index * 50000), // Giá mẫu, tăng dần theo index
          status: 'active',
          className: className,
          teacher: teacherName,
          subject: subjectName,
          originalData: item
        };
      });
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

    for (const course of coursesToSync) {
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
                subject: course.subject,
                teacher: course.teacher,
                className: course.className,
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
            subject: course.subject,
            teacher: course.teacher,
            className: course.className,
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