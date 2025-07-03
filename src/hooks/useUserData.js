import { useState, useEffect } from 'react';

const useUserData = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Giảm thời gian cache xuống 5 phút
  const CACHE_TTL = 5 * 60 * 1000; // 5 phút

  useEffect(() => {
    // Tạo biến để kiểm tra xem component còn mounted không
    let isMounted = true;

    const fetchUserData = async () => {
      try {
        setLoading(true);
        
        // Kiểm tra xem có dữ liệu user có hiệu lực trong global cache không
        const now = Date.now();
        if (window.__USER_DATA_CACHE__ && 
            window.__USER_DATA_TIMESTAMP__ && 
            (now - window.__USER_DATA_TIMESTAMP__) < CACHE_TTL) {
          if (isMounted) {
            setUserData(window.__USER_DATA_CACHE__);
            setLoading(false);
          }
          return;
        }
        
        // Luôn ưu tiên lấy dữ liệu từ API trước
        console.log('Đang gọi API users/me để lấy thông tin người dùng...');
        
        // Tạo danh sách các endpoint để thử
        const endpoints = [
          '/api/users/me',
          '/api/auth/verify', // Thử endpoint này nếu /api/users/me không hoạt động
          '/api/auth/user-role' // Thử endpoint này nếu cả hai không hoạt động
        ];
        
        // Lưu trữ lỗi từ tất cả các lần thử để ghi log
        const allErrors = [];
        let userData = null;
        
        // Thử từng endpoint cho đến khi thành công
        for (const endpoint of endpoints) {
          try {
            console.log(`Đang thử lấy dữ liệu người dùng từ ${endpoint}...`);
            // Prepare options for fetch
            const options = {
              method: endpoint === '/api/auth/user-role' ? 'POST' : 'GET', // Use POST for user-role endpoint
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              credentials: 'include', // Đảm bảo gửi cookie
              // Thêm timeout để tránh fetch quá lâu
              signal: AbortSignal.timeout(10000) // 10 giây timeout
            };
            
            // Add body for POST requests
            if (endpoint === '/api/auth/user-role') {
              options.body = JSON.stringify({ uid: 'anonymous-fallback' });
            }
            
            const response = await fetch(endpoint, options);
            
            if (response.ok) {
              const contentType = response.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                const result = await response.json();
                
                // Xử lý dữ liệu khác nhau từ các endpoint khác nhau
                if (endpoint === '/api/users/me' && result.success && result.user) {
                  userData = result.user;
                  break;
                } else if (endpoint === '/api/auth/verify' && result.valid && result.user) {
                  userData = result.user;
                  break;
                } else if (endpoint === '/api/auth/user-role' && result.success) {
                  // Tạo dữ liệu cơ bản từ thông tin vai trò
                  userData = {
                    uid: result.uid || 'unknown',
                    role: result.role || 'user',
                    roleDisplayName: getRoleDisplayName(result.role || 'user'),
                    additionalInfo: {},
                    enrollments: []
                  };
                  break;
                }
              }
            } else {
              // Lưu lại lỗi chi tiết hơn cho việc debug
              const errorStatus = response.status;
              const errorText = await response.text().catch(() => 'No response text');
              allErrors.push(`${endpoint}: ${errorStatus} ${errorText.substring(0, 100)}`);
              
              // Handle specific error cases
              if (endpoint === '/api/auth/user-role' && errorStatus === 405) {
                console.warn('API user-role requires POST method - retrying with proper payload');
                // Try again with proper request body if Method Not Allowed
                try {
                  const retryResponse = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json'
                    },
                    credentials: 'include',
                                            body: JSON.stringify({ uid: 'anonymous-fallback' }), // Provide a fallback UID
                    signal: AbortSignal.timeout(10000)
                  });
                  
                  if (retryResponse.ok) {
                    const retryData = await retryResponse.json();
                    if (retryData.success) {
                      userData = {
                        uid: retryData.uid || 'unknown',
                        role: retryData.role || 'user',
                        roleDisplayName: getRoleDisplayName(retryData.role || 'user'),
                        additionalInfo: {},
                        enrollments: []
                      };
                      break;
                    }
                  }
                } catch (retryError) {
                  console.warn('Retry failed:', retryError.message);
                }
              }
            }
          } catch (fetchError) {
            allErrors.push(`${endpoint}: ${fetchError.message}`);
          }
        }
        
        // Nếu lấy được dữ liệu từ bất kỳ endpoint nào
        if (userData) {
          console.log('✅ Lấy dữ liệu người dùng thành công');
          
          // Lưu vào global cache để các component khác sử dụng
          window.__USER_DATA_CACHE__ = userData;
          window.__USER_DATA_TIMESTAMP__ = Date.now();
          
          // Lưu thông tin người dùng vào localStorage để dùng khi offline
          try {
            localStorage.setItem('userData', JSON.stringify(userData));
            localStorage.setItem('userDataTimestamp', Date.now().toString());
            localStorage.setItem('userTokenHash', 'auto-generated');
          } catch (e) {
            console.error('Không thể lưu vào localStorage:', e);
          }
          
          if (isMounted) {
            setUserData(userData);
          }
        } else {
          // Nếu tất cả các endpoint đều thất bại, ghi log lỗi
          console.warn('Tất cả các endpoint đều thất bại:', allErrors);
          
          // Thử lấy từ localStorage
          try {
            console.log('Thử lấy dữ liệu từ localStorage do API thất bại');
            const cachedData = localStorage.getItem('userData');
            const timestamp = localStorage.getItem('userDataTimestamp');
            const now = Date.now();
            
            // Chỉ sử dụng cache nếu nó tồn tại và không quá 5 phút
            if (cachedData && timestamp && (now - parseInt(timestamp)) < CACHE_TTL) {
              const parsedData = JSON.parse(cachedData);
              console.log('✅ Sử dụng dữ liệu người dùng từ cache:', parsedData);
              
              // Lưu vào global cache
              window.__USER_DATA_CACHE__ = parsedData;
              window.__USER_DATA_TIMESTAMP__ = parseInt(timestamp);
              
              if (isMounted) {
                setUserData(parsedData);
              }
            } else {
              // Fallback user data khi không có cache và API thất bại
              console.log('⚠️ Không có cache hoặc cache đã hết hạn. Sử dụng dữ liệu người dùng mặc định');
              const defaultUser = getDefaultUser();
              
              // Lưu vào global cache
              window.__USER_DATA_CACHE__ = defaultUser;
              window.__USER_DATA_TIMESTAMP__ = now;
              
              if (isMounted) {
                setUserData(defaultUser);
              }
            }
          } catch (storageErr) {
            console.error('Không thể đọc từ localStorage:', storageErr);
            // Fallback user as last resort
            const defaultUser = getDefaultUser();
            
            // Lưu vào global cache
            window.__USER_DATA_CACHE__ = defaultUser;
            window.__USER_DATA_TIMESTAMP__ = Date.now();
            
            if (isMounted) {
              setUserData(defaultUser);
            }
          }
        }
      } catch (error) {
        console.error('❌ Lỗi khi lấy thông tin người dùng:', error);
        
        if (isMounted) {
          setError(error.message);
        }
        
        // Fallback to localStorage if API request fails
        try {
          const cachedData = localStorage.getItem('userData');
          if (cachedData) {
            const parsedData = JSON.parse(cachedData);
            console.log('API lỗi, sử dụng dữ liệu từ cache:', parsedData);
            
            // Lưu vào global cache
            window.__USER_DATA_CACHE__ = parsedData;
            window.__USER_DATA_TIMESTAMP__ = Date.now();
            
            if (isMounted) {
              setUserData(parsedData);
            }
          } else {
            console.log('API lỗi, không có cache. Sử dụng dữ liệu người dùng mặc định');
            const defaultUser = getDefaultUser();
            
            // Lưu vào global cache
            window.__USER_DATA_CACHE__ = defaultUser;
            window.__USER_DATA_TIMESTAMP__ = Date.now();
            
            if (isMounted) {
              setUserData(defaultUser);
            }
          }
        } catch (storageErr) {
          console.error('Không thể đọc từ localStorage:', storageErr);
          // Fallback user as absolute last resort
          const defaultUser = getDefaultUser();
          
          // Lưu vào global cache
          window.__USER_DATA_CACHE__ = defaultUser;
          window.__USER_DATA_TIMESTAMP__ = Date.now();
          
          if (isMounted) {
            setUserData(defaultUser);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchUserData();

    // Thiết lập kiểm tra định kỳ dữ liệu người dùng
    // Tăng khoảng thời gian kiểm tra để giảm tải máy chủ
    const intervalId = setInterval(() => {
      fetchUserData();
    }, 5 * 60 * 1000); // 5 phút thay vì 2 phút

    // Cleanup function để đánh dấu component đã unmounted và hủy interval
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  // Hàm tạo dữ liệu người dùng mặc định
  const getDefaultUser = () => {
    return {
      email: "guest@example.com",
      role: "student",
      roleDisplayName: "Học viên",
      additionalInfo: {},
      enrollments: []
    };
  };

  // Hàm chuyển đổi mã vai trò thành tên đầy đủ
  function getRoleDisplayName(role) {
    const roleMap = {
      'admin': 'Quản trị viên',
      'user': 'Người dùng',
      'ctv': 'Công tác viên',
      'staff': 'Nhân viên',
      'instructor': 'Giảng viên',
      'student': 'Học viên',
      'guest': 'Khách'
    };
    
    return roleMap[role] || role;
  }

  /**
   * Làm mới dữ liệu người dùng (gọi lại API)
   */
  const refreshUserData = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/users/me', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include', // Đổi từ same-origin sang include
        signal: AbortSignal.timeout(10000) // 10 giây timeout
      });
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.success && result.user) {
          // Cập nhật lại global cache
          window.__USER_DATA_CACHE__ = result.user;
          window.__USER_DATA_TIMESTAMP__ = Date.now();
          
          // Cập nhật lại localStorage
          localStorage.setItem('userData', JSON.stringify(result.user));
          localStorage.setItem('userDataTimestamp', Date.now().toString());
          // Cập nhật trường tokenHash để kiểm tra tính hợp lệ của phiên
          localStorage.setItem('userTokenHash', result.tokenHash || '');
          
          // Cập nhật state
          setUserData(result.user);
          setError(null);
        } else {
          setError('Không có dữ liệu người dùng hợp lệ');
          
          // Xóa cache nếu API trả về lỗi xác thực
          clearUserDataCache();
        }
      } else {
        setError(`Lỗi ${response.status}: ${response.statusText}`);
        
        // Xóa cache nếu API trả về lỗi xác thực
        if (response.status === 401 || response.status === 403) {
          clearUserDataCache();
        }
      }
    } catch (error) {
      console.error('❌ Lỗi khi làm mới thông tin người dùng:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Xóa cache người dùng
   */
  const clearUserDataCache = () => {
    // Xóa global cache
    delete window.__USER_DATA_CACHE__;
    delete window.__USER_DATA_TIMESTAMP__;
    
    // Xóa localStorage
    try {
      localStorage.removeItem('userData');
      localStorage.removeItem('userDataTimestamp');
      localStorage.removeItem('userTokenHash');
    } catch (e) {
      console.error('Không thể xóa dữ liệu từ localStorage:', e);
    }
  };

  return {
    userData,
    loading,
    error,
    refreshUserData,
    clearUserDataCache
  };
};

export default useUserData; 