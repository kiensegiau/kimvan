/**
 * Phiên bản giả lập của auth-client.js
 * Không sử dụng Firebase Client SDK để tránh lỗi auth/invalid-api-key
 */

// Lưu trữ người dùng giả lập
let mockCurrentUser = null;
const mockAuthListeners = [];

/**
 * Đăng nhập với email và mật khẩu
 * @param {string} email - Email người dùng
 * @param {string} password - Mật khẩu
 * @returns {Promise<Object>} - Thông tin đăng nhập
 */
export const loginWithEmailPassword = async (email, password) => {
  try {
    // Trong môi trường phát triển, chấp nhận bất kỳ email/mật khẩu nào
    if (process.env.NODE_ENV === 'development') {
      // Tạo người dùng giả lập
      mockCurrentUser = {
        uid: 'mock-user-1',
        email: email,
        emailVerified: true,
        displayName: 'Người dùng giả lập',
        photoURL: null,
        getIdToken: () => Promise.resolve('mock-token'),
      };
      
      // Thông báo cho tất cả listeners
      mockAuthListeners.forEach(callback => callback(mockCurrentUser));
      
      return {
        user: mockCurrentUser
      };
    }
    
    // Trong môi trường production, sử dụng API đăng nhập
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Đăng nhập thất bại');
    }
    
    return {
      user: data.user
    };
  } catch (error) {
    console.error('Lỗi đăng nhập:', error);
    throw new Error(error.message || 'Đã xảy ra lỗi khi đăng nhập');
  }
};

/**
 * Đăng ký tài khoản mới
 * @param {string} email - Email người dùng
 * @param {string} password - Mật khẩu
 * @returns {Promise<Object>} - Thông tin đăng ký
 */
export const registerWithEmailPassword = async (email, password) => {
  try {
    // Trong môi trường phát triển, chấp nhận bất kỳ email/mật khẩu nào
    if (process.env.NODE_ENV === 'development') {
      // Tạo người dùng giả lập
      mockCurrentUser = {
        uid: `mock-user-${Date.now()}`,
        email: email,
        emailVerified: false,
        displayName: null,
        photoURL: null,
        getIdToken: () => Promise.resolve('mock-token'),
      };
      
      // Thông báo cho tất cả listeners
      mockAuthListeners.forEach(callback => callback(mockCurrentUser));
      
      return {
        user: mockCurrentUser
      };
    }
    
    // Trong môi trường production, sử dụng API đăng ký
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Đăng ký thất bại');
    }
    
    return {
      user: data.user
    };
  } catch (error) {
    console.error('Lỗi đăng ký:', error);
    throw new Error(error.message || 'Đã xảy ra lỗi khi đăng ký');
  }
};

/**
 * Đăng xuất người dùng hiện tại
 * @returns {Promise<void>}
 */
export const logout = async () => {
  try {
    // Xóa cookie ở phía client
    document.cookie = `auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; ${location.protocol === 'https:' ? 'Secure;' : ''}`;
    
    // Trong môi trường phát triển, chỉ cần xóa người dùng giả lập
    if (process.env.NODE_ENV === 'development') {
      mockCurrentUser = null;
      
      // Thông báo cho tất cả listeners
      mockAuthListeners.forEach(callback => callback(null));
    }
    
    // Trong mọi môi trường, gọi API đăng xuất
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin' // Đảm bảo gửi cookie hiện tại
    });
    
    // Thực hiện hard reload để đảm bảo tất cả state được làm mới
    window.location.href = '/login';
  } catch (error) {
    console.error('Lỗi đăng xuất:', error);
    throw new Error('Đã xảy ra lỗi khi đăng xuất');
  }
};

/**
 * Gửi email đặt lại mật khẩu
 * @param {string} email - Email người dùng
 * @returns {Promise<void>}
 */
export const resetPassword = async (email) => {
  try {
    // Trong môi trường phát triển, không làm gì cả
    if (process.env.NODE_ENV === 'development') {
      console.log('Gửi email đặt lại mật khẩu cho:', email);
      return;
    }
    
    // Trong môi trường production, gọi API đặt lại mật khẩu
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Không thể gửi email đặt lại mật khẩu');
    }
  } catch (error) {
    console.error('Lỗi gửi email đặt lại mật khẩu:', error);
    throw new Error(error.message || 'Đã xảy ra lỗi khi gửi email đặt lại mật khẩu');
  }
};

/**
 * Lấy người dùng hiện tại
 * @returns {Object|null} - Người dùng hiện tại hoặc null nếu chưa đăng nhập
 */
export const getCurrentUser = () => {
  // Trong môi trường phát triển, trả về người dùng giả lập
  if (process.env.NODE_ENV === 'development') {
    return mockCurrentUser;
  }
  
  // Trong môi trường production, sử dụng cookie để kiểm tra
  const getCookie = name => {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  };
  
  const token = getCookie('auth-token');
  
  if (!token) return null;
  
  // Trả về một đối tượng giả lập với phương thức getIdToken
  return {
    getIdToken: () => Promise.resolve(token)
  };
};

/**
 * Theo dõi thay đổi trạng thái xác thực
 * @param {function} callback - Hàm callback nhận người dùng (User hoặc null)
 * @returns {function} - Hàm hủy theo dõi
 */
