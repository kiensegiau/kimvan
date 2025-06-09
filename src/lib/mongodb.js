import mongoose from 'mongoose';

// Biến lưu trữ kết nối toàn cục
let cachedConnection = {
  client: null,
  mongoosePromise: null,
  isConnecting: false,
  connectionsCounter: 0
};

// Cờ để đảm bảo chỉ log một lần
let connectionLoggedOnce = false;

// Kiểm tra URI MongoDB và ghi log cảnh báo thay vì báo lỗi
if (!process.env.MONGODB_URI) {
  console.warn('CẢNH BÁO: Không tìm thấy MONGODB_URI trong biến môi trường, ứng dụng sẽ chạy ở chế độ demo');
}

/**
 * Kết nối đến MongoDB và trả về client đã được cache
 * @returns {Promise<import('mongodb').MongoClient>} MongoDB client
 */
export const getMongoClient = async () => {
  const { MongoClient } = await import('mongodb');

  // Trả về ngay nếu client đã được tạo
  if (cachedConnection.client) {
    cachedConnection.connectionsCounter++;
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Sử dụng kết nối MongoDB đã cache (lần ${cachedConnection.connectionsCounter})`);
    }
    return cachedConnection.client;
  }

  // Nếu đang trong quá trình kết nối, đợi đến khi hoàn thành
  if (cachedConnection.isConnecting) {
    while (cachedConnection.isConnecting) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return cachedConnection.client;
  }

  // Khởi tạo quá trình kết nối mới
  try {
    cachedConnection.isConnecting = true;
    const uri = process.env.MONGODB_URI;
    
    if (!uri) {
      throw new Error('MONGODB_URI không được cấu hình trong biến môi trường');
    }
    
    // Log một lần duy nhất
    if (!connectionLoggedOnce && process.env.NODE_ENV === 'development') {
      console.log('🔄 Đang khởi tạo kết nối MongoDB mới...');
      connectionLoggedOnce = true;
    }

    // Tạo client với các thông số tối ưu
    const client = new MongoClient(uri, {
      maxPoolSize: 10, // Điều chỉnh theo nhu cầu thực tế
      minPoolSize: 3,  // Duy trì ít nhất 3 kết nối
      maxIdleTimeMS: 60000, // Đóng kết nối nếu không sử dụng sau 60s
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      w: 'majority'
    });

    // Kết nối và lưu vào cache
    await client.connect();
    
    // Lưu client vào cache toàn cục
    cachedConnection.client = client;
    cachedConnection.connectionsCounter = 1;

    // Thiết lập xử lý khi ứng dụng tắt
    process.on('SIGINT', async () => {
      try {
        if (cachedConnection.client) {
          console.log('Đóng kết nối MongoDB khi tắt ứng dụng');
          await cachedConnection.client.close();
          cachedConnection.client = null;
        }
      } catch (err) {
        console.error('Lỗi khi đóng kết nối MongoDB:', err);
      }
    });

    console.log('✅ Kết nối MongoDB thành công và được cache');
    return client;
  } catch (error) {
    console.error('❌ Lỗi kết nối MongoDB:', error.message);
    cachedConnection.isConnecting = false;
    throw error;
  } finally {
    cachedConnection.isConnecting = false;
  }
};

/**
 * Kết nối đến MongoDB sử dụng Mongoose và trả về kết nối
 */
export const connectDB = async () => {
  // Trả về ngay nếu Mongoose đã kết nối
  if (mongoose.connection.readyState === 1) {
    cachedConnection.connectionsCounter++;
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Sử dụng kết nối Mongoose đã cache (lần ${cachedConnection.connectionsCounter})`);
    }
    return;
  }

  // Nếu đang kết nối, đợi đến khi hoàn thành
  if (cachedConnection.isConnecting) {
    while (cachedConnection.isConnecting) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return;
  }

  // Bắt đầu quá trình kết nối mới
  try {
    cachedConnection.isConnecting = true;
    
    // Lấy URI từ biến môi trường
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI không được cấu hình trong biến môi trường');
    }
    
    // Tạo Promise kết nối
    if (!cachedConnection.mongoosePromise) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Khởi tạo kết nối Mongoose mới...');
      }
      
      // Thiết lập các tùy chọn kết nối tối ưu
      cachedConnection.mongoosePromise = mongoose.connect(uri, {
        bufferCommands: false,
        maxPoolSize: 10,
        minPoolSize: 3,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
        serverSelectionTimeoutMS: 10000
      });
    }
    
    // Đợi kết nối hoàn tất
    await cachedConnection.mongoosePromise;
    cachedConnection.connectionsCounter++;
    
    if (process.env.NODE_ENV === 'development' && !connectionLoggedOnce) {
      console.log('✅ Kết nối Mongoose thành công');
      connectionLoggedOnce = true;
    }
    
    return;
  } catch (error) {
    console.error('❌ Lỗi kết nối Mongoose:', error.message);
    cachedConnection.mongoosePromise = null;
    throw error;
  } finally {
    cachedConnection.isConnecting = false;
  }
};

// Bắt sự kiện kết nối thành công
mongoose.connection.on('connected', () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('✅ Mongoose đã kết nối với MongoDB');
  }
});

// Bắt sự kiện ngắt kết nối và reset cache
mongoose.connection.on('disconnected', () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('❌ Mongoose đã ngắt kết nối từ MongoDB');
  }
  connectionLoggedOnce = false;
});

// Bắt sự kiện lỗi để tránh crash ứng dụng
mongoose.connection.on('error', (err) => {
  console.error('❌ Lỗi kết nối Mongoose:', err);
  connectionLoggedOnce = false;
});

// Hàm để lấy số lượng kết nối hiện tại (debug)
export const getConnectionStats = async () => {
  try {
    // Thông tin cơ bản mà không cần quyền admin
    return {
      // Trạng thái kết nối mongoose (0: đang ngắt kết nối, 1: đã kết nối, 2: đang kết nối, 3: đang ngắt kết nối)
      mongooseState: mongoose.connection.readyState,
      mongooseStateText: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState],
      
      // Thông tin từ bộ đếm nội bộ
      cachedConnectionCounter: cachedConnection.connectionsCounter,
      
      // Có kết nối MongoDB Client không
      hasMongoClient: cachedConnection.client !== null,
      
      // Có Promise kết nối Mongoose không
      hasMongoosePromise: cachedConnection.mongoosePromise !== null,
      
      // Đang trong quá trình kết nối không
      isConnecting: cachedConnection.isConnecting,
      
      // Thời gian kiểm tra
      checkedAt: new Date().toISOString()
    };
  } catch (error) {
    return { error: error.message };
  }
};

// Phương thức tương thích ngược
export const connectToDatabase = async () => {
  return await getMongoClient();
};

// Export client promise theo cách cũ để tương thích với mã hiện tại
const clientPromise = getMongoClient();
export default clientPromise; 