import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

// File path để lưu trữ token và cookie
const TOKEN_PATH = path.join(process.cwd(), 'youtube_token.json');
const COOKIE_PATH = path.join(process.cwd(), 'youtube_cookie.json');

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

// Lưu cookie vào file riêng
function saveCookie(cookie) {
  try {
    fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookie, null, 2));
    console.log('Cookie saved to', COOKIE_PATH);
    return true;
  } catch (error) {
    console.error('Error saving cookie:', error);
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

// Đọc cookie từ file
function getStoredCookie() {
  try {
    if (fs.existsSync(COOKIE_PATH)) {
      const cookieContent = fs.readFileSync(COOKIE_PATH, 'utf8');
      return JSON.parse(cookieContent);
    }
  } catch (error) {
    console.error('Error reading cookie file:', error);
  }
  return null;
}

// Kiểm tra tính hợp lệ của cookie KimVan
async function verifyKimVanCookie(cookie) {
  try {
    // Tạo header với cookie
    const headers = {
      'Cookie': `__Secure-authjs.session-token=${cookie}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };

    // Thử gọi một endpoint của KimVan để kiểm tra
    const response = await axios.get('https://kimvan.id.vn/api/auth/check-session', {
      headers: headers
    });

    return {
      valid: true,
      data: response.data
    };
  } catch (error) {
    console.error('Error verifying KimVan cookie:', error);
    return {
      valid: false,
      error: error.message || 'Không thể xác thực cookie với KimVan API'
    };
  }
}

// Xử lý token từ Chrome
export async function POST(request) {
  try {
    // Lấy token từ request body
    const data = await request.json();
    const { token } = data;
    
    if (!token) {
      return NextResponse.json({ 
        error: 'Token không được cung cấp' 
      }, { status: 400 });
    }
    
    // Kiểm tra tính hợp lệ của cookie KimVan
    const verificationResult = await verifyKimVanCookie(token);
    
    // Nếu cookie không hợp lệ, báo lỗi
    if (!verificationResult.valid) {
      return NextResponse.json({ 
        error: 'Cookie KimVan không hợp lệ: ' + verificationResult.error 
      }, { status: 400 });
    }
    
    // Tạo token giả lập với thông tin cần thiết
    const now = Date.now();
    const oneWeekLater = now + 7 * 24 * 3600 * 1000; // Thêm 1 tuần
    
    // Thông tin kênh YouTube được lấy từ tài khoản KimVan
    const channelInfo = [{
      id: "KimVanChannel", // Giá trị giả lập
      title: "KimVan YouTube" // Giá trị giả lập
    }];
    
    const tokenData = {
      access_token: token,
      refresh_token: token,
      scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/drive',
      token_type: 'Bearer',
      expiry_date: oneWeekLater,
      timestamp: now,
      scopes: {
        youtube: true,
        drive: true
      },
      channel_info: channelInfo,
      source: 'kimvan-cookie'
    };
    
    // Lưu cookie riêng biệt với các thông tin bổ sung
    const cookieData = {
      __Secure_authjs_session_token: token,
      timestamp: now,
      expiry_date: oneWeekLater,
      last_verified: now,
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      source: 'kimvan'
    };
    
    // Lưu cả token và cookie vào file riêng
    const savedToken = saveToken(tokenData);
    const savedCookie = saveCookie(cookieData);
    
    if (savedToken && savedCookie) {
      // Xác nhận token và cookie đã được lưu
      return NextResponse.json({ 
        success: true,
        message: 'Token YouTube và cookie đã được cập nhật thành công!',
        expiryDate: new Date(oneWeekLater),
        channel_info: tokenData.channel_info
      });
    } else {
      return NextResponse.json({ 
        error: 'Không thể lưu token hoặc cookie' 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error updating YouTube token:', error);
    return NextResponse.json({ 
      error: error.message || 'Đã xảy ra lỗi không xác định khi cập nhật token' 
    }, { status: 500 });
  }
}

// Kiểm tra trạng thái token
export async function GET(request) {
  try {
    const storedToken = getStoredToken();
    const storedCookie = getStoredCookie();
    
    if (!storedToken) {
      return NextResponse.json({ 
        exists: false,
        message: 'Không tìm thấy token YouTube'
      });
    }
    
    // Kiểm tra tính hợp lệ của token (kiểm tra đơn giản dựa trên expiry_date)
    const now = Date.now();
    const isValid = storedToken.expiry_date > now;
    
    // Chuẩn bị thông tin để trả về
    const response = { 
      exists: true,
      valid: isValid,
      expiryDate: new Date(storedToken.expiry_date),
      tokenInfo: {
        access_token: storedToken.access_token.substring(0, 10) + '...[redacted]',
        scope: storedToken.scope
      },
      cookieExists: !!storedCookie,
      timeRemaining: isValid ? Math.floor((storedToken.expiry_date - now) / (1000 * 60 * 60)) + ' giờ' : '0 giờ',
      source: storedToken.source || 'unknown'
    };
    
    // Nếu có thông tin kênh, thêm vào
    if (storedToken.channel_info && storedToken.channel_info.length > 0) {
      response.channelInfo = storedToken.channel_info.map(channel => ({
        id: channel.id,
        title: channel.title
      }));
    }
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error checking YouTube token:', error);
    return NextResponse.json({ 
      error: error.message || 'Đã xảy ra lỗi khi kiểm tra token YouTube' 
    }, { status: 500 });
  }
}

// Xóa cả token và cookie
export async function DELETE(request) {
  try {
    let success = true;
    let message = "Xóa thành công";
    
    if (fs.existsSync(TOKEN_PATH)) {
      try {
        fs.unlinkSync(TOKEN_PATH);
      } catch (err) {
        success = false;
        message = "Không thể xóa file token";
      }
    }
    
    if (fs.existsSync(COOKIE_PATH)) {
      try {
        fs.unlinkSync(COOKIE_PATH);
      } catch (err) {
        success = false;
        message = success ? "Không thể xóa file cookie" : "Không thể xóa cả hai file";
      }
    }
    
    return NextResponse.json({ 
      success,
      message
    });
  } catch (error) {
    console.error('Error deleting token and cookie files:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Đã xảy ra lỗi khi xóa file token và cookie'
    }, { status: 500 });
  }
} 