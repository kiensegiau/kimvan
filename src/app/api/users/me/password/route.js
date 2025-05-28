import { NextResponse } from 'next/server';
import firebaseAdmin from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    // Lấy token từ cookie - sử dụng await
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ 
        success: false, 
        error: 'Không tìm thấy token xác thực' 
      }, { status: 401 });
    }

    // Xác thực token với Firebase - sửa cách gọi auth
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
    const firebaseId = decodedToken.uid;

    // Lấy dữ liệu từ request
    const { newPassword } = await request.json();

    if (!newPassword) {
      return NextResponse.json({ 
        success: false, 
        error: 'Vui lòng cung cấp mật khẩu mới' 
      }, { status: 400 });
    }

    // Thay đổi mật khẩu trong Firebase - sửa cách gọi auth
    await firebaseAdmin.auth().updateUser(firebaseId, {
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
        error: 'Mật khẩu mới không đủ mạnh (ít nhất 6 ký tự)' 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: false, 
      error: 'Lỗi khi thay đổi mật khẩu' 
    }, { status: 500 });
  }
} 