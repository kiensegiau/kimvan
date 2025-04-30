import { NextResponse } from 'next/server';
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
    return {
      success: false,
      accountIndex,
      message: `No valid token found for account ${accountIndex}`
    };
  }
  
  // Kiểm tra xem token có sắp hết hạn không
  const now = Date.now();
  const expiryTime = token.expiry_date;
  
  // Nếu token vẫn còn hạn và không cần làm mới
  if (expiryTime && expiryTime > now + REFRESH_BUFFER_MS) {
    return {
      success: true,
      accountIndex,
      refreshed: false,
      message: `Token for account ${accountIndex} is still valid until ${new Date(expiryTime).toLocaleString()}`
    };
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
    
    return {
      success: true,
      accountIndex,
      refreshed: true,
      email: token.accountInfo?.email,
      message: `Token refreshed successfully for account ${accountIndex} (${token.accountInfo?.email || 'unknown'})`
    };
    
  } catch (error) {
    console.error(`Error refreshing token for account ${accountIndex}:`, error);
    return {
      success: false,
      accountIndex,
      error: error.message,
      message: `Failed to refresh token for account ${accountIndex}: ${error.message}`
    };
  }
}

// API route để làm mới token
export async function GET() {
  try {
    const results = [];
    
    // Làm mới token cho cả hai tài khoản
    for (let i = 0; i < TOKEN_PATHS.length; i++) {
      const result = await checkAndRefreshToken(i);
      results.push(result);
    }
    
    return NextResponse.json({ 
      success: true, 
      timestamp: new Date().toISOString(),
      results 
    });
    
  } catch (error) {
    console.error('Error in refresh tokens API:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message || 'An unexpected error occurred while refreshing tokens'
    }, { status: 500 });
  }
} 