export const onAuthStateChanged = (callback) => {
  // Trong môi trường phát triển, thêm callback vào danh sách listeners
  if (process.env.NODE_ENV === 'development') {
    mockAuthListeners.push(callback);
    
    // Gọi callback ngay lập tức với trạng thái hiện tại
    setTimeout(() => callback(mockCurrentUser), 0);
    
    // Trả về hàm hủy theo dõi
    return () => {
      const index = mockAuthListeners.indexOf(callback);
      if (index !== -1) {
        mockAuthListeners.splice(index, 1);
      }
    };
  }
  
  // Trong môi trường production, kiểm tra cookie
  const checkAuth = () => {
    const getCookie = name => {
      if (typeof document === 'undefined') return null;
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop().split(';').shift();
      return null;
    };
    
    const token = getCookie('auth-token');
    
    if (token) {
      // Nếu có token, gọi callback với một đối tượng giả lập
      callback({
        getIdToken: () => Promise.resolve(token)
      });
    } else {
      // Nếu không có token, gọi callback với null
      callback(null);
    }
  };
  
  // Gọi checkAuth ngay lập tức
  setTimeout(checkAuth, 0);
  
  // Trả về hàm hủy theo dõi (không làm gì cả trong trường hợp này)
  return () => {};
};

/**
 * Làm mới token xác thực
 * @param {boolean} rememberMe - Có sử dụng thời gian sống dài hơn không
 * @returns {Promise<boolean>} - Kết quả làm mới token
 */
export const refreshToken = async (rememberMe = true) => {
  try {
    console.log('🔄 Bắt đầu quá trình làm mới token');
    // Gọi API làm mới token
    const response = await fetch('/api/auth/refresh-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rememberMe }),
      credentials: 'same-origin'
    });
    
    console.log('🔄 Đã nhận phản hồi từ API làm mới token:', response.status, response.statusText);
    const data = await response.json();
    console.log('🔄 Dữ liệu phản hồi:', data);
    
    if (!response.ok) {
      throw new Error(data.error || 'Không thể làm mới token');
    }
    
    console.log('✅ Làm mới token thành công');
    return true;
  } catch (error) {
    console.error('❌ Lỗi làm mới token:', error);
    return false;
  }
};

/**
 * Kiểm tra thời gian hết hạn của token và tự động làm mới nếu cần
 * @param {number} thresholdMinutes - Ngưỡng thời gian (phút) trước khi token hết hạn để làm mới
 * @returns {Promise<boolean>} - Kết quả kiểm tra và làm mới token
 */
export const checkAndRefreshTokenIfNeeded = async (thresholdMinutes = 30) => {
  try {
    console.log('🔍 Bắt đầu kiểm tra token...');
    // Gọi API kiểm tra token
    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin'
    });
    
    console.log('🔍 Đã nhận phản hồi từ API verify:', response.status, response.statusText);
    const data = await response.json();
    console.log('🔍 Dữ liệu phản hồi verify:', data);
    
    if (!response.ok || !data.valid) {
      console.log('❌ Token không hợp lệ hoặc đã hết hạn');
      return false;
    }
    
    // Kiểm tra thời gian còn lại của token
    const user = data.user;
    if (!user || !user.tokenExpiration) {
      console.log('❓ Không có thông tin về thời hạn token');
      return false;
    }
    
    const now = Date.now();
    const thresholdMs = thresholdMinutes * 60 * 1000;
    const timeLeft = user.tokenExpiration - now;
    
    console.log(`🕒 Thời gian còn lại của token: ${Math.floor(timeLeft / 60000)} phút (ngưỡng: ${thresholdMinutes} phút)`);
    
    // Nếu token sắp hết hạn, làm mới token
    if (timeLeft < thresholdMs) {
      console.log(`⚠️ Token sắp hết hạn (còn ${Math.floor(timeLeft / 60000)} phút), tiến hành làm mới`);
      return await refreshToken(true); // Sử dụng thời gian sống dài
    }
    
    // Token vẫn còn hiệu lực và chưa cần làm mới
    console.log(`✅ Token còn hiệu lực (còn ${Math.floor(timeLeft / 60000)} phút)`);
    return true;
  } catch (error) {
    console.error('❌ Lỗi kiểm tra thời hạn token:', error);
    return false;
  }
};

/**
 * Thiết lập kiểm tra token định kỳ
 * @param {number} intervalMinutes - Khoảng thời gian (phút) giữa các lần kiểm tra
 * @returns {number} - ID của interval để có thể hủy sau này
 */
export const setupTokenRefreshInterval = (intervalMinutes = 15) => {
  if (typeof window === 'undefined') return null;
  
  console.log(`⏱️ Thiết lập kiểm tra token định kỳ mỗi ${intervalMinutes} phút`);
  
  // Chuyển đổi phút thành mili giây
  const intervalMs = intervalMinutes * 60 * 1000;
  
  // Thiết lập interval để kiểm tra và làm mới token định kỳ
  const intervalId = setInterval(async () => {
    console.log(`⏰ Đang thực hiện kiểm tra token định kỳ (${new Date().toLocaleTimeString()})`);
    const user = getCurrentUser();
    if (user) {
      console.log('👤 Tìm thấy người dùng, tiến hành kiểm tra token');
      await checkAndRefreshTokenIfNeeded();
    } else {
      // Nếu không có người dùng, hủy interval
      console.log('⛔ Không tìm thấy người dùng, hủy interval kiểm tra token');
      clearInterval(intervalId);
    }
  }, intervalMs);
  
  console.log(`✅ Đã thiết lập interval kiểm tra token với ID: ${intervalId}`);
  return intervalId;
}; 