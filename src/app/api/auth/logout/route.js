import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { cookieConfig } from '@/config/env-config';

/**
 * API endpoint để đăng xuất
 * Xóa cookie xác thực và trả về thành công
 */
export async function POST(request) {
  try {
    // Lấy cookie store
    const cookieStore = await cookies();
    
    // Xóa cookie xác thực với các tùy chọn đầy đủ
    await cookieStore.delete(cookieConfig.authCookieName, {
      path: '/',
      secure: cookieConfig.secure,
      httpOnly: cookieConfig.httpOnly,
      sameSite: cookieConfig.sameSite
    });
    
    // Trả về thành công với header xóa cookie
    const response = NextResponse.json({ success: true });
    
    // Thêm header Set-Cookie để đảm bảo cookie bị xóa
    response.cookies.set({
      name: cookieConfig.authCookieName,
      value: '',
      path: '/',
      expires: new Date(0),
      secure: cookieConfig.secure,
      httpOnly: cookieConfig.httpOnly,
      sameSite: cookieConfig.sameSite
    });
    
    return response;
  } catch (error) {
    console.error('❌ Lỗi khi đăng xuất:', error);
    
    // Trả về lỗi
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi khi đăng xuất' },
      { status: 500 }
    );
  }
} 