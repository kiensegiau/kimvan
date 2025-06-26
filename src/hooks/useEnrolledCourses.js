import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Thời gian cache - Có thể điều chỉnh dễ dàng
const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 giờ 
const MAX_CACHE_ITEMS = 5; // Giữ tối đa 5 cache items
const CACHE_KEY = 'enrolled-courses';

export function useEnrolledCourses() {
  const router = useRouter();
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cacheStatus, setCacheStatus] = useState('');
  const [userData, setUserData] = useState(null);

  // Hàm kiểm tra người dùng đã đăng ký khóa học hay chưa
  const isEnrolledInCourse = (courseId) => {
    if (!enrolledCourses || enrolledCourses.length === 0) return false;
    return enrolledCourses.some(
      course => course.courseId === courseId || course.courseId === String(courseId)
    );
  };

  // Hàm kiểm tra người dùng có quyền xem tất cả khóa học
  const hasViewAllCoursesPermission = () => {
    return userData && (userData.role === 'admin' || userData.canViewAllCourses === true);
  };

  // Hàm kiểm tra quyền truy cập khóa học (đã đăng ký hoặc có quyền xem tất cả)
  const hasAccessToCourse = (courseId, course = null) => {
    // Kiểm tra đăng ký
    const enrolled = isEnrolledInCourse(courseId);
    
    // Kiểm tra quyền xem tất cả
    const hasFullAccess = hasViewAllCoursesPermission();
    
    // Kiểm tra yêu cầu đăng ký của khóa học
    const requiresEnrollment = course ? course.requiresEnrollment !== false : true;
    
    // Nếu không yêu cầu đăng ký hoặc người dùng đã đăng ký hoặc có quyền xem tất cả
    return !requiresEnrollment || enrolled || hasFullAccess;
  };

  // Hàm lưu dữ liệu vào localStorage với quản lý cache
  const saveToCache = (data) => {
    try {
      // Tạo đối tượng cache với dữ liệu và thời gian
      const cacheItem = {
        data: data,
        timestamp: Date.now()
      };
      
      // Lưu dữ liệu khóa học vào cache
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheItem));
      
      // Dọn dẹp cache cũ
      cleanupOldCaches();
      
      setCacheStatus('saved');
    } catch (error) {
      console.error('Lỗi khi lưu cache:', error);
      // Thử xóa cache và lưu lại
      try {
        localStorage.removeItem(CACHE_KEY);
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          data: data,
          timestamp: Date.now()
        }));
      } catch (e) {
        // Xử lý lỗi im lặng nếu vẫn không thể lưu
      }
    }
  };

  // Hàm dọn dẹp các cache cũ
  const cleanupOldCaches = () => {
    try {
      // Lấy tất cả keys trong localStorage
      const keys = Object.keys(localStorage);
      
      // Lọc các key liên quan đến cache khóa học
      const courseCacheKeys = keys.filter(key => 
        key.startsWith('courses-') || key === CACHE_KEY
      );
      
      // Nếu có quá nhiều cache (sử dụng hằng số MAX_CACHE_ITEMS)
      if (courseCacheKeys.length > MAX_CACHE_ITEMS) {
        // Tạo mảng các đối tượng cache với key và timestamp
        const cacheItems = [];
        
        for (const key of courseCacheKeys) {
          try {
            const item = JSON.parse(localStorage.getItem(key));
            if (item && item.timestamp) {
              cacheItems.push({ key, timestamp: item.timestamp });
            }
          } catch (e) {
            // Bỏ qua cache không hợp lệ
            localStorage.removeItem(key);
          }
        }
        
        // Sắp xếp theo thời gian, cũ nhất lên đầu
        cacheItems.sort((a, b) => a.timestamp - b.timestamp);
        
        // Xóa các cache cũ nhất, giữ lại số lượng cache theo MAX_CACHE_ITEMS
        for (let i = 0; i < cacheItems.length - MAX_CACHE_ITEMS; i++) {
          localStorage.removeItem(cacheItems[i].key);
        }
      }
    } catch (e) {
      // Bỏ qua lỗi khi dọn dẹp cache
    }
  };

  // Hàm lấy dữ liệu từ localStorage
  const getFromCache = () => {
    try {
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (!cachedData) return null;
      
      const cacheItem = JSON.parse(cachedData);
      const now = Date.now();
      
      // Kiểm tra xem cache có còn hiệu lực không (12 giờ)
      if (now - cacheItem.timestamp > CACHE_DURATION) {
        localStorage.removeItem(CACHE_KEY);
        setCacheStatus('expired');
        return null;
      }
      
      setCacheStatus('hit');
      return cacheItem.data;
    } catch (error) {
      console.error('Lỗi khi đọc cache:', error);
      // Xóa cache lỗi
      try {
        localStorage.removeItem(CACHE_KEY);
      } catch (e) {
        // Bỏ qua nếu không thể xóa
      }
      return null;
    }
  };

  // Hàm để tải danh sách khóa học đã đăng ký từ API
  const fetchEnrolledCourses = async () => {
    try {
      setLoading(true);
      setError(null);

      // Kiểm tra cache trước
      const cachedData = getFromCache();
      if (cachedData) {
        setEnrolledCourses(cachedData.enrolledCourses);
        setAllCourses(cachedData.allCourses);
        setUserData(cachedData.userData); // Lưu userData từ cache
        setLoading(false);
        return;
      }

      // Lấy thông tin người dùng
      const userResponse = await fetch('/api/users/me');
      let currentUserData = null;
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.success && userData.data) {
          currentUserData = userData.data;
          setUserData(currentUserData);
        }
      }

      // Lấy danh sách khóa học đã đăng ký
      const enrollmentsResponse = await fetch('/api/enrollments');
      
      if (!enrollmentsResponse.ok) {
        if (enrollmentsResponse.status === 401) {
          setError('Bạn cần đăng nhập để xem khóa học đã đăng ký');
          return;
        }
        
        const errorData = await enrollmentsResponse.json().catch(() => ({}));
        const errorMessage = errorData.error || `Lỗi ${enrollmentsResponse.status}: ${enrollmentsResponse.statusText}`;
        throw new Error(errorMessage);
      }
      
      const enrollmentsData = await enrollmentsResponse.json();
      if (!enrollmentsData.success || !enrollmentsData.data) {
        throw new Error('Không thể lấy được danh sách khóa học đã đăng ký');
      }
      
      const enrollments = enrollmentsData.data;
      setEnrolledCourses(enrollments);
      
      // Lấy thêm thông tin chi tiết của tất cả khóa học
      const coursesResponse = await fetch('/api/minicourses');
      if (coursesResponse.ok) {
        const coursesData = await coursesResponse.json();
        if (coursesData && coursesData.success && coursesData.data && Array.isArray(coursesData.data.minicourses)) {
          setAllCourses(coursesData.data.minicourses);
          
          // Lưu vào cache
          saveToCache({
            enrolledCourses: enrollments,
            allCourses: coursesData.data.minicourses,
            userData: currentUserData
          });
        }
      }
    } catch (err) {
      setError(err.message || 'Đã xảy ra lỗi khi tải dữ liệu khóa học.');
    } finally {
      setLoading(false);
    }
  };

  // Hàm làm mới dữ liệu
  const refreshEnrollments = () => {
    setLoading(true);
    
    // Xóa cache khi làm mới để đảm bảo lấy dữ liệu mới
    try {
      localStorage.removeItem(CACHE_KEY);
      setCacheStatus('cleared');
    } catch (error) {
      console.error('Lỗi khi xóa cache:', error);
    }
    
    // Chờ 300ms để hiển thị trạng thái loading trước khi fetch
    setTimeout(() => {
      fetchEnrolledCourses();
    }, 300);
  };

  // Tìm thông tin chi tiết khóa học
  const findCourseDetails = (courseId) => {
    return allCourses.find(course => 
      course._id === courseId || course.courseId === courseId
    );
  };

  // Lấy các khóa học đã đăng ký với thông tin chi tiết
  const getEnrolledCoursesWithDetails = () => {
    if (!enrolledCourses.length) return [];
    
    return enrolledCourses.map(enrollment => {
      const courseDetails = findCourseDetails(enrollment.courseId);
      return {
        ...enrollment,
        details: courseDetails || null
      };
    });
  };

  useEffect(() => {
    // Kiểm tra xem có dữ liệu trong cache không trước khi fetch
    const cachedData = getFromCache();
    if (cachedData) {
      setEnrolledCourses(cachedData.enrolledCourses);
      setAllCourses(cachedData.allCourses);
      setUserData(cachedData.userData);
      setLoading(false);
    } else {
      fetchEnrolledCourses();
    }
  }, []);

  return {
    enrolledCourses,
    allCourses, 
    userData,
    loading,
    error,
    cacheStatus,
    refreshEnrollments,
    getEnrolledCoursesWithDetails,
    findCourseDetails,
    isEnrolledInCourse,
    hasViewAllCoursesPermission,
    hasAccessToCourse
  };
}

export default useEnrolledCourses; 