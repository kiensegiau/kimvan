import { useState, useEffect } from 'react';

const useUserData = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Giảm thời gian cache xuống 1 phút để đảm bảo dữ liệu được cập nhật thường xuyên
  const CACHE_TTL = 1 * 60 * 1000; // 1 phút

  useEffect(() => {
    // Tạo biến để kiểm tra xem component còn mounted không
    let isMounted = true;

    const fetchUserData = async (forceRefresh = false) => {
      try {
        setLoading(true);
        
        // Kiểm tra xem có dữ liệu user có hiệu lực trong global cache không
        const now = Date.now();
        if (!forceRefresh && window.__USER_DATA_CACHE__ && 
            window.__USER_DATA_TIMESTAMP__ && 
            (now - window.__USER_DATA_TIMESTAMP__) < CACHE_TTL) {
          if (isMounted) {
            setUserData(window.__USER_DATA_CACHE__);
            setLoading(false);
          }
          return;
        }
        
        // THÊM: Kiểm tra thông tin từ cookie user_info trước
        try {
          console.log('🍪 Đang kiểm tra cookie user_info...');
          const cookies = document.cookie;
          console.log('📋 Danh sách cookies:', cookies);
          
          const userInfoCookie = cookies
            .split('; ')
            .find(row => row.startsWith('user_info='));
            
          if (userInfoCookie) {
            const cookieValue = userInfoCookie.split('=')[1];
            const decodedValue = decodeURIComponent(cookieValue);
            console.log('🔄 Cookie user_info đã giải mã:', decodedValue);
            
            try {
              const parsedUserInfo = JSON.parse(decodedValue);
              console.log('✅ Đã tìm thấy user_info cookie:', parsedUserInfo);
              
              if (parsedUserInfo && parsedUserInfo.uid) {
                // Tính toán hasViewAllPermission
                const hasViewAllPermission = parsedUserInfo.canViewAllCourses === true || 
                  (parsedUserInfo.permissions && Array.isArray(parsedUserInfo.permissions) && 
                   parsedUserInfo.permissions.includes('view_all_courses'));

                // Thêm hasViewAllPermission vào userData
                const enhancedUserData = {
                  ...parsedUserInfo,
                  hasViewAllPermission
                };
                
                // Lưu vào global cache
                window.__USER_DATA_CACHE__ = enhancedUserData;
                window.__USER_DATA_TIMESTAMP__ = Date.now();
                
                if (isMounted) {
                  setUserData(enhancedUserData);
                  setLoading(false);
                }
                
                // Lưu thông tin người dùng vào localStorage để dùng khi offline
                try {
                  localStorage.setItem('userData', JSON.stringify(enhancedUserData));
                  localStorage.setItem('userDataTimestamp', Date.now().toString());
                } catch (e) {
                  console.error('Không thể lưu vào localStorage:', e);
                }
                
                return; // Không cần gọi API nếu đã có thông tin từ cookie
              }
            } catch (parseError) {
              console.error('❌ Lỗi khi parse JSON từ cookie:', parseError);
            }
          } else {
            console.log('⚠️ Không tìm thấy user_info cookie, sẽ tiếp tục gọi API');
          }
        } catch (cookieError) {
          console.error('❌ Lỗi khi đọc cookie user_info:', cookieError);
        }
        
        // Luôn ưu tiên lấy dữ liệu từ API nếu không có cookie
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
              // Thêm timestamp để tránh cache
              cache: 'no-cache',
              // Thêm timeout để tránh fetch quá lâu
              signal: AbortSignal.timeout(10000) // 10 giây timeout
            };
            
            // Add body for POST requests
            if (endpoint === '/api/auth/user-role') {
              options.body = JSON.stringify({ uid: 'anonymous-fallback' });
            }
            
            const response = await fetch(`${endpoint}?_=${now}`, options);
            
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
                    signal: AbortSignal.timeout(10000),
                    cache: 'no-cache'
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
          console.log('✅ Lấy dữ liệu người dùng thành công:', userData);
          
          // Tính toán canViewAllCourses dựa trên permissions
          userData.canViewAllCourses = userData.canViewAllCourses === true || 
            (userData.permissions && Array.isArray(userData.permissions) && 
             userData.permissions.includes('view_all_courses'));
          
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
            
            // Chỉ sử dụng cache nếu nó tồn tại và không quá cũ
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
    
    // Thêm event listener để làm mới dữ liệu người dùng khi chuyển trang
    const handleRouteChange = () => {
      console.log('Đường dẫn thay đổi, làm mới thông tin người dùng');
      fetchUserData(true); // Force refresh khi chuyển trang
    };
    
    // Thêm event listener cho navigation events
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', handleRouteChange);
      
      // Cho Next.js router events nếu có
      try {
        const { Router } = require('next/router');
        Router.events.on('routeChangeComplete', handleRouteChange);
      } catch (e) {
        // Bỏ qua nếu không thể sử dụng Next.js Router events
      }
    }

    fetchUserData();

    return () => {
      isMounted = false;
      // Cleanup event listeners
      if (typeof window !== 'undefined') {
        window.removeEventListener('popstate', handleRouteChange);
        
        try {
          const { Router } = require('next/router');
          Router.events.off('routeChangeComplete', handleRouteChange);
        } catch (e) {
          // Bỏ qua nếu không thể sử dụng Next.js Router events
        }
      }
    };
  }, []);

  const getDefaultUser = () => {
    return {
      uid: 'anonymous',
      email: 'guest@example.com',
      displayName: 'Khách',
      role: 'guest',
      roleDisplayName: 'Khách',
      additionalInfo: {},
      enrollments: []
    };
  };

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

  // Hàm để tải lại dữ liệu người dùng một cách chủ động
  const refreshUserData = async () => {
    console.log('⟳ Đang tải lại thông tin người dùng...');
    setLoading(true);
    
    try {
      // Xóa cache
      clearUserDataCache();
      
      // Gọi API để lấy thông tin mới nhất
      const response = await fetch('/api/users/me?_=' + Date.now(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        cache: 'no-cache'
      });
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.success && result.user) {
          // Cập nhật cache và state
          window.__USER_DATA_CACHE__ = result.user;
          window.__USER_DATA_TIMESTAMP__ = Date.now();
          
          // Cập nhật localStorage
          try {
            localStorage.setItem('userData', JSON.stringify(result.user));
            localStorage.setItem('userDataTimestamp', Date.now().toString());
          } catch (e) {
            console.error('Không thể lưu vào localStorage:', e);
          }
          
          setUserData(result.user);
          console.log('✅ Tải lại thông tin người dùng thành công');
          return true;
        }
      }
      
      console.error('❌ Không thể tải lại thông tin người dùng:', response.status);
      return false;
    } catch (error) {
      console.error('❌ Lỗi khi tải lại thông tin người dùng:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Hàm xóa cache người dùng
  const clearUserDataCache = () => {
    console.log('🧹 Đang xóa cache thông tin người dùng...');
    
    // Xóa cache toàn cục
    if (typeof window !== 'undefined') {
      window.__USER_DATA_CACHE__ = null;
      window.__USER_DATA_TIMESTAMP__ = 0;
    }
    
    // Xóa localStorage
    try {
      localStorage.removeItem('userData');
      localStorage.removeItem('userDataTimestamp');
    } catch (e) {
      console.error('Không thể xóa từ localStorage:', e);
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