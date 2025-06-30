import { NextResponse } from 'next/server';
import { dbMiddleware } from '@/utils/db-middleware';
import Enrollment from '@/models/Enrollment';
import Course from '@/models/Course';
import { authMiddleware } from '@/lib/auth';
import mongoose from 'mongoose';

// GET: Lấy danh sách khóa học đã đăng ký của người dùng hiện tại
export async function GET(request) {
  try {
    // Kiểm tra xác thực người dùng
    const user = await authMiddleware(request);
    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Bạn cần đăng nhập để xem khóa học đã đăng ký' 
      }, { status: 401 });
    }
    
    // Kết nối đến MongoDB
    await dbMiddleware(request);
    
    // Lấy danh sách khóa học đã đăng ký
    const enrollments = await Enrollment.find({ userId: user.uid })
      .populate('courseId')
      .sort({ enrolledAt: -1 })
      .lean()
      .exec();
    
    // Lấy thông tin khóa học cho mỗi đăng ký
    const enrolledCoursesPromises = enrollments.map(async (enrollment) => {
      const course = await Course.findById(enrollment.courseId).lean().exec();
      return {
        id: enrollment._id,
        courseId: enrollment.courseId,
        kimvanId: course ? course.kimvanId : null,
        courseName: course ? course.name : 'Khóa học không tồn tại',
        courseDescription: course ? course.description : '',
        courseImage: course ? course.image : '',
        enrolledAt: enrollment.enrolledAt,
        lastAccessedAt: enrollment.lastAccessedAt,
        progress: enrollment.progress,
        status: enrollment.status
      };
    });
    
    // Trả về kết quả
    const enrolledCourses = await Promise.all(enrolledCoursesPromises);
    return NextResponse.json({
      success: true,
      data: enrolledCourses
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách khóa học đã đăng ký:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Lỗi khi lấy danh sách khóa học đã đăng ký' 
    }, { status: 500 });
  }
}

// POST: Đăng ký khóa học mới
export async function POST(request) {
  try {
    // Kiểm tra xác thực người dùng
    const user = await authMiddleware(request);
    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Bạn cần đăng nhập để đăng ký khóa học' 
      }, { status: 401 });
    }
    
    // Kiểm tra quyền admin
    // Lấy thông tin người dùng từ database để kiểm tra vai trò
    const userResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/users/me`, {
      headers: {
        cookie: request.headers.get('cookie') || ''
      }
    });
    
    if (!userResponse.ok) {
      return NextResponse.json({
        success: false,
        error: 'Không thể xác thực quyền người dùng'
      }, { status: 403 });
    }
    
    const userData = await userResponse.json();
    const userRole = userData?.data?.role;
    
    // Chỉ cho phép admin đăng ký khóa học
    if (userRole !== 'admin') {
      return NextResponse.json({
        success: false,
        error: 'Chỉ quản trị viên mới có thể đăng ký khóa học cho người dùng'
      }, { status: 403 });
    }
    
    // Lấy dữ liệu từ request
    const body = await request.json();
    const { courseId } = body;
    
    // Kiểm tra ID khóa học
    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      return NextResponse.json({ 
        success: false, 
        error: 'ID khóa học không hợp lệ' 
      }, { status: 400 });
    }
    
    // Kết nối đến MongoDB
    await dbMiddleware(request);
    
    // Kiểm tra khóa học tồn tại
    const course = await Course.findById(courseId).lean().exec();
    if (!course) {
      return NextResponse.json({ 
        success: false, 
        error: 'Không tìm thấy khóa học' 
      }, { status: 404 });
    }
    
    // Kiểm tra xem người dùng đã đăng ký khóa học này chưa
    const existingEnrollment = await Enrollment.findOne({ 
      userId: user.uid, 
      courseId: courseId 
    }).lean().exec();
    
    if (existingEnrollment) {
      return NextResponse.json({ 
        success: false, 
        error: 'Bạn đã đăng ký khóa học này rồi' 
      }, { status: 409 });
    }
    
    // Tạo đăng ký mới
    const enrollment = new Enrollment({
      userId: user.uid,
      courseId: courseId,
      enrolledAt: new Date(),
      lastAccessedAt: new Date(),
      status: 'active'
    });
    
    // Lưu đăng ký vào database
    await enrollment.save();
    
    // Trả về kết quả
    return NextResponse.json({
      success: true,
      message: 'Đăng ký khóa học thành công',
      data: {
        id: enrollment._id,
        courseId: course._id,
        courseName: course.name,
        enrolledAt: enrollment.enrolledAt
      }
    });
  } catch (error) {
    console.error('Lỗi khi đăng ký khóa học:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Lỗi khi đăng ký khóa học' 
    }, { status: 500 });
  }
}

// DELETE: Hủy đăng ký khóa học
export async function DELETE(request) {
  try {
    // Kiểm tra xác thực người dùng
    const user = await authMiddleware(request);
    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Bạn cần đăng nhập để hủy đăng ký khóa học' 
      }, { status: 401 });
    }
    
    // Lấy ID khóa học từ URL
    const { searchParams } = new URL(request.url);
    const enrollmentId = searchParams.get('id');
    
    // Kiểm tra ID đăng ký
    if (!enrollmentId || !mongoose.Types.ObjectId.isValid(enrollmentId)) {
      return NextResponse.json({ 
        success: false, 
        error: 'ID đăng ký không hợp lệ' 
      }, { status: 400 });
    }
    
    // Kết nối đến MongoDB
    await dbMiddleware(request);
    
    // Tìm đăng ký
    const enrollment = await Enrollment.findById(enrollmentId).exec();
    
    // Kiểm tra đăng ký tồn tại
    if (!enrollment) {
      return NextResponse.json({ 
        success: false, 
        error: 'Không tìm thấy đăng ký khóa học' 
      }, { status: 404 });
    }
    
    // Kiểm tra quyền (chỉ người dùng đã đăng ký mới có thể hủy)
    if (enrollment.userId !== user.uid) {
      return NextResponse.json({ 
        success: false, 
        error: 'Bạn không có quyền hủy đăng ký này' 
      }, { status: 403 });
    }
    
    // Xóa đăng ký
    await enrollment.deleteOne();
    
    // Trả về kết quả
    return NextResponse.json({
      success: true,
      message: 'Hủy đăng ký khóa học thành công'
    });
  } catch (error) {
    console.error('Lỗi khi hủy đăng ký khóa học:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Lỗi khi hủy đăng ký khóa học' 
    }, { status: 500 });
  }
} 