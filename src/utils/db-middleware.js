import { connectDB } from '@/lib/mongodb';

/**
 * Middleware để tự động kết nối đến MongoDB trước khi xử lý API request
 * @param {function} handler - Hàm xử lý API request
 * @returns {function} - Hàm xử lý API request đã được bọc middleware
 */
export function withDatabase(handler) {
  return async (req, res) => {
    try {
      // Kết nối đến database trước khi xử lý request
      await connectDB();
      
      // Gọi handler gốc sau khi đã kết nối
      return await handler(req, res);
    } catch (error) {
      console.error('❌ Lỗi trong DB middleware:', error);
      return res.status(500).json({ error: 'Lỗi kết nối cơ sở dữ liệu' });
    }
  };
}

/**
 * Middleware để tự động kết nối đến MongoDB trước khi xử lý Next.js App Router API request
 * Sử dụng cho các route.js trong App Router
 * @param {Request} [request] - Request object từ Next.js (optional)
 */
export async function dbMiddleware(request) {
  try {
    // Kết nối đến database
    await connectDB();
    if (request) {
      console.log(`🔌 dbMiddleware - Đã kết nối DB tự động cho ${request.url || 'API request'}`);
    } else {
      console.log('🔌 dbMiddleware - Đã kết nối DB tự động (không có request object)');
    }
    return null; // Tiếp tục xử lý request
  } catch (error) {
    console.error('❌ Lỗi kết nối DB trong middleware:', error);
    throw error; // Để Next.js xử lý lỗi
  }
} 