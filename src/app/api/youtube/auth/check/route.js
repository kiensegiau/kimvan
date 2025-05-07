import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Đường dẫn hồ sơ Chrome cố định và cookies
const CHROME_PROFILE_PATH = path.join(process.env.USERPROFILE || process.env.HOME, 'youtube-upload-profile');
const COOKIES_PATH = path.join(process.cwd(), 'youtube_cookies.json');

/**
 * API endpoint để kiểm tra trạng thái đăng nhập YouTube
 */
export async function GET(request) {
  try {
    // Kiểm tra xem hồ sơ Chrome tồn tại không
    const profileExists = fs.existsSync(CHROME_PROFILE_PATH);
    
    // Kiểm tra xem file cookies tồn tại không
    const cookiesExist = fs.existsSync(COOKIES_PATH);
    
    // Đọc thông tin cookies nếu có
    let cookiesInfo = null;
    if (cookiesExist) {
      try {
        const cookiesData = fs.readFileSync(COOKIES_PATH, 'utf8');
        const cookies = JSON.parse(cookiesData);
        
        // Lấy thông tin cơ bản
        cookiesInfo = {
          count: cookies.length,
          domains: [...new Set(cookies.map(c => c.domain))],
          hasYoutubeCookies: cookies.some(c => c.domain.includes('youtube')),
          timestamp: fs.statSync(COOKIES_PATH).mtime
        };
      } catch (err) {
        console.error('Lỗi đọc file cookies:', err);
      }
    }
    
    // Trả về thông tin trạng thái
    return NextResponse.json({
      success: true,
      loggedIn: profileExists && cookiesExist,
      profileExists,
      cookiesExist,
      profilePath: CHROME_PROFILE_PATH,
      cookiesPath: COOKIES_PATH,
      cookiesInfo
    });
  } catch (error) {
    console.error('Lỗi kiểm tra đăng nhập YouTube:', error);
    return NextResponse.json({
      success: false,
      message: 'Lỗi kiểm tra đăng nhập YouTube',
      error: error.message
    }, { status: 500 });
  }
} 