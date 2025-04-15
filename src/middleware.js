import { NextResponse } from 'next/server';

export function middleware(request) {
  // Trang khóa học và các trang không phải API sẽ không bị xử lý ở đây
  return NextResponse.next();
}

// Không cần matcher nữa
export const config = {
  matcher: [] // Không bắt bất kỳ route nào qua middleware
}; 