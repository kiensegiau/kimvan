import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Các Security Headers cho API
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

export async function middleware(request) {
  // Lấy đường dẫn từ request
  const path = request.nextUrl.pathname;
  
  // Kiểm tra nếu là API cần bảo vệ
  if (path.startsWith('/api/courses/')) {
    // Lấy token từ session
    const token = await getToken({ 
      req: request,
      secret: process.env.NEXTAUTH_SECRET
    });
    
    // Lấy referer từ header
    const referer = request.headers.get('referer') || '';
    const isFromSameDomain = referer.includes(request.nextUrl.origin);
    
    // Tạo header chống CSRF
    const headers = new Headers(request.headers);
    headers.set('X-CSRF-Protection', 'true');
    
    // Nếu không có token và không phải từ cùng domain, từ chối truy cập
    if (!token && !isFromSameDomain) {
      return NextResponse.json(
        { error: 'Không có quyền truy cập' },
        { status: 401 }
      );
    }
    
    // Thêm custom header để đánh dấu request đã qua middleware
    const response = NextResponse.next({
      request: {
        headers
      }
    });
    
    // Thêm header chống cache cho dữ liệu nhạy cảm
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    // Thêm security headers
    securityHeaders.forEach(header => {
      response.headers.set(header.key, header.value);
    });
    
    return response;
  }
  
  return NextResponse.next();
}

// Cấu hình middleware
export const config = {
  matcher: ['/api/courses/:path*']
}; 