 import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { connectDB } from '@/lib/mongodb';
import Course from '@/models/Course';
import MiniCourse from '@/models/MiniCourse';
import mongoose from 'mongoose';

export async function GET() {
  try {
    // Kết nối đến MongoDB
    const mongoClient = await clientPromise;
    const db = mongoClient.db('kimvan');
    await connectDB(); // Đảm bảo kết nối Mongoose

    // Kiểm tra xem collection minicourses đã tồn tại chưa
    const collections = await db.listCollections({ name: 'minicourses' }).toArray();
    
    let message = '';
    let created = false;
    let stats = {
      processed: 0,
      created: 0,
      updated: 0,
      errors: 0
    };

    if (collections.length === 0) {
      // Nếu collection chưa tồn tại, tạo mới
      await db.createCollection('minicourses');
      message = `Đã tạo collection 'minicourses'`;
      created = true;
    } else {
      message = `Collection 'minicourses' đã tồn tại`;
    }

    // Lấy tất cả khóa học từ collection courses
    const courses = await Course.find({}).lean();
    console.log(`Đã tìm thấy ${courses.length} khóa học để xử lý`);
    
    // Chuẩn bị các thao tác hàng loạt
    const bulkOps = [];
    
    // Tạo các bản ghi minicourse từ dữ liệu courses
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
          createdAt: course.createdAt || new Date(),
          updatedAt: new Date(),
          processedDriveFiles: course.processedDriveFiles || []
        };
        
        // Kiểm tra xem minicourse đã tồn tại chưa
        const existingMiniCourse = await MiniCourse.findOne({ kimvanId: course.kimvanId });
        
        if (existingMiniCourse) {
          // Cập nhật minicourse hiện có
          bulkOps.push({
            updateOne: {
              filter: { _id: existingMiniCourse._id },
              update: { $set: miniCourseData }
            }
          });
          stats.updated++;
        } else {
          // Thêm mới minicourse
          bulkOps.push({
            insertOne: {
              document: miniCourseData
            }
          });
          stats.created++;
        }
      } catch (error) {
        console.error(`Lỗi khi xử lý khóa học ${course._id}:`, error);
        stats.errors++;
      }
    }
    
    // Thực hiện các thao tác hàng loạt nếu có
    if (bulkOps.length > 0) {
      await db.collection('minicourses').bulkWrite(bulkOps);
    }

    // Trả về thông tin khởi tạo
    return NextResponse.json({ 
      success: true, 
      message: `${message}. Đã xử lý ${stats.processed} khóa học, tạo ${stats.created} minicourse mới, cập nhật ${stats.updated} minicourse, ${stats.errors} lỗi.`,
      created,
      stats,
      database: 'kimvan'
    });
  } catch (error) {
    console.error('Lỗi khi khởi tạo collection minicourses:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Đã xảy ra lỗi khi khởi tạo collection minicourses', 
      error: error.message 
    }, { status: 500 });
  }
} 