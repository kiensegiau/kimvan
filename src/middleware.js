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
  '/api/test-browser'
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

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  // Debug: log pathname để kiểm tra
  console.log('🔎 middleware pathname:', pathname);

  // Áp dụng security headers cho tất cả các request
  const response = NextResponse.next();
  securityHeaders.forEach(header => {
    response.headers.set(header.key, header.value);
  });

  // Loại trừ các API xác thực khỏi middleware để tránh lặp
  if (
    pathname.startsWith(TOKEN_VERIFY_API) ||
    pathname.startsWith(TOKEN_REFRESH_API) ||
    pathname.startsWith(USER_ROLE_API) ||
    pathname.startsWith('/api/auth/logout') ||
    pathname.startsWith('/api/auth/admin/check-permission')
  ) {
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
    const rawPathname = pathname;
    if (pathname.startsWith('/api/')) {
      // Nếu là API, trả về JSON lỗi 401
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    } else {
      // Nếu là route thường, redirect về login
      const redirectUrl = new URL(routes.login, request.url);
      redirectUrl.searchParams.set('returnUrl', rawPathname);
      const redirectResponse = NextResponse.redirect(redirectUrl);
      return addSecurityHeaders(redirectResponse);
    }
  }

  // Xác thực token với server trước khi cho phép truy cập
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    // Gọi API xác thực token (dùng URL đầy đủ)
    const verifyResponse = await fetch(`${baseUrl}${TOKEN_VERIFY_API}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    let user;
    let userRole;

    if (!verifyResponse.ok) {
      // Thử làm mới token (dùng URL đầy đủ)
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
      
      // Nếu làm mới token thành công, lấy token mới và tiếp tục
      const refreshData = await refreshResponse.json();
      
      if (!refreshData.success || !refreshData.token) {
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
      
      // Cập nhật token mới vào cookie
      const maxAge = 60 * 60 * 24 * 30; // 30 ngày
      response.cookies.set({
        name: cookieConfig.authCookieName,
        value: refreshData.token,
        path: '/',
        maxAge: maxAge,
        httpOnly: true,
        secure: cookieConfig.secure,
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
        const redirectUrl = new URL(routes.login, request.url);
        redirectUrl.searchParams.set('returnUrl', pathname);
        const redirectResponse = NextResponse.redirect(redirectUrl);
        return addSecurityHeaders(redirectResponse);
      }
      
      const verifyData = await reVerifyResponse.json();
      
      // Nếu token mới không hợp lệ, chuyển hướng đến trang đăng nhập
      if (!verifyData.valid) {
        const redirectUrl = new URL(routes.login, request.url);
        redirectUrl.searchParams.set('returnUrl', pathname);
        const redirectResponse = NextResponse.redirect(redirectUrl);
        return addSecurityHeaders(redirectResponse);
      }
      
      // Sử dụng dữ liệu từ token mới đã được xác thực
      user = verifyData.user;
      
      // Lấy role từ MongoDB thông qua API (dùng URL đầy đủ)
      userRole = user.role || 'user';
      try {
        const roleResponse = await fetch(`${baseUrl}${USER_ROLE_API}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uid: user.uid }),
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
      const tokenExpiration = user.tokenExpiration;
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
                secure: cookieConfig.secure,
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
      response.headers.set('x-user-id', user.uid);
      response.headers.set('x-user-role', userRole);
    } else {
      const verifyData = await verifyResponse.json();
      
      // Nếu token không hợp lệ, chuyển hướng đến trang đăng nhập
      if (!verifyData.valid) {
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
      
      user = verifyData.user;
      
      // Lấy role từ MongoDB thông qua API (dùng URL đầy đủ)
      userRole = user.role || 'user';
      try {
        const roleResponse = await fetch(`${baseUrl}${USER_ROLE_API}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uid: user.uid }),
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
      const tokenExpiration = user.tokenExpiration;
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
                secure: cookieConfig.secure,
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
      response.headers.set('x-user-id', user.uid);
      response.headers.set('x-user-role', userRole);
    }
    
    // ==== Kiểm tra quyền truy cập cho các đường dẫn cụ thể ====
    
    // 1. Kiểm tra nếu yêu cầu là cho trang admin
    if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
      // Đảm bảo userRole đã được định nghĩa
      if (userRole === undefined) {
        userRole = user?.role || 'user';
      }
      
      // Kiểm tra user có quyền admin không
      if (userRole !== 'admin') {
        const redirectResponse = NextResponse.redirect(new URL('/', request.url));
        return addSecurityHeaders(redirectResponse);
      }
      
      // Thêm cookie admin_access để đánh dấu quyền admin
      response.cookies.set('admin_access', 'true', {
        httpOnly: true,
        secure: cookieConfig.secure,
        sameSite: cookieConfig.sameSite,
        maxAge: 60 * 60 * 2, // 2 giờ
        path: '/',
      });
      
      return addSecurityHeaders(response);
    }
    
    // 2. Kiểm tra nếu yêu cầu là cho trang công tác viên (CTV)
    if (pathname.startsWith('/ctv') && !pathname.startsWith('/ctv/login')) {
      // Đảm bảo userRole đã được định nghĩa
      if (userRole === undefined) {
        userRole = user?.role || 'user';
      }
      
      // Kiểm tra user có quyền ctv (công tác viên) hay không
      if (userRole !== 'ctv') {
        const redirectResponse = NextResponse.redirect(new URL('/', request.url));
        return addSecurityHeaders(redirectResponse);
      }
      
      // Thêm cookie ctv_access để đánh dấu quyền công tác viên
      response.cookies.set('ctv_access', 'true', {
        httpOnly: true,
        secure: cookieConfig.secure,
        sameSite: cookieConfig.sameSite,
        maxAge: 60 * 60 * 2, // 2 giờ
        path: '/',
      });
      
      return addSecurityHeaders(response);
    }
    
    // 3. Kiểm tra nếu yêu cầu là cho API admin
    if (pathname.startsWith('/api/admin') || pathname.startsWith('/api/courses/raw')) {
      // Đảm bảo userRole đã được định nghĩa
      if (userRole === undefined) {
        userRole = user?.role || 'user';
      }
      
      // Kiểm tra các API đặc biệt mà CTV được phép truy cập
      if (pathname.startsWith('/api/admin/enrollments') || pathname.startsWith('/api/admin/courses')) {
        // Kiểm tra user có quyền admin hoặc ctv không
        if (userRole === 'admin' || userRole === 'ctv') {
          // Thiết lập cookie phù hợp dựa trên vai trò
          if (userRole === 'admin') {
            response.cookies.set('admin_access', 'true', {
              httpOnly: true,
              secure: cookieConfig.secure,
              sameSite: cookieConfig.sameSite,
              maxAge: 60 * 60 * 2, // 2 giờ
              path: '/',
            });
          } else if (userRole === 'ctv') {
            // Đặt cookie ctv_access và thêm email CTV vào cookie để API có thể sử dụng
            response.cookies.set('ctv_access', 'true', {
              httpOnly: true,
              secure: cookieConfig.secure,
              sameSite: cookieConfig.sameSite,
              maxAge: 60 * 60 * 2, // 2 giờ
              path: '/',
            });
            
            // Thêm email của CTV vào cookie để API có thể lấy
            response.cookies.set('ctv_email', user.email, {
              httpOnly: true,
              secure: cookieConfig.secure,
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
        secure: cookieConfig.secure,
        sameSite: cookieConfig.sameSite,
        maxAge: 60 * 60 * 2, // 2 giờ
        path: '/',
      });
      
      return addSecurityHeaders(response);
    }
    
    // 4. Kiểm tra nếu yêu cầu là cho API công tác viên (CTV)
    if (pathname.startsWith('/api/ctv')) {
      // Đảm bảo userRole đã được định nghĩa
      if (userRole === undefined) {
        userRole = user?.role || 'user';
      }
      
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
        secure: cookieConfig.secure,
        sameSite: cookieConfig.sameSite,
        maxAge: 60 * 60 * 2, // 2 giờ
        path: '/',
      });
      
      return addSecurityHeaders(response);
    }
    
    // Cho phép truy cập các đường dẫn khác nếu đã xác thực thành công
    return addSecurityHeaders(response);
  } catch (error) {
    console.error('Lỗi khi xác thực token:', error);
    
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