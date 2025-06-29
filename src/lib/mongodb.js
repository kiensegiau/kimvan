import mongoose from 'mongoose';

// Global connection object - make it truly global to ensure it's shared across all imports
// Use global._mongoConnection instead of module-level variable
if (!global._mongoConnection) {
  global._mongoConnection = {
    client: null,
    mongoosePromise: null,
    isConnecting: false,
    connectionsCounter: 0,
    lastReconnectAttempt: 0
  };
}

// Kiểm tra nếu đang trong worker thread - không kết nối đến MongoDB trong worker thread
const isWorkerThread = process.env.WORKER_THREAD === 'true';
if (isWorkerThread) {
  console.log('🧵 Worker thread phát hiện - MongoDB sẽ không được kết nối');
}

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
  // Không kết nối nếu đang trong worker thread
  if (isWorkerThread) {
    return null;
  }

  const { MongoClient } = await import('mongodb');

  // Trả về ngay nếu client đã được tạo và hoạt động
  if (global._mongoConnection.client) {
    global._mongoConnection.connectionsCounter++;
    return global._mongoConnection.client;
  }

  // Nếu đang trong quá trình kết nối, đợi đến khi hoàn thành
  if (global._mongoConnection.isConnecting) {
    // Đặt timeout để không đợi vô hạn
    const waitTimeout = setTimeout(() => {
      global._mongoConnection.isConnecting = false; // Reset trạng thái nếu đợi quá lâu
      console.warn('⚠️ Đã hủy đợi kết nối MongoDB sau 10 giây');
    }, 10000);
    
    while (global._mongoConnection.isConnecting) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    clearTimeout(waitTimeout); // Xóa timeout nếu không cần nữa
    
    if (global._mongoConnection.client) {
      return global._mongoConnection.client;
    }
  }

  // Kiểm tra thời gian tái kết nối
  const now = Date.now();
  if (now - global._mongoConnection.lastReconnectAttempt < RECONNECT_COOLDOWN) {
    await new Promise(resolve => setTimeout(resolve, RECONNECT_COOLDOWN));
  }
  global._mongoConnection.lastReconnectAttempt = now;

  // Khởi tạo quá trình kết nối mới
  try {
    global._mongoConnection.isConnecting = true;
    const uri = process.env.MONGODB_URI;
    
    if (!uri) {
      throw new Error('MONGODB_URI không được cấu hình trong biến môi trường');
    }
    
    console.log('🔄 Đang khởi tạo kết nối MongoDB mới...');

    // Tạo client với các thông số tối ưu
    const client = new MongoClient(uri, MONGODB_OPTIONS);

    // Kết nối và lưu vào cache
    await client.connect();
    
    // Lưu client vào cache toàn cục
    global._mongoConnection.client = client;
    global._mongoConnection.connectionsCounter = 1;

    // Thiết lập xử lý khi ứng dụng tắt
    setupGracefulShutdown(client);

    console.log('✅ Kết nối MongoDB thành công và được cache');
    return client;
  } catch (error) {
    console.error('❌ Lỗi kết nối MongoDB:', error.message);
    global._mongoConnection.isConnecting = false;
    throw error;
  } finally {
    global._mongoConnection.isConnecting = false;
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
      if (global._mongoConnection.client) {
        await global._mongoConnection.client.close();
        global._mongoConnection.client = null;
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
  // Không kết nối nếu đang trong worker thread
  if (isWorkerThread) {
    return null;
  }

  // Kiểm tra nếu Mongoose đã kết nối
  if (mongoose.connection.readyState === 1) {
    global._mongoConnection.connectionsCounter++;
    return mongoose.connection;
  }

  // Nếu đang kết nối, đợi đến khi hoàn thành
  if (global._mongoConnection.isConnecting) {
    // Đặt timeout để không đợi vô hạn
    const waitTimeout = setTimeout(() => {
      global._mongoConnection.isConnecting = false; // Reset trạng thái nếu đợi quá lâu
      console.warn('⚠️ Đã hủy đợi kết nối Mongoose sau 10 giây');
    }, 10000);
    
    while (global._mongoConnection.isConnecting) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    clearTimeout(waitTimeout); // Xóa timeout nếu không cần nữa
    
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }
  }

  // Bắt đầu quá trình kết nối mới
  try {
    global._mongoConnection.isConnecting = true;
    
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
    global._mongoConnection.mongoosePromise = mongoose.connect(uri, {
      bufferCommands: false,
      ...MONGODB_OPTIONS
    });
    
    // Đợi kết nối hoàn tất
    await global._mongoConnection.mongoosePromise;
    global._mongoConnection.connectionsCounter++;
    
    console.log('✅ Kết nối Mongoose thành công');
    return mongoose.connection;
  } catch (error) {
    console.error('❌ Lỗi kết nối Mongoose:', error.message);
    global._mongoConnection.mongoosePromise = null;
    throw error;
  } finally {
    global._mongoConnection.isConnecting = false;
  }
};

/**
 * Thiết lập các sự kiện cho kết nối Mongoose
 */
function setupMongooseEventHandlers() {
  // Đã kết nối
  mongoose.connection.on('connected', () => {
    console.log('Mongoose đã kết nối thành công');
  });

  // Đã ngắt kết nối
  mongoose.connection.on('disconnected', () => {
    console.log('Mongoose đã ngắt kết nối');
  });

  // Lỗi kết nối
  mongoose.connection.on('error', (err) => {
    console.error('Lỗi kết nối Mongoose:', err);
  });
}

/**
 * Lấy thống kê kết nối MongoDB
 */
export const getConnectionStats = async () => {
  try {
    // Kiểm tra nếu không có kết nối
    if (!global._mongoConnection.client) {
      return {
        isConnected: false,
        stats: null,
        mongooseState: mongoose.connection.readyState
      };
    }

    // Lấy thông tin từ admin database
    const admin = global._mongoConnection.client.db().admin();
    const serverStatus = await admin.serverStatus();

    // Trả về thông tin kết nối
    return {
      isConnected: true,
      stats: {
        connections: serverStatus.connections,
        uptime: serverStatus.uptime,
        version: serverStatus.version,
        process: serverStatus.process
      },
      mongooseState: mongoose.connection.readyState
    };
  } catch (error) {
    console.error('Lỗi khi lấy thống kê kết nối:', error);
    return {
      isConnected: false,
      error: error.message,
      mongooseState: mongoose.connection.readyState
    };
  }
};

/**
 * Hàm kết nối đến cơ sở dữ liệu, ưu tiên sử dụng Mongoose
 */
export const connectToDatabase = async () => {
  return await getMongoClient();
};

// Export client promise theo cách cũ để tương thích với mã hiện tại
const clientPromise = getMongoClient();
export default clientPromise; 