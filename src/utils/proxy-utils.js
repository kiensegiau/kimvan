/**
 * Utility functions for handling proxy links
 */

/**
 * Giải mã link proxy từ base64
 * @param {string} proxyUrl - URL proxy cần giải mã
 * @returns {string|null} URL đã giải mã hoặc null nếu không phải link proxy
 */
export const decodeProxyLink = (proxyUrl) => {
  if (!proxyUrl) return null;
  
  // Kiểm tra xem có phải link proxy không
  if (proxyUrl.startsWith('/api/proxy-link/')) {
    try {
      // Lấy phần mã hóa base64
      const base64Part = proxyUrl.replace('/api/proxy-link/', '');
      
      // Chuẩn hóa chuỗi base64 trước khi giải mã
      // 1. Thay thế các ký tự URL-safe
      // 2. Thêm padding nếu cần
      const normalizedBase64 = base64Part
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .replace(/\s/g, '');
      
      const paddedBase64 = normalizedBase64.padEnd(
        normalizedBase64.length + (4 - (normalizedBase64.length % 4)) % 4,
        '='
      );
      
      // Giải mã base64 - sử dụng atob() ở client-side
      // hoặc Buffer.from() ở server-side
      let decodedUrl;
      if (typeof window !== 'undefined') {
        try {
          // Client-side
          decodedUrl = decodeURIComponent(escape(atob(paddedBase64)));
        } catch (e) {
          // Nếu giải mã UTF-8 thất bại, thử giải mã trực tiếp
          decodedUrl = atob(paddedBase64);
        }
      } else {
        // Server-side
        decodedUrl = Buffer.from(paddedBase64, 'base64').toString('utf-8');
      }
      
      return decodedUrl;
    } catch (error) {
      console.error('Lỗi khi giải mã proxy link:', error);
      return proxyUrl;
    }
  }
  
  return proxyUrl;
};

/**
 * Mã hóa URL thành proxy link sử dụng base64
 * @param {string} url - URL cần mã hóa
 * @returns {string} URL đã mã hóa dạng proxy link
 */
export const encodeProxyLink = (url) => {
  if (!url) return '';
  
  try {
    // Mã hóa URL sử dụng base64
    let base64Url;
    if (typeof window !== 'undefined') {
      // Client-side
      // Mã hóa UTF-8 trước khi chuyển sang base64
      base64Url = btoa(unescape(encodeURIComponent(url)))
        .replace(/\+/g, '-') // Thay thế các ký tự không an toàn cho URL
        .replace(/\//g, '_')
        .replace(/=+$/, ''); // Xóa padding ở cuối
    } else {
      // Server-side
      base64Url = Buffer.from(url)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }
    
    return `/api/proxy-link/${base64Url}`;
  } catch (error) {
    console.error('Lỗi khi mã hóa URL thành proxy link:', error);
    return url;
  }
};

/**
 * Lấy URL đã giải mã từ URL gốc (có thể là proxy hoặc không)
 * @param {string} originalUrl - URL gốc cần kiểm tra và giải mã
 * @returns {Object} Đối tượng chứa URL đã giải mã và thông tin về proxy
 */
export const getUpdatedUrl = (originalUrl) => {
  if (!originalUrl) return { url: null, isProxy: false };
  
  // Kiểm tra xem có phải link proxy không
  const isProxy = originalUrl.startsWith('/api/proxy-link/');
  
  // Giải mã link proxy nếu cần
  const decodedUrl = isProxy ? decodeProxyLink(originalUrl) : originalUrl;
  
  // Trả về cả URL gốc và URL đã giải mã
  return {
    url: decodedUrl,
    originalUrl: originalUrl,
    isProxy: isProxy
  };
}; 