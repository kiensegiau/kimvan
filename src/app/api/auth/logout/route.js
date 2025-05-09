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
    
    // Xóa cookie xác thực
    await cookieStore.delete(cookieConfig.authCookieName);
    
    // Log hành động
    console.log('🔒 Người dùng đã đăng xuất thành công');
    
    // Trả về thành công
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Lỗi khi đăng xuất:', error);
    
    // Trả về lỗi
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi khi đăng xuất' },
      { status: 500 }
    );
  }
} 