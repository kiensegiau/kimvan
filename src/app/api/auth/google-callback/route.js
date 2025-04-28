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

export async function GET(request) {
  try {
    // Lấy code từ URL
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const scope = searchParams.get('scope');
    
    if (!code) {
      return NextResponse.json({ 
        error: 'No code provided in callback' 
      }, { status: 400 });
    }
    
    console.log('Received code from Google OAuth callback', { code, scope });
    
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
    
    const enhancedTokens = {
      ...tokens,
      timestamp: Date.now(),
      scopes: {
        youtube: hasYoutubeScope,
        drive: hasDriveScope
      }
    };
    
    // Lưu token vào file
    const saved = saveToken(enhancedTokens);
    
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