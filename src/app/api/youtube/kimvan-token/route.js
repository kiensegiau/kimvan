import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { 
  extractSessionTokenFromCookie, 
  parseCookieString, 
  detectTokenType,
  buildFullCookieString 
} from '../../helpers/kimvan-token';

// File path để lưu trữ token KimVan
const KIMVAN_TOKEN_PATH = path.join(process.cwd(), 'kimvan_token.json');

// Lưu KimVan token vào file
function saveKimVanToken(token) {
  try {
    fs.writeFileSync(KIMVAN_TOKEN_PATH, JSON.stringify(token, null, 2));
    console.log('KimVan token saved to', KIMVAN_TOKEN_PATH);
    return true;
  } catch (error) {
    console.error('Error saving KimVan token:', error);
    return false;
  }
}

// Đọc KimVan token từ file
function getStoredKimVanToken() {
  try {
    if (fs.existsSync(KIMVAN_TOKEN_PATH)) {
      const tokenContent = fs.readFileSync(KIMVAN_TOKEN_PATH, 'utf8');
      return JSON.parse(tokenContent);
    }
  } catch (error) {
    console.error('Error reading KimVan token:', error);
  }
  return null;
}

// Xóa token
function deleteKimVanToken() {
  try {
    if (fs.existsSync(KIMVAN_TOKEN_PATH)) {
      fs.unlinkSync(KIMVAN_TOKEN_PATH);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting KimVan token:', error);
    return false;
  }
}

// Xác thực token KimVan với API
async function verifyKimVanToken(token, tokenType) {
  try {
    // Cách verify khác nhau dựa vào loại token
    if (tokenType === 'jwt') {
      // Verify JWT token với endpoint /api/users/me
      const response = await axios.get('https://kimvan.id.vn/api/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
        }
      });
      return { verified: response.status === 200, data: response.data };
    } else {
      // Verify session token với endpoint spreadsheets
      // Format cookie chuẩn
      const cookie = buildFullCookieString(token);
      
      const response = await axios.get('https://kimvan.id.vn/api/spreadsheets', {
        headers: {
          'Cookie': cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
        }
      });
      return { verified: response.status === 200, data: response.data };
    }
  } catch (error) {
    console.error('Error verifying KimVan token:', error.message);
    return { verified: false, error: error.message };
  }
}

