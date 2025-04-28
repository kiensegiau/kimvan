import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// File path to store token
const TOKEN_PATH = path.join(process.cwd(), 'youtube_token.json');

// Lưu token vào file
function saveToken(token) {
  try {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
    console.log('Token saved to', TOKEN_PATH);
    return true;
  } catch (error) {
    console.error('Error saving token:', error);
    return false;
  }
}

// Đọc token từ file
function getStoredToken() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const tokenContent = fs.readFileSync(TOKEN_PATH, 'utf8');
      return JSON.parse(tokenContent);
    }
  } catch (error) {
    console.error('Error reading token file:', error);
  }
  return null;
}

// Route để bắt đầu quá trình xác thực
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    
    console.log('GET /api/youtube/setup with code:', code ? `${code.substring(0, 10)}...` : 'null');
    
    // Tạo OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Nếu không có code, tạo URL xác thực
    if (!code) {
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/youtube.upload',
          'https://www.googleapis.com/auth/drive'
        ],
        prompt: 'consent' // Yêu cầu consent mỗi lần để nhận refresh token
      });
      
      console.log('Generated auth URL with YouTube and Drive scopes');
      
      return NextResponse.json({ 
        message: 'Authorization required', 
        authUrl 
      });
    }
    
    // Đổi code lấy token
    console.log('Exchanging code for token...');
    const { tokens } = await oauth2Client.getToken(code);
    console.log('Token received successfully, scope:', tokens.scope);
    
    // Xác định phạm vi quyền từ scope string
    const hasYoutubeScope = tokens.scope.includes('youtube');
    const hasDriveScope = tokens.scope.includes('drive');
    console.log('Scope analysis - YouTube:', hasYoutubeScope, 'Drive:', hasDriveScope);
    
    // Thêm thông tin vào token
    const enhancedTokens = {
      ...tokens,
      timestamp: Date.now(),
      scopes: {
        youtube: hasYoutubeScope,
        drive: hasDriveScope
      }
    };
    
    // Lưu token vào file
    console.log('Saving token to file:', TOKEN_PATH);
    const saved = saveToken(enhancedTokens);
    
    if (saved) {
      // Xác nhận token đã được lưu
      console.log('Token saved successfully');
      
      return NextResponse.json({ 
        message: 'YouTube token successfully saved!',
        tokens: {
          ...tokens,
          access_token: tokens.access_token.substring(0, 10) + '...[redacted]', // Che một phần token vì lý do bảo mật
          refresh_token: tokens.refresh_token ? tokens.refresh_token.substring(0, 10) + '...[redacted]' : null,
          scope: tokens.scope,
          scopes: enhancedTokens.scopes
        }
      });
    } else {
      console.error('Failed to save token to file');
      return NextResponse.json({ 
        error: 'Failed to save token' 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error in YouTube setup:', error);
    return NextResponse.json({ 
      error: error.message || 'An unexpected error occurred during YouTube setup' 
    }, { status: 500 });
  }
}

// Route để kiểm tra trạng thái token
export async function POST(request) {
  try {
    const storedToken = getStoredToken();
    
    if (!storedToken) {
      return NextResponse.json({ 
        exists: false,
        message: 'No YouTube token found'
      });
    }
    
    // Tạo OAuth2 client và thử kiểm tra token
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials(storedToken);
    
    try {
      // Thử gọi một API đơn giản để kiểm tra token
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
      await youtube.channels.list({
        part: 'snippet',
        mine: true
      });
      
      return NextResponse.json({ 
        exists: true,
        valid: true,
        expiryDate: new Date(storedToken.expiry_date),
        tokenInfo: {
          access_token: storedToken.access_token.substring(0, 10) + '...[redacted]',
          refresh_token: storedToken.refresh_token ? storedToken.refresh_token.substring(0, 10) + '...[redacted]' : null,
          scope: storedToken.scope
        }
      });
    } catch (error) {
      return NextResponse.json({ 
        exists: true,
        valid: false,
        error: error.message,
        tokenInfo: {
          access_token: storedToken.access_token.substring(0, 10) + '...[redacted]',
          refresh_token: storedToken.refresh_token ? storedToken.refresh_token.substring(0, 10) + '...[redacted]' : null
        }
      });
    }
    
  } catch (error) {
    console.error('Error checking YouTube token:', error);
    return NextResponse.json({ 
      error: error.message || 'An unexpected error occurred while checking YouTube token' 
    }, { status: 500 });
  }
}

// Route để xóa token hiện tại
export async function DELETE(request) {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      fs.unlinkSync(TOKEN_PATH);
      return NextResponse.json({ 
        success: true,
        message: 'Token đã được xóa thành công'
      });
    } else {
      return NextResponse.json({ 
        success: false,
        message: 'Không tìm thấy file token'
      });
    }
  } catch (error) {
    console.error('Error deleting token file:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Đã xảy ra lỗi khi xóa token'
    }, { status: 500 });
  }
} 