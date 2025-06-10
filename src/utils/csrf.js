import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';

const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';
const CSRF_FORM_FIELD = '_csrf';

/**
 * Tạo CSRF token mới
 * @returns {string} CSRF token
 */
export function generateCsrfToken() {
  return randomBytes(32).toString('hex');
}

/**
 * Lưu CSRF token vào cookie
 * @param {string} token - CSRF token
 * @param {number} maxAge - Thời gian sống của cookie (mặc định 1 giờ)
 */
export async function setCsrfCookie(token, maxAge = 3600) {
  await cookies().set(CSRF_COOKIE_NAME, token, {
    path: '/',
    maxAge,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
}

/**
 * Lấy CSRF token từ cookie
 * @returns {string|null} CSRF token hoặc null nếu không tìm thấy
 */
export async function getCsrfToken() {
  return (await cookies().get(CSRF_COOKIE_NAME))?.value || null;
}

/**
 * Tạo và lưu CSRF token mới
 * @param {number} maxAge - Thời gian sống của cookie (mặc định 1 giờ)
 * @returns {string} CSRF token mới
 */
export async function createCsrfToken(maxAge = 3600) {
  const token = generateCsrfToken();
  await setCsrfCookie(token, maxAge);
  return token;
}

/**
 * Xác thực CSRF token
 * @param {string} providedToken - Token được cung cấp từ form hoặc header
 * @returns {boolean} true nếu token hợp lệ, false nếu không
 */
export async function validateCsrfToken(providedToken) {
  if (!providedToken) return false;
  
  const storedToken = await getCsrfToken();
  if (!storedToken) return false;
  
  // So sánh token một cách an toàn, tránh timing attacks
  return timingSafeEqual(providedToken, storedToken);
}

/**
 * So sánh hai string một cách an toàn, tránh timing attacks
 * @param {string} a - String thứ nhất
 * @param {string} b - String thứ hai
 * @returns {boolean} true nếu hai string giống nhau, false nếu khác
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Tạo input field ẩn cho CSRF token trong form
 * @param {string} token - CSRF token
 * @returns {string} HTML input field
 */
export function csrfInputField(token) {
  return `<input type="hidden" name="${CSRF_FORM_FIELD}" value="${token}" />`;
}

/**
 * Middleware CSRF cho API routes
 * @param {function} handler - API handler function
 * @returns {function} Wrapped handler with CSRF protection
 */
export function withCsrfProtection(handler) {
  return async (req, res) => {
    // Bỏ qua kiểm tra CSRF cho GET, HEAD, OPTIONS
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return handler(req, res);
    }
    
    // Lấy token từ header hoặc body
    const providedToken = req.headers[CSRF_HEADER_NAME.toLowerCase()] || 
                          (req.body && req.body[CSRF_FORM_FIELD]);
    
    // Xác thực token
    if (!await validateCsrfToken(providedToken)) {
      return res.status(403).json({ error: 'CSRF token không hợp lệ' });
    }
    
    // Nếu token hợp lệ, tiếp tục xử lý request
    return handler(req, res);
  };
}

// Export constants
export const CSRF = {
  COOKIE_NAME: CSRF_COOKIE_NAME,
  HEADER_NAME: CSRF_HEADER_NAME,
  FORM_FIELD: CSRF_FORM_FIELD,
}; 