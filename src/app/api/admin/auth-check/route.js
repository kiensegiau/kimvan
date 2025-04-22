import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request) {
  try {
    // Lấy token từ cookie hoặc header
    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;
    
    // Giả lập kiểm tra token (trong thực tế sẽ kiểm tra với DB hoặc JWT)
    // TODO: Thay thế bằng logic xác thực thực tế
    const isAuthenticated = !!token; 
    
    // Hard-coded cho demo, thay đổi sau với logic xác thực thực tế
    return NextResponse.json({ 
      authenticated: true,
      message: 'Xác thực admin thành công'
    });
  } catch (error) {
    console.error('Lỗi xác thực admin:', error);
    return NextResponse.json({ 
      authenticated: false, 
      message: 'Lỗi xác thực' 
    }, { status: 500 });
  }
} 