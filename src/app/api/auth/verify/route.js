import { NextResponse } from 'next/server';
import { verifyServerAuthToken } from '@/utils/server-auth';
import { dbMiddleware } from '@/utils/db-middleware';
import mongoose from 'mongoose';
import { cookieConfig } from '@/config/env-config';

// Hàm chuyển đổi mã vai trò thành tên đầy đủ
function getRoleDisplayName(role) {
  const roleMap = {
    'admin': 'Quản trị viên',
    'user': 'Người dùng',
    'ctv': 'Công tác viên',
    'staff': 'Nhân viên',
    'instructor': 'Giảng viên',
    'student': 'Học viên',
    'guest': 'Khách'
  };
  
  return roleMap[role] || role;
}

// Hàm lấy thông tin chi tiết người dùng từ MongoDB
async function getUserDetails(uid, request) {
  try {
    await dbMiddleware(request);
    const db = mongoose.connection.db;
    const userCollection = db.collection('users');
    return await userCollection.findOne({ firebaseId: uid });
  } catch (error) {
    console.error('❌ Lỗi khi lấy thông tin từ MongoDB:', error);
    return null;
  }
}

// Hàm kết hợp thông tin người dùng từ Firebase và MongoDB
async function enrichUserData(firebaseUser, request) {
  try {
    // Lấy thông tin user từ MongoDB
    const userDetails = await getUserDetails(firebaseUser.uid, request);
    console.log('🔍 API verify: Thông tin từ MongoDB:', userDetails ? 'Tìm thấy' : 'Không tìm thấy');
    
    // Lấy vai trò từ DB nếu có, ngược lại sử dụng từ token
    const userRole = userDetails?.role || firebaseUser.role || 'user';
    
    // Chuyển đổi mã vai trò thành tên đầy đủ
    const roleDisplayName = getRoleDisplayName(userRole);
    
    // Kết hợp thông tin từ Firebase và MongoDB
    return {
      ...firebaseUser,
      // Ưu tiên thông tin từ MongoDB
      role: userRole,
      roleDisplayName: roleDisplayName,
      // Thêm các thông tin từ MongoDB nếu có
      canViewAllCourses: userDetails?.canViewAllCourses || false,
      additionalInfo: userDetails?.additionalInfo || {},
      enrollments: userDetails?.enrollments || [],
      // Thêm thông tin khác từ MongoDB nếu có
      phoneNumber: userDetails?.phoneNumber || null
    };
  } catch (error) {
    console.error('❌ API verify: Lỗi khi làm giàu dữ liệu từ MongoDB:', error);
    // Trả về thông tin cơ bản nếu có lỗi
    return firebaseUser;
  }
}

/**
 * API route để xác thực token
 * Sử dụng bởi các trang client-side và server components
 */
export async function POST(request) {
  try {
    console.log('📝 API verify: Đang xử lý yêu cầu xác thực token');
    const body = await request.json();
    const { token } = body;

    if (!token) {
      console.log('❌ API verify: Không có token trong request');
      return NextResponse.json(
        { valid: false, error: 'Không có token' },
        { status: 400 }
      );
    }

    console.log('🔍 API verify: Đang xác thực token...');
    // Xác thực token với Firebase Admin
    const firebaseUser = await verifyServerAuthToken(token);

    if (!firebaseUser) {
      console.log('❌ API verify: Token không hợp lệ hoặc đã hết hạn');
      return NextResponse.json(
        { valid: false, error: 'Token không hợp lệ hoặc đã hết hạn' },
        { status: 401 }
      );
    }

    console.log('✅ API verify: Token hợp lệ, lấy thông tin người dùng đầy đủ');
    // Lấy thông tin người dùng đầy đủ kết hợp từ MongoDB
    const enrichedUser = await enrichUserData(firebaseUser, request);
    
    // Trả về thông tin người dùng đầy đủ
    return NextResponse.json({
      valid: true,
      user: enrichedUser
    });

  } catch (error) {
    console.error('❌ API verify: Lỗi xác thực token:', error);
    return NextResponse.json(
      { valid: false, error: 'Lỗi xác thực token: ' + error.message },
      { status: 500 }
    );
  }
}

/**
 * API route để lấy thông tin người dùng từ cookie token
 * Sử dụng bởi server components
 */
export async function GET(request) {
  try {
    console.log('📝 API verify GET: Đang xử lý yêu cầu lấy thông tin người dùng');
    // Lấy token từ cookie
    const token = request.cookies.get(cookieConfig.authCookieName)?.value;

    if (!token) {
      console.log('❌ API verify GET: Không có token trong cookie');
      return NextResponse.json(
        { authenticated: false, error: 'Không có token' },
        { status: 401 }
      );
    }

    console.log('🔍 API verify GET: Đang xác thực token từ cookie...');
    // Xác thực token với Firebase Admin
    const firebaseUser = await verifyServerAuthToken(token);

    if (!firebaseUser) {
      console.log('❌ API verify GET: Token không hợp lệ hoặc đã hết hạn');
      return NextResponse.json(
        { authenticated: false, error: 'Token không hợp lệ hoặc đã hết hạn' },
        { status: 401 }
      );
    }

    console.log('✅ API verify GET: Token hợp lệ, lấy thông tin người dùng đầy đủ');
    // Lấy thông tin người dùng đầy đủ kết hợp từ MongoDB
    const enrichedUser = await enrichUserData(firebaseUser, request);
    
    // Trả về thông tin người dùng đầy đủ
    return NextResponse.json({
      authenticated: true,
      user: enrichedUser
    });

  } catch (error) {
    console.error('❌ API verify GET: Lỗi xác thực token:', error);
    return NextResponse.json(
      { authenticated: false, error: 'Lỗi xác thực token: ' + error.message },
      { status: 500 }
    );
  }
} 