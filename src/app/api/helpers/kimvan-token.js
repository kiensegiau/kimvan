import fs from 'fs';
import path from 'path';

// File path để lưu trữ token KimVan
const KIMVAN_TOKEN_PATH = path.join(process.cwd(), 'kimvan_token.json');

let cachedAuthInfo = null;
let lastLoadTime = 0;

/**
 * Lấy KimVan token từ file lưu trữ
 * @returns {Object} Đối tượng chứa token và thông tin liên quan
 */
export function getKimVanToken() {
  try {
    // Kiểm tra file tồn tại
    if (fs.existsSync(KIMVAN_TOKEN_PATH)) {
      // Đọc nội dung file
      const tokenContent = fs.readFileSync(KIMVAN_TOKEN_PATH, 'utf8');
      const tokenData = JSON.parse(tokenContent);
      
      // Kiểm tra tính hợp lệ
      const now = Date.now();
      if (tokenData.expiry_date > now) {
        console.log('[TOKEN] Đã tải token KimVan từ file');
        return tokenData;
      } else {
        console.log('[TOKEN] Token KimVan đã hết hạn');
        return null;
      }
    }
  } catch (error) {
    console.error('[TOKEN] Lỗi khi đọc file token KimVan:', error);
  }
  
  return null;
}

/**
 * Lấy giá trị token để sử dụng trong Authorization header
 * @returns {string|null} Token giá trị hoặc null nếu không có
 */
export function getKimVanTokenValue() {
  const tokenData = getKimVanToken();
  return tokenData ? tokenData.value : null;
}

/**
 * Trích xuất session token từ chuỗi cookie
 * @param {string} cookieString - Chuỗi cookie đầy đủ
 * @returns {string|null} Session token hoặc null nếu không tìm thấy
 */
export function extractSessionTokenFromCookie(cookieString) {
  try {
    if (!cookieString) return null;
    
    // Nếu cookieString là token JWT hoặc session trực tiếp, không phải chuỗi cookie
    if (cookieString.startsWith('eyJ') && !cookieString.includes('=')) {
      return cookieString;
    }
    
    // Phân tích chuỗi cookie đầy đủ
    const cookieParts = cookieString.split(';').map(part => part.trim());
    
    // Tìm session token
    const sessionToken = extractValueFromCookie(cookieParts, '__Secure-authjs.session-token');
    
    return sessionToken;
  } catch (error) {
    console.error('[COOKIE] Lỗi khi trích xuất session token:', error);
    return null;
  }
}

/**
 * Phân tích chuỗi cookie để trích xuất các thành phần
 * @param {string} cookieString - Chuỗi cookie đầy đủ
 * @returns {Object} Các thành phần của cookie hoặc null nếu không hợp lệ
 */
export function parseCookieString(cookieString) {
  try {
    if (!cookieString) return null;
    
    // Nếu cookieString là token JWT hoặc session trực tiếp, không phải chuỗi cookie
    if (cookieString.startsWith('eyJ') && !cookieString.includes('=')) {
      // Phát hiện loại token
      const tokenType = detectTokenType(cookieString);
      
      if (tokenType === 'jwt') {
        return {
          token_type: 'jwt',
          value: cookieString,
          csrf_token: null,
          callback_url: null,
          session_token: null
        };
      } else if (tokenType === 'session') {
        return {
          token_type: 'session',
          value: cookieString,
          csrf_token: null,
          callback_url: null,
          session_token: cookieString
        };
      }
      
      return null;
    }
    
    // Phân tích chuỗi cookie đầy đủ
    const cookieParts = cookieString.split(';').map(part => part.trim());
    
    // Tìm các thành phần quan trọng
    const csrfToken = extractValueFromCookie(cookieParts, '__Host-authjs.csrf-token');
    const callbackUrl = extractValueFromCookie(cookieParts, '__Secure-authjs.callback-url');
    const sessionToken = extractValueFromCookie(cookieParts, '__Secure-authjs.session-token');
    
    // Nếu không tìm thấy session token, thử kiểm tra xem cookieString có phải là session token không
    if (!sessionToken && detectTokenType(cookieString) === 'session') {
      return {
        token_type: 'session',
        value: cookieString,
        csrf_token: null,
        callback_url: null,
        session_token: cookieString
      };
    }
    
    // Nếu không tìm thấy session token, không hợp lệ
    if (!sessionToken) {
      console.log('[COOKIE] Không tìm thấy session token trong cookie');
      return null;
    }
    
    return {
      token_type: 'cookies',
      value: sessionToken,
      csrf_token: csrfToken,
      callback_url: callbackUrl,
      session_token: sessionToken
    };
  } catch (error) {
    console.error('[COOKIE] Lỗi khi phân tích cookie:', error);
    return null;
  }
}

/**
 * Trích xuất giá trị từ cookie theo tên
 * @param {string[]} cookieParts - Các phần của cookie đã tách
 * @param {string} name - Tên cookie cần tìm
 * @returns {string|null} Giá trị cookie hoặc null nếu không tìm thấy
 */
function extractValueFromCookie(cookieParts, name) {
  const cookie = cookieParts.find(part => part.startsWith(`${name}=`));
  if (cookie) {
    return cookie.substring(name.length + 1);
  }
  return null;
}

/**
 * Phát hiện loại token dựa trên định dạng
 * @param {string} token - Token cần kiểm tra
 * @returns {string} Loại token: 'jwt', 'session', hoặc 'unknown'
 */
