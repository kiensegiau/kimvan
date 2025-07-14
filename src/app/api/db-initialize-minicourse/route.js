import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { dbMiddleware } from '@/utils/db-middleware';
import Course from '@/models/Course';
import MiniCourse from '@/models/MiniCourse';
import mongoose from 'mongoose';

export async function GET(request) {
  try {
    // Kết nối đến MongoDB
    const mongoClient = await clientPromise;
    const db = mongoClient.db('kimvan');
    await dbMiddleware(request); // Đảm bảo kết nối Mongoose

    console.log('Bắt đầu quy trình xóa và làm mới toàn bộ minicourses');
    
    // Xóa toàn bộ dữ liệu trong collection minicourses
    let deleteResult;
    try {
      // Kiểm tra xem collection minicourses đã tồn tại chưa
      const collections = await db.listCollections({ name: 'minicourses' }).toArray();
      
      if (collections.length > 0) {
        console.log('Xóa toàn bộ dữ liệu trong collection minicourses...');
        deleteResult = await MiniCourse.deleteMany({});
        console.log(`Đã xóa ${deleteResult.deletedCount} minicourses`);
      } else {
        // Nếu collection chưa tồn tại, tạo mới
        console.log('Collection minicourses chưa tồn tại, đang tạo mới...');
        await db.createCollection('minicourses');
        console.log('Đã tạo collection minicourses');
        deleteResult = { deletedCount: 0 };
      }
    } catch (deleteError) {
      console.error('Lỗi khi xóa dữ liệu minicourses:', deleteError);
      throw deleteError;
    }

    // Lấy tất cả khóa học từ collection courses
    const courses = await Course.find({}).lean();
    console.log(`Đã tìm thấy ${courses.length} khóa học để xử lý`);
    
    // Chuẩn bị các thao tác hàng loạt để tạo mới
    const bulkOps = [];
    
    // Tạo các bản ghi minicourse mới từ dữ liệu courses
    let stats = {
      processed: 0,
      created: 0,
      errors: 0
    };
    
    for (const course of courses) {
      try {
        stats.processed++;
        
        // Chuẩn bị dữ liệu cho minicourse
        const miniCourseData = {
          name: course.name,
          description: course.description,
          price: course.price || 0,
          originalPrice: course.originalPrice || 0,
          status: course.status || 'active',
          kimvanId: course.kimvanId,
          spreadsheetId: course.spreadsheetId,
          courseId: course._id, // Tham chiếu đến khóa học gốc
          createdAt: new Date(), // Tạo mới thời gian tạo
          updatedAt: new Date(),
          // Không copy processedDriveFiles, khởi tạo mảng trống
          processedDriveFiles: []
        };
        
        // Thêm mới minicourse (không cần kiểm tra tồn tại vì đã xóa hết)
        bulkOps.push({
          insertOne: {
            document: miniCourseData
          }
        });
        stats.created++;
      } catch (error) {
        console.error(`Lỗi khi xử lý khóa học ${course._id}:`, error);
        stats.errors++;
      }
    }
    
    // Thực hiện các thao tác hàng loạt để tạo mới
    if (bulkOps.length > 0) {
      await db.collection('minicourses').bulkWrite(bulkOps);
      console.log(`Đã tạo mới ${stats.created} minicourses`);
    }

    // Trả về thông tin khởi tạo
    return NextResponse.json({ 
      success: true, 
      message: `Đã xóa hoàn toàn ${deleteResult.deletedCount} minicourse cũ và tạo mới ${stats.created} minicourse từ ${stats.processed} khóa học. Có ${stats.errors} lỗi.`,
      stats: {
        deleted: deleteResult.deletedCount,
        processed: stats.processed,
        created: stats.created,
        errors: stats.errors
      },
      database: 'kimvan'
    });
  } catch (error) {
    console.error('Lỗi khi khởi tạo lại collection minicourses:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Đã xảy ra lỗi khi xóa và khởi tạo lại minicourses', 
      error: error.message 
    }, { status: 500 });
  }
} 