import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/utils/auth-utils';
import { cookieConfig } from '@/config/env-config';

export async function adminAuthMiddleware(request) {
  try {
    // Lấy token từ cookie hoặc header
    const cookieStore = cookies();
    const token = cookieStore.get(cookieConfig.authCookieName)?.value || 
                  request.headers.get('authorization')?.split('Bearer ')[1];
    
    if (!token) {
      return NextResponse.json({ 
        success: false, 
        error: 'Không có quyền truy cập' 
      }, { status: 401 });
    }
    
    try {
      // Xác thực token và lấy thông tin người dùng từ Firebase
      const decodedToken = await verifyToken(token);
      if (!decodedToken || !decodedToken.uid) {
        throw new Error('Token không hợp lệ');
      }
      
      // Chỉ kiểm tra email từ Firebase, không cần kiểm tra trong MongoDB
      if (decodedToken.email !== 'phanhuukien2001@gmail.com') {
        return NextResponse.json({ 
          success: false, 
          error: 'Bạn không có quyền truy cập API quản trị' 
        }, { status: 403 });
      }
      
      // Thêm thông tin người dùng vào request để sử dụng trong handler
      const requestWithAdmin = new Request(request);
      requestWithAdmin.admin = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        displayName: decodedToken.name || decodedToken.email.split('@')[0]
      };
      
      return requestWithAdmin;
    } catch (error) {
      console.error('Lỗi xác thực admin middleware:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Không có quyền truy cập' 
      }, { status: 401 });
    }
  } catch (error) {
    console.error('Lỗi middleware admin:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Lỗi máy chủ' 
    }, { status: 500 });
  }
} 