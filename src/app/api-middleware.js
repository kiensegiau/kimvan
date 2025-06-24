import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { cookieConfig } from '@/config/env-config';

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
  // Áp dụng security headers cho tất cả các request
  const response = NextResponse.next();
  securityHeaders.forEach(header => {
    response.headers.set(header.key, header.value);
  });
  
  // Lấy token từ cookie hoặc header Authorization
  const authHeader = request.headers.get('authorization');
  const token = authHeader ? authHeader.split('Bearer ')[1] : null;
  
  const cookieStore = request.cookies;
  const authCookie = cookieStore.get(cookieConfig.authCookieName);
  const cookieToken = authCookie?.value;
  
  // Sử dụng token từ header hoặc cookie
  const accessToken = token || cookieToken;
  
  if (!accessToken) {
    return NextResponse.json(
      { error: 'Yêu cầu xác thực', message: 'Vui lòng đăng nhập để truy cập API' },
      { status: 401 }
    );
  }
  
  try {
    // Kiểm tra token có hợp lệ không
    // Chuyển xác thực đến API endpoint
    const verifyEndpoint = new URL('/api/auth/verify', request.url);
    const verifyResponse = await fetch(verifyEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: accessToken }),
    });

    const authData = await verifyResponse.json();
    
    if (!authData.valid) {
      return NextResponse.json(
        { error: 'Token không hợp lệ', message: 'Vui lòng đăng nhập lại' },
        { status: 401 }
      );
    }
    
    // Gắn thông tin người dùng vào request header để route handlers có thể truy cập
    const modifiedRequest = new Request(request);
    modifiedRequest.headers.set('x-user-id', authData.user.uid);
    modifiedRequest.headers.set('x-user-role', authData.user.role || 'user');
    
    return NextResponse.next({
      request: modifiedRequest,
      headers: response.headers
    });
  } catch (error) {
    console.error('Lỗi xác thực API:', error);
    return NextResponse.json(
      { error: 'Lỗi xác thực', message: 'Có lỗi xảy ra khi xử lý yêu cầu' },
      { status: 500 }
    );
  }
}

// Cấu hình middleware
export const config = {
  matcher: [
    '/api/courses/:path*',
    '/api/sheets/:path*',
    '/api/proxy-link/:path*'  // Thay thế links API bằng proxy-link API
  ]
}; 