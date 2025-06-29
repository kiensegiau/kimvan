import { NextResponse } from 'next/server';
import { dbMiddleware } from '@/utils/db-middleware';

/**
 * Middleware để tự động kết nối đến MongoDB trước khi xử lý API request trong App Router
 */
export async function middleware(request) {
  try {
    // Kết nối đến database sử dụng dbMiddleware
    await dbMiddleware(request);
    console.log(`🔌 API Middleware - Đã kết nối DB tự động cho API: ${request.nextUrl.pathname}`);
    return NextResponse.next();
  } catch (error) {
    console.error('❌ Lỗi kết nối DB trong API middleware:', error);
    return NextResponse.json(
      { error: 'Lỗi kết nối cơ sở dữ liệu' },
      { status: 500 }
    );
  }
}

/**
 * Cấu hình middleware để chỉ áp dụng cho các API routes
 */
export const config = {
  matcher: ['/api/:path*'],
}; 