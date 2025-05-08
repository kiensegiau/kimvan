import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import firebaseAdmin from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

/**
 * Đăng nhập với email và mật khẩu
 * @param {string} email - Email người dùng
 * @param {string} password - Mật khẩu
 * @returns {Promise<UserCredential>} - Thông tin đăng nhập
 */
export const loginWithEmailPassword = async (email, password) => {
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error('Lỗi đăng nhập:', error);
    
    // Xử lý mã lỗi Firebase
    let errorMessage = 'Đã xảy ra lỗi khi đăng nhập';
    
    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage = 'Không tìm thấy tài khoản với email này';
        break;
      case 'auth/wrong-password':
        errorMessage = 'Mật khẩu không đúng';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Email không hợp lệ';
        break;
      case 'auth/user-disabled':
        errorMessage = 'Tài khoản đã bị vô hiệu hóa';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Quá nhiều yêu cầu không thành công. Vui lòng thử lại sau';
        break;
    }
    
    throw new Error(errorMessage);
  }
};

/**
 * Đăng ký tài khoản mới
 * @param {string} email - Email người dùng
 * @param {string} password - Mật khẩu
 * @returns {Promise<UserCredential>} - Thông tin đăng ký
 */
export const registerWithEmailPassword = async (email, password) => {
  try {
    return await createUserWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error('Lỗi đăng ký:', error);
    
    // Xử lý mã lỗi Firebase
    let errorMessage = 'Đã xảy ra lỗi khi đăng ký';
    
    switch (error.code) {
      case 'auth/email-already-in-use':
        errorMessage = 'Email đã được sử dụng';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Email không hợp lệ';
        break;
      case 'auth/weak-password':
        errorMessage = 'Mật khẩu quá yếu. Vui lòng sử dụng ít nhất 6 ký tự';
        break;
      case 'auth/operation-not-allowed':
        errorMessage = 'Đăng ký với email/mật khẩu không được cho phép';
        break;
    }
    
    throw new Error(errorMessage);
  }
};

/**
 * Đăng xuất người dùng hiện tại
 * @returns {Promise<void>}
 */
export const logout = async () => {
  try {
    return await signOut(auth);
  } catch (error) {
    console.error('Lỗi đăng xuất:', error);
    throw new Error('Đã xảy ra lỗi khi đăng xuất');
  }
};

/**
 * Gửi email đặt lại mật khẩu
 * @param {string} email - Email người dùng
 * @returns {Promise<void>}
 */
export const resetPassword = async (email) => {
  try {
    return await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error('Lỗi gửi email đặt lại mật khẩu:', error);
    
    // Xử lý mã lỗi Firebase
    let errorMessage = 'Đã xảy ra lỗi khi gửi email đặt lại mật khẩu';
    
    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage = 'Không tìm thấy tài khoản với email này';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Email không hợp lệ';
        break;
      case 'auth/missing-android-pkg-name':
      case 'auth/missing-continue-uri':
      case 'auth/missing-ios-bundle-id':
      case 'auth/invalid-continue-uri':
      case 'auth/unauthorized-continue-uri':
        errorMessage = 'Lỗi cấu hình. Vui lòng liên hệ quản trị viên';
        break;
    }
    
    throw new Error(errorMessage);
  }
};

/**
 * Lấy người dùng hiện tại
 * @returns {User|null} - Người dùng hiện tại hoặc null nếu chưa đăng nhập
 */
export const getCurrentUser = () => {
  return auth.currentUser;
};

/**
 * Theo dõi thay đổi trạng thái xác thực
 * @param {function} callback - Hàm callback nhận người dùng (User hoặc null)
 * @returns {function} - Hàm hủy theo dõi
 */
export const onAuthStateChanged = (callback) => {
  return auth.onAuthStateChanged(callback);
};

// Hàm lấy token từ cookies
export async function getToken() {
  const cookieStore = cookies();
  const token = cookieStore.get('auth-token')?.value;
  return token || null;
}

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

// Xóa token hết hạn mỗi phút
setInterval(cleanupTokenCache, 60 * 1000);

// Hàm xác thực token được tối ưu với cache
export async function verifyAuthToken(token) {
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
    
    // Nếu không có trong cache hoặc đã hết hạn, xác thực token mới
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
    const user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      displayName: decodedToken.name,
      photoURL: decodedToken.picture,
      role: decodedToken.role || 'user',
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

// Kiểm tra xem người dùng đã đăng nhập chưa
export async function isAuthenticated() {
  const token = await getToken();
  if (!token) return false;
  
  const user = await verifyAuthToken(token);
  return !!user;
}

// Kiểm tra vai trò của người dùng
export async function hasRole(requiredRole = 'user') {
  const token = await getToken();
  if (!token) return false;
  
  const user = await verifyAuthToken(token);
  if (!user) return false;
  
  // Nếu role là admin, cho phép truy cập mọi nơi
  if (user.role === 'admin') return true;
  
  // Nếu role là staff, cho phép truy cập quyền staff và user
  if (user.role === 'staff' && requiredRole === 'user') return true;
  
  // Trường hợp khác, so sánh trực tiếp
  return user.role === requiredRole;
} 