import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { routes } from '@/config/env-config';

/**
 * Hàm trợ giúp xác thực cho Server Components
 * @param {string} token - Token xác thực
 * @returns {Promise<Object>} - Thông tin người dùng
 */
async function verifyAuthTokenServer(token) {
  try {
    // Gọi API nội bộ để xác thực token
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
      // Đảm bảo không cache
      cache: 'no-store'
    });

    const data = await response.json();
    
    if (data.valid && data.user) {
      return data.user;
    }
    
    return null;
  } catch (error) {
    console.error('Lỗi xác thực token server:', error);
    return null;
  }
}

/**
 * Lấy thông tin người dùng hiện tại từ cookie token
 * Sử dụng trong Server Components
 * @returns {Promise<Object|null>} - Thông tin người dùng hoặc null
 */
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  
  if (!token) return null;
  
  return await verifyAuthTokenServer(token);
}

/**
 * Higher-order function kiểm tra xác thực cho Server Components
 * @param {Function} getServerSideProps - Hàm getServerSideProps gốc
 * @param {Object} options - Các tùy chọn
 * @param {boolean} options.requireAuth - Yêu cầu xác thực
 * @param {string} options.requiredRole - Vai trò yêu cầu
 * @returns {Function} - Hàm getServerSideProps mới có xác thực
 */
export function withAuth(callback, options = {}) {
  const { requireAuth = true, requiredRole = null } = options;
  
  return async function withAuthWrapper(context) {
    // Lấy thông tin người dùng từ cookie
    const user = await getCurrentUser();
    
    // Nếu yêu cầu xác thực và không có người dùng
    if (requireAuth && !user) {
      // Lấy đường dẫn hiện tại để chuyển hướng về sau
      const returnUrl = encodeURIComponent(context.url || '/');
      
      // Chuyển hướng đến trang đăng nhập
      redirect(`${routes.login}?returnUrl=${returnUrl}`);
    }
    
    // Nếu yêu cầu vai trò cụ thể
    if (user && requiredRole && user.role !== requiredRole && user.role !== 'admin') {
      // Nếu không đủ quyền, chuyển hướng về trang chủ
      redirect(routes.home);
    }
    
    // Thêm thông tin người dùng vào context
    context.user = user;
    
    // Gọi hàm callback ban đầu với context đã được bổ sung
    return await callback(context);
  };
}

/**
 * Kiểm tra xác thực đơn giản cho các hành động hoặc route handler
 * @param {Request} request - Đối tượng request
 * @param {Object} options - Các tùy chọn
 * @returns {Promise<Object|null>} - Thông tin người dùng hoặc null
 */
export async function checkAuth(request, options = {}) {
  const { requireAuth = true, requiredRole = null } = options;
  
  // Lấy token từ cookie
  const cookieHeader = request.headers.get('cookie') || '';
  const tokenMatch = cookieHeader.match(/auth-token=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : null;
  
  if (!token) {
    if (requireAuth) {
      return { authenticated: false, error: 'Không có token xác thực' };
    }
    return { authenticated: false };
  }
  
  // Xác thực token
  const user = await verifyAuthTokenServer(token);
  
  if (!user) {
    if (requireAuth) {
      return { authenticated: false, error: 'Token không hợp lệ hoặc đã hết hạn' };
    }
    return { authenticated: false };
  }
  
  // Kiểm tra vai trò
  if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
    return { authenticated: true, authorized: false, error: 'Không đủ quyền truy cập' };
  }
  
  return { authenticated: true, authorized: true, user };
} 