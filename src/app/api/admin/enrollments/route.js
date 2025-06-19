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
    // Lấy thông tin từ query params và headers
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const ctvEmail = searchParams.get('ctvEmail'); // Email CTV từ query
    
    console.log(`🔍 GET /api/admin/enrollments - userId: ${userId}, ctvEmail: ${ctvEmail}`);
    
    // Kiểm tra quyền admin hoặc CTV
    const cookieStore = cookies();
    // Đọc cookies trực tiếp từ cookieStore mà không sử dụng .get()
    let adminAccess = false;
    let ctvAccess = false;
    let ctvEmailCookie = null;
    
    // Lặp qua tất cả cookie để tìm cookie cần thiết
    for (const cookie of cookieStore.getAll()) {
      if (cookie.name === 'admin_access' && cookie.value === 'true') {
        adminAccess = true;
      }
      if (cookie.name === 'ctv_access' && cookie.value === 'true') {
        ctvAccess = true;
      }
      if (cookie.name === 'ctv_email') {
        ctvEmailCookie = cookie;
      }
    }
    
    console.log(`🔑 Cookie check - adminAccess: ${adminAccess}, ctvAccess: ${ctvAccess}`);
    
    // Nếu có cookie admin_access hoặc ctv_access, cho phép truy cập
    let hasAccess = adminAccess || ctvAccess;
    
    // Nếu không có cookie xác thực, kiểm tra qua header Authorization
    if (!hasAccess) {
      console.log('🔍 Checking auth through headers...');
      hasAccess = await checkAuthAndRole(request, ['admin', 'ctv']);
      
      if (!hasAccess) {
        // Nếu có ctvEmail trong query và đã thiết lập cookie ctv_email, cho phép
        if (ctvEmail && ctvEmailCookie && decodeURIComponent(ctvEmailCookie.value) === ctvEmail) {
          console.log('✅ Access granted through ctv_email cookie match with query param');
          hasAccess = true;
        } else {
          console.log('⚠️ ctv_email cookie check failed', {
            queryCtvEmail: ctvEmail,
            cookieCtvEmail: ctvEmailCookie ? decodeURIComponent(ctvEmailCookie.value) : null
          });
        }
      }
    }
    
    if (!hasAccess) {
      console.log('❌ Admin/CTV API - Không có quyền truy cập');
      return NextResponse.json({ 
        success: false,
        message: 'Bạn không có quyền thực hiện hành động này' 
      }, { status: 403 });
    }
    
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
    
    console.log(`✅ Found ${enrollments.length} enrollments for user ${userId}`);
    
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
    // Lấy dữ liệu từ request
    const body = await request.json();
    const { userId, courseId, ctvEmail } = body;
    
    console.log(`🔍 POST /api/admin/enrollments - userId: ${userId}, courseId: ${courseId}, ctvEmail: ${ctvEmail}`);
    
    // Kiểm tra quyền admin hoặc CTV
    const cookieStore = cookies();
    // Đọc cookies trực tiếp từ cookieStore mà không sử dụng .get()
    let adminAccess = false;
    let ctvAccess = false;
    let ctvEmailCookie = null;
    
    // Lặp qua tất cả cookie để tìm cookie cần thiết
    for (const cookie of cookieStore.getAll()) {
      if (cookie.name === 'admin_access' && cookie.value === 'true') {
        adminAccess = true;
      }
      if (cookie.name === 'ctv_access' && cookie.value === 'true') {
        ctvAccess = true;
      }
      if (cookie.name === 'ctv_email') {
        ctvEmailCookie = cookie;
      }
    }
    
    console.log(`🔑 Cookie check - adminAccess: ${adminAccess}, ctvAccess: ${ctvAccess}`);
    
    // Nếu có cookie admin_access hoặc ctv_access, cho phép truy cập
    let hasAccess = adminAccess || ctvAccess;
    
    // Nếu không có cookie xác thực, kiểm tra qua header Authorization
    if (!hasAccess) {
      console.log('🔍 Checking auth through headers...');
      hasAccess = await checkAuthAndRole(request, ['admin', 'ctv']);
      
      if (!hasAccess) {
        // Nếu có ctvEmail trong body và đã thiết lập cookie ctv_email, cho phép
        if (ctvEmail && ctvEmailCookie && decodeURIComponent(ctvEmailCookie.value) === ctvEmail) {
          console.log('✅ Access granted through ctv_email cookie match with body param');
          hasAccess = true;
        } else {
          console.log('⚠️ ctv_email cookie check failed', {
            bodyCtvEmail: ctvEmail,
            cookieCtvEmail: ctvEmailCookie ? decodeURIComponent(ctvEmailCookie.value) : null
          });
        }
      }
    }
    
    if (!hasAccess) {
      console.log('❌ Admin/CTV API - Không có quyền truy cập');
      return NextResponse.json({ 
        success: false,
        message: 'Bạn không có quyền thực hiện hành động này' 
      }, { status: 403 });
    }
    
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
    
    console.log(`✅ Added course ${courseId} for user ${userId}`);
    
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
    // Lấy ID đăng ký từ URL
    const { searchParams } = new URL(request.url);
    const enrollmentId = searchParams.get('id');
    const ctvEmail = searchParams.get('ctvEmail');
    
    console.log(`🔍 DELETE /api/admin/enrollments - enrollmentId: ${enrollmentId}, ctvEmail: ${ctvEmail}`);
    
    // Kiểm tra quyền admin hoặc CTV
    const cookieStore = cookies();
    // Đọc cookies trực tiếp từ cookieStore mà không sử dụng .get()
    let adminAccess = false;
    let ctvAccess = false;
    let ctvEmailCookie = null;
    
    // Lặp qua tất cả cookie để tìm cookie cần thiết
    for (const cookie of cookieStore.getAll()) {
      if (cookie.name === 'admin_access' && cookie.value === 'true') {
        adminAccess = true;
      }
      if (cookie.name === 'ctv_access' && cookie.value === 'true') {
        ctvAccess = true;
      }
      if (cookie.name === 'ctv_email') {
        ctvEmailCookie = cookie;
      }
    }
    
    console.log(`🔑 Cookie check - adminAccess: ${adminAccess}, ctvAccess: ${ctvAccess}`);
    
    // Nếu có cookie admin_access hoặc ctv_access, cho phép truy cập
    let hasAccess = adminAccess || ctvAccess;
    
    // Nếu không có cookie xác thực, kiểm tra qua header Authorization
    if (!hasAccess) {
      console.log('🔍 Checking auth through headers...');
      hasAccess = await checkAuthAndRole(request, ['admin', 'ctv']);
      
      if (!hasAccess) {
        // Nếu có ctvEmail trong query và đã thiết lập cookie ctv_email, cho phép
        if (ctvEmail && ctvEmailCookie && decodeURIComponent(ctvEmailCookie.value) === ctvEmail) {
          console.log('✅ Access granted through ctv_email cookie match with query param');
          hasAccess = true;
        } else {
          console.log('⚠️ ctv_email cookie check failed', {
            queryCtvEmail: ctvEmail,
            cookieCtvEmail: ctvEmailCookie ? decodeURIComponent(ctvEmailCookie.value) : null
          });
        }
      }
    }
    
    if (!hasAccess) {
      console.log('❌ Admin/CTV API - Không có quyền truy cập');
      return NextResponse.json({ 
        success: false,
        message: 'Bạn không có quyền thực hiện hành động này' 
      }, { status: 403 });
    }
    
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
    
    console.log(`✅ Deleted enrollment ${enrollmentId}`);
    
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