export function detectTokenType(token) {
  if (!token) return 'unknown';

  // JWT tokens thường có 3 phần được phân cách bởi dấu "."
  if (token.split('.').length === 3 && token.startsWith('eyJ')) {
    return 'jwt';
  }
  
  // Session token thường bắt đầu với "eyJhbG" của AuthJS/NextAuth
  if (token.startsWith('eyJ') && token.includes('A256CBC-HS512')) {
    return 'session';
  }
  
  // Nếu là chuỗi cookie đầy đủ
  if (token.includes('__Secure-authjs.session-token=')) {
    return 'fullcookie';
  }
  
  return 'unknown';
}

/**
 * Tạo chuỗi cookie đầy đủ từ các thành phần
 * @param {Object|string} cookieData - Dữ liệu cookie hoặc session token
 * @returns {string} Chuỗi cookie đầy đủ
 */
export function buildFullCookieString(cookieData) {
  // Nếu cookieData là chuỗi, coi đó là session token
  if (typeof cookieData === 'string') {
    return `__Host-authjs.csrf-token=255bd05b44d8c546476d3294676d36836f397de559807dcdd55957d6296b7b49%7Ca69e1a22b47f43c851e93ab3c667111509b145d72b0ac1907c3060c63e1dfa73; __Secure-authjs.callback-url=https%3A%2F%2Fkimvan.id.vn%2F; __Secure-authjs.session-token=${cookieData}`;
  }
  
  // Nếu đã có cookie_string đầy đủ, sử dụng nó
  if (cookieData.cookie_string) {
    return cookieData.cookie_string;
  }
  
  // Lấy các thành phần từ cookieData
  let csrfToken = cookieData.csrf_token;
  let callbackUrl = cookieData.callback_url;
  const sessionToken = cookieData.session_token || cookieData.value;
  
  // Tạo CSRF token nếu cần
  if (!csrfToken) {
    csrfToken = '255bd05b44d8c546476d3294676d36836f397de559807dcdd55957d6296b7b49%7Ca69e1a22b47f43c851e93ab3c667111509b145d72b0ac1907c3060c63e1dfa73';
  }
  
  // Tạo callback URL nếu cần
  if (!callbackUrl) {
    callbackUrl = 'https%3A%2F%2Fkimvan.id.vn%2F';
  }
  
  // Tạo chuỗi cookie đầy đủ
  return `__Host-authjs.csrf-token=${csrfToken}; __Secure-authjs.callback-url=${callbackUrl}; __Secure-authjs.session-token=${sessionToken}`;
}

/**
 * Hàm lấy headers xác thực cho KimVan API
 * Đọc từ file auth được lưu bởi script Puppeteer
 */
export function getKimVanAuthHeaders() {
  const now = Date.now();
  
  // Chỉ đọc lại file sau mỗi 5 phút
  if (!cachedAuthInfo || now - lastLoadTime > 5 * 60 * 1000) {
    try {
      // Tìm file auth mới nhất trong thư mục logs
      const logsDir = path.join(process.cwd(), 'logs');
      const files = fs.readdirSync(logsDir)
        .filter(file => file.startsWith('kimvan-requests-'))
        .sort()
        .reverse(); // Sắp xếp theo thời gian mới nhất
      
      if (files.length > 0) {
        const latestFile = path.join(logsDir, files[0]);
        const fileContent = fs.readFileSync(latestFile, 'utf8');
        const authData = JSON.parse(fileContent);
        
        // Lưu vào cache
        cachedAuthInfo = authData;
        lastLoadTime = now;
        
        console.log(`Đã đọc thông tin xác thực từ file: ${latestFile}`);
      } else {
        console.warn('Không tìm thấy file thông tin xác thực. Vui lòng chạy script Puppeteer trước.');
      }
    } catch (error) {
      console.error('Lỗi khi đọc file thông tin xác thực:', error);
    }
  }
  
  // Tạo headers dựa trên thông tin trong file
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  };
  
  if (cachedAuthInfo) {
    // Ưu tiên sử dụng Bearer token nếu có
    if (cachedAuthInfo.requests) {
      const authRequest = cachedAuthInfo.requests.find(r => r.headers && r.headers.Authorization);
      if (authRequest?.headers?.Authorization) {
        headers.Authorization = authRequest.headers.Authorization;
      }
    }
    
    // Nếu không có Bearer token, dùng cookie
    if (!headers.Authorization && cachedAuthInfo.cookies) {
      const authCookie = cachedAuthInfo.cookies.find(
        c => c.name === 'connect.sid' || c.name.toLowerCase().includes('token')
      );
      if (authCookie) {
        headers.cookie = `${authCookie.name}=${authCookie.value}`;
      }
    }
  }
  
  return headers;
}

/**
 * Hàm lưu thông tin xác thực mới
 * (Có thể được sử dụng từ API route khác nếu cần)
 */
export function saveKimVanAuth(authInfo) {
  try {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const filePath = path.join(logsDir, `kimvan-auth-manual-${Date.now()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(authInfo, null, 2));
    
    // Cập nhật cache
    cachedAuthInfo = authInfo;
    lastLoadTime = Date.now();
    
    return true;
  } catch (error) {
    console.error('Lỗi khi lưu thông tin xác thực:', error);
    return false;
  }
}

/**
 * Lấy thông tin email từ token KimVan
 * @returns {string|null} Email người dùng hoặc null nếu không có
 */
export function getKimVanUserEmail() {
  const tokenData = getKimVanToken();
  return tokenData?.auth_email || null;
}

/**
 * Lấy refreshToken nếu có
 * @returns {string|null} RefreshToken hoặc null nếu không có
 */
export function getKimVanRefreshToken() {
  const tokenData = getKimVanToken();
  return tokenData?.refreshToken || null;
}