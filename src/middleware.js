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
const USER_ROLE_API = '/api/auth/user-role';

// Email được phép truy cập trang admin - không còn cần thiết vì sẽ kiểm tra theo role
// const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'phanhuukien2001@gmail.com';
// console.log('🔧 Middleware - Email admin được cấu hình:', ADMIN_EMAIL);

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

  // Áp dụng security headers cho tất cả các request
  const response = NextResponse.next();
  securityHeaders.forEach(header => {
    response.headers.set(header.key, header.value);
  });

  // Bỏ qua middleware cho API verify token, refresh token và user-role để tránh vòng lặp vô hạn
  if (pathname === TOKEN_VERIFY_API || 
      pathname === TOKEN_REFRESH_API ||
      pathname === USER_ROLE_API ||
      pathname === '/api/auth/logout' || 
      pathname === '/api/auth/admin/check-permission') {
    return response;
  }

  // Kiểm tra và cache kết quả cho đường dẫn công khai
  if (publicPathCache.has(pathname)) {
    const isPublic = publicPathCache.get(pathname);
    if (isPublic) {
      console.log('🔓 Middleware - Đường dẫn công khai (cached):', pathname);
      return addSecurityHeaders(response);
    }
  }

  const pathIsPublic = isPublicPath(pathname);
  publicPathCache.set(pathname, pathIsPublic);
  
  // Không kiểm tra xác thực cho các đường dẫn công khai
  if (pathIsPublic) {
    console.log('🔓 Middleware - Đường dẫn công khai:', pathname);
    return addSecurityHeaders(response);
  }

  // Lấy token từ cookie cho tất cả các đường dẫn được bảo vệ
  const tokenCookie = request.cookies.get(cookieConfig.authCookieName);
  const token = tokenCookie?.value;
  
  // Kiểm tra token có tồn tại và không phải là chuỗi rỗng
  if (!token || token.trim() === '') {
    console.log('🔒 Token không tồn tại hoặc rỗng, chuyển hướng đến trang đăng nhập');
    
    const redirectUrl = new URL(routes.login, request.url);
    // Thêm returnUrl để sau khi đăng nhập có thể chuyển hướng về trang ban đầu
    redirectUrl.searchParams.set('returnUrl', encodeURIComponent(pathname));
    const redirectResponse = NextResponse.redirect(redirectUrl);
    return addSecurityHeaders(redirectResponse);
  }

  // Xác thực token với server trước khi cho phép truy cập
  try {
    // Xác định URL cơ sở
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    
    // Gọi API xác thực token
    console.log('🔒 Middleware - Đang xác thực token cho đường dẫn:', pathname);
    const verifyResponse = await fetch(`${baseUrl}${TOKEN_VERIFY_API}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    if (!verifyResponse.ok) {
      console.log('❌ Middleware - API xác thực không trả về kết quả thành công');
      const redirectUrl = new URL(routes.login, request.url);
      redirectUrl.searchParams.set('returnUrl', encodeURIComponent(pathname));
      const redirectResponse = NextResponse.redirect(redirectUrl);
      return addSecurityHeaders(redirectResponse);
    }

    const verifyData = await verifyResponse.json();
    
    // Nếu token không hợp lệ, chuyển hướng đến trang đăng nhập
    if (!verifyData.valid) {
      console.log('🔒 Token không hợp lệ, chuyển hướng đến trang đăng nhập');
      
      const redirectUrl = new URL(routes.login, request.url);
      redirectUrl.searchParams.set('returnUrl', encodeURIComponent(pathname));
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

    const user = verifyData.user;
    
    // Log chi tiết thông tin user để debug
    console.log('🔍 MIDDLEWARE - Thông tin người dùng đầy đủ:', JSON.stringify(user));
    console.log('🔍 MIDDLEWARE - Role của người dùng từ token:', user.role);
    
    // Lấy role từ MongoDB thông qua API
    let userRole = user.role || 'user';
    try {
      console.log('🔍 MIDDLEWARE - Đang lấy role từ MongoDB qua API');
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
          console.log('🔍 MIDDLEWARE - Role từ MongoDB:', userRole);
        }
      } else {
        console.error('❌ MIDDLEWARE - Lỗi khi gọi API role:', await roleResponse.text());
      }
    } catch (roleError) {
      console.error('❌ MIDDLEWARE - Lỗi khi lấy role từ API:', roleError);
      // Không làm gián đoạn luồng nếu lỗi API, tiếp tục sử dụng role từ token
    }
    
    console.log('🔍 MIDDLEWARE - Role cuối cùng sử dụng:', userRole);
    console.log('🔍 MIDDLEWARE - Kiểm tra role === admin:', userRole === 'admin');

    // Kiểm tra xem token có sắp hết hạn không
    // Lấy thời gian hết hạn từ payload token
    const tokenExpiration = user.tokenExpiration;
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
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            token, // Truyền token hiện tại vào body
            rememberMe: true // Mặc định sử dụng thời gian sống dài
          })
        });
        
        const refreshData = await refreshResponse.json();
        
        if (refreshResponse.ok) {
          console.log('✅ Làm mới token thành công');
          
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
          console.error('❌ Không thể làm mới token:', refreshData.error);
        }
      } catch (refreshError) {
        console.error('❌ Lỗi khi làm mới token:', refreshError);
      }
    }
    
    // Nếu token hợp lệ, đặt header
    response.headers.set('x-middleware-active', 'true');
    response.headers.set('x-auth-token', token);
    response.headers.set('x-user-id', user.uid);
    response.headers.set('x-user-role', userRole); // Dùng userRole từ MongoDB hoặc token

    // ==== Kiểm tra quyền truy cập cho các đường dẫn cụ thể ====
    
    // 1. Kiểm tra nếu yêu cầu là cho trang admin
    if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
      console.log('🔒 Middleware - Kiểm tra quyền truy cập trang admin cho:', pathname);
      
      // Kiểm tra user có quyền admin không - sử dụng userRole thay vì user.role
      if (!userRole || userRole !== 'admin') {
        console.log('⚠️ Middleware - Không phải là admin, chuyển hướng đến trang chủ');
        const redirectResponse = NextResponse.redirect(new URL('/', request.url));
        return addSecurityHeaders(redirectResponse);
      }
      
      // Loại bỏ phần kiểm tra email admin - chỉ kiểm tra role
      console.log('✅ Middleware - User có role admin hợp lệ:', user.email);
      
      // Thêm cookie admin_access để đánh dấu quyền admin
      response.cookies.set('admin_access', 'true', {
        httpOnly: true,
        secure: cookieConfig.secure,
        sameSite: cookieConfig.sameSite,
        maxAge: 60 * 60 * 2, // 2 giờ
        path: '/',
      });
      
      // Nếu hợp lệ, cho phép truy cập
      console.log('✅ Middleware - User admin hợp lệ, cho phép truy cập');
      return addSecurityHeaders(response);
    }
    
    // 2. Kiểm tra nếu yêu cầu là cho trang công tác viên (CTV)
    if (pathname.startsWith('/ctv') && !pathname.startsWith('/ctv/login')) {
      console.log('🔒 Middleware - Kiểm tra quyền truy cập trang CTV cho:', pathname);
      
      // Kiểm tra user có quyền ctv (công tác viên) hay không - sử dụng userRole
      console.log('🔒 Middleware - Kiểm tra quyền CTV, vai trò hiện tại:', userRole);
      
      if (!userRole || userRole !== 'ctv') {
        console.log('⚠️ Middleware - Không phải là CTV, chuyển hướng đến trang chủ');
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
      
      // Nếu hợp lệ, cho phép truy cập
      console.log('✅ Middleware - User CTV hợp lệ, cho phép truy cập');
      return addSecurityHeaders(response);
    }
    
    // 3. Kiểm tra nếu yêu cầu là cho API admin
    if (pathname.startsWith('/api/admin') || pathname.startsWith('/api/courses/raw')) {
      console.log('🔒 Middleware - Kiểm tra quyền truy cập API admin cho:', pathname);
      
      // Kiểm tra user có quyền admin không - sử dụng userRole
      if (!userRole || userRole !== 'admin') {
        console.log('⚠️ Middleware - Không phải là admin, từ chối truy cập API');
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
      
      console.log('✅ Middleware - Có quyền admin, cho phép truy cập API');
      return addSecurityHeaders(response);
    }
    
    // 4. Kiểm tra nếu yêu cầu là cho API công tác viên (CTV)
    if (pathname.startsWith('/api/ctv')) {
      console.log('🔒 Middleware - Kiểm tra quyền truy cập API CTV cho:', pathname);
      
      // Kiểm tra user có quyền CTV không - sử dụng userRole
      if (!userRole || userRole !== 'ctv') {
        console.log('⚠️ Middleware - Không phải là CTV, từ chối truy cập API');
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
      
      console.log('✅ Middleware - Có quyền CTV, cho phép truy cập API');
      return addSecurityHeaders(response);
    }
    
    // Cho phép truy cập các đường dẫn khác nếu đã xác thực thành công
    return addSecurityHeaders(response);
  } catch (error) {
    console.error('❌ Lỗi khi xác thực token:', error);
    
    // Trong trường hợp lỗi, chuyển hướng đến trang đăng nhập để an toàn
    const redirectUrl = new URL(routes.login, request.url);
    redirectUrl.searchParams.set('returnUrl', encodeURIComponent(pathname));
    const redirectResponse = NextResponse.redirect(redirectUrl);
    return addSecurityHeaders(redirectResponse);
  }
}

// Cấu hình middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * 1. The ones in publicPaths (defined in env-config.js)
     * 2. _next/static (static files)
     * 3. _next/image (image optimization files)
     * 4. favicon.ico, images, fonts, assets (static assets)
     */
    '/((?!api/auth/verify|api/auth/refresh-token|api/auth/logout|api/auth/admin/check-permission|login|admin/login|ctv/login|register|forgot-password|reset-password|_next/static|_next/image|favicon.ico|images|fonts|assets).*)',
  ],
  // Edge runtime settings
  skipMiddlewareUrlNormalize: true
}; 