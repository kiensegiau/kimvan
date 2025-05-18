import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Course from '@/models/Course';
import { authMiddleware, checkAuthAndRole } from '@/lib/auth';
import { cookies } from 'next/headers';
import { connectDB } from '@/lib/mongodb';

// GET: Lấy thông tin chi tiết của một khóa học
export async function GET(request, { params }) {
  try {
    // Await params trước khi sử dụng
    const paramsData = await params;
    const id = paramsData.id;
    
    // Kiểm tra cookie admin_access
    const cookieStore = await cookies();
    const adminAccess = cookieStore.get('admin_access');
    
    // Nếu có cookie admin_access, cho phép truy cập
    if (adminAccess && adminAccess.value === 'true') {
      console.log('🔒 Admin API - Đã có cookie admin_access, cho phép truy cập');
      
      // Đảm bảo kết nối đến MongoDB trước khi truy vấn
      await connectDB();
      
      // Kiểm tra ID hợp lệ
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ 
          success: false,
          message: 'ID khóa học không hợp lệ' 
        }, { status: 400 });
      }
      
      // Tìm khóa học theo ID
      const course = await Course.findById(id).lean().exec();
      
      if (!course) {
        return NextResponse.json({ 
          success: false,
          message: 'Không tìm thấy khóa học' 
        }, { status: 404 });
      }
      
      // Trả về dữ liệu không mã hóa cho admin
      return NextResponse.json(course);
    }
    
    // Kiểm tra xác thực người dùng và quyền admin
    const hasAccess = await checkAuthAndRole(request, 'admin');
    
    if (!hasAccess) {
      console.log('❌ Admin API - Không có quyền admin');
      return NextResponse.json({ 
        success: false,
        message: 'Bạn không có quyền truy cập vào tài nguyên này' 
      }, { status: 403 });
    }
    
    // Đảm bảo kết nối đến MongoDB trước khi truy vấn
    await connectDB();
    
    // Kiểm tra ID hợp lệ
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ 
        success: false,
        message: 'ID khóa học không hợp lệ' 
      }, { status: 400 });
    }
    
    // Tìm khóa học theo ID
    const course = await Course.findById(id).lean().exec();
    
    if (!course) {
      return NextResponse.json({ 
        success: false,
        message: 'Không tìm thấy khóa học' 
      }, { status: 404 });
    }
    
    // Trả về dữ liệu không mã hóa cho admin
    return NextResponse.json(course);
  } catch (error) {
    console.error('Lỗi khi lấy thông tin khóa học:', error);
    return NextResponse.json({ 
      success: false,
      message: 'Đã xảy ra lỗi khi lấy thông tin khóa học',
      error: error.message 
    }, { status: 500 });
  }
}

