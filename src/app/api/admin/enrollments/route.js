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
    
    let isAdmin = false;
    let isCTV = false;
    let currentUserEmail = '';
    
    console.log('🔍 API Enrollments - Kiểm tra quyền truy cập');
    console.log('Cookie admin_access:', adminAccess ? adminAccess.value : 'không có');
    console.log('Cookie ctv_access:', ctvAccess ? ctvAccess.value : 'không có');
    
    // Nếu có cookie admin_access, cho phép truy cập admin
    if (adminAccess && adminAccess.value === 'true') {
      isAdmin = true;
      console.log('✅ API - Truy cập với quyền admin từ cookie');
    } 
    // Nếu có cookie ctv_access, cho phép truy cập CTV
    else if (ctvAccess && ctvAccess.value === 'true') {
      isCTV = true;
      console.log('✅ API - Truy cập với quyền CTV từ cookie');
      
      // Lấy email CTV từ URL query params nếu có
      const { searchParams } = new URL(request.url);
      const ctvEmailParam = searchParams.get('ctvEmail');
      
      if (ctvEmailParam) {
        currentUserEmail = ctvEmailParam;
        console.log('✅ API - Email CTV từ query params:', currentUserEmail);
      }
      
      // Nếu không có email từ query params, thử lấy từ cookie
      if (!currentUserEmail) {
        const ctvEmailCookie = cookieStore.get('ctv_email');
        if (ctvEmailCookie) {
          currentUserEmail = ctvEmailCookie.value;
          console.log('✅ API - Email CTV từ cookie:', currentUserEmail);
        }
      }
    } 
    // Nếu không có cookie, kiểm tra quyền từ token
    else {
      try {
        const hasAdminAccess = await checkAuthAndRole(request, 'admin');
        if (hasAdminAccess) {
          isAdmin = true;
          console.log('✅ API - Truy cập với quyền admin từ token');
        } else {
          const hasCTVAccess = await checkAuthAndRole(request, 'ctv');
          if (hasCTVAccess) {
            isCTV = true;
            console.log('✅ API - Truy cập với quyền CTV từ token');
            
            // Lấy thông tin người dùng hiện tại
            const authResult = await authMiddleware(request);
            if (authResult && authResult.user && authResult.user.email) {
              currentUserEmail = authResult.user.email;
              console.log('✅ API - Email CTV từ token:', currentUserEmail);
            }
          }
        }
      } catch (error) {
        console.log('⚠️ API - Lỗi khi kiểm tra quyền:', error.message);
      }
    }
    
    // Nếu không phải admin hoặc CTV, từ chối truy cập
    if (!isAdmin && !isCTV) {
      console.log('❌ API - Không có quyền truy cập');
      return NextResponse.json({ 
        success: false,
        message: 'Bạn không có quyền thực hiện hành động này' 
      }, { status: 403 });
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
    
    // Nếu là CTV, kiểm tra xem người dùng có thuộc quản lý của CTV không
    if (isCTV && currentUserEmail) {
      console.log('🔍 API - Kiểm tra quyền CTV cho userId:', userId);
      console.log('🔍 API - Email CTV hiện tại:', currentUserEmail);
      
      const db = mongoose.connection.db;
      const user = await db.collection('users').findOne({ 
        $or: [
          { uid: userId },
          { firebaseId: userId }
        ]
      });
      
      if (!user) {
        console.log('❌ API - Không tìm thấy người dùng với ID:', userId);
        return NextResponse.json({ 
          success: false,
          message: 'Không tìm thấy người dùng' 
        }, { status: 404 });
      }
      
      console.log('🔍 API - Thông tin người dùng:', {
        id: user._id,
        firebaseId: user.firebaseId,
        createdBy: user.createdBy,
        phoneNumber: user.phoneNumber
      });
      
      // Kiểm tra xem người dùng có thuộc quản lý của CTV không
      const isUserManagedByCTV = 
        (user.createdBy === currentUserEmail) || 
        (user.phoneNumber === currentUserEmail);
      
      console.log('🔍 API - Người dùng thuộc quản lý của CTV?', isUserManagedByCTV);
      
      if (!isUserManagedByCTV) {
        return NextResponse.json({ 
          success: false,
          message: 'Bạn không có quyền quản lý người dùng này' 
        }, { status: 403 });
      }
    }
    
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

// POST: Admin hoặc CTV thêm khóa học cho người dùng
export async function POST(request) {
  try {
    // Kiểm tra quyền admin hoặc CTV
    const cookieStore = await cookies();
    const adminAccess = cookieStore.get('admin_access');
    const ctvAccess = cookieStore.get('ctv_access');
    
    let isAdmin = false;
    let isCTV = false;
    let currentUserEmail = '';
    
    // Nếu có cookie admin_access, cho phép truy cập admin
    if (adminAccess && adminAccess.value === 'true') {
      isAdmin = true;
    } else {
      // Kiểm tra xác thực người dùng và quyền admin
      const hasAdminAccess = await checkAuthAndRole(request, 'admin');
      
      if (hasAdminAccess) {
        isAdmin = true;
      } else if (ctvAccess && ctvAccess.value === 'true') {
        // Nếu có cookie ctv_access, cho phép truy cập CTV
        isCTV = true;
        
        // Lấy thông tin người dùng hiện tại
        const authResult = await authMiddleware(request);
        if (authResult && authResult.user && authResult.user.email) {
          currentUserEmail = authResult.user.email;
        }
      } else {
        // Kiểm tra xác thực người dùng và quyền CTV
        const hasCTVAccess = await checkAuthAndRole(request, 'ctv');
        
        if (hasCTVAccess) {
          isCTV = true;
          
          // Lấy thông tin người dùng hiện tại
          const authResult = await authMiddleware(request);
          if (authResult && authResult.user && authResult.user.email) {
            currentUserEmail = authResult.user.email;
          }
        }
      }
      
      // Nếu không phải admin hoặc CTV, từ chối truy cập
      if (!isAdmin && !isCTV) {
        console.log('❌ API - Không có quyền truy cập');
        return NextResponse.json({ 
          success: false,
          message: 'Bạn không có quyền thực hiện hành động này' 
        }, { status: 403 });
      }
    }
    
    // Lấy dữ liệu từ request
    const body = await request.json();
    const { userId, courseId } = body;
    
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
    
    // Nếu là CTV, kiểm tra xem người dùng có thuộc quản lý của CTV không
    if (isCTV && currentUserEmail) {
      const db = mongoose.connection.db;
      const user = await db.collection('users').findOne({ 
        $or: [
          { uid: userId },
          { firebaseId: userId }
        ]
      });
      
      if (!user) {
        return NextResponse.json({ 
          success: false,
          message: 'Không tìm thấy người dùng' 
        }, { status: 404 });
      }
      
      // Kiểm tra xem người dùng có thuộc quản lý của CTV không
      const isUserManagedByCTV = 
        (user.createdBy === currentUserEmail) || 
        (user.phoneNumber === currentUserEmail);
      
      if (!isUserManagedByCTV) {
        return NextResponse.json({ 
          success: false,
          message: 'Bạn không có quyền quản lý người dùng này' 
        }, { status: 403 });
      }
    }
    
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
      status: 'active'
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

// DELETE: Admin hoặc CTV xóa đăng ký khóa học
export async function DELETE(request) {
  try {
    // Kiểm tra quyền admin hoặc CTV
    const cookieStore = await cookies();
    const adminAccess = cookieStore.get('admin_access');
    const ctvAccess = cookieStore.get('ctv_access');
    
    let isAdmin = false;
    let isCTV = false;
    let currentUserEmail = '';
    
    // Nếu có cookie admin_access, cho phép truy cập admin
    if (adminAccess && adminAccess.value === 'true') {
      isAdmin = true;
    } else {
      // Kiểm tra xác thực người dùng và quyền admin
      const hasAdminAccess = await checkAuthAndRole(request, 'admin');
      
      if (hasAdminAccess) {
        isAdmin = true;
      } else if (ctvAccess && ctvAccess.value === 'true') {
        // Nếu có cookie ctv_access, cho phép truy cập CTV
        isCTV = true;
        
        // Lấy thông tin người dùng hiện tại
        const authResult = await authMiddleware(request);
        if (authResult && authResult.user && authResult.user.email) {
          currentUserEmail = authResult.user.email;
        }
      } else {
        // Kiểm tra xác thực người dùng và quyền CTV
        const hasCTVAccess = await checkAuthAndRole(request, 'ctv');
        
        if (hasCTVAccess) {
          isCTV = true;
          
          // Lấy thông tin người dùng hiện tại
          const authResult = await authMiddleware(request);
          if (authResult && authResult.user && authResult.user.email) {
            currentUserEmail = authResult.user.email;
          }
        }
      }
      
      // Nếu không phải admin hoặc CTV, từ chối truy cập
      if (!isAdmin && !isCTV) {
        console.log('❌ API - Không có quyền truy cập');
        return NextResponse.json({ 
          success: false,
          message: 'Bạn không có quyền thực hiện hành động này' 
        }, { status: 403 });
      }
    }
    
    // Lấy ID đăng ký từ URL
    const { searchParams } = new URL(request.url);
    const enrollmentId = searchParams.get('id');
    
    // Kiểm tra ID đăng ký
    if (!enrollmentId || !mongoose.Types.ObjectId.isValid(enrollmentId)) {
      return NextResponse.json({ 
        success: false,
        message: 'ID đăng ký không hợp lệ' 
      }, { status: 400 });
    }
    
    // Kết nối đến MongoDB
    await connectDB();
    
    // Tìm thông tin đăng ký
    const enrollment = await Enrollment.findById(enrollmentId).lean().exec();
    
    if (!enrollment) {
      return NextResponse.json({ 
        success: false,
        message: 'Không tìm thấy đăng ký khóa học' 
      }, { status: 404 });
    }
    
    // Nếu là CTV, kiểm tra xem người dùng có thuộc quản lý của CTV không
    if (isCTV && currentUserEmail) {
      const db = mongoose.connection.db;
      const user = await db.collection('users').findOne({ 
        $or: [
          { uid: enrollment.userId },
          { firebaseId: enrollment.userId }
        ]
      });
      
      if (!user) {
        return NextResponse.json({ 
          success: false,
          message: 'Không tìm thấy người dùng' 
        }, { status: 404 });
      }
      
      // Kiểm tra xem người dùng có thuộc quản lý của CTV không
      const isUserManagedByCTV = 
        (user.createdBy === currentUserEmail) || 
        (user.phoneNumber === currentUserEmail);
      
      if (!isUserManagedByCTV) {
        return NextResponse.json({ 
          success: false,
          message: 'Bạn không có quyền quản lý người dùng này' 
        }, { status: 403 });
      }
    }
    
    // Xóa đăng ký
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