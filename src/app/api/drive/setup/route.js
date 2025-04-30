import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// File paths to store tokens for two accounts
const TOKEN_PATHS = [
  path.join(process.cwd(), 'drive_token_upload.json'),
  path.join(process.cwd(), 'drive_token_download.json')
];

// Lưu token vào file
function saveToken(token, accountIndex) {
  try {
    fs.writeFileSync(TOKEN_PATHS[accountIndex], JSON.stringify(token, null, 2));
    console.log(`Token saved to ${TOKEN_PATHS[accountIndex]}`);
    return true;
  } catch (error) {
    console.error('Error saving token:', error);
    return false;
  }
}

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

// Lấy thông tin tài khoản từ token
async function getAccountInfo(oauth2Client) {
  try {
    const people = google.people({ version: 'v1', auth: oauth2Client });
    const me = await people.people.get({
      resourceName: 'people/me',
      personFields: 'emailAddresses,names'
    });
    
    const email = me.data.emailAddresses?.[0]?.value || null;
    const name = me.data.names?.[0]?.displayName || null;
    
    return { email, name };
  } catch (error) {
    console.error('Error getting account info:', error);
    return { email: null, name: null };
  }
}

// Route để bắt đầu quá trình xác thực
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const accountIndex = state ? parseInt(state) : parseInt(searchParams.get('account') || '0');
    
    if (accountIndex < 0 || accountIndex > 1) {
      return NextResponse.json({ 
        error: 'Invalid account index. Must be 0 or 1.' 
      }, { status: 400 });
    }
    
    console.log(`GET /api/drive/setup with code: ${code ? `${code.substring(0, 10)}...` : 'null'} for account ${accountIndex}`);
    
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
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile'
        ],
        prompt: 'consent', // Yêu cầu consent mỗi lần để nhận refresh token
        state: accountIndex.toString() // Lưu account index vào state để sử dụng sau khi redirect
      });
      
      console.log('Generated auth URL with Drive scopes for account', accountIndex);
      
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
    const hasDriveScope = tokens.scope.includes('drive');
    console.log('Scope analysis - Drive:', hasDriveScope);
    
    if (!hasDriveScope) {
      return NextResponse.json({ 
        error: 'Missing required Drive scope permissions.' 
      }, { status: 400 });
    }
    
    // Set credentials để lấy thông tin tài khoản
    oauth2Client.setCredentials(tokens);
    const accountInfo = await getAccountInfo(oauth2Client);
    
    // Thêm thông tin vào token
    const enhancedTokens = {
      ...tokens,
      timestamp: Date.now(),
      accountInfo,
      accountIndex
    };
    
    // Lưu token vào file
    console.log(`Saving token to file: ${TOKEN_PATHS[accountIndex]}`);
    const saved = saveToken(enhancedTokens, accountIndex);
    
    if (saved) {
      // Xác nhận token đã được lưu
      console.log('Token saved successfully');
      
      return NextResponse.json({ 
        message: 'Google Drive token successfully saved!',
        tokens: {
          ...tokens,
          access_token: tokens.access_token.substring(0, 10) + '...[redacted]', // Che một phần token vì lý do bảo mật
          refresh_token: tokens.refresh_token ? tokens.refresh_token.substring(0, 10) + '...[redacted]' : null,
          scope: tokens.scope,
          accountInfo
        }
      });
    } else {
      console.error('Failed to save token to file');
      return NextResponse.json({ 
        error: 'Failed to save token' 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error in Drive setup:', error);
    return NextResponse.json({ 
      error: error.message || 'An unexpected error occurred during Drive setup' 
    }, { status: 500 });
  }
}

// Route để kiểm tra trạng thái token cho tất cả các tài khoản
export async function POST(request) {
  try {
    const accounts = [];
    
    // Kiểm tra trạng thái của từng tài khoản
    for (let i = 0; i < TOKEN_PATHS.length; i++) {
      const storedToken = getStoredToken(i);
      
      if (!storedToken) {
        // Không tìm thấy token cho tài khoản này
        continue;
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
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        await drive.about.get({
          fields: 'user'
        });
        
        accounts.push({ 
          index: i,
          valid: true,
          expiryDate: new Date(storedToken.expiry_date),
          email: storedToken.accountInfo?.email || null,
          name: storedToken.accountInfo?.name || null,
          tokenInfo: {
            access_token: storedToken.access_token.substring(0, 10) + '...[redacted]',
            refresh_token: storedToken.refresh_token ? storedToken.refresh_token.substring(0, 10) + '...[redacted]' : null,
            scope: storedToken.scope
          }
        });
      } catch (error) {
        accounts.push({ 
          index: i,
          valid: false,
          email: storedToken.accountInfo?.email || null,
          name: storedToken.accountInfo?.name || null,
          error: error.message,
          tokenInfo: {
            access_token: storedToken.access_token.substring(0, 10) + '...[redacted]',
            refresh_token: storedToken.refresh_token ? storedToken.refresh_token.substring(0, 10) + '...[redacted]' : null,
            scope: storedToken.scope
          }
        });
      }
    }
    
    return NextResponse.json({ accounts });
    
  } catch (error) {
    console.error('Error checking Drive tokens:', error);
    return NextResponse.json({ 
      error: error.message || 'An unexpected error occurred while checking Drive tokens' 
    }, { status: 500 });
  }
}

// Route để xóa token của một tài khoản
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountIndex = parseInt(searchParams.get('account') || '0');
    
    if (accountIndex < 0 || accountIndex > 1) {
      return NextResponse.json({ 
        success: false,
        error: 'Invalid account index. Must be 0 or 1.' 
      }, { status: 400 });
    }
    
    if (fs.existsSync(TOKEN_PATHS[accountIndex])) {
      fs.unlinkSync(TOKEN_PATHS[accountIndex]);
      return NextResponse.json({ 
        success: true,
        message: `Token cho tài khoản ${accountIndex} đã được xóa thành công`
      });
    } else {
      return NextResponse.json({ 
        success: false,
        message: `Không tìm thấy file token cho tài khoản ${accountIndex}`
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