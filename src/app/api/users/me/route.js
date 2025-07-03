import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { cookies } from 'next/headers';
import { verifyServerAuthToken } from '@/utils/server-auth';
import { cookieConfig } from '@/config/env-config';
import { ObjectId } from 'mongodb';
import { authMiddleware } from '@/lib/auth';
import { dbMiddleware } from '@/utils/db-middleware';
import mongoose from 'mongoose';

export async function GET(request) {
  try {
    console.log('🔍 API Users/me - Bắt đầu xử lý GET request');
    
    // Lấy token từ nhiều nguồn khác nhau
    // 1. Thử lấy từ Authorization header
    let token = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    
    // 2. Thử lấy từ cookie
    if (!token) {
      try {
        const cookieStore = await cookies();
        // Thử nhiều tên cookie khác nhau để đảm bảo tương thích
        const possibleCookieNames = [
          cookieConfig.authCookieName,
          'auth-token',
          'authToken'
        ];
        
        for (const cookieName of possibleCookieNames) {
          const cookie = cookieStore.get(cookieName);
          if (cookie && cookie.value) {
            token = cookie.value;
            break;
          }
        }
      } catch (cookieError) {
        console.error('❌ API Users/me - Lỗi khi đọc cookie:', cookieError.message);
      }
    }
    
    console.log('🔍 API Users/me - Token:', token ? 'Tìm thấy' : 'Không tìm thấy');
    
    // Nếu không có token, trả về response với dữ liệu giả
    if (!token) {
      console.log('🔍 API Users/me - Không có token, trả về thông tin người dùng giả');
      return NextResponse.json({
        success: false,
        authenticated: false,
        message: 'Không tìm thấy token xác thực',
        user: null
      }, { status: 401 });
    }
    
    // Xác thực token trực tiếp thay vì qua authMiddleware
    let user = null;
    try {
      user = await verifyServerAuthToken(token);
    } catch (authError) {
      console.error('❌ API Users/me - Lỗi xác thực token:', authError.message);
    }
    
    if (!user) {
      console.log('🔍 API Users/me - Token không hợp lệ, trả về thông tin người dùng giả');
      return NextResponse.json({
        success: false,
        authenticated: false,
        message: 'Token xác thực không hợp lệ hoặc đã hết hạn',
        user: null
      }, { status: 401 });
    }
    
    // Log thông tin user cơ bản
    console.log('🔍 API Users/me - Thông tin người dùng:', {
      uid: user.uid,
      email: user.email,
      role: user.role
    });
    
    // Kết nối đến MongoDB để lấy thêm thông tin
    try {
      await dbMiddleware(request);
      
      // Tìm thông tin người dùng trong MongoDB
      const db = mongoose.connection.db;
      const userCollection = db.collection('users');
      
      const userDetails = await userCollection.findOne({ firebaseId: user.uid });
      console.log('🔍 API Users/me - Thông tin từ MongoDB:', userDetails ? 'Tìm thấy' : 'Không tìm thấy');
      
      // Lấy vai trò từ DB nếu có, ngược lại sử dụng từ token
      const userRole = userDetails?.role || user.role || 'user';
      
      // Chuyển đổi mã vai trò thành tên đầy đủ
      const roleDisplayName = getRoleDisplayName(userRole);
      
      // Kết hợp thông tin từ Firebase và MongoDB
      const userData = {
        ...user,
        // Ưu tiên thông tin từ MongoDB
        role: userRole,
        roleDisplayName: roleDisplayName,
        // Thêm các thông tin từ MongoDB nếu có
        canViewAllCourses: userDetails?.canViewAllCourses || false,
        additionalInfo: userDetails?.additionalInfo || {},
        enrollments: userDetails?.enrollments || []
      };
      
      return NextResponse.json({
        success: true,
        authenticated: true,
        user: userData
      });
    } catch (dbError) {
      console.error('❌ API Users/me - Lỗi khi kết nối với MongoDB:', dbError.message);
      
      // Trả về thông tin cơ bản nếu không thể kết nối MongoDB
      return NextResponse.json({
        success: true,
        authenticated: true,
        user: {
          ...user,
          roleDisplayName: getRoleDisplayName(user.role || 'user'),
          canViewAllCourses: user.role === 'admin',
          additionalInfo: {},
          enrollments: []
        },
        message: 'Dữ liệu không đầy đủ do lỗi kết nối cơ sở dữ liệu'
      });
    }
  } catch (error) {
    console.error('❌ API Users/me - Lỗi khi lấy thông tin người dùng:', error);
    return NextResponse.json(
      { 
        success: false, 
        authenticated: false,
        message: 'Đã xảy ra lỗi khi lấy thông tin người dùng', 
        error: error.message,
        user: null
      },
      { status: 500 }
    );
  }
}

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

export async function PATCH(request) {
  try {
    // Lấy token từ nhiều nguồn khác nhau
    let token = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    
    if (!token) {
      try {
        const cookieStore = await cookies();
        token = cookieStore.get(cookieConfig.authCookieName)?.value;
      } catch (cookieError) {
        console.error('Lỗi khi đọc cookie:', cookieError.message);
      }
    }
    
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Không tìm thấy token xác thực' },
        { status: 401 }
      );
    }
    
    // Xác thực token trực tiếp
    const user = await verifyServerAuthToken(token);
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Token xác thực không hợp lệ hoặc đã hết hạn' },
        { status: 401 }
      );
    }
    
    // Lấy dữ liệu từ request
    const requestData = await request.json();
    const { displayName, phoneNumber, additionalInfo } = requestData;
    
    // Kết nối đến MongoDB
    try {
      await dbMiddleware(request);
      const db = mongoose.connection.db;
      const userCollection = db.collection('users');
      
      // Chuẩn bị dữ liệu cập nhật
      const updateData = {
        $set: {
          updatedAt: new Date()
        }
      };
      
      // Thêm các trường cần cập nhật nếu có
      if (displayName !== undefined) {
        updateData.$set.displayName = displayName;
      }
      
      if (phoneNumber !== undefined) {
        updateData.$set.phoneNumber = phoneNumber;
      }
      
      if (additionalInfo !== undefined) {
        updateData.$set.additionalInfo = additionalInfo;
      }
      
      // Cập nhật trong MongoDB
      const result = await userCollection.updateOne(
        { firebaseId: user.uid },
        updateData,
        { upsert: true }
      );
      
      // Trả về kết quả
      return NextResponse.json({
        success: true,
        message: 'Cập nhật thông tin thành công',
        user: {
          ...user,
          displayName: displayName !== undefined ? displayName : user.displayName,
          phoneNumber: phoneNumber !== undefined ? phoneNumber : user.phoneNumber,
          additionalInfo: additionalInfo !== undefined ? additionalInfo : user.additionalInfo
        }
      });
    } catch (dbError) {
      console.error('Lỗi khi kết nối với MongoDB:', dbError.message);
      
      return NextResponse.json(
        { success: false, message: 'Lỗi kết nối cơ sở dữ liệu: ' + dbError.message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Lỗi khi cập nhật thông tin người dùng:', error);
    return NextResponse.json(
      { success: false, message: 'Đã xảy ra lỗi khi cập nhật thông tin người dùng', error: error.message },
      { status: 500 }
    );
  }
} 