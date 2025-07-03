import { NextResponse } from 'next/server';
import { publicPaths, routes, cookieConfig } from '@/config/env-config';
// Không import config từ middleware.config.js

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
const USER_ROLE_API = '/api/auth/user-role';

// Đường dẫn API không cần kết nối DB
const NO_DB_API_PATHS = [
  '/api/auth/verify',
  '/api/auth/refresh-token',
  '/api/auth/user-role',
  '/api/auth/logout',
  '/api/auth/admin/check-permission',
  '/api/drive/check-file-type',
  '/api/drive/download',
  '/api/drive/download-direct',
  '/api/drive/refresh-tokens',
  '/api/test-browser',
  '/api/users/me'
];

// Đường dẫn API đặc biệt cần loại trừ khỏi middleware hoàn toàn
const EXCLUDED_API_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh-token',
  '/api/auth/verify',
  '/api/auth/google-callback',
  '/api/auth/reset-password',
  '/api/auth/user-role',
  '/api/users/me',
  '/api/health-check',
  '/api/health-check/mongodb',
  '/api/health-check/mongodb-reset'
];

// Kiểm tra xem đường dẫn có cần kết nối DB không
const needsDatabaseConnection = (path) => {
  return path.startsWith('/api/') && !NO_DB_API_PATHS.some(apiPath => path.startsWith(apiPath));
};

// Email được phép truy cập trang admin - không còn cần thiết vì sẽ kiểm tra theo role
// const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'phanhuukien2001@gmail.com';
// console.log('🔧 Middleware - Email admin được cấu hình:', ADMIN_EMAIL);

// Log khởi động middleware
console.log('🚨 MIDDLEWARE.JS LOADED');

// Hàm thêm security headers vào response
function addSecurityHeaders(response) {
  securityHeaders.forEach(header => {
    response.headers.set(header.key, header.value);
  });
  return response;
}

