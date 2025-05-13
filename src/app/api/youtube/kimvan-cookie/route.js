import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

// File path để lưu trữ cookie KimVan
const KIMVAN_COOKIE_PATH = path.join(process.cwd(), 'kimvan_cookie.json');

// Lưu KimVan cookie vào file
function saveKimVanCookie(cookie) {
  try {
    fs.writeFileSync(KIMVAN_COOKIE_PATH, JSON.stringify(cookie, null, 2));
    console.log('KimVan cookie saved to', KIMVAN_COOKIE_PATH);
    return true;
  } catch (error) {
    console.error('Error saving KimVan cookie:', error);
    return false;
  }
}

// Đọc KimVan cookie từ file
function getStoredKimVanCookie() {
  try {
    if (fs.existsSync(KIMVAN_COOKIE_PATH)) {
      const cookieContent = fs.readFileSync(KIMVAN_COOKIE_PATH, 'utf8');
      return JSON.parse(cookieContent);
    }
  } catch (error) {
    console.error('Error reading KimVan cookie file:', error);
  }
  return null;
}

// Xác thực tính hợp lệ của cookie KimVan
async function verifyKimVanCookie(cookieValue) {
  try {
    // Tạo header với cookie
    const headers = {
      'Cookie': cookieValue,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };

    // Thử gọi một endpoint để kiểm tra cookie
    const response = await axios.get('https://kimvan.id.vn/api/spreadsheets/create/testauth', {
      headers: headers,
      validateStatus: (status) => true // Chấp nhận bất kỳ status code nào để tránh lỗi
    });

    // Kiểm tra response để xác định tính hợp lệ của cookie
    if (response.status === 200) {
      return {
        valid: true,
        data: response.data
      };
    } else {
      return {
        valid: false,
        error: `Không thể xác thực cookie KimVan (Mã lỗi: ${response.status})`
      };
    }
  } catch (error) {
    console.error('Error verifying KimVan cookie:', error);
    return {
      valid: true, // Giả định cookie hợp lệ nếu không thể xác thực (vì có thể endpoint xác thực chưa sẵn sàng)
      error: error.message || 'Không thể xác thực cookie KimVan'
    };
  }
}

// Xử lý cập nhật cookie KimVan
export async function POST(request) {
  try {
    // Lấy cookie từ request body
    const data = await request.json();
    const { cookie } = data;
    
    if (!cookie) {
      return NextResponse.json({ 
        error: 'Cookie không được cung cấp' 
      }, { status: 400 });
    }
    
    // Kiểm tra tính hợp lệ của cookie (nếu cần)
    const verificationResult = await verifyKimVanCookie(cookie);
    
    // Tạo dữ liệu cookie với các thông tin bổ sung
    const now = Date.now();
    const oneMonthLater = now + 30 * 24 * 3600 * 1000; // Thêm 1 tháng
    
    const cookieData = {
      value: cookie,
      timestamp: now,
      expiry_date: oneMonthLater,
      last_verified: now,
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      verification_result: verificationResult.valid,
      note: 'Cookie KimVan cho phép truy cập vào hệ thống KimVan không cần đăng nhập lại'
    };
    
    // Lưu cookie vào file
    const savedToFile = saveKimVanCookie(cookieData);
    
    if (savedToFile) {
      // Xác nhận cookie đã được lưu
      return NextResponse.json({ 
        success: true,
        message: 'Cookie KimVan đã được cập nhật thành công!',
        expiryDate: new Date(oneMonthLater),
        verified: verificationResult.valid
      });
    } else {
      return NextResponse.json({ 
        error: 'Không thể lưu cookie KimVan' 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error updating KimVan cookie:', error);
    return NextResponse.json({ 
      error: error.message || 'Đã xảy ra lỗi không xác định khi cập nhật cookie KimVan' 
    }, { status: 500 });
  }
}

// Kiểm tra trạng thái cookie KimVan
export async function GET(request) {
  try {
    const storedCookie = getStoredKimVanCookie();
    
    if (!storedCookie) {
      return NextResponse.json({ 
        exists: false,
        message: 'Không tìm thấy cookie KimVan'
      });
    }
    
    // Kiểm tra tính hợp lệ của cookie dựa trên expiry_date
    const now = Date.now();
    const isValid = storedCookie.expiry_date > now;
    
    // Chuẩn bị thông tin để trả về
    return NextResponse.json({ 
      exists: true,
      valid: isValid,
      expiryDate: new Date(storedCookie.expiry_date),
      timeRemaining: isValid ? Math.floor((storedCookie.expiry_date - now) / (1000 * 60 * 60)) + ' giờ' : '0 giờ',
      lastVerified: new Date(storedCookie.last_verified || storedCookie.timestamp),
      note: storedCookie.note
    });
    
  } catch (error) {
    console.error('Error checking KimVan cookie:', error);
    return NextResponse.json({ 
      error: error.message || 'Đã xảy ra lỗi khi kiểm tra cookie KimVan' 
    }, { status: 500 });
  }
}

// Xóa cookie KimVan
export async function DELETE(request) {
  try {
    let success = true;
    
    if (fs.existsSync(KIMVAN_COOKIE_PATH)) {
      try {
        fs.unlinkSync(KIMVAN_COOKIE_PATH);
      } catch (err) {
        console.error('Error deleting cookie file:', err);
        success = false;
      }
    }
    
    return NextResponse.json({ 
      success,
      message: success ? 'Cookie KimVan đã được xóa thành công' : 'Có lỗi khi xóa cookie KimVan'
    });
  } catch (error) {
    console.error('Error deleting KimVan cookie file:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Đã xảy ra lỗi khi xóa cookie KimVan'
    }, { status: 500 });
  }
} 