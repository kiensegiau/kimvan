import mongoose from 'mongoose';

// Biến lưu trữ kết nối toàn cục
let cachedConnection = {
  client: null,
  mongoosePromise: null,
  isConnecting: false,
  connectionsCounter: 0,
  lastReconnectAttempt: 0
};

// Cờ để đảm bảo chỉ log một lần
let connectionLoggedOnce = false;

// Định cấu hình và hằng số
const RECONNECT_COOLDOWN = 5000; // 5 giây giữa các lần tái kết nối
const MONGODB_OPTIONS = {
  maxPoolSize: 50,       // Tăng số lượng kết nối tối đa 
  minPoolSize: 10,       // Tăng số lượng kết nối tối thiểu để đảm bảo luôn có sẵn
  socketTimeoutMS: 60000, // Tăng thời gian timeout socket
  connectTimeoutMS: 30000, // Tăng timeout kết nối
  serverSelectionTimeoutMS: 30000, // Tăng thời gian chọn server
  heartbeatFrequencyMS: 10000, // Tăng tần suất heartbeat
  retryWrites: true,
  w: 'majority'
};

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

  // Trả về ngay nếu client đã được tạo và hoạt động
  if (cachedConnection.client) {
    cachedConnection.connectionsCounter++;
    // Chỉ log khi đang ở development và số lần gọi chia hết cho 10
    if (process.env.NODE_ENV === 'development' && cachedConnection.connectionsCounter % 10 === 0) {
      console.log(`✅ Sử dụng kết nối MongoDB đã cache (lần ${cachedConnection.connectionsCounter})`);
    }
    return cachedConnection.client;
  }

  // Nếu đang trong quá trình kết nối, đợi đến khi hoàn thành
  if (cachedConnection.isConnecting) {
    // Log khi bắt đầu đợi
    console.log('⏳ Đang đợi kết nối MongoDB hiện tại hoàn thành...');
    
    // Đặt timeout để không đợi vô hạn
    const waitTimeout = setTimeout(() => {
      cachedConnection.isConnecting = false; // Reset trạng thái nếu đợi quá lâu
      console.warn('⚠️ Đã hủy đợi kết nối MongoDB sau 10 giây');
    }, 10000);
    
    while (cachedConnection.isConnecting) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    clearTimeout(waitTimeout); // Xóa timeout nếu không cần nữa
    
    if (cachedConnection.client) {
      return cachedConnection.client;
    }
  }

  // Kiểm tra thời gian tái kết nối
  const now = Date.now();
  if (now - cachedConnection.lastReconnectAttempt < RECONNECT_COOLDOWN) {
    console.log('⏳ Đợi thêm trước khi thử kết nối lại MongoDB...');
    await new Promise(resolve => setTimeout(resolve, RECONNECT_COOLDOWN));
  }
  cachedConnection.lastReconnectAttempt = now;

  // Khởi tạo quá trình kết nối mới
  try {
    cachedConnection.isConnecting = true;
    const uri = process.env.MONGODB_URI;
    
    if (!uri) {
      throw new Error('MONGODB_URI không được cấu hình trong biến môi trường');
    }
    
    // Log một lần duy nhất cho mỗi lần khởi động ứng dụng
    console.log('🔄 Đang khởi tạo kết nối MongoDB mới...');

    // Tạo client với các thông số tối ưu
    const client = new MongoClient(uri, MONGODB_OPTIONS);

    // Kết nối và lưu vào cache
    await client.connect();
    
    // Lưu client vào cache toàn cục
    cachedConnection.client = client;
    cachedConnection.connectionsCounter = 1;

    // Thiết lập xử lý khi ứng dụng tắt
    setupGracefulShutdown(client);

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
 * Thiết lập xử lý đóng kết nối khi ứng dụng tắt
 * @param {import('mongodb').MongoClient} client - MongoDB client
 */
function setupGracefulShutdown(client) {
  // Kiểm tra nếu đã thiết lập sự kiện
  if (process._mongoShutdownHandlerAdded) return;
  process._mongoShutdownHandlerAdded = true;
  
  const shutdown = async () => {
    try {
      console.log('🔄 Đóng kết nối MongoDB khi tắt ứng dụng...');
      
      // Đóng kết nối MongoDB nếu tồn tại
      if (cachedConnection.client) {
        await cachedConnection.client.close();
        cachedConnection.client = null;
      }
      
      // Đóng kết nối Mongoose nếu đang kết nối
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
      }
      
      console.log('✅ Đã đóng kết nối MongoDB thành công');
      process.exit(0);
    } catch (err) {
      console.error('❌ Lỗi khi đóng kết nối MongoDB:', err);
      process.exit(1);
    }
  };

  // Đăng ký các sự kiện tắt ứng dụng
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('exit', shutdown);
}

