import { NextResponse } from 'next/server';
import { auth } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    // Lấy token từ cookie
    const cookieStore = cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ 
        success: false, 
        error: 'Không tìm thấy token xác thực' 
      }, { status: 401 });
    }

    // Xác thực token với Firebase
    const decodedToken = await auth.verifyIdToken(token);
    const firebaseId = decodedToken.uid;

    // Lấy dữ liệu từ request
    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ 
        success: false, 
        error: 'Vui lòng cung cấp mật khẩu hiện tại và mật khẩu mới' 
      }, { status: 400 });
    }

    // Thay đổi mật khẩu trong Firebase
    await auth.updateUser(firebaseId, {
      password: newPassword
    });

    return NextResponse.json({
      success: true,
      message: 'Thay đổi mật khẩu thành công'
    });
  } catch (error) {
    console.error('Lỗi khi thay đổi mật khẩu:', error);
    
    // Xử lý các lỗi cụ thể từ Firebase
    if (error.code === 'auth/requires-recent-login') {
      return NextResponse.json({ 
        success: false, 
        error: 'Vui lòng đăng nhập lại để thay đổi mật khẩu' 
      }, { status: 403 });
    }
    
    if (error.code === 'auth/weak-password') {
      return NextResponse.json({ 
        success: false, 
        error: 'Mật khẩu mới không đủ mạnh' 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: false, 
      error: 'Lỗi khi thay đổi mật khẩu' 
    }, { status: 500 });
  }
} 