// PUT: Cập nhật thông tin khóa học
export async function PUT(request, { params }) {
  try {
    // Await params trước khi sử dụng
    const paramsData = await params;
    const id = paramsData.id;
    
    // Kiểm tra cookie admin_access
    const cookieStore = await cookies();
    const adminAccess = cookieStore.get('admin_access');
    
    // Nếu có cookie admin_access, cho phép truy cập
    if (adminAccess && adminAccess.value === 'true') {
      console.log('🔒 Admin API - Đã có cookie admin_access, cho phép truy cập');
      
      const body = await request.json();
      
      // Đảm bảo kết nối đến MongoDB trước khi truy vấn
      await connectDB();
      
      // Kiểm tra ID hợp lệ
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ 
          success: false,
          message: 'ID khóa học không hợp lệ' 
        }, { status: 400 });
      }
      
      // Cập nhật thông tin khóa học
      const updatedCourse = await Course.findByIdAndUpdate(
        id,
        { 
          ...body,
          updatedAt: new Date()
        },
        { new: true }
      ).lean().exec();
      
      if (!updatedCourse) {
        return NextResponse.json({ 
          success: false,
          message: 'Không tìm thấy khóa học để cập nhật' 
        }, { status: 404 });
      }
      
      return NextResponse.json({
        success: true,
        message: 'Khóa học đã được cập nhật thành công',
        course: updatedCourse
      });
    }
    
    // Kiểm tra xác thực người dùng và quyền admin
    const hasAccess = await checkAuthAndRole(request, 'admin');
    
    if (!hasAccess) {
      console.log('❌ Admin API - Không có quyền admin');
      return NextResponse.json({ 
        success: false,
        message: 'Bạn không có quyền thực hiện hành động này' 
      }, { status: 403 });
    }
    
    const body = await request.json();
    
    // Đảm bảo kết nối đến MongoDB trước khi truy vấn
    await connectDB();
    
    // Kiểm tra ID hợp lệ
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ 
        success: false,
        message: 'ID khóa học không hợp lệ' 
      }, { status: 400 });
    }
    
    // Cập nhật thông tin khóa học
    const updatedCourse = await Course.findByIdAndUpdate(
      id,
      { 
        ...body,
        updatedAt: new Date()
      },
      { new: true }
    ).lean().exec();
    
    if (!updatedCourse) {
      return NextResponse.json({ 
        success: false,
        message: 'Không tìm thấy khóa học để cập nhật' 
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Khóa học đã được cập nhật thành công',
      course: updatedCourse
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật khóa học:', error);
    return NextResponse.json({ 
      success: false,
      message: 'Đã xảy ra lỗi khi cập nhật khóa học',
      error: error.message 
    }, { status: 500 });
  }
}

// DELETE: Xóa khóa học
export async function DELETE(request, { params }) {
  try {
    // Await params trước khi sử dụng
    const paramsData = await params;
    const id = paramsData.id;
    
    // Kiểm tra cookie admin_access
    const cookieStore = await cookies();
    const adminAccess = cookieStore.get('admin_access');
    
    // Nếu có cookie admin_access, cho phép truy cập
    if (adminAccess && adminAccess.value === 'true') {
      console.log('🔒 Admin API - Đã có cookie admin_access, cho phép truy cập');
      
      // Đảm bảo kết nối đến MongoDB trước khi truy vấn
      await connectDB();
      
      // Kiểm tra ID hợp lệ
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ 
          success: false,
          message: 'ID khóa học không hợp lệ' 
        }, { status: 400 });
      }
      
      // Xóa khóa học
      const deletedCourse = await Course.findByIdAndDelete(id).lean().exec();
      
      if (!deletedCourse) {
        return NextResponse.json({ 
          success: false,
          message: 'Không tìm thấy khóa học để xóa' 
        }, { status: 404 });
      }
      
      return NextResponse.json({
        success: true,
        message: 'Khóa học đã được xóa thành công'
      });
    }
    
    // Kiểm tra xác thực người dùng và quyền admin
    const hasAccess = await checkAuthAndRole(request, 'admin');
    
    if (!hasAccess) {
      console.log('❌ Admin API - Không có quyền admin');
      return NextResponse.json({ 
        success: false,
        message: 'Bạn không có quyền thực hiện hành động này' 
      }, { status: 403 });
    }
    
    // Đảm bảo kết nối đến MongoDB trước khi truy vấn
    await connectDB();
    
    // Kiểm tra ID hợp lệ
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ 
        success: false,
        message: 'ID khóa học không hợp lệ' 
      }, { status: 400 });
    }
    
    // Xóa khóa học
    const deletedCourse = await Course.findByIdAndDelete(id).lean().exec();
    
    if (!deletedCourse) {
      return NextResponse.json({ 
        success: false,
        message: 'Không tìm thấy khóa học để xóa' 
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Khóa học đã được xóa thành công'
    });
  } catch (error) {
    console.error('Lỗi khi xóa khóa học:', error);
    return NextResponse.json({ 
      success: false,
      message: 'Đã xảy ra lỗi khi xóa khóa học',
      error: error.message 
    }, { status: 500 });
  }
} 