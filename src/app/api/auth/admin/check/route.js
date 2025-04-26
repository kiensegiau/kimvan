import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    // Lấy token từ cookie
    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;
    
    // Kiểm tra token có hợp lệ không (trong thực tế cần verify JWT)
    const isAuthenticated = !!token && token.startsWith('admin-');
    
    return NextResponse.json({ 
      success: true,
      authenticated: isAuthenticated,
      message: isAuthenticated ? 'Đã xác thực' : 'Chưa xác thực'
    });
  } catch (error) {
    console.error('Lỗi kiểm tra xác thực:', error);
    return NextResponse.json({ 
      success: false,
      authenticated: false, 
      error: 'Lỗi kiểm tra xác thực: ' + error.message
    }, { status: 500 });
  }
} 