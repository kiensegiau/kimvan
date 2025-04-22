import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// GET: Lấy một khóa học theo ID
export async function GET(request, { params }) {
  try {
    const { id } = params;
    
    const mongoClient = await clientPromise;
    const db = mongoClient.db('kimvan');
    
    const course = await db.collection('courses').findOne({ _id: new ObjectId(id) });
    
    if (!course) {
      return NextResponse.json({ message: 'Không tìm thấy khóa học' }, { status: 404 });
    }
    
    return NextResponse.json(course, { status: 200 });
  } catch (error) {
    console.error('Lỗi khi lấy thông tin khóa học:', error);
    return NextResponse.json({ message: 'Đã xảy ra lỗi khi lấy thông tin khóa học' }, { status: 500 });
  }
}

// PUT: Cập nhật một khóa học
export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    
    const mongoClient = await clientPromise;
    const db = mongoClient.db('kimvan');
    
    const updatedCourse = {
      name: body.name,
      description: body.description,
      price: body.price,
      status: body.status,
    };
    
    const result = await db.collection('courses').updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedCourse }
    );
    
    if (result.matchedCount === 0) {
      return NextResponse.json({ message: 'Không tìm thấy khóa học' }, { status: 404 });
    }
    
    return NextResponse.json(
      { message: 'Khóa học đã được cập nhật thành công' }, 
      { status: 200 }
    );
  } catch (error) {
    console.error('Lỗi khi cập nhật khóa học:', error);
    return NextResponse.json({ message: 'Đã xảy ra lỗi khi cập nhật khóa học' }, { status: 500 });
  }
}

// DELETE: Xóa một khóa học
export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    
    const mongoClient = await clientPromise;
    const db = mongoClient.db('kimvan');
    
    const result = await db.collection('courses').deleteOne({ _id: new ObjectId(id) });
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ message: 'Không tìm thấy khóa học' }, { status: 404 });
    }
    
    return NextResponse.json(
      { message: 'Khóa học đã được xóa thành công' }, 
      { status: 200 }
    );
  } catch (error) {
    console.error('Lỗi khi xóa khóa học:', error);
    return NextResponse.json({ message: 'Đã xảy ra lỗi khi xóa khóa học' }, { status: 500 });
  }
} 