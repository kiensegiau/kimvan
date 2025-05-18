/**
 * Module quản lý kết nối MongoDB tập trung
 * Tối ưu để tái sử dụng kết nối hiện có và tránh log trùng lặp
 */

import { MongoClient } from 'mongodb';

// Biến kiểm soát log
let connectionLoggedOnce = false;
let connectionEstablishedLoggedOnce = false;
let clientCache = null;

/**
 * Lấy kết nối MongoDB đã được cache
 * @param {boolean} suppressLog - Tắt log nếu true 
 * @returns {Promise<MongoClient>} - MongoDB client
 */
export async function getMongoClient(suppressLog = false) {
  // Kiểm tra xem đã có kết nối trong cache chưa
  if (clientCache) {
    if (!suppressLog && !connectionLoggedOnce) {
      console.log('✅ Sử dụng kết nối MongoDB đã cache');
      connectionLoggedOnce = true;
    }
    return clientCache;
  }
  
  // Lấy connection string từ biến môi trường
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI không được cấu hình trong biến môi trường');
  }
  
  // Log URI một lần khi ở môi trường development
  if (process.env.NODE_ENV === 'development' && !suppressLog && !connectionLoggedOnce) {
    console.log('Đang sử dụng MongoDB URI:', uri);
    connectionLoggedOnce = true;
  }
  
  // Tạo client mới nếu chưa có
  if (!suppressLog && !connectionEstablishedLoggedOnce) {
    console.log('Đang kết nối đến MongoDB...');
    connectionEstablishedLoggedOnce = true;
  }
  
  // Tạo client mới
  try {
    clientCache = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 5,
      retryWrites: true,
      w: 'majority'
    });
    
    // Kết nối
    await clientCache.connect();
    
    // Log kết nối thành công một lần
    if (!suppressLog && !connectionEstablishedLoggedOnce) {
      console.log('Kết nối MongoDB thành công');
      connectionEstablishedLoggedOnce = true;
    }
    
    // Lắng nghe sự kiện đóng kết nối để xóa cache
    clientCache.on('close', () => {
      clientCache = null;
      connectionLoggedOnce = false;
      connectionEstablishedLoggedOnce = false;
    });
    
    return clientCache;
  } catch (error) {
    console.error('❌ Lỗi kết nối MongoDB:', error.message);
    throw error;
  }
}

/**
 * Đóng kết nối MongoDB nếu tồn tại
 */
export async function closeMongoConnection() {
  if (clientCache) {
    await clientCache.close();
    clientCache = null;
    connectionLoggedOnce = false;
    connectionEstablishedLoggedOnce = false;
    console.log('Đã đóng kết nối MongoDB');
  }
}

export default { getMongoClient, closeMongoConnection }; 