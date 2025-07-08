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
  return publicPaths.some(publicPath => path.startsWith(publicPath)) || 
         path.startsWith('/api/spreadsheets/') ||  // Thêm /api/spreadsheets vào danh sách bỏ qua
         path.startsWith('/api/auth/') || // Thêm tất cả API auth vào danh sách bỏ qua
         path.startsWith('/_next/') ||     // Thêm các static assets
         path.startsWith('/favicon.ico');  // Favicon
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

// Kiểm tra xem request có phải là từ login/register flow
function isAuthFlow(pathname) {
  return pathname === '/login' || 
         pathname === '/register' || 
         pathname === '/forgot-password' ||
         pathname.startsWith('/api/auth/');
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  console.log('🚨 MIDDLEWARE EXECUTED FOR:', pathname);

  // Ngăn chặn vòng lặp chuyển hướng - nếu đã ở trang login thì không xử lý nữa
  if (isAuthFlow(pathname)) {
    return addSecurityHeaders(NextResponse.next());
  }

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
    
    // Tránh chuyển hướng vòng lặp
    if (pathname === routes.login) {
      return addSecurityHeaders(NextResponse.next());
    }
    
    const redirectUrl = new URL(routes.login, request.url);
    // Thêm returnUrl để sau khi đăng nhập có thể chuyển hướng về trang ban đầu
    redirectUrl.searchParams.set('returnUrl', pathname);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    return addSecurityHeaders(redirectResponse);
  }

  // Thêm khối try-catch bên ngoài để đảm bảo không có lỗi không xử lý
  try {
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
        // Thêm timeout để tránh request bị treo
        signal: AbortSignal.timeout(5000), // 5 giây timeout
      });

      // Kiểm tra response status
      if (!verifyResponse.ok) {
        throw new Error(`Lỗi xác thực token: HTTP status ${verifyResponse.status}`);
      }

      const verifyData = await verifyResponse.json();
      
      // Nếu token không hợp lệ, chuyển hướng đến trang đăng nhập
      if (!verifyData.valid) {
        console.log('🔒 Token không hợp lệ, chuyển hướng đến trang đăng nhập');
        
        // Tránh chuyển hướng vòng lặp
        if (pathname === routes.login) {
          return addSecurityHeaders(NextResponse.next());
        }
        
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
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              token, // Truyền token hiện tại vào body
              rememberMe: true // Mặc định sử dụng thời gian sống dài
            }),
            // Thêm timeout cho request refresh
            signal: AbortSignal.timeout(5000), // 5 giây timeout
          });
          
          if (!refreshResponse.ok) {
            throw new Error(`Lỗi làm mới token: HTTP status ${refreshResponse.status}`);
          }
          
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
          console.error('❌ Lỗi khi làm mới token:', refreshError.message);
          // Không cần chuyển hướng ở đây, vì token vẫn còn hiệu lực
        }
      }
    } catch (error) {
      console.error('❌ Lỗi khi xác thực token:', error.message);
      
      // Trong trường hợp lỗi xác thực, cho phép tiếp tục truy cập thay vì chuyển hướng
      // Điều này giúp ngăn chặn các vấn đề khi API xác thực không hoạt động
      console.log('⚠️ Cho phép truy cập do lỗi xác thực token');
      return addSecurityHeaders(response);
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
          // Thêm timeout để tránh request bị treo
          signal: AbortSignal.timeout(5000), // 5 giây timeout
        });

        if (!verifyResponse.ok) {
          throw new Error(`Lỗi xác thực admin: HTTP status ${verifyResponse.status}`);
        }

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
        return addSecurityHeaders(NextResponse.next());
      } catch (error) {
        console.error('❌ Middleware - Lỗi kiểm tra email admin:', error.message);
        // Trong trường hợp lỗi xác thực admin, cho phép tiếp tục truy cập
        console.log('⚠️ Cho phép truy cập admin do lỗi xác thực');
        return addSecurityHeaders(response);
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
      return addSecurityHeaders(NextResponse.next());
    }
    
    return addSecurityHeaders(response);
  } catch (globalError) {
    // Xử lý mọi lỗi không mong muốn
    console.error('❌ Lỗi không xử lý trong middleware:', globalError.message);
    // Cho phép truy cập để tránh trang web bị treo
    return addSecurityHeaders(NextResponse.next());
  }
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