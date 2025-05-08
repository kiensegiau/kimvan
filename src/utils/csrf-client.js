import { randomBytes } from 'crypto';

const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';
const CSRF_FORM_FIELD = '_csrf';

/**
 * Tạo CSRF token mới cho client
 * @returns {string} CSRF token
 */
export function generateCsrfToken() {
  // Sử dụng Math.random() thay vì crypto cho client
  const randomStr = Math.random().toString(36).substring(2, 15) + 
                    Math.random().toString(36).substring(2, 15);
  return randomStr;
}

/**
 * Lấy CSRF token từ cookie ở client
 * @returns {string|null} CSRF token hoặc null nếu không tìm thấy
 */
export function getCsrfToken() {
  // Hàm lấy cookie ở client
  const getCookie = name => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  };
  
  return getCookie(CSRF_COOKIE_NAME);
}

/**
 * Thiết lập CSRF token cookie ở client
 * @param {string} token - Token cần thiết lập
 * @param {number} maxAge - Thời gian sống của cookie (giây)
 */
export function setCsrfCookie(token, maxAge = 3600) {
  const secure = window.location.protocol === 'https:';
  document.cookie = `${CSRF_COOKIE_NAME}=${token}; path=/; max-age=${maxAge}; SameSite=Lax; ${secure ? 'Secure;' : ''}`;
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

// Export constants
export const CSRF = {
  COOKIE_NAME: CSRF_COOKIE_NAME,
  HEADER_NAME: CSRF_HEADER_NAME,
  FORM_FIELD: CSRF_FORM_FIELD,
}; 