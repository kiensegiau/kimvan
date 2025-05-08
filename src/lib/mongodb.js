import { MongoClient } from 'mongodb';

// Kiểm tra URI MongoDB và ghi log cảnh báo thay vì báo lỗi
if (!process.env.MONGODB_URI) {
  console.warn('CẢNH BÁO: Không tìm thấy MONGODB_URI trong biến môi trường, ứng dụng sẽ chạy ở chế độ demo');
}

// Sử dụng ưu tiên URI từ biến môi trường, nếu không có thì dùng localhost
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/kimvan';
console.log('Đang sử dụng MongoDB URI:', uri);

const options = {
  connectTimeoutMS: 10000, // Tăng thời gian timeout kết nối
  serverSelectionTimeoutMS: 10000, // Tăng thời gian timeout chọn server
  retryWrites: true,
  w: 'majority',
  directConnection: process.env.MONGODB_URI ? false : true // Kết nối trực tiếp nếu dùng MongoDB cục bộ
};

let client;
let clientPromise;

// Hàm để tạo kết nối MongoDB
export const connectToDatabase = async () => {
  try {
    if (!client) {
      client = new MongoClient(uri, options);
      console.log('Đang kết nối đến MongoDB...');
    }
    
    const connection = await client.connect();
    console.log('Kết nối MongoDB thành công');
    return connection;
  } catch (error) {
    console.error('Lỗi khi kết nối đến MongoDB:', error);
    
    // Thêm mã xử lý lỗi cụ thể
    if (error.code === 'ENOTFOUND') {
      console.error('Không tìm thấy máy chủ MongoDB. Vui lòng kiểm tra URI kết nối.');
    } else if (error.message.includes('authentication failed')) {
      console.error('Xác thực MongoDB thất bại. Vui lòng kiểm tra tên người dùng và mật khẩu.');
    }
    
    throw error;
  }
};

if (process.env.NODE_ENV === 'development') {
  // Trong môi trường phát triển, sử dụng biến global để lưu lại kết nối
  let globalWithMongo = global;

  if (!globalWithMongo._mongoClientPromise) {
    globalWithMongo._mongoClientPromise = connectToDatabase().catch(err => {
      console.error('Không thể khởi tạo kết nối MongoDB trong môi trường development:', err);
      // Trả về Promise đã rejected để các thao tác khác biết lỗi
      return Promise.reject(err);
    });
  }
  
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // Trong môi trường sản xuất, tạo kết nối mới
  clientPromise = connectToDatabase().catch(err => {
    console.error('Không thể khởi tạo kết nối MongoDB trong môi trường production:', err);
    // Trả về Promise đã rejected để các thao tác khác biết lỗi
    return Promise.reject(err);
  });
}

export default clientPromise; 