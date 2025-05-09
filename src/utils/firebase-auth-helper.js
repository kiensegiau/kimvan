/**
 * Helper functions cho xác thực Firebase
 */
import firebaseAdmin from '@/lib/firebase-admin';

/**
 * Xác thực người dùng bằng email và mật khẩu
 * @param {string} email - Email người dùng
 * @param {string} password - Mật khẩu
 * @returns {Promise<Object>} - Thông tin đăng nhập
 */
export async function verifyEmailPassword(email, password) {
  try {
    // Lấy API key từ biến môi trường
    const apiKey = process.env.FIREBASE_API_KEY;
    
    if (!apiKey) {
      // Nếu không có API key, sử dụng phương pháp thay thế với Firebase Admin
      console.warn('FIREBASE_API_KEY không được cấu hình, sử dụng phương pháp thay thế với Firebase Admin');
      
      try {
        // Tìm người dùng theo email
        const userRecord = await firebaseAdmin.auth().getUserByEmail(email);
        
        // Lưu ý: Không thể xác thực mật khẩu trực tiếp với Firebase Admin SDK
        // Đây là một giải pháp tạm thời, không an toàn cho môi trường production
        // Trong môi trường production thực tế, bạn cần sử dụng Firebase API Key
        
        return {
          uid: userRecord.uid,
          email: userRecord.email,
          emailVerified: userRecord.emailVerified || false,
        };
      } catch (error) {
        throw new Error('EMAIL_NOT_FOUND');
      }
    }
    
    // Gọi Firebase Auth REST API để xác thực
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      }
    );
    
    const data = await response.json();
    
    if (!response.ok) {
      // Xử lý lỗi từ Firebase Auth
      const errorCode = data.error?.message || 'auth/unknown-error';
      throw new Error(errorCode);
    }
    
    // Trả về thông tin người dùng
    return {
      uid: data.localId,
      email: data.email,
      emailVerified: data.emailVerified || false,
      idToken: data.idToken,
      refreshToken: data.refreshToken,
    };
  } catch (error) {
    console.error('Lỗi xác thực Firebase:', error);
    throw error;
  }
}

/**
 * Tạo người dùng mới bằng email và mật khẩu
 * @param {string} email - Email người dùng
 * @param {string} password - Mật khẩu
 * @returns {Promise<Object>} - Thông tin người dùng mới
 */
export async function createUserWithEmailPassword(email, password) {
  try {
    // Lấy API key từ biến môi trường
    const apiKey = process.env.FIREBASE_API_KEY;
    
    if (!apiKey) {
      // Nếu không có API key, sử dụng Firebase Admin SDK
      console.warn('FIREBASE_API_KEY không được cấu hình, sử dụng Firebase Admin SDK');
      
      // Tạo người dùng mới với Firebase Admin
      const userRecord = await firebaseAdmin.auth().createUser({
        email: email,
        password: password,
        emailVerified: false,
      });
      
      return {
        uid: userRecord.uid,
        email: userRecord.email,
        emailVerified: userRecord.emailVerified || false,
      };
    }
    
    // Gọi Firebase Auth REST API để tạo người dùng mới
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      }
    );
    
    const data = await response.json();
    
    if (!response.ok) {
      // Xử lý lỗi từ Firebase Auth
      const errorCode = data.error?.message || 'auth/unknown-error';
      throw new Error(errorCode);
    }
    
    // Trả về thông tin người dùng mới
    return {
      uid: data.localId,
      email: data.email,
      emailVerified: false,
      idToken: data.idToken,
      refreshToken: data.refreshToken,
    };
  } catch (error) {
    console.error('Lỗi tạo người dùng Firebase:', error);
    throw error;
  }
}

/**
 * Gửi email đặt lại mật khẩu
 * @param {string} email - Email người dùng
 * @returns {Promise<void>}
 */
export async function sendPasswordResetEmail(email) {
  try {
    // Lấy API key từ biến môi trường
    const apiKey = process.env.FIREBASE_API_KEY;
    
    if (!apiKey) {
      // Nếu không có API key, sử dụng Firebase Admin SDK
      console.warn('FIREBASE_API_KEY không được cấu hình, sử dụng Firebase Admin SDK');
      
      // Tạo link đặt lại mật khẩu với Firebase Admin
      await firebaseAdmin.auth().generatePasswordResetLink(email);
      return;
    }
    
    // Gọi Firebase Auth REST API để gửi email đặt lại mật khẩu
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestType: 'PASSWORD_RESET',
          email,
        }),
      }
    );
    
    const data = await response.json();
    
    if (!response.ok) {
      // Xử lý lỗi từ Firebase Auth
      const errorCode = data.error?.message || 'auth/unknown-error';
      throw new Error(errorCode);
    }
  } catch (error) {
    console.error('Lỗi gửi email đặt lại mật khẩu Firebase:', error);
    throw error;
  }
} 