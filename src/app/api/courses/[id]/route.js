import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// GET: Lấy một khóa học theo ID
export async function GET(request, { params }) {
  try {
    const { id } = params;
    const mongoClient = await clientPromise;
    const db = mongoClient.db('kimvan');
    const collection = db.collection('courses');

    if (!id) {
      return NextResponse.json(
        { message: 'Thiếu ID khóa học' },
        { status: 400 }
      );
    }

    const course = await collection.findOne({ kimvanId: id });

    if (!course) {
      return NextResponse.json(
        { message: 'Không tìm thấy khóa học' },
        { status: 404 }
      );
    }

    // Nếu khóa học có dữ liệu gốc, trả về cả thông tin khóa học và dữ liệu gốc
    return NextResponse.json({
      ...course,
      originalData: course.originalData || null
    });
  } catch (error) {
    console.error('Lỗi khi lấy thông tin khóa học:', error);
    return NextResponse.json(
      { 
        message: 'Lỗi khi lấy thông tin khóa học',
        error: error.message 
      },
      { status: 500 }
    );
  }
}

// PUT: Cập nhật một khóa học
export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const mongoClient = await clientPromise;
    const db = mongoClient.db('kimvan');
    const collection = db.collection('courses');
    
    if (!id) {
      return NextResponse.json(
        { message: 'Thiếu ID khóa học' },
        { status: 400 }
      );
    }
    
    const course = await collection.findOne({ kimvanId: id });
    if (!course) {
      return NextResponse.json(
        { message: 'Không tìm thấy khóa học' },
        { status: 404 }
      );
    }
    
    const data = await request.json();
    
    // Loại bỏ trường _id để tránh lỗi khi cập nhật
    delete data._id;
    
    // Giữ nguyên dữ liệu gốc
    data.originalData = course.originalData;
    
    const result = await collection.updateOne(
      { kimvanId: id },
      { $set: data }
    );
    
    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { message: 'Không có thay đổi nào được cập nhật' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ 
      message: 'Cập nhật khóa học thành công',
      success: true
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật khóa học:', error);
    return NextResponse.json(
      { 
        message: 'Lỗi khi cập nhật khóa học',
        error: error.message 
      },
      { status: 500 }
    );
  }
}

// DELETE: Xóa một khóa học
export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    
    // Kết nối MongoDB
    const mongoClient = await clientPromise;
    const db = mongoClient.db('kimvan');
    
    const result = await db.collection('courses').deleteOne({ _id: new ObjectId(id) });
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ 
        success: false,
        message: 'Không tìm thấy khóa học' 
      }, { status: 404 });
    }
    
    return NextResponse.json(
      { 
        success: true,
        message: 'Khóa học đã được xóa thành công' 
      }, 
      { status: 200 }
    );
  } catch (error) {
    console.error('Lỗi khi xóa khóa học:', error);
    return NextResponse.json({ 
      success: false,
      message: 'Đã xảy ra lỗi khi xóa khóa học. Vui lòng kiểm tra kết nối MongoDB.',
      error: error.message
    }, { status: 500 });
  }
} 