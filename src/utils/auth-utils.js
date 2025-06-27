import admin from '@/lib/firebase-admin';
import path from 'path';
import fs from 'fs';
import fetch from 'node-fetch';

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

/**
 * Lấy access token cho Google Drive API với cơ chế retry
 * @returns {Promise<string>} Access token
 */
export async function getAccessToken() {
  const MAX_RETRIES = 3;
  let lastError = null;
  
  for (let retryCount = 0; retryCount <= MAX_RETRIES; retryCount++) {
    try {
      if (retryCount > 0) {
        console.log(`Thử lại lần ${retryCount}/${MAX_RETRIES} để lấy access token`);
        // Đợi thời gian tăng dần trước khi thử lại (exponential backoff)
        const delayTime = Math.min(Math.pow(2, retryCount) * 1000, 10000); // tối đa 10 giây
        console.log(`Đợi ${delayTime/1000} giây trước khi thử lại...`);
        await new Promise(resolve => setTimeout(resolve, delayTime));
      }
      
      // Đọc token từ file
      const tokenPath = path.join(process.cwd(), 'drive_token_download.json');
      const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
      
      // Kiểm tra xem token có hết hạn chưa
      const expiryDate = tokenData.expiry_date;
      const now = Date.now();
      
      // Nếu token còn hạn, trả về
      if (expiryDate > now + 60000) { // Thêm 60 giây buffer
        return tokenData.access_token;
      }
      
      // Nếu token hết hạn, refresh token
      console.log('Token hết hạn, đang refresh...');
      const refreshToken = tokenData.refresh_token;
      
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Lỗi khi refresh token: ${response.status} - ${errorText}`);
      }
      
      const newTokenData = await response.json();
      
      // Cập nhật token data với token mới
      const updatedTokenData = {
        ...tokenData,
        access_token: newTokenData.access_token,
        expiry_date: Date.now() + (newTokenData.expires_in * 1000),
      };
      
      // Lưu token mới vào file
      fs.writeFileSync(tokenPath, JSON.stringify(updatedTokenData, null, 2));
      console.log('Đã refresh và lưu token mới');
      
      return newTokenData.access_token;
    } catch (error) {
      lastError = error;
      console.error(`Lỗi khi lấy access token (lần thử ${retryCount + 1}/${MAX_RETRIES + 1}):`, error.message);
      
      // Nếu đã thử lại đủ số lần, ném lỗi
      if (retryCount === MAX_RETRIES) {
        throw new Error(`Không thể lấy access token sau ${MAX_RETRIES + 1} lần thử: ${error.message}`);
      }
    }
  }
} 