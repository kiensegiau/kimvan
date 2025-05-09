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