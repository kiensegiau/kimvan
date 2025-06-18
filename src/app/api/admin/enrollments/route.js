import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Enrollment from '@/models/Enrollment';
import Course from '@/models/Course';
import { authMiddleware, checkAuthAndRole } from '@/lib/auth';
import mongoose from 'mongoose';
import { cookies } from 'next/headers';

// GET: Lấy danh sách đăng ký khóa học của người dùng cụ thể
export async function GET(request) {
  try {
    // Kiểm tra quyền admin hoặc CTV
    const cookieStore = await cookies();
    const adminAccess = cookieStore.get('admin_access');
    const ctvAccess = cookieStore.get('ctv_access');
    
    // Nếu có cookie admin_access hoặc ctv_access, cho phép truy cập
    if (!((adminAccess && adminAccess.value === 'true') || (ctvAccess && ctvAccess.value === 'true'))) {
      // Kiểm tra xác thực người dùng và quyền admin/ctv
      const hasAccess = await checkAuthAndRole(request, ['admin', 'ctv']);
      
      if (!hasAccess) {
        console.log('❌ Admin/CTV API - Không có quyền truy cập');
        return NextResponse.json({ 
          success: false,
          message: 'Bạn không có quyền thực hiện hành động này' 
        }, { status: 403 });
      }
    }
    
    // Lấy userId từ query params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ 
        success: false,
        message: 'Thiếu ID người dùng' 
      }, { status: 400 });
    }
    
    // Kết nối đến MongoDB
    await connectDB();
    
    // Lấy danh sách đăng ký khóa học của người dùng
    const enrollments = await Enrollment.find({ userId })
      .populate('courseId')
      .sort({ enrolledAt: -1 })
      .lean()
      .exec();
    
    // Trả về kết quả
    return NextResponse.json({
      success: true,
      data: enrollments.map(enrollment => ({
        id: enrollment._id,
        courseId: enrollment.courseId._id,
        courseName: enrollment.courseId.name,
        progress: enrollment.progress || 0,
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
        lastAccessedAt: enrollment.lastAccessedAt
      }))
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách đăng ký khóa học:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Lỗi khi lấy danh sách đăng ký khóa học' 
    }, { status: 500 });
  }
}

// POST: Admin/CTV thêm khóa học cho người dùng
export async function POST(request) {
  try {
    // Kiểm tra quyền admin hoặc CTV
    const cookieStore = await cookies();
    const adminAccess = cookieStore.get('admin_access');
    const ctvAccess = cookieStore.get('ctv_access');
    
    // Nếu có cookie admin_access hoặc ctv_access, cho phép truy cập
    if (!((adminAccess && adminAccess.value === 'true') || (ctvAccess && ctvAccess.value === 'true'))) {
      // Kiểm tra xác thực người dùng và quyền admin/ctv
      const hasAccess = await checkAuthAndRole(request, ['admin', 'ctv']);
      
      if (!hasAccess) {
        console.log('❌ Admin/CTV API - Không có quyền truy cập');
        return NextResponse.json({ 
          success: false,
          message: 'Bạn không có quyền thực hiện hành động này' 
        }, { status: 403 });
      }
    }
    
    // Lấy dữ liệu từ request
    const body = await request.json();
    const { userId, courseId, ctvEmail } = body;
    
    // Kiểm tra dữ liệu đầu vào
    if (!userId) {
      return NextResponse.json({ 
        success: false,
        message: 'Thiếu ID người dùng' 
      }, { status: 400 });
    }
    
    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      return NextResponse.json({ 
        success: false,
        message: 'ID khóa học không hợp lệ' 
      }, { status: 400 });
    }
    
    // Kết nối đến MongoDB
    await connectDB();
    
    // Kiểm tra khóa học tồn tại
    const course = await Course.findById(courseId).lean().exec();
    if (!course) {
      return NextResponse.json({ 
        success: false,
        message: 'Không tìm thấy khóa học' 
      }, { status: 404 });
    }
    
    // Kiểm tra xem người dùng đã đăng ký khóa học này chưa
    const existingEnrollment = await Enrollment.findOne({ 
      userId,
      courseId
    }).lean().exec();
    
    if (existingEnrollment) {
      return NextResponse.json({ 
        success: false,
        message: 'Người dùng đã đăng ký khóa học này rồi' 
      }, { status: 409 });
    }
    
    // Tạo đăng ký mới
    const enrollment = new Enrollment({
      userId,
      courseId,
      enrolledAt: new Date(),
      lastAccessedAt: new Date(),
      status: 'active',
      createdBy: ctvEmail || null // Lưu thông tin CTV đã thêm khóa học
    });
    
    // Lưu đăng ký vào database
    await enrollment.save();
    
    // Trả về kết quả
    return NextResponse.json({
      success: true,
      message: 'Đã thêm khóa học cho người dùng thành công',
      data: {
        id: enrollment._id,
        courseId: course._id,
        courseName: course.name,
        progress: 0,
        status: 'active',
        enrolledAt: enrollment.enrolledAt,
        lastAccessedAt: enrollment.lastAccessedAt
      }
    });
  } catch (error) {
    console.error('Lỗi khi thêm khóa học cho người dùng:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Lỗi khi thêm khóa học cho người dùng' 
    }, { status: 500 });
  }
}

// DELETE: Admin/CTV xóa đăng ký khóa học
export async function DELETE(request) {
  try {
    // Kiểm tra quyền admin hoặc CTV
    const cookieStore = await cookies();
    const adminAccess = cookieStore.get('admin_access');
    const ctvAccess = cookieStore.get('ctv_access');
    
    // Nếu có cookie admin_access hoặc ctv_access, cho phép truy cập
    if (!((adminAccess && adminAccess.value === 'true') || (ctvAccess && ctvAccess.value === 'true'))) {
      // Kiểm tra xác thực người dùng và quyền admin/ctv
      const hasAccess = await checkAuthAndRole(request, ['admin', 'ctv']);
      
      if (!hasAccess) {
        console.log('❌ Admin/CTV API - Không có quyền truy cập');
        return NextResponse.json({ 
          success: false,
          message: 'Bạn không có quyền thực hiện hành động này' 
        }, { status: 403 });
      }
    }
    
    // Lấy ID đăng ký từ URL
    const { searchParams } = new URL(request.url);
    const enrollmentId = searchParams.get('id');
    const ctvEmail = searchParams.get('ctvEmail');
    
    // Kiểm tra ID đăng ký
    if (!enrollmentId || !mongoose.Types.ObjectId.isValid(enrollmentId)) {
      return NextResponse.json({ 
        success: false,
        message: 'ID đăng ký không hợp lệ' 
      }, { status: 400 });
    }
    
    // Kết nối đến MongoDB
    await connectDB();
    
    // Tìm và xóa đăng ký
    const result = await Enrollment.findByIdAndDelete(enrollmentId);
    
    // Kiểm tra kết quả
    if (!result) {
      return NextResponse.json({ 
        success: false,
        message: 'Không tìm thấy đăng ký khóa học' 
      }, { status: 404 });
    }
    
    // Trả về kết quả
    return NextResponse.json({
      success: true,
      message: 'Đã xóa đăng ký khóa học thành công'
    });
  } catch (error) {
    console.error('Lỗi khi xóa đăng ký khóa học:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Lỗi khi xóa đăng ký khóa học' 
    }, { status: 500 });
  }
} 