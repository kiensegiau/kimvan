/**
 * Cấu hình biến môi trường tập trung
 * Tập tin này giúp quản lý tất cả các biến môi trường trong một nơi
 * Dễ dàng kiểm tra và cập nhật khi cần thiết
 */

// Xác định môi trường hiện tại
export const isDevelopment = process.env.NODE_ENV === 'development';
export const isProduction = process.env.NODE_ENV === 'production';
export const isTest = process.env.NODE_ENV === 'test';

// Cấu hình Firebase Client (sử dụng ở phía client)
export const firebaseClientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

// Xử lý private key từ biến môi trường
const getPrivateKey = () => {
  const key = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!key) return undefined;
  
  // Nếu key đã có ký tự xuống dòng thực sự (\n), trả về nguyên bản
  if (key.includes('\n')) return key;
  
  // Nếu key có chuỗi "\n", thay thế bằng ký tự xuống dòng thực sự
  return key.replace(/\\n/g, '\n');
};

// Cấu hình Firebase Admin (sử dụng ở phía server)
export const firebaseAdminConfig = {
  // Ưu tiên sử dụng biến môi trường dành riêng cho server
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || 
    (isDevelopment ? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID : undefined),
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: getPrivateKey(),
  databaseURL: process.env.FIREBASE_DATABASE_URL || 
    (isDevelopment ? process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL : undefined),
};

// Cấu hình Cookie
export const cookieConfig = {
  // Thời gian sống của cookie (mặc định 24 giờ)
  defaultMaxAge: 24 * 60 * 60,
  // Thời gian sống dài (30 ngày) cho tính năng "Ghi nhớ đăng nhập"
  extendedMaxAge: 30 * 24 * 60 * 60,
  // Cookie sử dụng cho xác thực
  authCookieName: 'auth-token',
  // Đảm bảo cookie chỉ được gửi qua HTTPS trong môi trường sản xuất
  secure: isProduction,
  // Ngăn JavaScript truy cập vào cookie (bảo mật hơn)
  httpOnly: true,
  // Giới hạn cookie chỉ được gửi trong các yêu cầu cùng nguồn
  sameSite: 'lax',
};

// Cấu hình đường dẫn
export const routes = {
  home: '/',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  logout: '/logout',
  admin: '/admin',
  profile: '/profile',
  // Thêm các đường dẫn khác khi cần thiết
};

// Các trang không yêu cầu xác thực (public)
export const publicPaths = [
  '/', // Thêm trang chủ vào danh sách công khai để tạm thời debug
  routes.login,
  routes.register,
  routes.forgotPassword,
  routes.resetPassword,
  '/api/auth',
  '/api/auth/verify',
  '/api/csrf',
  '/_next',
  '/favicon.ico',
  '/static',
  '/images',
  // Thêm các đường dẫn công khai khác khi cần thiết
]; 