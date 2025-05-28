import { cookies } from 'next/headers';
import firebaseAdmin from '@/lib/firebase-admin';

// Thêm system cache cho token để tăng hiệu suất
// Cache theo cặp {token: {user, timestamp}}
const tokenCache = new Map();
const TOKEN_CACHE_MAX_AGE = 5 * 60 * 1000; // 5 phút

// Hàm kiểm tra và xóa các token hết hạn trong cache
function cleanupTokenCache() {
  const now = Date.now();
  for (const [token, data] of tokenCache.entries()) {
    if (now - data.timestamp > TOKEN_CACHE_MAX_AGE) {
      tokenCache.delete(token);
    }
  }
}

// Xóa token hết hạn mỗi phút (chỉ chạy trên server)
setInterval(cleanupTokenCache, 60 * 1000);

// Hàm lấy token từ cookies (server-side)
export async function getServerToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  return token || null;
}

// Hàm xác thực token được tối ưu với cache
export async function verifyServerAuthToken(token) {
  if (!token) return null;
  
  try {
    // Kiểm tra cache trước
    if (tokenCache.has(token)) {
      const cachedData = tokenCache.get(token);
      const now = Date.now();
      
      // Nếu token trong cache vẫn còn hạn, sử dụng lại
      if (now - cachedData.timestamp < TOKEN_CACHE_MAX_AGE) {
        return cachedData.user;
      } else {
        // Xóa token hết hạn
        tokenCache.delete(token);
      }
    }
    
    // Xác thực token với Firebase Admin
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;
    
    // Lấy thông tin người dùng từ uid
    const userRecord = await firebaseAdmin.auth().getUser(uid);
    
    const user = {
      uid: userRecord.uid,
      email: userRecord.email,
      emailVerified: userRecord.emailVerified,
      displayName: userRecord.displayName,
      photoURL: userRecord.photoURL,
      role: userRecord.customClaims?.role || 'user',
      // Thêm thông tin về thời gian hết hạn của token
      tokenExpiration: decodedToken.exp * 1000, // Chuyển từ giây sang mili giây
    };
    
    // Lưu kết quả xác thực vào cache
    tokenCache.set(token, {
      user,
      timestamp: Date.now()
    });
    
    return user;
  } catch (error) {
    console.error('Lỗi xác thực token:', error.message);
    return null;
  }
}

// Hàm kiểm tra token sắp hết hạn
export async function isTokenExpiringSoon(token, thresholdMinutes = 30) {
  if (!token) return true;
  
  try {
    const user = await verifyServerAuthToken(token);
    if (!user || !user.tokenExpiration) return true;
    
    const now = Date.now();
    const thresholdMs = thresholdMinutes * 60 * 1000;
    
    // Token sắp hết hạn nếu thời gian còn lại nhỏ hơn ngưỡng
    return (user.tokenExpiration - now) < thresholdMs;
  } catch (error) {
    console.error('Lỗi kiểm tra thời hạn token:', error);
    return true;
  }
}

// Kiểm tra xem người dùng đã đăng nhập chưa (server-side)
export async function isServerAuthenticated() {
  const token = await getServerToken();
  if (!token) return false;
  
  const user = await verifyServerAuthToken(token);
  return !!user;
}

// Kiểm tra vai trò của người dùng (server-side)
export async function hasServerRole(requiredRole = 'user') {
  const token = await getServerToken();
  if (!token) return false;
  
  const user = await verifyServerAuthToken(token);
  if (!user) return false;
  
  // Nếu role là admin, cho phép truy cập mọi nơi
  if (user.role === 'admin') return true;
  
  // Nếu role là staff, cho phép truy cập quyền staff và user
  if (user.role === 'staff' && requiredRole === 'user') return true;
  
  // Trường hợp khác, so sánh trực tiếp
  return user.role === requiredRole;
} 