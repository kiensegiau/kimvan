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

// Tự động phát hiện nếu đang sử dụng HTTPS
const isHttpsEnabled = () => {
  // Trong môi trường phát triển, không yêu cầu secure cookie
  if (isDevelopment) return false;
  
  // Kiểm tra nếu biến môi trường chỉ định rõ ràng
  if (process.env.HTTPS_ENABLED === 'true') return true;
  if (process.env.HTTPS_ENABLED === 'false') return false;
  
  // Kiểm tra URL cơ sở nếu có
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
  if (baseUrl.startsWith('https://')) return true;
  
  // Mặc định để an toàn, chỉ bật secure trong môi trường production khi không thể xác định
  return false;
};

// Cấu hình Cookie
export const cookieConfig = {
  authCookieName: 'auth-token',
  defaultMaxAge: 60 * 60 * 24 * 30, // 30 ngày (thay vì 7 ngày)
  extendedMaxAge: 60 * 60 * 24 * 180, // 180 ngày (thay vì 90 ngày)
  // Tự động phát hiện xem có đang sử dụng HTTPS hay không
  secure: isHttpsEnabled(),
  httpOnly: true,
  sameSite: 'lax'
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
  // Trang đăng nhập
  '/login',
  
  // Quên mật khẩu
  '/forgot-password',
  '/reset-password',
  
  // API cần thiết cho đăng nhập
  '/api/auth/login',
  '/api/auth/verify',
  '/api/auth/refresh-token',
  '/api/auth/user-role',
  '/api/auth/logout',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/admin/check-permission',
  '/api/csrf',
  
  // API Drive không yêu cầu xác thực
  '/api/drive/remove-watermark',
  '/api/drive/check-file-type',
  '/api/drive/upload',
  '/api/courses/process-all-drive',
  
  // API không yêu cầu xác thực
  '/api/spreadsheets',
  
  // Tài nguyên tĩnh
  '/_next',
  '/favicon.ico',
  '/static',
  '/images',
  '/fonts',
  '/assets',
]; 