// Hàm lấy base URL
const getBaseUrl = (request) => {
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  return `${protocol}://${host}`;
};

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  // Debug: log pathname để kiểm tra
  console.log('🔎 middleware pathname:', pathname);

  // Áp dụng security headers cho tất cả các request
  const response = NextResponse.next();
  securityHeaders.forEach(header => {
    response.headers.set(header.key, header.value);
  });
  
  // Phát hiện giao thức HTTPS
  const protocol = request.headers.get('x-forwarded-proto') || 
                   (request.nextUrl.protocol === 'https:' ? 'https' : 'http');
  const isHttps = protocol === 'https';
  
  // Log thông tin giao thức để debug
  console.log('🔒 Protocol detection:', { 
    pathname,
    protocol, 
    isHttps, 
    nextUrlProtocol: request.nextUrl.protocol,
    'x-forwarded-proto': request.headers.get('x-forwarded-proto'),
    'cf-visitor': request.headers.get('cf-visitor'),
    'x-forwarded-host': request.headers.get('x-forwarded-host'),
    'host': request.headers.get('host')
  });

  // Loại trừ các API đặc biệt khỏi middleware để tránh lặp và redirect loops
  if (EXCLUDED_API_PATHS.some(path => pathname.startsWith(path))) {
    return response;
  }

  // Kiểm tra và cache kết quả cho đường dẫn công khai
  if (publicPathCache.has(pathname)) {
    const isPublic = publicPathCache.get(pathname);
    if (isPublic) {
      return addSecurityHeaders(response);
    }
  }

  const pathIsPublic = isPublicPath(pathname);
  publicPathCache.set(pathname, pathIsPublic);
  
  // Không kiểm tra xác thực cho các đường dẫn công khai
  if (pathIsPublic) {
    return addSecurityHeaders(response);
  }

  // Lấy token từ cookie cho tất cả các đường dẫn được bảo vệ
  // Danh sách các tên cookie có thể chứa token
  const possibleCookieNames = [
    cookieConfig.authCookieName,
    'auth-token',
    'authToken',
    '__Secure-authjs.session-token'
  ];
  
  let token = null;
  
  // Kiểm tra từng cookie có thể chứa token
  for (const cookieName of possibleCookieNames) {
    const cookieValue = request.cookies.get(cookieName)?.value;
    if (cookieValue && cookieValue.trim() !== '') {
      token = cookieValue;
      break;
    }
  }
  
  // Kiểm tra token có tồn tại và không phải là chuỗi rỗng
  if (!token || token.trim() === '') {
    if (pathname.startsWith('/api/')) {
      // Với API, trả về 401 JSON, KHÔNG redirect
      return NextResponse.json({ success: false, error: 'Unauthorized', message: 'Missing or invalid token' }, { status: 401 });
    } else {
      const redirectUrl = new URL(routes.login, request.url);
      redirectUrl.searchParams.set('returnUrl', pathname);
      const redirectResponse = NextResponse.redirect(redirectUrl);
      return addSecurityHeaders(redirectResponse);
    }
  }

  // Xác thực token với server trước khi cho phép truy cập
  try {
    const baseUrl = getBaseUrl(request);
    
    // Gọi API xác thực token với URL đầy đủ
    const verifyResponse = await fetch(`${baseUrl}${TOKEN_VERIFY_API}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    // Kiểm tra content-type của response
    const contentType = verifyResponse.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Unexpected response type:', contentType);
      throw new Error('Expected JSON response but got: ' + contentType);
    }
    
    // Clone response để có thể đọc nhiều lần
    const verifyResponseClone = verifyResponse.clone();
    let verifyData;
    try {
      verifyData = await verifyResponseClone.json();
    } catch (parseError) {
      console.error('Failed to parse verify response:', parseError);
      // Log response text để debug
      const responseText = await verifyResponse.text();
      console.error('Response text:', responseText);
      throw new Error('Invalid JSON response from verify endpoint');
    }

    if (!verifyResponse.ok || !verifyData.valid) {
      // Thử làm mới token với URL đầy đủ
      const refreshResponse = await fetch(`${baseUrl}${TOKEN_REFRESH_API}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          token,
          rememberMe: true
        })
      });
      
      // Nếu không thể làm mới token, chuyển hướng đến trang đăng nhập
      if (!refreshResponse.ok) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        } else {
          const redirectUrl = new URL(routes.login, request.url);
          redirectUrl.searchParams.set('returnUrl', pathname);
          const redirectResponse = NextResponse.redirect(redirectUrl);
          redirectResponse.cookies.set({
            name: cookieConfig.authCookieName,
            value: '',
            expires: new Date(0),
            path: '/',
          });
          return addSecurityHeaders(redirectResponse);
        }
      }
      
      // Kiểm tra content-type của refresh response
      const refreshContentType = refreshResponse.headers.get('content-type');
      if (!refreshContentType || !refreshContentType.includes('application/json')) {
        console.error('Unexpected refresh response type:', refreshContentType);
        throw new Error('Expected JSON response from refresh but got: ' + refreshContentType);
      }

      // Nếu làm mới token thành công, lấy token mới và tiếp tục
      let refreshData;
      try {
        refreshData = await refreshResponse.json();
      } catch (parseError) {
        console.error('Failed to parse refresh response:', parseError);
        const responseText = await refreshResponse.text();
        console.error('Refresh response text:', responseText);
        throw new Error('Invalid JSON response from refresh endpoint');
      }
      
      if (!refreshData.success || !refreshData.token) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        } else {
          const redirectUrl = new URL(routes.login, request.url);
          redirectUrl.searchParams.set('returnUrl', pathname);
          const redirectResponse = NextResponse.redirect(redirectUrl);
          redirectResponse.cookies.set({
            name: cookieConfig.authCookieName,
            value: '',
            expires: new Date(0),
            path: '/',
          });
          return addSecurityHeaders(redirectResponse);
        }
      }
      
      // Cập nhật token mới vào cookie
      const maxAge = 60 * 60 * 24 * 30; // 30 ngày
      response.cookies.set({
        name: cookieConfig.authCookieName,
        value: refreshData.token,
        path: '/',
        maxAge: maxAge,
        httpOnly: true,
        secure: isHttps,
        sameSite: cookieConfig.sameSite,
      });
      
      // Cập nhật token để sử dụng cho các bước tiếp theo
      token = refreshData.token;
      
      // Gọi lại API xác thực với token mới (dùng URL đầy đủ)
      const reVerifyResponse = await fetch(`${baseUrl}${TOKEN_VERIFY_API}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });
      
      if (!reVerifyResponse.ok) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        } else {
          const redirectUrl = new URL(routes.login, request.url);
          redirectUrl.searchParams.set('returnUrl', pathname);
          const redirectResponse = NextResponse.redirect(redirectUrl);
          return addSecurityHeaders(redirectResponse);
        }
      }
      
      const verifyData = await reVerifyResponse.json();
      
      // Nếu token mới không hợp lệ, chuyển hướng đến trang đăng nhập
      if (!verifyData.valid) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        } else {
          const redirectUrl = new URL(routes.login, request.url);
          redirectUrl.searchParams.set('returnUrl', pathname);
          const redirectResponse = NextResponse.redirect(redirectUrl);
          redirectResponse.cookies.set({
            name: cookieConfig.authCookieName,
            value: '',
            expires: new Date(0),
            path: '/',
          });
          return addSecurityHeaders(redirectResponse);
        }
      }
      
      // Sử dụng dữ liệu từ token mới đã được xác thực
      request.user = verifyData.user;
      
      // Lấy role từ MongoDB thông qua API (dùng URL đầy đủ)
      let userRole = verifyData.user.role || 'user';
      try {
        const roleResponse = await fetch(`${baseUrl}${USER_ROLE_API}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uid: verifyData.user.uid }),
        });
        
        if (roleResponse.ok) {
          const roleData = await roleResponse.json();
          if (roleData.success && roleData.role) {
            userRole = roleData.role;
          }
        } else {
          console.error('Lỗi khi gọi API role:', await roleResponse.text());
        }
      } catch (roleError) {
        console.error('Lỗi khi lấy role từ API:', roleError);
        // Không làm gián đoạn luồng nếu lỗi API, tiếp tục sử dụng role từ token
      }
  
      // Kiểm tra xem token có sắp hết hạn không
      // Lấy thời gian hết hạn từ payload token
      const tokenExpiration = verifyData.user.tokenExpiration;
      const now = Date.now();
      const timeLeft = tokenExpiration - now;
      
      // Nếu token sắp hết hạn (còn dưới 30 phút), làm mới token
      if (timeLeft < 30 * 60 * 1000) {
        try {
          // Gọi API làm mới token (dùng URL đầy đủ)
          const refreshResponse = await fetch(`${baseUrl}${TOKEN_REFRESH_API}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              token,
              rememberMe: true
            })
          });
          
          const refreshData = await refreshResponse.json();
          
          if (refreshResponse.ok) {
            // Cập nhật cookie với token mới
            if (refreshData.token) {
              // Thiết lập cookie mới cho response
              const maxAge = 60 * 60 * 24 * 30; // 30 ngày
              response.cookies.set({
                name: cookieConfig.authCookieName,
                value: refreshData.token,
                path: '/',
                maxAge: maxAge,
                httpOnly: true,
                secure: isHttps,
                sameSite: cookieConfig.sameSite,
              });
            }
          } else {
            console.error('Không thể làm mới token:', refreshData.error);
          }
        } catch (refreshError) {
          console.error('Lỗi khi làm mới token:', refreshError);
        }
      }
      
      // Nếu token hợp lệ, đặt header
      response.headers.set('x-middleware-active', 'true');
      response.headers.set('x-auth-token', token);
      response.headers.set('x-user-id', verifyData.user.uid);
      response.headers.set('x-user-role', userRole);
    } else {
      const verifyData = await verifyResponse.json();
      
      // Nếu token không hợp lệ, chuyển hướng đến trang đăng nhập
      if (!verifyData.valid) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        } else {
          const redirectUrl = new URL(routes.login, request.url);
          redirectUrl.searchParams.set('returnUrl', pathname);
          const redirectResponse = NextResponse.redirect(redirectUrl);
          redirectResponse.cookies.set({
            name: cookieConfig.authCookieName,
            value: '',
            expires: new Date(0),
            path: '/',
          });
          return addSecurityHeaders(redirectResponse);
        }
      }
      
      // Sử dụng dữ liệu từ token đã được xác thực
      request.user = verifyData.user;
      
      // Lấy role từ MongoDB thông qua API (dùng URL đầy đủ)
      let userRole = verifyData.user.role || 'user';
      try {
        const roleResponse = await fetch(`${baseUrl}${USER_ROLE_API}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uid: verifyData.user.uid }),
        });
        
        if (roleResponse.ok) {
          const roleData = await roleResponse.json();
          if (roleData.success && roleData.role) {
            userRole = roleData.role;
          }
        } else {
          console.error('Lỗi khi gọi API role:', await roleResponse.text());
        }
      } catch (roleError) {
        console.error('Lỗi khi lấy role từ API:', roleError);
        // Không làm gián đoạn luồng nếu lỗi API, tiếp tục sử dụng role từ token
      }
  
      // Kiểm tra xem token có sắp hết hạn không
      // Lấy thời gian hết hạn từ payload token
      const tokenExpiration = verifyData.user.tokenExpiration;
      const now = Date.now();
      const timeLeft = tokenExpiration - now;
      
      // Nếu token sắp hết hạn (còn dưới 30 phút), làm mới token
      if (timeLeft < 30 * 60 * 1000) {
        try {
          // Gọi API làm mới token (dùng URL đầy đủ)
          const refreshResponse = await fetch(`${baseUrl}${TOKEN_REFRESH_API}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              token,
              rememberMe: true
            })
          });
          
          const refreshData = await refreshResponse.json();
          
          if (refreshResponse.ok) {
            // Cập nhật cookie với token mới
            if (refreshData.token) {
              // Thiết lập cookie mới cho response
              const maxAge = 60 * 60 * 24 * 30; // 30 ngày
              response.cookies.set({
                name: cookieConfig.authCookieName,
                value: refreshData.token,
                path: '/',
                maxAge: maxAge,
                httpOnly: true,
                secure: isHttps,
                sameSite: cookieConfig.sameSite,
              });
            }
          } else {
            console.error('Không thể làm mới token:', refreshData.error);
          }
        } catch (refreshError) {
          console.error('Lỗi khi làm mới token:', refreshError);
        }
      }
      
      // Nếu token hợp lệ, đặt header
      response.headers.set('x-middleware-active', 'true');
      response.headers.set('x-auth-token', token);
      response.headers.set('x-user-id', verifyData.user.uid);
      response.headers.set('x-user-role', userRole);
    }
    
    // ==== Kiểm tra quyền truy cập cho các đường dẫn cụ thể ====
    
          // 1. Kiểm tra nếu yêu cầu là cho trang admin
    if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
      // Đảm bảo userRole đã được định nghĩa
      // Sử dụng biến user đã được xác thực từ verifyData, nếu có
      const user = request.user || (verifyData?.user);
      let userRole = user?.role || 'user';
      
      
      // Kiểm tra user có quyền admin không
      if (userRole !== 'admin') {
        const redirectResponse = NextResponse.redirect(new URL('/', request.url));
        return addSecurityHeaders(redirectResponse);
      }
      
      // Thêm cookie admin_access để đánh dấu quyền admin
      response.cookies.set('admin_access', 'true', {
        httpOnly: true,
        secure: isHttps,
        sameSite: cookieConfig.sameSite,
        maxAge: 60 * 60 * 2, // 2 giờ
        path: '/',
      });
      
      // Đặt header role cho admin
      response.headers.set('x-user-role', 'admin');
      
      return addSecurityHeaders(response);
    }
    
    // 2. Kiểm tra nếu yêu cầu là cho trang công tác viên (CTV)
    if (pathname.startsWith('/ctv') && !pathname.startsWith('/ctv/login')) {
      // Đảm bảo userRole đã được định nghĩa
      const user = request.user || (verifyData?.user);
      let userRole = user?.role || 'user';
      
      // Kiểm tra user có quyền ctv (công tác viên) hay không
      if (userRole !== 'ctv') {
        const redirectResponse = NextResponse.redirect(new URL('/', request.url));
        return addSecurityHeaders(redirectResponse);
      }
      
      // Thêm cookie ctv_access để đánh dấu quyền công tác viên
      response.cookies.set('ctv_access', 'true', {
        httpOnly: true,
        secure: isHttps,
        sameSite: cookieConfig.sameSite,
        maxAge: 60 * 60 * 2, // 2 giờ
        path: '/',
      });
      
      // Đặt header role cho ctv
      response.headers.set('x-user-role', 'ctv');
      
      return addSecurityHeaders(response);
    }
    
    // 3. Kiểm tra nếu yêu cầu là cho API admin
    if (pathname.startsWith('/api/admin') || pathname.startsWith('/api/courses/raw')) {
      // Đảm bảo userRole đã được định nghĩa
      const user = request.user || (verifyData?.user);
      let userRole = user?.role || 'user';
      
      // Kiểm tra các API đặc biệt mà CTV được phép truy cập
      if (pathname.startsWith('/api/admin/enrollments') || pathname.startsWith('/api/admin/courses')) {
        // Kiểm tra user có quyền admin hoặc ctv không
        if (userRole === 'admin' || userRole === 'ctv') {
          // Thiết lập cookie phù hợp dựa trên vai trò
          if (userRole === 'admin') {
            response.cookies.set('admin_access', 'true', {
              httpOnly: true,
              secure: isHttps,
              sameSite: cookieConfig.sameSite,
              maxAge: 60 * 60 * 2, // 2 giờ
              path: '/',
            });
          } else if (userRole === 'ctv') {
            // Đặt cookie ctv_access và thêm email CTV vào cookie để API có thể sử dụng
            response.cookies.set('ctv_access', 'true', {
              httpOnly: true,
              secure: isHttps,
              sameSite: cookieConfig.sameSite,
              maxAge: 60 * 60 * 2, // 2 giờ
              path: '/',
            });
            
            // Thêm email của CTV vào cookie để API có thể lấy
            const email = user?.email || '';
            response.cookies.set('ctv_email', email, {
              httpOnly: true,
              secure: isHttps,
              sameSite: cookieConfig.sameSite,
              maxAge: 60 * 60 * 2, // 2 giờ
              path: '/',
            });
          }
          
          return addSecurityHeaders(response);
        } else {
          return NextResponse.json(
            { error: 'Không có quyền truy cập API này' },
            { status: 403 }
          );
        }
      }
      
      // Các API admin khác (không phải /api/admin/enrollments hoặc /api/admin/courses)
      // chỉ cho phép admin truy cập
      if (userRole !== 'admin') {
        return NextResponse.json(
          { error: 'Không có quyền truy cập API admin' },
          { status: 403 }
        );
      }
      
      // Cập nhật cookie admin_access
      response.cookies.set('admin_access', 'true', {
        httpOnly: true,
        secure: isHttps,
        sameSite: cookieConfig.sameSite,
        maxAge: 60 * 60 * 2, // 2 giờ
        path: '/',
      });
      
      return addSecurityHeaders(response);
    }
    
    // 4. Kiểm tra nếu yêu cầu là cho API công tác viên (CTV)
    if (pathname.startsWith('/api/ctv')) {
      // Đảm bảo userRole đã được định nghĩa
      const user = request.user || (verifyData?.user);
      let userRole = user?.role || 'user';
      
      // Kiểm tra user có quyền CTV không
      if (userRole !== 'ctv') {
        return NextResponse.json(
          { error: 'Không có quyền truy cập API công tác viên' },
          { status: 403 }
        );
      }
      
      // Cập nhật cookie ctv_access
      response.cookies.set('ctv_access', 'true', {
        httpOnly: true,
        secure: isHttps,
        sameSite: cookieConfig.sameSite,
        maxAge: 60 * 60 * 2, // 2 giờ
        path: '/',
      });
      
      return addSecurityHeaders(response);
    }
    
    // Thêm CORS headers cho API routes
    if (pathname.startsWith('/api/')) {
      response.headers.set('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_BASE_URL || '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    
    // Cho phép truy cập các đường dẫn khác nếu đã xác thực thành công
    return addSecurityHeaders(response);
  } catch (error) {
    console.error('Middleware error:', error);
    
    // Nếu là API, trả về JSON lỗi 401 mà KHÔNG redirect
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', message: 'Error processing authentication' },
        { status: 401 }
      );
    }
    
    // Nếu là route thường, redirect về login
    const redirectUrl = new URL(routes.login, request.url);
    redirectUrl.searchParams.set('returnUrl', pathname);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    return addSecurityHeaders(redirectResponse);
  }
}

// Cấu hình middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ]
}; 