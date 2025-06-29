import { cookies } from 'next/headers';
import firebaseAdmin from '@/lib/firebase-admin';
import { cookieConfig } from '@/config/env-config';

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
  const token = cookieStore.get(cookieConfig.authCookieName)?.value;
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
    let decodedToken;
    try {
      decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
    } catch (tokenError) {
      console.error('❌ verifyServerAuthToken: Lỗi xác thực token:', tokenError.message);
      
      // Kiểm tra nếu lỗi là do token hết hạn
      if (tokenError.code === 'auth/id-token-expired') {
        return null;
      }
      
      throw tokenError;
    }
    
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
    console.error('❌ verifyServerAuthToken: Lỗi xác thực token:', error.message);
    return null;
  }
}

/**
 * Thử refresh token khi token hiện tại đã hết hạn
 * @param {string} currentToken - Token hiện tại đã hết hạn
 * @returns {Promise<{success: boolean, token: string|null}>} - Kết quả refresh token
 */
export async function tryRefreshToken(currentToken) {
  try {
    // Lấy thông tin từ token đã hết hạn
    let uid = null;
    try {
      // Giải mã token mà không kiểm tra chữ ký hoặc thời gian hết hạn
      const decodedToken = firebaseAdmin.auth().verifyIdToken(currentToken, true);
      uid = decodedToken.uid;
    } catch (decodeError) {
      console.error('❌ tryRefreshToken: Không thể giải mã token:', decodeError.message);
    }
    
    if (!uid) {
      return { success: false, token: null };
    }
    
    // Tạo custom token mới
    const customToken = await firebaseAdmin.auth().createCustomToken(uid);
    
    // Đổi custom token thành ID token
    const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!firebaseApiKey) {
      throw new Error('Firebase API Key không được cấu hình');
    }
    
    const tokenResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${firebaseApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: customToken,
          returnSecureToken: true,
        }),
      }
    );
    
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(`Không thể tạo ID token mới: ${JSON.stringify(tokenData.error)}`);
    }
    
    // Lấy ID token mới
    const newIdToken = tokenData.idToken;
    
    return { success: true, token: newIdToken };
  } catch (error) {
    console.error('❌ tryRefreshToken: Lỗi khi refresh token:', error.message);
    return { success: false, token: null, error: error.message };
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