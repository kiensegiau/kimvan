import { verifyServerAuthToken, getServerToken } from "@/utils/server-auth";

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
  const token = await getServerToken();
  
  if (!token) {
    return null;
  }
  
  const user = await verifyServerAuthToken(token);
  
  if (user) {
    try {
      // Kết nối đến MongoDB để lấy thông tin bổ sung
      const { connectDB } = require('./mongodb');
      await connectDB();
      
      const mongoose = require('mongoose');
      const db = mongoose.connection.db;
      const userCollection = db.collection('users');
      
      // Tìm thông tin người dùng trong MongoDB
      const userDetails = await userCollection.findOne({ firebaseId: user.uid });
      
      // Thêm thông tin canViewAllCourses vào đối tượng user
      if (userDetails) {
        user.canViewAllCourses = !!userDetails.canViewAllCourses;
      }
    } catch (error) {
      console.error('Lỗi khi lấy thông tin bổ sung từ MongoDB:', error);
    }
  }
  
  return user;
}

// Hàm kiểm tra xác thực và vai trò
export async function checkAuthAndRole(req, requiredRole = 'user') {
  const user = await authMiddleware(req);
  
  if (!user) {
    return false;
  }
  
  // Nếu role là admin, cho phép truy cập mọi nơi
  if (user.role === 'admin') return true;
  
  // Nếu role là staff, cho phép truy cập quyền staff và user
  if (user.role === 'staff' && requiredRole === 'user') return true;
  
  // Trường hợp khác, so sánh trực tiếp
  return user.role === requiredRole;
}

// Hàm lấy thông tin người dùng hiện tại
export async function getCurrentUser(req) {
  return await authMiddleware(req);
} 