import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// File paths to store tokens
const TOKEN_PATHS = [
  path.join(process.cwd(), 'drive_token_upload.json'),
  path.join(process.cwd(), 'drive_token_download.json')
];

// Thời gian buffer trước khi cần làm mới (5 phút)
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

// Thời gian kiểm tra token (30 phút một lần)
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

// Đánh dấu service đã khởi động chưa
let isServiceRunning = false;
let intervalId = null;

// Đọc token từ file
function getStoredToken(accountIndex) {
  try {
    if (fs.existsSync(TOKEN_PATHS[accountIndex])) {
      const tokenContent = fs.readFileSync(TOKEN_PATHS[accountIndex], 'utf8');
      return JSON.parse(tokenContent);
    }
  } catch (error) {
    console.error(`Error reading token file for account ${accountIndex}:`, error);
  }
  return null;
}

// Lưu token vào file
function saveToken(token, accountIndex) {
  try {
    fs.writeFileSync(TOKEN_PATHS[accountIndex], JSON.stringify(token, null, 2));
    console.log(`Token refreshed and saved to ${TOKEN_PATHS[accountIndex]}`);
    return true;
  } catch (error) {
    console.error('Error saving refreshed token:', error);
    return false;
  }
}

// Kiểm tra và làm mới token nếu cần
async function checkAndRefreshToken(accountIndex) {
  const token = getStoredToken(accountIndex);
  
  if (!token || !token.refresh_token) {
    console.log(`No valid token found for account ${accountIndex}`);
    return false;
  }
  
  // Kiểm tra xem token có sắp hết hạn không
  const now = Date.now();
  const expiryTime = token.expiry_date;
  
  // Nếu token vẫn còn hạn và không cần làm mới
  if (expiryTime && expiryTime > now + REFRESH_BUFFER_MS) {
    console.log(`Token for account ${accountIndex} is still valid until ${new Date(expiryTime).toLocaleString()}`);
    return true;
  }
  
  // Làm mới token
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials({
      refresh_token: token.refresh_token
    });
    
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    // Gộp token mới với token cũ để giữ lại thông tin quan trọng
    const newToken = {
      ...token,
      ...credentials,
      timestamp: Date.now()
    };
    
    // Lưu token mới
    saveToken(newToken, accountIndex);
    
    console.log(`Token refreshed successfully for account ${accountIndex} (${token.accountInfo?.email || 'unknown'})`);
    return true;
    
  } catch (error) {
    console.error(`Error refreshing token for account ${accountIndex}:`, error);
    return false;
  }
}

// Kiểm tra và làm mới toàn bộ token
async function refreshAllTokens() {
  console.log(`[${new Date().toISOString()}] Running scheduled token refresh check...`);
  
  for (let i = 0; i < TOKEN_PATHS.length; i++) {
    await checkAndRefreshToken(i);
  }
}

// Khởi động service làm mới token
export function startTokenRefreshService() {
  // Nếu service đã chạy, không khởi động lại
  if (isServiceRunning) {
    console.log('Token refresh service is already running');
    return;
  }
  
  console.log('Starting token refresh service...');
  
  // Kiểm tra và làm mới token ngay lập tức
  refreshAllTokens();
  
  // Thiết lập interval để kiểm tra và làm mới token định kỳ
  intervalId = setInterval(refreshAllTokens, CHECK_INTERVAL_MS);
  isServiceRunning = true;
  
  console.log(`Token refresh service started. Tokens will be checked every ${CHECK_INTERVAL_MS / (60 * 1000)} minutes.`);
}

// Dừng service
export function stopTokenRefreshService() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    isServiceRunning = false;
    console.log('Token refresh service stopped');
  }
} 