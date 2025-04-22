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

// PATCH: Đồng bộ một khóa học từ Kimvan
export async function PATCH(request, { params }) {
  try {
    const id = params.id; // Lấy ID từ params mà không cần destructuring
    
    const mongoClient = await clientPromise;
    const db = mongoClient.db('kimvan');
    const collection = db.collection('courses');
    
    if (!id) {
      return NextResponse.json(
        { message: 'Thiếu ID khóa học' },
        { status: 400 }
      );
    }
    
    // Kiểm tra xem khóa học có tồn tại không
    const existingCourse = await collection.findOne({ kimvanId: id });
    if (!existingCourse) {
      return NextResponse.json(
        { 
          success: false,
          message: 'Không tìm thấy khóa học để đồng bộ' 
        },
        { status: 404 }
      );
    }
    
    // Gọi API để lấy dữ liệu mới từ Kimvan - sử dụng API đúng
    console.log(`Đang gọi API kimvan với ID: ${id}`);
    const kimvanUrl = new URL(request.url);
    const origin = kimvanUrl.origin;
    const kimvanApiUrl = `${origin}/api/spreadsheets/${id}`;
    console.log(`URL đích: ${kimvanApiUrl}`);
    
    const kimvanResponse = await fetch(kimvanApiUrl);
    
    if (!kimvanResponse.ok) {
      return NextResponse.json(
        { 
          success: false,
          message: 'Không thể lấy dữ liệu từ Kimvan API',
          error: `Lỗi: ${kimvanResponse.status}` 
        },
        { status: 500 }
      );
    }
    
    console.log('Đã nhận dữ liệu từ kimvan API thành công!');
    const kimvanData = await kimvanResponse.json();
    
    // Giữ lại _id và kimvanId từ dữ liệu cũ
    const _id = existingCourse._id;
    const kimvanId = existingCourse.kimvanId;
    
    // Tạo document mới hoàn toàn để thay thế dữ liệu cũ
    const newCourseData = {
      _id: _id,
      kimvanId: kimvanId,
      name: kimvanData.name || 'Khóa học không tên',
      description: `Khóa học ${kimvanData.name || 'không tên'}`,
      price: existingCourse.price || 500000, // Giữ giá cũ nếu có
      status: existingCourse.status || 'active',
      createdAt: existingCourse.createdAt || new Date(),
      updatedAt: new Date(),
      originalData: kimvanData // Lưu dữ liệu gốc mới
    };
    
    // Xóa document cũ và thay thế bằng document mới
    const result = await collection.replaceOne(
      { kimvanId: id },
      newCourseData
    );
    
    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { 
          success: false,
          message: 'Không có dữ liệu nào được cập nhật' 
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Đồng bộ khóa học thành công - Dữ liệu đã được làm mới hoàn toàn',
      updatedFields: Object.keys(newCourseData)
    });
  } catch (error) {
    console.error('Lỗi khi đồng bộ khóa học:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Đã xảy ra lỗi khi đồng bộ khóa học',
        error: error.message 
      },
      { status: 500 }
    );
  }
} 