import { verifyServerAuthToken, getServerToken } from "@/utils/server-auth";
import { cookieConfig } from "@/config/env-config";

// Cấu hình xác thực cho Next.js API routes
export const authOptions = {
  // Hàm callbacks để xác thực người dùng
  callbacks: {
    async session({ session, token }) {
      // Sử dụng token từ Firebase Auth
      const firebaseToken = await getServerToken();
      
      if (firebaseToken) {
        const user = await verifyServerAuthToken(firebaseToken);
        
        if (user) {
          // Thêm thông tin người dùng vào session
          session.user = user;
          session.token = firebaseToken;
        }
      }
      
      return session;
    },
    async jwt({ token, user }) {
      // Nếu có user, thêm vào token
      if (user) {
        token.user = user;
      }
      
      return token;
    }
  },
  // Sử dụng JWT để lưu trữ phiên đăng nhập
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 ngày
  },
  // Không cần providers vì đang sử dụng Firebase Auth
  providers: [],
};

// Middleware để kiểm tra xác thực cho API routes
export async function authMiddleware(req) {
  try {
    console.log('🔑 Auth Middleware - Bắt đầu xác thực');
    
    // Lấy token từ header
    const authHeader = req.headers?.authorization;
    let token = authHeader ? authHeader.replace('Bearer ', '') : null;
    console.log('🔑 Auth Middleware - Token từ header:', token ? 'Có' : 'Không có');
    
    // Nếu không có token trong header, thử lấy từ cookie
    if (!token) {
      const cookieName = cookieConfig.authCookieName;
      console.log('🔑 Auth Middleware - Tên cookie cần tìm:', cookieName);
      
      // Kiểm tra xem request có đối tượng cookies hay không
      if (req.cookies) {
        // Đối với API Route handlers mới (App Router)
        console.log('🔑 Auth Middleware - Đang thử lấy token từ req.cookies');
        token = req.cookies.get?.(cookieName)?.value;
      } else {
        // Sử dụng cookies() API nếu có thể
        try {
          console.log('🔑 Auth Middleware - Đang thử lấy token từ cookies() API');
          const { cookies } = require('next/headers');
          token = cookies().get(cookieName)?.value;
        } catch (cookieError) {
          console.error('🔑 Auth Middleware - Lỗi khi truy cập cookies:', cookieError);
        }
      }
      
      console.log('🔑 Auth Middleware - Token từ cookie:', token ? 'Có' : 'Không có');
    }
    
    if (!token) {
      console.log('🔑 Auth Middleware - Không tìm thấy token, xác thực thất bại');
      return null;
    }
    
    // Xác thực token với Firebase Admin
    console.log('🔑 Auth Middleware - Đang xác thực token với Firebase');
    const firebaseAdmin = (await import('@/lib/firebase-admin')).default;
    
    try {
      const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
      
      if (!decodedToken) {
        console.log('🔑 Auth Middleware - Token không hợp lệ');
        return null;
      }
      
      console.log('🔑 Auth Middleware - Xác thực thành công:', {
        uid: decodedToken.uid,
        email: decodedToken.email,
        role: decodedToken.role || 'user'
      });
      
      // Trả về thông tin người dùng đã xác thực
      return {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.displayName,
        role: decodedToken.role || 'user',
        canViewAllCourses: decodedToken.role === 'admin' || decodedToken.canViewAllCourses === true
      };
    } catch (verifyError) {
      console.error('🔑 Auth Middleware - Lỗi khi xác thực token:', verifyError);
      return null;
    }
  } catch (error) {
    console.error('🔑 Auth Middleware - Lỗi xác thực tổng quát:', error);
    return null;
  }
}

// Hàm kiểm tra xác thực và vai trò
export async function checkAuthAndRole(req, requiredRole = 'user') {
  const user = await authMiddleware(req);
  
  if (!user) {
    return false;
  }
  
  // Nếu role là admin, cho phép truy cập mọi nơi
  if (user.role === 'admin') return true;
  
  // Hỗ trợ kiểm tra nhiều vai trò
  if (Array.isArray(requiredRole)) {
    return requiredRole.includes(user.role);
  }
  
  // Nếu role là staff, cho phép truy cập quyền staff và user
  if (user.role === 'staff' && requiredRole === 'user') return true;
  
  // Trường hợp khác, so sánh trực tiếp
  return user.role === requiredRole;
}

// Hàm lấy thông tin người dùng hiện tại
export async function getCurrentUser(req) {
  return await authMiddleware(req);
} 