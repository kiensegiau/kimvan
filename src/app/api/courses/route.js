import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// GET: Lấy tất cả khóa học
export async function GET() {
  try {
    const mongoClient = await clientPromise;
    const db = mongoClient.db('kimvan');
    const courses = await db.collection('courses').find({}).toArray();
    
    return NextResponse.json(courses, { status: 200 });
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu khóa học:', error);
    return NextResponse.json({ message: 'Đã xảy ra lỗi khi lấy dữ liệu khóa học' }, { status: 500 });
  }
}

// POST: Tạo khóa học mới
export async function POST(request) {
  try {
    const body = await request.json();
    
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
      { message: 'Khóa học đã được tạo thành công', course: { ...newCourse, _id: result.insertedId } }, 
      { status: 201 }
    );
  } catch (error) {
    console.error('Lỗi khi tạo khóa học mới:', error);
    return NextResponse.json({ message: 'Đã xảy ra lỗi khi tạo khóa học mới' }, { status: 500 });
  }
} 