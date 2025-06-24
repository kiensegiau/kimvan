import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import MiniCourse from '@/models/MiniCourse';

export async function GET(request) {
  try {
    // Kết nối đến MongoDB
    await connectDB();
    
    // Lấy tham số tìm kiếm từ URL nếu có
    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '100');
    const page = parseInt(searchParams.get('page') || '1');
    const skip = (page - 1) * limit;
    
    // Tạo query dựa trên tham số tìm kiếm
    let query = {};
    if (searchTerm) {
      query = {
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } }
        ]
      };
    }
    
    // Đếm tổng số bản ghi
    const total = await MiniCourse.countDocuments(query);
    
    // Lấy danh sách minicourses với phân trang
    const minicourses = await MiniCourse.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Trả về kết quả
    return NextResponse.json({
      success: true,
      data: {
        minicourses,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách minicourses:', error);
    return NextResponse.json({
      success: false,
      message: 'Đã xảy ra lỗi khi lấy danh sách minicourses',
      error: error.message
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    // Kết nối đến MongoDB
    await connectDB();
    
    // Lấy dữ liệu từ request
    const miniCourseData = await request.json();
    
    if (!miniCourseData) {
      return NextResponse.json({
        success: false,
        message: 'Không có dữ liệu khóa học để thêm/cập nhật'
      }, { status: 400 });
    }
    
    let result;
    
    // Kiểm tra nếu đã có courseId thì cập nhật, ngược lại thì tạo mới
    if (miniCourseData.courseId) {
      // Tìm minicourse với courseId tương ứng
      const existingMiniCourse = await MiniCourse.findOne({ courseId: miniCourseData.courseId });
      
      if (existingMiniCourse) {
        // Cập nhật minicourse đã tồn tại
        result = await MiniCourse.findOneAndUpdate(
          { courseId: miniCourseData.courseId },
          { 
            ...miniCourseData,
            updatedAt: new Date()
          },
          { new: true }
        );
        
        return NextResponse.json({
          success: true,
          message: 'Cập nhật minicourse thành công',
          data: result
        });
      }
    }
    
    // Tạo mới minicourse nếu không tìm thấy
    result = await MiniCourse.create({
      ...miniCourseData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      message: 'Thêm minicourse mới thành công',
      data: result
    });
    
  } catch (error) {
    console.error('Lỗi khi thêm/cập nhật minicourse:', error);
    return NextResponse.json({
      success: false,
      message: 'Đã xảy ra lỗi khi thêm/cập nhật minicourse',
      error: error.message
    }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    // Kết nối đến MongoDB
    await connectDB();
    
    // Lấy dữ liệu từ request
    const data = await request.json();
    
    if (!data || (!data.courseId && !data.kimvanId)) {
      return NextResponse.json({
        success: false,
        message: 'Thiếu thông tin courseId hoặc kimvanId để xóa minicourse'
      }, { status: 400 });
    }
    
    // Tạo query dựa trên dữ liệu đầu vào
    let query = {};
    if (data.courseId) {
      query.courseId = data.courseId;
    } else if (data.kimvanId) {
      query.kimvanId = data.kimvanId;
    }
    
    // Tìm và xóa minicourse
    const result = await MiniCourse.deleteOne(query);
    
    if (result.deletedCount === 0) {
      return NextResponse.json({
        success: false,
        message: 'Không tìm thấy minicourse để xóa',
        data: result
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Xóa minicourse thành công',
      data: result
    });
    
  } catch (error) {
    console.error('Lỗi khi xóa minicourse:', error);
    return NextResponse.json({
      success: false,
      message: 'Đã xảy ra lỗi khi xóa minicourse',
      error: error.message
    }, { status: 500 });
  }
} 