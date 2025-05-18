import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import CryptoJS from 'crypto-js';
import mongoose from 'mongoose';
import Course from '@/models/Course';
import { connectDB } from '@/lib/mongodb';

// Khóa mã hóa - phải giống với khóa ở phía client
const ENCRYPTION_KEY = 'kimvan-secure-key-2024';

// Hàm mã hóa dữ liệu với xử lý lỗi tốt hơn
const encryptData = (data) => {
  try {
    if (!data) {
      throw new Error("Không có dữ liệu để mã hóa");
    }
    
    const jsonString = JSON.stringify(data);
    return CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
  } catch (error) {
    console.error("Lỗi mã hóa:", error);
    throw new Error(`Không thể mã hóa dữ liệu: ${error.message}`);
  }
};

// Hàm mã hóa toàn bộ đối tượng
const encryptEntireObject = (obj) => {
  try {
    const jsonString = JSON.stringify(obj);
    return CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
  } catch (error) {
    console.error("Lỗi mã hóa toàn bộ đối tượng:", error);
    throw new Error(`Không thể mã hóa: ${error.message}`);
  }
};

// GET: Lấy một khóa học theo ID
export async function GET(request, { params }) {
  try {
    // Đảm bảo params được awaited
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'slug';
    const secure = searchParams.get('secure') === 'true';
    
    // Đảm bảo kết nối đến MongoDB trước khi truy vấn
    await connectDB();
    
    // Tìm khóa học theo ID hoặc slug
    let course;
    if (type === '_id') {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ error: 'ID không hợp lệ' }, { status: 400 });
      }
      course = await Course.findById(id).lean().exec();
    } else {
      course = await Course.findOne({ slug: id }).lean().exec();
    }
    
    if (!course) {
      return NextResponse.json({ error: 'Không tìm thấy khóa học' }, { status: 404 });
    }
    
    // Tạo một bản sao an toàn để không ảnh hưởng đến đối tượng gốc
    const safeResponse = { ...course };
    
    // Loại bỏ các trường nhạy cảm khỏi phản hồi chính
    if (secure) {
      // Mã hóa toàn bộ đối tượng nếu yêu cầu bảo mật cao
      const encryptedFullData = encryptEntireObject(course);
      return NextResponse.json({ _secureData: encryptedFullData });
    } else {
      // Mã hóa chỉ dữ liệu nhạy cảm
      if (safeResponse.originalData) {
        try {
          // Sử dụng hàm mã hóa đã được cải thiện
          const encryptedData = encryptData(safeResponse.originalData);
          
          // Thay thế dữ liệu gốc bằng dữ liệu đã mã hóa
          safeResponse._encryptedData = encryptedData;
          delete safeResponse.originalData;
        } catch (encryptError) {
          console.error("Lỗi khi mã hóa dữ liệu:", encryptError);
          return NextResponse.json({ 
            error: 'Lỗi khi xử lý dữ liệu khóa học',
            message: encryptError.message 
          }, { status: 500 });
        }
      }
      
      // Loại bỏ thêm các trường nhạy cảm khác
      delete safeResponse.__v;
      
      // Giữ lại chỉ những trường cần thiết
      const publicData = {
        _id: safeResponse._id,
        name: safeResponse.name,
        description: safeResponse.description,
        price: safeResponse.price,
        status: safeResponse.status,
        updatedAt: safeResponse.updatedAt,
        _encryptedData: safeResponse._encryptedData
      };
      
      return NextResponse.json(publicData);
    }
  } catch (error) {
    console.error('Lỗi khi lấy thông tin khóa học:', error);
    return NextResponse.json({ 
      error: 'Lỗi server', 
      message: error.message 
    }, { status: 500 });
  }
}

// PUT: Cập nhật một khóa học
export async function PUT(request, { params }) {
  try {
    // Đảm bảo params được awaited
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    
    // Đảm bảo kết nối đến MongoDB trước khi truy vấn
    await connectDB();
    
    if (!id) {
      return NextResponse.json(
        { message: 'Thiếu ID khóa học' },
        { status: 400 }
      );
    }
    
    // Kiểm tra xem có tham số type=_id không
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    
    let query = {};
    
    // Truy vấn theo loại ID
    if (type === '_id') {
      // Truy vấn theo MongoDB _id 
      try {
        query = { _id: new ObjectId(id) };
      } catch (err) {
        return NextResponse.json(
          { message: 'ID không hợp lệ' },
          { status: 400 }
        );
      }
    } else {
      // Truy vấn theo kimvanId
      query = { kimvanId: id };
    }
    
    const course = await Course.findOne(query).lean().exec();
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
    
    const result = await Course.updateOne(
      query,
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
    // Đảm bảo params được awaited
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    
    // Đảm bảo kết nối đến MongoDB trước khi truy vấn
    await connectDB();
    
    const result = await Course.deleteOne({ _id: new ObjectId(id) });
    
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
    // Đảm bảo params được awaited
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    
    // Đảm bảo kết nối đến MongoDB trước khi truy vấn
    await connectDB();
    
    if (!id) {
      return NextResponse.json(
        { message: 'Thiếu ID khóa học' },
        { status: 400 }
      );
    }
    
    // Kiểm tra xem khóa học có tồn tại không
    const existingCourse = await Course.findOne({ kimvanId: id }).lean().exec();
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
    
    // Xử lý dữ liệu dựa vào cấu trúc thực tế từ API
    // Kimvan API có thể trả về dữ liệu trong nhiều định dạng khác nhau
    let courseName = '';
    
    // Kiểm tra cấu trúc dữ liệu và lấy tên khóa học
    if (kimvanData && typeof kimvanData === 'object') {
      if (kimvanData.name) {
        courseName = kimvanData.name;
      } else if (kimvanData.data && kimvanData.data.name) {
        courseName = kimvanData.data.name;
      } else if (Array.isArray(kimvanData) && kimvanData.length > 0 && kimvanData[0].name) {
        courseName = kimvanData[0].name;
      }
    }
    
    console.log('Tên khóa học được xác định:', courseName);
    
    // Giữ lại _id và kimvanId từ dữ liệu cũ
    const _id = existingCourse._id;
    const kimvanId = existingCourse.kimvanId;
    
    // Tạo document mới hoàn toàn để thay thế dữ liệu cũ
    const newCourseData = {
      _id: _id,
      kimvanId: kimvanId,
      name: courseName || existingCourse.name, // Sử dụng tên đã xác định hoặc giữ tên cũ
      description: courseName 
        ? `Khóa học ${courseName}` 
        : existingCourse.description, // Giữ mô tả cũ nếu không có tên mới
      price: existingCourse.price || 500000, 
      status: existingCourse.status || 'active',
      createdAt: existingCourse.createdAt || new Date(),
      updatedAt: new Date(),
      originalData: kimvanData
    };
    
    // Xóa document cũ và thay thế bằng document mới
    const result = await Course.replaceOne(
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