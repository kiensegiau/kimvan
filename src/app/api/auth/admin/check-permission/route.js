import { NextResponse } from 'next/server';
import admin from '@/lib/firebase-admin';
import { verifyToken } from '@/utils/auth-utils';

export async function POST(request) {
  try {
    const { token } = await request.json();
    
    if (!token) {
      return NextResponse.json({ 
        hasAdminAccess: false,
        message: 'Không tìm thấy token xác thực'
      });
    }
    
    // Xác thực token và lấy thông tin người dùng từ Firebase
    try {
      const decodedToken = await verifyToken(token);
      
      if (!decodedToken || !decodedToken.uid) {
        return NextResponse.json({ 
          hasAdminAccess: false,
          message: 'Token không hợp lệ'
        });
      }
      
      // Kiểm tra role từ token thay vì email cụ thể
      const hasAdminAccess = decodedToken.role === 'admin';
      
      return NextResponse.json({
        hasAdminAccess,
        message: hasAdminAccess 
          ? 'Có quyền truy cập trang quản trị' 
          : 'Không có quyền truy cập trang quản trị',
        user: {
          uid: decodedToken.uid,
          email: decodedToken.email,
          role: decodedToken.role
        }
      });
    } catch (error) {
      console.error('❌ Lỗi xác thực Firebase:', error);
      return NextResponse.json({
        hasAdminAccess: false,
        message: 'Lỗi xác thực: ' + error.message
      });
    }
  } catch (error) {
    console.error('❌ Lỗi kiểm tra quyền admin:', error);
    return NextResponse.json({
      hasAdminAccess: false,
      message: 'Lỗi kiểm tra quyền truy cập'
    });
  }
} 