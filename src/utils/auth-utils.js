import admin from '@/lib/firebase-admin';

/**
 * Xác thực Firebase token
 * @param {string} token - Firebase ID token
 * @returns {Promise<object|null>} - Đối tượng đã giải mã hoặc null nếu không hợp lệ
 */
export async function verifyToken(token) {
  try {
    console.log('🔐 Auth Utils - Bắt đầu xác thực token');
    
    // Xác thực token bằng Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(token);
    console.log('🔐 Auth Utils - Token hợp lệ, uid:', decodedToken.uid);
    return decodedToken;
  } catch (error) {
    console.error('❌ Auth Utils - Lỗi xác thực token:', error);
    return null;
  }
}

/**
 * Kiểm tra xem người dùng có quyền admin không
 * @param {string} email - Email người dùng
 * @returns {boolean} - true nếu có quyền admin
 */
export function isAdminEmail(email) {
  const isAdmin = email === 'phanhuukien2001@gmail.com';
  console.log(`🔐 Auth Utils - Kiểm tra email admin: ${email}, Kết quả: ${isAdmin}`);
  return isAdmin;
} 