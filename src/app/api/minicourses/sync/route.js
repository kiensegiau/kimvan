import { NextResponse } from 'next/server';
import { dbMiddleware } from '@/utils/db-middleware';
import clientPromise from '@/lib/mongodb';
import MiniCourse from '@/models/MiniCourse';

export async function POST(request) {
  try {
    // Kết nối đến MongoDB
    await dbMiddleware(request);
    const mongoClient = await clientPromise;
    const db = mongoClient.db('kimvan');
    const miniCoursesCollection = db.collection('minicourses');
    
    // Lấy dữ liệu từ request
    const { courses } = await request.json();
    
    if (!courses || !Array.isArray(courses) || courses.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Không có dữ liệu khóa học để đồng bộ'
      }, { status: 400 });
    }
    
    // Lấy danh sách các kimvanId đã tồn tại
    const existingMiniCourses = await miniCoursesCollection.find(
      { kimvanId: { $in: courses.map(course => course.kimvanId) } },
      { projection: { kimvanId: 1 } }
    ).toArray();
    
    const existingKimvanIds = new Set(existingMiniCourses.map(course => course.kimvanId));
    
    // Chuẩn bị các thao tác hàng loạt
    const bulkOps = [];
    
    // Kết quả đồng bộ
    const syncResults = {
      total: courses.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0
    };
    
    for (const course of courses) {
      try {
        if (!course.kimvanId) {
          syncResults.skipped++;
          continue;
        }
        
        if (!existingKimvanIds.has(course.kimvanId)) {
          // Thêm mới nếu chưa tồn tại
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
          // Cập nhật nếu đã tồn tại
          bulkOps.push({
            updateOne: {
              filter: { kimvanId: course.kimvanId },
              update: {
                $set: {
                  ...course,
                  updatedAt: new Date()
                }
              }
            }
          });
          syncResults.updated++;
        }
      } catch (error) {
        console.error(`Lỗi khi xử lý minicourse ${course.kimvanId}:`, error);
        syncResults.errors++;
      }
    }
    
    // Thực hiện các thao tác hàng loạt nếu có
    if (bulkOps.length > 0) {
      await miniCoursesCollection.bulkWrite(bulkOps);
    }
    
    // Trả về kết quả
    return NextResponse.json({
      success: true,
      message: `Đã đồng bộ ${syncResults.created + syncResults.updated}/${syncResults.total} minicourse thành công`,
      syncResults
    });
  } catch (error) {
    console.error('Lỗi khi đồng bộ minicourses:', error);
    return NextResponse.json({
      success: false,
      message: 'Đã xảy ra lỗi khi đồng bộ minicourses',
      error: error.message
    }, { status: 500 });
  }
} 