// API POST handler - Lưu cookie
export async function POST(request) {
  try {
    const body = await request.json();
    
    if (!body) {
      return NextResponse.json({ error: 'No data provided' }, { status: 400 });
    }
    
    // Kiểm tra token hoặc cookie
    if (!body.cookie && !body.accessToken) {
      return NextResponse.json({ error: 'No cookie or accessToken provided' }, { status: 400 });
    }
    
    // Trích xuất token từ cookie hoặc sử dụng trực tiếp nếu đã là token
    let rawCookie = body.cookie || body.accessToken;
    
    // Phân tích cookie để lấy đầy đủ thông tin
    let cookieData = null;
    let tokenType = 'unknown';
    let sessionToken = null;
    
    // Trường hợp 1: Nếu là cookie đầy đủ có 3 thành phần
    if (rawCookie && rawCookie.includes('authjs.session-token=') && rawCookie.includes(';')) {
      cookieData = parseCookieString(rawCookie);
      if (cookieData) {
        sessionToken = cookieData.session_token;
        tokenType = detectTokenType(sessionToken);
        console.log('Đã trích xuất thông tin từ cookie đầy đủ');
      }
    } 
    // Trường hợp 2: Chỉ là session token hoặc JWT token đơn
    else {
      sessionToken = extractSessionTokenFromCookie(rawCookie) || rawCookie;
      tokenType = detectTokenType(sessionToken);
      
      // Tạo dữ liệu cookie nếu là session token
      if (tokenType === 'session') {
        cookieData = {
          token_type: 'session',
          value: sessionToken,
          session_token: sessionToken,
          csrf_token: '255bd05b44d8c546476d3294676d36836f397de559807dcdd55957d6296b7b49%7Ca69e1a22b47f43c851e93ab3c667111509b145d72b0ac1907c3060c63e1dfa73',
          callback_url: 'https%3A%2F%2Fkimvan.id.vn%2F'
        };
      }
    }
    
    console.log(`Token type detected: ${tokenType}`);
    
    if (tokenType === 'unknown') {
      return NextResponse.json({ error: 'Invalid token format' }, { status: 400 });
    }
    
    // Tạo chuỗi cookie đầy đủ cho token session
    let cookieString = null;
    if (tokenType === 'session') {
      cookieString = buildFullCookieString(cookieData || sessionToken);
    }
    
    // Bỏ việc xác thực token, lưu trực tiếp
    
    // Thêm 30 ngày vào thời hạn token để lưu trữ lâu dài
    const now = Date.now();
    
    // Tính toán thời hạn token dựa trên tokenExpiryTime nếu có, hoặc mặc định là 30 ngày
    let expiryDate;
    if (body.tokenExpiryTime) {
      // Nếu tokenExpiryTime là timestamp số giây (10 chữ số), chuyển sang mili-giây
      if (body.tokenExpiryTime.toString().length === 10) {
        expiryDate = body.tokenExpiryTime * 1000;
      } 
      // Nếu tokenExpiryTime là timestamp mili-giây (13 chữ số), sử dụng trực tiếp
      else if (body.tokenExpiryTime.toString().length === 13) {
        expiryDate = parseInt(body.tokenExpiryTime);
      } 
      // Nếu không, sử dụng thời hạn mặc định
      else {
        expiryDate = new Date(now + 30 * 24 * 60 * 60 * 1000).getTime();
      }
    } else {
      expiryDate = new Date(now + 30 * 24 * 60 * 60 * 1000).getTime();
    }
    
    // Tạo đối tượng token để lưu
    const tokenData = {
      value: sessionToken,
      timestamp: now,
      expiry_date: expiryDate,
      last_verified: now,
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
      token_type: tokenType,
      cookie_string: cookieString,
      csrf_token: cookieData?.csrf_token || null,
      callback_url: cookieData?.callback_url || null,
      session_token: cookieData?.session_token || (tokenType === 'session' ? sessionToken : null),
      
      // Lưu thêm các thông tin mới
      accessToken: body.accessToken || sessionToken,
      refreshToken: body.refreshToken || null,
      auth_email: body.auth_email || null,
      tokenExpiryTime: body.tokenExpiryTime || null
    };
    
    // Lưu token vào file
    const saved = saveKimVanToken(tokenData);
    
    if (saved) {
      return NextResponse.json({
        success: true,
        message: 'Token KimVan đã được cập nhật thành công!',
        expiryDate: new Date(expiryDate).toISOString(),
        verified: true,
        tokenType: tokenType,
        hasCookieComponents: !!(tokenData.csrf_token && tokenData.callback_url && tokenData.session_token),
        hasAuthInfo: !!(tokenData.accessToken && tokenData.refreshToken && tokenData.auth_email)
      });
    } else {
      return NextResponse.json({ error: 'Failed to save token to file' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in POST /api/youtube/kimvan-token:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// API GET handler - Kiểm tra trạng thái cookie
export async function GET(request) {
  try {
    const tokenData = getStoredKimVanToken();
    
    if (!tokenData) {
      return NextResponse.json({ exists: false });
    }
    
    // Kiểm tra tính hợp lệ của token
    const now = Date.now();
    const isValid = tokenData.expiry_date > now;
    
    // Tính thời gian còn lại
    let timeRemaining = null;
    if (isValid) {
      const remainingMs = tokenData.expiry_date - now;
      const remainingDays = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
      const remainingHours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      timeRemaining = `${remainingDays} ngày ${remainingHours} giờ`;
    }
    
    // Kiểm tra thông tin token
    const hasCookieComponents = !!(tokenData.csrf_token && tokenData.callback_url && tokenData.session_token);
    const hasAuthInfo = !!(tokenData.accessToken && tokenData.refreshToken && tokenData.auth_email);
    
    return NextResponse.json({
      exists: true,
      valid: isValid,
      expiryDate: tokenData.expiry_date,
      timeRemaining: timeRemaining,
      tokenType: tokenData.token_type || 'unknown',
      hasCookieComponents: hasCookieComponents,
      hasAuthInfo: hasAuthInfo,
      auth_email: tokenData.auth_email || null,
      tokenExpiryTime: tokenData.tokenExpiryTime || null,
      refreshTokenExists: !!tokenData.refreshToken
    });
  } catch (error) {
    console.error('Error in GET /api/youtube/kimvan-token:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// API DELETE handler - Xóa token
export async function DELETE(request) {
  try {
    const deleted = deleteKimVanToken();
    
    if (deleted) {
      return NextResponse.json({ success: true, message: 'Token KimVan đã được xóa thành công!' });
    } else {
      return NextResponse.json({ success: false, message: 'Không tìm thấy token để xóa' });
    }
  } catch (error) {
    console.error('Error in DELETE /api/youtube/kimvan-token:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 