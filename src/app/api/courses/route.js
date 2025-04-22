import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// GET: Lấy tất cả khóa học
export async function GET() {
  try {
    // Kết nối MongoDB
    const mongoClient = await clientPromise;
    const db = mongoClient.db('kimvan');
    const courses = await db.collection('courses').find({}).toArray();
    
    console.log('Kết nối MongoDB thành công, lấy được', courses.length, 'khóa học');
    
    return NextResponse.json(courses, { status: 200 });
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu khóa học:', error);
    return NextResponse.json({ 
      success: false,
      message: 'Đã xảy ra lỗi khi lấy dữ liệu khóa học. Vui lòng kiểm tra kết nối MongoDB.',
      error: error.message 
    }, { status: 500 });
  }
}

// POST: Tạo khóa học mới
export async function POST(request) {
  try {
    const body = await request.json();
    
    // Kết nối MongoDB
    const mongoClient = await clientPromise;
    const db = mongoClient.db('kimvan');
    
    const newCourse = {
      name: body.name,
      description: body.description,
      price: body.price,
      status: body.status || 'active',
      createdAt: new Date(),
    };
    
    const result = await db.collection('courses').insertOne(newCourse);
    
    return NextResponse.json(
      { 
        success: true,
        message: 'Khóa học đã được tạo thành công', 
        course: { ...newCourse, _id: result.insertedId } 
      }, 
      { status: 201 }
    );
  } catch (error) {
    console.error('Lỗi khi tạo khóa học mới:', error);
    return NextResponse.json({ 
      success: false,
      message: 'Đã xảy ra lỗi khi tạo khóa học mới. Vui lòng kiểm tra kết nối MongoDB.',
      error: error.message 
    }, { status: 500 });
  }
} 