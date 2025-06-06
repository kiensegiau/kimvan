import { NextResponse } from 'next/server';
import admin from '@/lib/firebase-admin';
import { verifyToken } from '@/utils/auth-utils';

export async function POST(request) {
  try {
    const { token } = await request.json();
    
    console.log('🔑 Check Admin Permission - Token nhận được:', token ? 'Có token' : 'Không có token');
    
    if (!token) {
      return NextResponse.json({ 
        hasAdminAccess: false,
        message: 'Không tìm thấy token xác thực'
      });
    }
    
    // Xác thực token và lấy thông tin người dùng từ Firebase
    try {
      console.log('🔑 Check Admin Permission - Bắt đầu xác thực token');
      const decodedToken = await verifyToken(token);
      console.log('🔑 Check Admin Permission - Decoded token:', decodedToken ? JSON.stringify(decodedToken) : 'Không giải mã được');
      
      if (!decodedToken || !decodedToken.uid) {
        return NextResponse.json({ 
          hasAdminAccess: false,
          message: 'Token không hợp lệ'
        });
      }
      
      // Kiểm tra role từ token thay vì email cụ thể
      const hasAdminAccess = decodedToken.role === 'admin';
      console.log(`🔑 Check Admin Permission - Email: ${decodedToken.email}, Role: ${decodedToken.role}, Có quyền admin: ${hasAdminAccess}`);
      
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