/**
 * Kết nối đến MongoDB sử dụng Mongoose và trả về kết nối
 */
export const connectDB = async () => {
  // Kiểm tra nếu Mongoose đã kết nối
  if (mongoose.connection.readyState === 1) {
    cachedConnection.connectionsCounter++;
    // Chỉ log khi đang ở development và số lần gọi chia hết cho 10
    if (process.env.NODE_ENV === 'development' && cachedConnection.connectionsCounter % 10 === 0) {
      console.log(`✅ Sử dụng kết nối Mongoose đã cache (lần ${cachedConnection.connectionsCounter})`);
    }
    return mongoose.connection;
  }

  // Nếu đang kết nối, đợi đến khi hoàn thành
  if (cachedConnection.isConnecting) {
    console.log('⏳ Đang đợi kết nối Mongoose hiện tại hoàn thành...');
    
    // Đặt timeout để không đợi vô hạn
    const waitTimeout = setTimeout(() => {
      cachedConnection.isConnecting = false; // Reset trạng thái nếu đợi quá lâu
      console.warn('⚠️ Đã hủy đợi kết nối Mongoose sau 10 giây');
    }, 10000);
    
    while (cachedConnection.isConnecting) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    clearTimeout(waitTimeout); // Xóa timeout nếu không cần nữa
    
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }
  }

  // Bắt đầu quá trình kết nối mới
  try {
    cachedConnection.isConnecting = true;
    
    // Lấy URI từ biến môi trường
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI không được cấu hình trong biến môi trường');
    }
    
    console.log('🔄 Khởi tạo kết nối Mongoose mới...');
    
    // Thiết lập cấu hình Mongoose toàn cục
    mongoose.set('strictQuery', false);
    
    // Thiết lập sự kiện
    setupMongooseEventHandlers();
    
    // Tạo Promise kết nối với các tùy chọn tối ưu
    cachedConnection.mongoosePromise = mongoose.connect(uri, {
      bufferCommands: false,
      ...MONGODB_OPTIONS
    });
    
    // Đợi kết nối hoàn tất
    await cachedConnection.mongoosePromise;
    cachedConnection.connectionsCounter++;
    
    console.log('✅ Kết nối Mongoose thành công');
    return mongoose.connection;
  } catch (error) {
    console.error('❌ Lỗi kết nối Mongoose:', error.message);
    cachedConnection.mongoosePromise = null;
    throw error;
  } finally {
    cachedConnection.isConnecting = false;
  }
};

/**
 * Thiết lập các sự kiện cho kết nối Mongoose
 */
function setupMongooseEventHandlers() {
  // Chỉ thiết lập một lần
  if (mongoose.connection._hasSetupEvents) return;
  mongoose.connection._hasSetupEvents = true;
  
  // Bắt sự kiện kết nối thành công
  mongoose.connection.on('connected', () => {
    console.log('✅ Mongoose đã kết nối với MongoDB');
  });
  
  // Bắt sự kiện ngắt kết nối và tự động thử kết nối lại
  mongoose.connection.on('disconnected', () => {
    console.log('❌ Mongoose đã ngắt kết nối từ MongoDB');
    
    // Reset để lần sau sẽ tạo kết nối mới
    cachedConnection.mongoosePromise = null;
    connectionLoggedOnce = false;
    
    // Thử kết nối lại sau một khoảng thời gian
    setTimeout(async () => {
      try {
        if (mongoose.connection.readyState !== 1) {
          console.log('🔄 Đang thử kết nối lại Mongoose...');
          await connectDB();
        }
      } catch (reconnectError) {
        console.error('❌ Không thể tái kết nối Mongoose:', reconnectError.message);
      }
    }, RECONNECT_COOLDOWN);
  });
  
  // Bắt sự kiện lỗi để tránh crash ứng dụng
  mongoose.connection.on('error', (err) => {
    console.error('❌ Lỗi kết nối Mongoose:', err.message);
  });
}

// Hàm để lấy số lượng kết nối hiện tại (debug)
export const getConnectionStats = async () => {
  try {
    // Thông tin cơ bản
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
      checkedAt: new Date().toISOString(),
      
      // Thời gian kể từ lần tái kết nối cuối
      timeSinceLastReconnect: Date.now() - cachedConnection.lastReconnectAttempt
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