import { NextResponse } from 'next/server';
import { dbMiddleware } from '@/utils/db-middleware';
import mongoose from 'mongoose';
import { verifyServerAuthToken } from '@/utils/server-auth';
import { cookieConfig } from '@/config/env-config';

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

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Xác thực token trực tiếp với Firebase Admin
    const firebaseUser = await verifyServerAuthToken(token);
    
    if (!firebaseUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Lấy thông tin chi tiết từ MongoDB
    const userDetails = await getUserDetails(firebaseUser.uid, request);
    
    // Kết hợp thông tin từ Firebase và MongoDB
    const userData = {
      ...firebaseUser,
      role: userDetails?.role || firebaseUser.role || 'user',
      roleDisplayName: getRoleDisplayName(userDetails?.role || firebaseUser.role || 'user'),
      additionalInfo: userDetails?.additionalInfo || {},
      enrollments: userDetails?.enrollments || []
    };
    
    return NextResponse.json({
      success: true,
      user: userData
    });
    
  } catch (error) {
    console.error('❌ Lỗi khi lấy thông tin người dùng:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
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