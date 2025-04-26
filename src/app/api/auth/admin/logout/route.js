import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    // Xóa cookie admin_token
    const cookieStore = cookies();
    cookieStore.delete('admin_token');
    
    return NextResponse.json({ 
      success: true,
      message: 'Đăng xuất thành công'
    });
  } catch (error) {
    console.error('Lỗi đăng xuất admin:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Lỗi đăng xuất: ' + error.message 
    }, { status: 500 });
  }
} 