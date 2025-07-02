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
        
        const response = await fetch('/api/users/me', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          credentials: 'include', // Thay same-origin bằng include để đảm bảo gửi cookie
          // Thêm timeout để tránh fetch quá lâu
          signal: AbortSignal.timeout(10000) // 10 giây timeout
        });
        
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const result = await response.json();
            
            if (result.success && result.user) {
              console.log('✅ Lấy dữ liệu người dùng từ API thành công');
              
              // Lưu vào global cache để các component khác sử dụng
              window.__USER_DATA_CACHE__ = result.user;
              window.__USER_DATA_TIMESTAMP__ = Date.now();
              
              // Lưu thông tin người dùng vào localStorage để dùng khi offline
              try {
                localStorage.setItem('userData', JSON.stringify(result.user));
                localStorage.setItem('userDataTimestamp', Date.now().toString());
                // Thêm trường tokenHash để kiểm tra tính hợp lệ của phiên
                localStorage.setItem('userTokenHash', result.tokenHash || '');
              } catch (e) {
                console.error('Không thể lưu vào localStorage:', e);
              }
              
              if (isMounted) {
                setUserData(result.user);
              }
            } else {
              console.warn('API trả về thành công nhưng không có dữ liệu người dùng hợp lệ:', result);
              if (isMounted) {
                setError('Không có dữ liệu người dùng hợp lệ');
              }
            }
          } else {
            const textContent = await response.text();
            console.warn('API không trả về JSON mà trả về:', textContent.substring(0, 200) + '...');
            if (isMounted) {
              setError('API trả về định dạng không hợp lệ');
            }
          }
        } else {
          console.warn(`API trả về lỗi ${response.status}: ${response.statusText}`);
          
          if (isMounted) {
            setError(`Lỗi ${response.status}: ${response.statusText}`);
          }
          
          // Nếu không lấy được từ API, thử lấy từ localStorage
          try {
            console.log('Thử lấy dữ liệu từ localStorage do API thất bại');
            const cachedData = localStorage.getItem('userData');
            const timestamp = localStorage.getItem('userDataTimestamp');
            const tokenHash = localStorage.getItem('userTokenHash');
            const now = Date.now();
            
            // Chỉ sử dụng cache nếu nó tồn tại, không quá 5 phút, và có tokenHash
            if (cachedData && timestamp && tokenHash && 
                (now - parseInt(timestamp)) < CACHE_TTL) {
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
              const defaultUser = {
                email: "guest@example.com",
                role: "student",
                roleDisplayName: "Học viên",
                additionalInfo: {},
                enrollments: []
              };
              
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
            const defaultUser = {
              email: "guest@example.com",
              role: "student",
              roleDisplayName: "Học viên"
            };
            
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
            const defaultUser = {
              email: "guest@example.com",
              role: "student",
              roleDisplayName: "Học viên",
              additionalInfo: {},
              enrollments: []
            };
            
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
          const defaultUser = {
            email: "guest@example.com",
            role: "student",
            roleDisplayName: "Học viên"
          };
          
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