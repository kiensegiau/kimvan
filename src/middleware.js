import { NextResponse } from 'next/server';

export function middleware(request) {
  // Trong quá trình phát triển, cho phép truy cập tất cả các đường dẫn
  // Khi cần kích hoạt lại việc bảo vệ, chỉ cần bỏ comment các đoạn code bên dưới
  
  // Bỏ qua tất cả kiểm tra và cho phép truy cập
  return NextResponse.next();
  
  /* BỎ COMMENT PHẦN NÀY KHI CẦN BẢO VỆ LẠI
  // URL hiện tại
  const url = request.nextUrl.clone();
  const { pathname } = url;
  
  // Các đường dẫn công khai (không cần xác thực)
  const publicPaths = [
    '/admin/login',
    '/api/auth/admin/login',
    '/api/auth/admin/check',
    // Tài nguyên tĩnh
    '/_next',
    '/favicon.ico',
    '/images',
    '/assets'
  ];
  
  // Kiểm tra đường dẫn công khai
  const isPublicPath = publicPaths.some(path => 
    pathname === path || pathname.startsWith(`${path}/`)
  );
  
  // API users cho phép GET nhưng các phương thức khác cần xác thực
  const isPublicUsersApi = pathname.startsWith('/api/users') && request.method === 'GET';
  
  // Nếu không phải đường dẫn công khai và không phải API users GET
  if (!isPublicPath && !isPublicUsersApi) {
    // Lấy token từ cookie
    const adminToken = request.cookies.get('admin_token')?.value;
    
    // Nếu không có token hoặc token không hợp lệ
    if (!adminToken || !adminToken.startsWith('admin-')) {
      // Nếu đang gọi API, trả về lỗi 401
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ 
          success: false,
          error: 'Không có quyền truy cập API này'
        }, { status: 401 });
      }
      
      // Lưu URL hiện tại để chuyển hướng sau khi đăng nhập
      url.pathname = '/admin/login';
      url.searchParams.set('from', pathname);
      return NextResponse.redirect(url);
    }
  }
  
  return NextResponse.next();
  */
}

// Tạm thời không áp dụng middleware cho bất kỳ đường dẫn nào
export const config = {
  matcher: []
};

/* BỎ COMMENT PHẦN NÀY KHI CẦN BẢO VỆ LẠI
export const config = {
  matcher: [
    // Bảo vệ tất cả /admin ngoại trừ login
    '/admin/:path*',
    // Bảo vệ các API admin và users (trừ GET)
    '/api/admin/:path*',
    '/api/users/:path*',
    '/api/courses/:path*'
  ],
};
*/ 