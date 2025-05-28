import { NextResponse } from 'next/server';
import { publicPaths, routes, cookieConfig } from '@/config/env-config';

// Các Security Headers cơ bản
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  }
];

// Kiểm tra xem đường dẫn có thuộc danh sách công khai không
const isPublicPath = (path) => {
  return publicPaths.some(publicPath => path.startsWith(publicPath));
};

// Cache kết quả kiểm tra đường dẫn public để tăng hiệu suất
const publicPathCache = new Map();

// Đường dẫn API xác thực token
const TOKEN_VERIFY_API = '/api/auth/verify';
const TOKEN_REFRESH_API = '/api/auth/refresh-token';

// Email được phép truy cập trang admin
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'phanhuukien2001@gmail.com';
console.log('🔧 Middleware - Email admin được cấu hình:', ADMIN_EMAIL);

// This will run when the file is loaded - check terminal for this message
console.log('🚨 MIDDLEWARE.JS LOADED - CHECK TERMINAL FOR THIS MESSAGE');

// Hàm thêm security headers vào response
function addSecurityHeaders(response) {
  securityHeaders.forEach(header => {
    response.headers.set(header.key, header.value);
  });
  return response;
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  console.log('🚨 MIDDLEWARE EXECUTED FOR:', pathname);

  // Bỏ qua middleware cho API verify token và refresh token để tránh vòng lặp vô hạn
  if (pathname === TOKEN_VERIFY_API || 
      pathname === TOKEN_REFRESH_API ||
      pathname === '/api/auth/logout' || 
      pathname === '/api/auth/admin/check-permission') {
    return NextResponse.next();
  }
  
  // Áp dụng security headers cho tất cả các request
  const response = NextResponse.next();
  securityHeaders.forEach(header => {
    response.headers.set(header.key, header.value);
  });

  // Xử lý middleware cho API courses
  if (pathname.startsWith('/api/courses/')) {
    // Lấy Firebase token từ header Authorization hoặc cookie
    const authHeader = request.headers.get('authorization');
    const firebaseToken = authHeader ? authHeader.split('Bearer ')[1] : null;
    
    // Lấy referer từ header
    const referer = request.headers.get('referer') || '';
    const isFromSameDomain = referer.includes(request.nextUrl.origin);
    
    // Tạo header chống CSRF
    const headers = new Headers(request.headers);
    headers.set('X-CSRF-Protection', 'true');
    
    // Cho phép truy cập nếu có token hoặc từ cùng domain
    if (!firebaseToken && !isFromSameDomain) {
      return NextResponse.json(
        { error: 'Không có quyền truy cập' },
        { status: 401 }
      );
    }
    
    // Thêm custom header để đánh dấu request đã qua middleware
    const apiResponse = NextResponse.next({
      request: {
        headers
      }
    });
    
    // Thêm header chống cache cho dữ liệu nhạy cảm
    apiResponse.headers.set('Cache-Control', 'no-store, max-age=0');
    apiResponse.headers.set('Pragma', 'no-cache');
    apiResponse.headers.set('Expires', '0');
    
    // Sao chép security headers
    securityHeaders.forEach(header => {
      apiResponse.headers.set(header.key, header.value);
    });
    
    return apiResponse;
  }

  // Xử lý middleware cho các đường dẫn khác
  // Kiểm tra cache trước khi thực hiện logic
  if (publicPathCache.has(pathname)) {
    const isPublic = publicPathCache.get(pathname);
    if (isPublic) {
      return addSecurityHeaders(NextResponse.next());
    }
  }

  // Kiểm tra và cache kết quả
  const pathIsPublic = isPublicPath(pathname);
  publicPathCache.set(pathname, pathIsPublic);
  
  // Không kiểm tra xác thực cho các đường dẫn công khai
  if (pathIsPublic) {
    return addSecurityHeaders(NextResponse.next());
  }

  // Lấy token từ cookie
  const tokenCookie = request.cookies.get(cookieConfig.authCookieName);
  const token = tokenCookie?.value;
  
  // Kiểm tra token có tồn tại và không phải là chuỗi rỗng
  if (!token || token.trim() === '') {
    console.log('🔒 Token không tồn tại hoặc rỗng, chuyển hướng đến trang đăng nhập');
    
    const redirectUrl = new URL(routes.login, request.url);
    // Thêm returnUrl để sau khi đăng nhập có thể chuyển hướng về trang ban đầu
    redirectUrl.searchParams.set('returnUrl', pathname);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    return addSecurityHeaders(redirectResponse);
  }

  // Xác thực token với server trước khi cho phép truy cập
  try {
    // Xác định URL cơ sở
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    
    // Gọi API xác thực token
    const verifyResponse = await fetch(`${baseUrl}${TOKEN_VERIFY_API}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    const verifyData = await verifyResponse.json();
    
    // Nếu token không hợp lệ, chuyển hướng đến trang đăng nhập
    if (!verifyData.valid) {
      console.log('🔒 Token không hợp lệ, chuyển hướng đến trang đăng nhập');
      
      const redirectUrl = new URL(routes.login, request.url);
      redirectUrl.searchParams.set('returnUrl', pathname);
      const redirectResponse = NextResponse.redirect(redirectUrl);
      
      // Xóa cookie token không hợp lệ
      redirectResponse.cookies.set({
        name: cookieConfig.authCookieName,
        value: '',
        expires: new Date(0),
        path: '/',
      });
      
      return addSecurityHeaders(redirectResponse);
    }
    
    // Kiểm tra xem token có sắp hết hạn không
    // Lấy thời gian hết hạn từ payload token
    const tokenPayload = verifyData.user;
    const tokenExpiration = tokenPayload.tokenExpiration;
    const now = Date.now();
    const timeLeft = tokenExpiration - now;
    
    // Nếu token sắp hết hạn (còn dưới 30 phút), làm mới token
    if (timeLeft < 30 * 60 * 1000) {
      console.log('🔄 Token sắp hết hạn, tiến hành làm mới token');
      
      try {
        // Gọi API làm mới token
        const refreshResponse = await fetch(`${baseUrl}${TOKEN_REFRESH_API}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            rememberMe: true // Mặc định sử dụng thời gian sống dài
          }),
          credentials: 'same-origin'
        });
        
        if (refreshResponse.ok) {
          console.log('✅ Làm mới token thành công');
        } else {
          console.error('❌ Không thể làm mới token');
        }
      } catch (refreshError) {
        console.error('❌ Lỗi khi làm mới token:', refreshError);
      }
    }
  } catch (error) {
    console.error('❌ Lỗi khi xác thực token:', error);
    
    // Trong trường hợp lỗi, chuyển hướng đến trang đăng nhập để an toàn
    const redirectUrl = new URL(routes.login, request.url);
    redirectUrl.searchParams.set('returnUrl', pathname);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    return addSecurityHeaders(redirectResponse);
  }
  
  // Nếu token hợp lệ, đặt header
  response.headers.set('x-middleware-active', 'true');
  response.headers.set('x-auth-token', token);

  // Kiểm tra nếu yêu cầu là cho trang admin
  if (pathname.startsWith('/admin') && 
      !pathname.startsWith('/admin/login')) {
    
    console.log('🔒 Middleware - Kiểm tra quyền truy cập trang admin cho:', pathname);
    
    try {
      // Xác định URL cơ sở
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
      
      // Gọi API verify để lấy thông tin người dùng
      console.log('🔒 Middleware - Gọi API verify để lấy thông tin người dùng');
      const verifyResponse = await fetch(`${baseUrl}${TOKEN_VERIFY_API}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const verifyData = await verifyResponse.json();
      
      if (!verifyData.valid) {
        console.log('⚠️ Middleware - Token không hợp lệ, chuyển hướng đến trang đăng nhập');
        return NextResponse.redirect(new URL(routes.login, request.url));
      }
      
      // Kiểm tra email có phải là email admin không
      console.log('🔒 Middleware - Email người dùng:', verifyData.user.email);
      console.log('🔒 Middleware - Email admin được cấu hình:', ADMIN_EMAIL);
      
      if (verifyData.user.email !== ADMIN_EMAIL) {
        console.log('⚠️ Middleware - Email không phải là admin, chuyển hướng đến trang chủ');
        return NextResponse.redirect(new URL('/', request.url));
      }
      
      // Nếu email hợp lệ, cho phép truy cập
      console.log('✅ Middleware - Email admin hợp lệ, cho phép truy cập');
      return NextResponse.next();
    } catch (error) {
      console.error('❌ Middleware - Lỗi kiểm tra email admin:', error);
      return NextResponse.redirect(new URL('/', request.url));
    }
  }
  
  // Xử lý middleware cho API admin
  if (pathname.startsWith('/api/admin') || pathname.startsWith('/api/courses/raw')) {
    console.log('🔒 Middleware - Kiểm tra quyền truy cập API admin cho:', pathname);
    
    // Kiểm tra cookie admin_access hoặc token trong header
    const adminAccessCookie = request.cookies.get('admin_access');
    const adminAccess = adminAccessCookie?.value;
    if (adminAccess !== 'true') {
      console.log('⚠️ Middleware - Không có quyền admin, từ chối truy cập API');
      return NextResponse.json(
        { error: 'Không có quyền truy cập API admin' },
        { status: 403 }
      );
    }
    
    console.log('✅ Middleware - Có quyền admin, cho phép truy cập API');
    return NextResponse.next();
  }
  
  return response;
}

// Cấu hình middleware
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images|fonts|assets|api/auth|api/drive).*)',
    '/api/courses/:path*',
    '/admin/:path*',
    '/api/admin/:path*'
  ],
  // Thêm cái này để sửa các vấn đề với edge runtime
  skipMiddlewareUrlNormalize: true
}; 