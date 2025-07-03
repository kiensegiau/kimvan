import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { cookies } from 'next/headers';
import { verifyServerAuthToken } from '@/utils/server-auth';
import { cookieConfig } from '@/config/env-config';
import { ObjectId } from 'mongodb';
import { authMiddleware } from '@/lib/auth';
import { dbMiddleware } from '@/utils/db-middleware';
import mongoose from 'mongoose';

/**
 * Hàm chuyển đổi mã vai trò thành tên đầy đủ
 */
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

/**
 * Hàm lấy thông tin chi tiết người dùng từ MongoDB
 */
async function getUserDetails(uid, req) {
  try {
    await dbMiddleware(req);
    const db = mongoose.connection.db;
    const userCollection = db.collection('users');
    return await userCollection.findOne({ firebaseId: uid });
  } catch (error) {
    console.error('❌ Lỗi khi lấy thông tin từ MongoDB:', error);
    return null;
  }
}

/**
 * Route handler cho API /api/users/me
 */
export async function GET(request) {
  try {
    // Lấy token từ cookie
    const token = request.cookies.get(cookieConfig.authCookieName)?.value;
    
    // Nếu không có token, trả về dữ liệu người dùng mặc định thay vì lỗi 401
    if (!token) {
      console.log('❌ API /users/me: Không có token trong cookie');
      return NextResponse.json({
        success: true,
        user: {
          uid: 'anonymous',
          role: 'guest',
          roleDisplayName: getRoleDisplayName('guest'),
          displayName: 'Khách',
          email: null,
          isAnonymous: true,
          additionalInfo: {},
          enrollments: []
        }
      });
    }
    
    // Xác thực token
    const firebaseUser = await verifyServerAuthToken(token);
    
    // Nếu token không hợp lệ, trả về dữ liệu người dùng mặc định thay vì lỗi 401
    if (!firebaseUser) {
      console.log('❌ API /users/me: Token không hợp lệ hoặc hết hạn');
      return NextResponse.json({
        success: true,
        user: {
          uid: 'anonymous',
          role: 'guest',
          roleDisplayName: getRoleDisplayName('guest'),
          displayName: 'Khách',
          email: null,
          isAnonymous: true,
          additionalInfo: {},
          enrollments: []
        }
      });
    }
    
    // Lấy thông tin chi tiết từ MongoDB
    const userDetails = await getUserDetails(firebaseUser.uid, request);
    
    // Lấy vai trò từ MongoDB nếu có, ngược lại sử dụng từ token
    const userRole = userDetails?.role || firebaseUser.role || 'user';
    const roleDisplayName = getRoleDisplayName(userRole);
    
    // Kết hợp thông tin từ Firebase và MongoDB
    const userData = {
      ...firebaseUser,
      role: userRole,
      roleDisplayName,
      isAnonymous: false,
      additionalInfo: userDetails?.additionalInfo || {},
      enrollments: userDetails?.enrollments || [],
    };
    
    // Trả về thông tin người dùng
    return NextResponse.json({
      success: true,
      user: userData
    });
    
  } catch (error) {
    console.error('❌ Lỗi khi lấy thông tin người dùng:', error);
    
    // Trả về dữ liệu người dùng mặc định thay vì lỗi 500
    return NextResponse.json({
      success: true,
      user: {
        uid: 'anonymous',
        role: 'guest',
        roleDisplayName: getRoleDisplayName('guest'),
        displayName: 'Khách',
        email: null,
        isAnonymous: true,
        additionalInfo: {},
        enrollments: []
      }
    });
  }
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