import { useState, useEffect, useCallback } from 'react';
import CryptoJS from 'crypto-js';
import useEnrolledCourses from '@/hooks/useEnrolledCourses';

// Khóa mã hóa - phải giống với khóa ở phía server
const ENCRYPTION_KEY = 'kimvan-secure-key-2024';
// Thời gian cache - 12 giờ tính bằng milliseconds
const CACHE_DURATION = 12 * 60 * 60 * 1000;
// Phiên bản cache hiện tại
const CACHE_VERSION = '1.1';
// Key quyền truy cập
const PERMISSION_KEYS = {
  isEnrolled: 'isEnrolled',
  canViewAllCourses: 'canViewAllCourses'
};

// Thời gian sống của cache (1 giờ)
const CACHE_TTL = 60 * 60 * 1000;
// Khóa lưu trữ cho tất cả cache của khóa học
const COURSE_CACHE_KEY = 'courseDataCache';
// Giới hạn số lượng cache được lưu trữ
const CACHE_LIMIT = 15;

export function useCourseData(id, userData = null, userLoading = false) {
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeSheet, setActiveSheet] = useState(0);
  const [linkedSheets, setLinkedSheets] = useState([]);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [sheetData, setSheetData] = useState({});
  const [loadingSheetData, setLoadingSheetData] = useState({});
  const [cacheStatus, setCacheStatus] = useState('');
  const [permissionChecked, setPermissionChecked] = useState(false);
  
  // Sử dụng hook useEnrolledCourses để lấy danh sách khóa học đã đăng ký và hàm kiểm tra
  const { 
    enrolledCourses,
    loading: enrolledCoursesLoading,
    isEnrolledInCourse
  } = useEnrolledCourses();

  // Hàm giải mã dữ liệu với xử lý lỗi
  const decryptData = (encryptedData) => {
    try {
      if (!encryptedData) {
        throw new Error("Không có dữ liệu được mã hóa");
      }
      
      // Giải mã dữ liệu
      const decryptedBytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
      if (!decryptedBytes) {
        throw new Error("Giải mã không thành công");
      }
      
      const decryptedText = decryptedBytes.toString(CryptoJS.enc.Utf8);
      if (!decryptedText || decryptedText.length === 0) {
        throw new Error("Dữ liệu giải mã không hợp lệ");
      }
      
      return JSON.parse(decryptedText);
    } catch (error) {
      // Xử lý lỗi im lặng
      throw new Error(`Không thể giải mã: ${error.message}`);
    }
  };

  // Hàm kiểm tra quyền truy cập
  const checkPermission = (courseData) => {
    // Nếu không có dữ liệu khoá học, không có quyền truy cập
    if (!courseData) {
      return false;
    }
    
    // Nếu đang tải thông tin người dùng, chưa thể xác định quyền truy cập
    if (userLoading) {
      return null; // Trả về null để biết rằng việc kiểm tra quyền chưa hoàn tất
    }
    
    // Kiểm tra thuộc tính canViewAllCourses
    if (userData && userData.canViewAllCourses === true) {
      return true;
    }
    
    // Kiểm tra quyền từ mảng permissions
    if (userData && userData.permissions && Array.isArray(userData.permissions) && 
        userData.permissions.includes('view_all_courses')) {
      return true;
    }
    
    // Kiểm tra role admin
    if (userData && userData.role === 'admin') {
      return true;
    }
    
    // Kiểm tra yêu cầu đăng ký của khóa học
    const requiresEnrollment = courseData?.requiresEnrollment !== false;
    
    if (!requiresEnrollment) {
      return true;
    }
    
    // Kiểm tra đăng ký - kiểm tra cả MongoDB ID và kimvanId
    
    // Lấy thông tin MongoDB ID và kimvanId từ dữ liệu khóa học
    const mongoDbId = courseData._id ? String(courseData._id) : null;
    const kimvanId = courseData.kimvanId ? String(courseData.kimvanId) : null;
    
    // Kiểm tra đăng ký với cả hai loại ID
    let isUserEnrolled = false;
    
    if (isEnrolledInCourse) {
      // Kiểm tra với ID hiện tại (có thể là MongoDB ID hoặc kimvanId)
      isUserEnrolled = isEnrolledInCourse(id);
      
      // Nếu không tìm thấy, thử kiểm tra với MongoDB ID
      if (!isUserEnrolled && mongoDbId && mongoDbId !== id) {
        isUserEnrolled = isEnrolledInCourse(mongoDbId);
      }
      
      // Nếu vẫn không tìm thấy, thử kiểm tra với kimvanId
      if (!isUserEnrolled && kimvanId && kimvanId !== id) {
        isUserEnrolled = isEnrolledInCourse(kimvanId);
      }
    }
    
    if (isUserEnrolled) {
      return true;
    }
    
    return false;
  };
  
  // Hàm lưu dữ liệu vào cache
  const saveToCache = (data) => {
    try {
      // Check if running in browser environment
      if (typeof window === 'undefined') return false;
      
      // Thêm thời gian hết hạn và phiên bản cache
      const cacheData = {
        ...data,
        _cacheExpires: Date.now() + CACHE_DURATION,
        _cacheVersion: CACHE_VERSION
      };
      
      // Lưu dữ liệu vào cache
      const cacheKey = `course-detail-${id}`;
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      
      // Dọn dẹp cache cũ
      cleanupOldCaches();
      
      setCacheStatus('saved');
      return true;
    } catch (error) {
      // Xử lý lỗi im lặng
      return false;
    }
  };
  
  // Hàm lấy dữ liệu từ cache
  const getFromCache = () => {
    try {
      // Check if running in browser environment
      if (typeof window === 'undefined') return null;
      
      const cacheKey = `course-detail-${id}`;
      const cachedData = localStorage.getItem(cacheKey);
      if (!cachedData) return null;
      
      const parsedData = JSON.parse(cachedData);
      
      // Kiểm tra phiên bản cache
      if (parsedData._cacheVersion !== CACHE_VERSION) {
        clearCurrentCache();
        return null;
      }
      
      // Kiểm tra thời gian hết hạn
      if (parsedData._cacheExpires < Date.now()) {
        clearCurrentCache();
        setCacheStatus('expired');
        return null;
      }
      
      setCacheStatus('hit');
      return parsedData;
    } catch (error) {
      clearCurrentCache();
      return null;
    }
  };
  
  // Hàm dọn dẹp các cache cũ
  const cleanupOldCaches = () => {
    try {
      // Check if running in browser environment
      if (typeof window === 'undefined') return;
      
      // Lấy tất cả keys trong localStorage
      const keys = Object.keys(localStorage);
      
      // Lọc các key liên quan đến cache chi tiết khóa học
      const courseCacheKeys = keys.filter(key => key.startsWith('course-detail-'));
      
      // Nếu có quá nhiều cache
      const MAX_CACHE_ITEMS = 5;
      if (courseCacheKeys.length > MAX_CACHE_ITEMS) {
        // Tạo mảng các đối tượng cache với key và timestamp
        const cacheItems = [];
        
        for (const key of courseCacheKeys) {
          try {
            const item = JSON.parse(localStorage.getItem(key));
            if (item && item._cacheExpires) {
              cacheItems.push({ key, timestamp: item._cacheExpires });
            }
          } catch (e) {
            // Xóa cache không hợp lệ
            localStorage.removeItem(key);
          }
        }
        
        // Sắp xếp theo thời gian, cũ nhất lên đầu
        cacheItems.sort((a, b) => a.timestamp - b.timestamp);
        
        // Xóa các cache cũ nhất
        for (let i = 0; i < cacheItems.length - MAX_CACHE_ITEMS; i++) {
          localStorage.removeItem(cacheItems[i].key);
        }
      }
    } catch (e) {
      // Bỏ qua lỗi khi dọn dẹp cache
    }
  };
  
  // Hàm xóa cache hiện tại
  const clearCurrentCache = () => {
    try {
      // Check if running in browser environment
      if (typeof window === 'undefined') return false;
      
      const cacheKey = `course-detail-${id}`;
      localStorage.removeItem(cacheKey);
      setCacheStatus('cleared');
      return true;
    } catch (error) {
      return false;
    }
  };

  // Hàm lấy tiêu đề của sheet
  const getSheetTitle = (index, sheets) => {
    if (!sheets || !sheets[index]) return `Khóa ${index + 1}`;
    const sheet = sheets[index];
    return sheet?.properties?.title || `Khóa ${index + 1}`;
  };

  // Hàm lấy danh sách sheets liên kết với khóa học
  const fetchLinkedSheets = async () => {
    if (!id) return;
    
    // Kiểm tra quyền truy cập trước khi gọi API
    if (!checkPermission(course)) {
      return;
    }
    
    setLoadingSheets(true);
    try {
      const response = await fetch(`/api/courses/${id}/sheets`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Lỗi ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setLinkedSheets(data.sheets || []);
        
        // Tải dữ liệu cho mỗi sheet
        const sheets = data.sheets || [];
        for (const sheet of sheets) {
          fetchSheetData(sheet._id);
        }
      } else {
        setError(`Không thể tải danh sách sheets: ${data.error || 'Lỗi không xác định'}`);
        setLinkedSheets([]);
      }
    } catch (error) {
      setError(`Lỗi khi tải danh sách sheets: ${error.message}`);
      setLinkedSheets([]);
    } finally {
      setLoadingSheets(false);
    }
  };
  
  // Hàm xử lý dữ liệu sheet vào database
  const processSheetToDb = async (sheetId) => {
    try {
      const response = await fetch(`/api/sheets/${sheetId}/process-to-db`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ background: false })
      });
      
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result.success;
    } catch (error) {
      return false;
    }
  };

  // Hàm lấy dữ liệu sheet từ database
  const fetchSheetFromDb = async (sheetId) => {
    try {
      const response = await fetch(`/api/sheets/${sheetId}/from-db`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        return result.sheet;
      } else if (result.needsFallback) {
        // Nếu cần xử lý dữ liệu
        const processed = await processSheetToDb(sheetId);
        if (processed) {
          // Thử lấy lại dữ liệu sau khi xử lý
          return await fetchSheetFromDb(sheetId);
        }
      }
      
      throw new Error(result.error || 'Không thể lấy dữ liệu sheet');
    } catch (error) {
      throw error;
    }
  };

  // Hàm lấy dữ liệu sheet
  const fetchSheetData = async (sheetId) => {
    if (!sheetId) return;
    
    setLoadingSheetData(prev => ({ ...prev, [sheetId]: true }));
    try {
      // Lấy dữ liệu từ database
      const data = await fetchSheetFromDb(sheetId);
      
      if (data) {
        setSheetData(prev => ({ ...prev, [sheetId]: data }));
      }
    } catch (error) {
    } finally {
      setLoadingSheetData(prev => ({ ...prev, [sheetId]: false }));
    }
  };

  // Hàm lấy thông tin chi tiết của khóa học
  const fetchCourseDetail = async () => {
    try {
      setLoading(true);
      
      // Kiểm tra cache trước
      const cachedData = getFromCache();
      
      if (cachedData) {
        setCourse(cachedData);
        
        // Chỉ kiểm tra quyền truy cập khi đã tải xong thông tin người dùng
        if (!userLoading) {
          const hasPermission = checkPermission(cachedData);
          setPermissionChecked(true);
          
          // Chỉ set lỗi nếu hasPermission là false (không phải null)
          if (hasPermission === false) {
            setError('Bạn không có quyền truy cập khóa học này');
            return;
          }
        }
        
        setIsLoaded(true);
        setLoading(false);
        return;
      }
      
      // Gọi API nếu không có cache
      console.log(`Fetching course detail for ID: ${id}`);
      const response = await fetch(`/api/courses/${id}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Error ${response.status}: ${response.statusText}` }));
        throw new Error(errorData.error || `Lỗi khi tải khóa học: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Có lỗi xảy ra khi tải thông tin khóa học');
      }
      
      const courseData = result.course;
      
      // Kiểm tra quyền truy cập
      const hasPermission = checkPermission(courseData);
      setPermissionChecked(true);
      
      // Chỉ set lỗi và ngăn không tải dữ liệu nếu hasPermission là false (không phải null)
      if (hasPermission === false) {
        setError('Bạn không có quyền truy cập khóa học này');
        setLoading(false);
        return;
      }
      
      // Lưu vào cache cho lần sau
      saveToCache(courseData);
      
      // Cập nhật state
      setCourse(courseData);
      setIsLoaded(true);
      setError(null);
      
    } catch (error) {
      console.error('Error fetching course detail:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Thêm hàm handleChangeSheet
  const handleChangeSheet = (index) => {
    setActiveSheet(index);
  };

  // Thêm hàm refreshCourseData
  const refreshCourseData = async () => {
    // Xóa cache hiện tại
    clearCurrentCache();
    // Tải lại dữ liệu
    await fetchCourseDetail();
  };

  // Thêm phụ thuộc userLoading vào useEffect để chạy lại khi trạng thái tải user thay đổi
  useEffect(() => {
    fetchCourseDetail();
  }, [id, userLoading]);
  
  // Tải danh sách sheets khi component mount
  useEffect(() => {
    if (course && !loadingSheets) {
      fetchLinkedSheets();
    }
  }, [course]);

  return {
    course,
    loading,
    error,
    formData,
    setFormData,
    isLoaded,
    activeSheet,
    linkedSheets,
    loadingSheets,
    sheetData,
    loadingSheetData,
    cacheStatus,
    permissionChecked,
    getSheetTitle,
    setActiveSheet: handleChangeSheet,
    refreshCourseData,
    clearCache: clearCurrentCache,
    fetchSheetData,
    fetchLinkedSheets
  };
}