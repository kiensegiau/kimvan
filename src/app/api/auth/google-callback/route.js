import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// File paths to store tokens for different accounts
const TOKEN_PATHS = {
  youtube: path.join(process.cwd(), 'youtube_token.json'),
  drive: [
    path.join(process.cwd(), 'drive_token_upload.json'),
    path.join(process.cwd(), 'drive_token_download.json')
  ]
};

// Lưu token vào file
function saveToken(token, type, accountIndex = 0) {
  try {
    const tokenPath = type === 'drive' ? TOKEN_PATHS.drive[accountIndex] : TOKEN_PATHS.youtube;
    fs.writeFileSync(tokenPath, JSON.stringify(token, null, 2));
    console.log('Token saved to', tokenPath);
    return true;
  } catch (error) {
    console.error('Error saving token:', error);
    return false;
  }
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

export async function GET(request) {
  try {
    // Lấy code từ URL
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const scope = searchParams.get('scope');
    const state = searchParams.get('state');
    
    // Xác định loại token và tài khoản
    let tokenType = 'youtube';
    let accountIndex = 0;
    
    if (state) {
      // Nếu state là số, đây là tài khoản Google Drive
      if (!isNaN(parseInt(state))) {
        tokenType = 'drive';
        accountIndex = parseInt(state);
        if (accountIndex < 0 || accountIndex > 1) {
          accountIndex = 0; // Default to first account if invalid
        }
      }
    }
    
    if (!code) {
      return NextResponse.json({ 
        error: 'No code provided in callback' 
      }, { status: 400 });
    }
    
    console.log(`Received code from Google OAuth callback for ${tokenType} ${tokenType === 'drive' ? `account ${accountIndex}` : ''}`, { code, scope });
    
    // Tạo OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Đổi code lấy token
    const { tokens } = await oauth2Client.getToken(code);
    
    // Xác định phạm vi quyền và lưu thông tin này vào token
    const tokenScopes = scope.split(' ');
    const hasYoutubeScope = tokenScopes.some(s => s.includes('youtube'));
    const hasDriveScope = tokenScopes.some(s => s.includes('drive'));
    
    // Set credentials để lấy thông tin tài khoản nếu là Drive
    let accountInfo = null;
    if (tokenType === 'drive' && hasDriveScope) {
      oauth2Client.setCredentials(tokens);
      accountInfo = await getAccountInfo(oauth2Client);
    }
    
    const enhancedTokens = {
      ...tokens,
      timestamp: Date.now(),
      scopes: {
        youtube: hasYoutubeScope,
        drive: hasDriveScope
      },
      ...(accountInfo && { accountInfo }),
      ...(tokenType === 'drive' && { accountIndex })
    };
    
    // Lưu token vào file
    const saved = saveToken(enhancedTokens, tokenType, accountIndex);
    
    if (saved) {
      // Redirect to setup page in admin
      return NextResponse.redirect(new URL('/admin/youtube-setup', request.url));
    } else {
      return NextResponse.json({ 
        error: 'Failed to save token' 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error in Google callback:', error);
    return NextResponse.json({ 
      error: error.message || 'An unexpected error occurred during Google callback' 
    }, { status: 500 });
  }
} 