import { getMongoClient } from './mongodb-connection';
import mongoose from 'mongoose';

// Biến để theo dõi trạng thái kết nối mongoose
let mongooseConnected = false;
let mongooseConnecting = false;
let mongooseConnectionLoggedOnce = false;

// Kiểm tra URI MongoDB và ghi log cảnh báo thay vì báo lỗi
if (!process.env.MONGODB_URI) {
  console.warn('CẢNH BÁO: Không tìm thấy MONGODB_URI trong biến môi trường, ứng dụng sẽ chạy ở chế độ demo');
}

// Tạo clientPromise sử dụng module kết nối tập trung mới
const clientPromise = (async () => {
  try {
    // Sử dụng module kết nối tập trung thay vì tạo kết nối mới
    const client = await getMongoClient();
    return client;
  } catch (error) {
    console.error('❌ Không thể khởi tạo kết nối MongoDB:', error.message);
    return Promise.reject(error);
  }
})();

// Hàm connectDB mà các route API đang sử dụng
export const connectDB = async () => {
  // Nếu đã kết nối, không làm gì cả và trả về nhanh
  if (mongooseConnected) return;
  
  // Nếu đang trong quá trình kết nối, đợi kết nối hoàn thành
  if (mongooseConnecting) {
    while (mongooseConnecting) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    return;
  }
  
  try {
    mongooseConnecting = true;
    
    // Lấy URI từ biến môi trường
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI không được cấu hình trong biến môi trường');
    }
    
    // Kết nối mongoose nếu chưa kết nối
    await mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    
    mongooseConnected = true;
    mongooseConnecting = false;
    
    // Chỉ log một lần khi thực sự kết nối mới và chưa từng log trước đó
    if (!mongooseConnectionLoggedOnce && process.env.NODE_ENV === 'development') {
      console.log('Mongoose connected to MongoDB successfully');
      mongooseConnectionLoggedOnce = true;
    }
  } catch (error) {
    mongooseConnecting = false;
    console.error('Mongoose connection error:', error);
    throw error;
  }
};

// Thiết lập sự kiện đóng kết nối để cập nhật trạng thái
mongoose.connection.on('disconnected', () => {
  if (process.env.NODE_ENV === 'development' && mongooseConnected) {
    console.log('Mongoose disconnected from MongoDB');
  }
  mongooseConnected = false;
  mongooseConnectionLoggedOnce = false; // Reset cờ để log nếu kết nối lại
});

// Bắt sự kiện lỗi để tránh crash ứng dụng
mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err);
  mongooseConnected = false;
  mongooseConnecting = false;
  mongooseConnectionLoggedOnce = false; // Reset cờ để log nếu kết nối lại
});

// Khai báo hàm để API vẫn có thể sử dụng (tương thích ngược)
export const connectToDatabase = async () => {
  return await clientPromise;
};

export default clientPromise; 