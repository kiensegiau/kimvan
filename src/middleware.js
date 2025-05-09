import { NextResponse } from 'next/server';
import { publicPaths, routes, cookieConfig } from '@/config/env-config';

// Các Security Headers cơ bản
const securityHeaders = {
  'X-DNS-Prefetch-Control': 'on',
  'X-XSS-Protection': '1; mode=block',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload'
};

// Kiểm tra xem đường dẫn có thuộc danh sách công khai không
const isPublicPath = (path) => {
  return publicPaths.some(publicPath => path.startsWith(publicPath));
};

// Cache kết quả kiểm tra đường dẫn public để tăng hiệu suất
const publicPathCache = new Map();

// Đường dẫn API xác thực token
const TOKEN_VERIFY_API = '/api/auth/verify';

// This will run when the file is loaded - check terminal for this message
console.log('🚨 MIDDLEWARE.JS LOADED - CHECK TERMINAL FOR THIS MESSAGE');

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  console.log('🚨 MIDDLEWARE EXECUTED FOR:', pathname);

  // Bỏ qua middleware cho API verify token để tránh vòng lặp vô hạn
  if (pathname === TOKEN_VERIFY_API || pathname === '/api/auth/logout') {
    return NextResponse.next();
  }

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
  const token = request.cookies.get(cookieConfig.authCookieName)?.value;
  
  // Kiểm tra token có tồn tại và không phải là chuỗi rỗng
  if (!token || token.trim() === '') {
    console.log('🔒 Token không tồn tại hoặc rỗng, chuyển hướng đến trang đăng nhập');
    
    const redirectUrl = new URL(routes.login, request.url);
    // Thêm returnUrl để sau khi đăng nhập có thể chuyển hướng về trang ban đầu
    redirectUrl.searchParams.set('returnUrl', pathname);
    const response = NextResponse.redirect(redirectUrl);
    return addSecurityHeaders(response);
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
      const response = NextResponse.redirect(redirectUrl);
      
      // Xóa cookie token không hợp lệ
      response.cookies.set({
        name: cookieConfig.authCookieName,
        value: '',
        expires: new Date(0),
        path: '/',
      });
      
      return addSecurityHeaders(response);
    }
  } catch (error) {
    console.error('❌ Lỗi khi xác thực token:', error);
    
    // Trong trường hợp lỗi, chuyển hướng đến trang đăng nhập để an toàn
    const redirectUrl = new URL(routes.login, request.url);
    redirectUrl.searchParams.set('returnUrl', pathname);
    const response = NextResponse.redirect(redirectUrl);
    return addSecurityHeaders(response);
  }
  
  // Nếu token hợp lệ, cho phép request đi qua
  const response = NextResponse.next();
  response.headers.set('x-middleware-active', 'true');
  response.headers.set('x-auth-token', token);
  
  return addSecurityHeaders(response);
}

// Hàm thêm security headers vào response
function addSecurityHeaders(response) {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

// Match tất cả các đường dẫn, trừ các tệp tĩnh và API của Next.js
export const config = {
  matcher: [
    // Áp dụng cho tất cả các đường dẫn ngoại trừ _next và các file tĩnh
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
  // Thêm cái này để sửa các vấn đề với edge runtime
  skipMiddlewareUrlNormalize: true
}; 