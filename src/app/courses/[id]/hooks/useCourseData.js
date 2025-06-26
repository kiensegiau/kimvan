import { useState, useEffect, useCallback } from 'react';
import CryptoJS from 'crypto-js';
import useUserData from '@/hooks/useUserData';
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

export function useCourseData(id) {
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
  
  // Lấy thông tin người dùng từ hook useUserData
  const { userData, loading: userDataLoading } = useUserData();
  
  // Sử dụng hook useEnrolledCourses để lấy danh sách khóa học đã đăng ký
  const { 
    enrolledCourses, 
    loading: enrolledCoursesLoading,
    hasAccessToCourse,
    hasViewAllCoursesPermission,
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
    if (!courseData) return false;
    
    // Sử dụng các hàm kiểm tra từ hook useEnrolledCourses
    return hasAccessToCourse(id, courseData);
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
      console.error('Lỗi khi lưu cache:', error);
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
        console.log('Phiên bản cache không khớp, xóa cache cũ');
        clearCurrentCache();
        return null;
      }
      
      // Kiểm tra thời gian hết hạn
      if (parsedData._cacheExpires < Date.now()) {
        console.log('Cache đã hết hạn');
        clearCurrentCache();
        setCacheStatus('expired');
        return null;
      }
      
      setCacheStatus('hit');
      return parsedData;
    } catch (error) {
      console.error('Lỗi khi đọc cache:', error);
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
      // Xử lý lỗi im lặng
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
      console.error('Lỗi khi xóa cache:', error);
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
      console.error('Lỗi khi lấy danh sách sheets:', error);
      setError(`Lỗi khi tải danh sách sheets: ${error.message}`);
      setLinkedSheets([]);
    } finally {
      setLoadingSheets(false);
    }
  };
  
  // Hàm lấy dữ liệu của sheet
  const fetchSheetData = async (sheetId) => {
    if (!sheetId) return;
    
    setLoadingSheetData(prev => ({ ...prev, [sheetId]: true }));
    try {
      const response = await fetch(`/api/sheets/${sheetId}?fetchData=true`);
      
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Xử lý các ô gộp nếu có
        const processedData = { ...data.sheet };
        
        if (processedData.merges && processedData.merges.length > 0) {
          // Tạo bản đồ các ô đã gộp
          const mergedCellsMap = {};
          
          processedData.merges.forEach(merge => {
            const startRow = merge.startRowIndex;
            const endRow = merge.endRowIndex;
            const startCol = merge.startColumnIndex;
            const endCol = merge.endColumnIndex;
            
            // Tính toán rowSpan và colSpan
            const rowSpan = endRow - startRow;
            const colSpan = endCol - startCol;
            
            // Đánh dấu ô chính (góc trên bên trái của vùng gộp)
            if (!processedData.htmlData[startRow]) {
              processedData.htmlData[startRow] = { values: [] };
            }
            
            if (!processedData.htmlData[startRow].values) {
              processedData.htmlData[startRow].values = [];
            }
            
            if (!processedData.htmlData[startRow].values[startCol]) {
              processedData.htmlData[startRow].values[startCol] = {};
            }
            
            processedData.htmlData[startRow].values[startCol].rowSpan = rowSpan;
            processedData.htmlData[startRow].values[startCol].colSpan = colSpan;
            
            // Đánh dấu các ô khác trong vùng gộp để bỏ qua khi render
            for (let r = startRow; r < endRow; r++) {
              for (let c = startCol; c < endCol; c++) {
                // Bỏ qua ô chính
                if (r === startRow && c === startCol) continue;
                
                const key = `${r},${c}`;
                mergedCellsMap[key] = { mainCell: { row: startRow, col: startCol } };
              }
            }
          });
          
          // Lưu bản đồ các ô đã gộp vào data
          processedData.mergedCellsMap = mergedCellsMap;
        }
        
        setSheetData(prev => ({ ...prev, [sheetId]: processedData }));
      } else {
        setError(`Không thể tải dữ liệu sheet: ${data.error || 'Lỗi không xác định'}`);
      }
    } catch (error) {
      setError(`Lỗi khi tải dữ liệu sheet: ${error.message}`);
    } finally {
      setLoadingSheetData(prev => ({ ...prev, [sheetId]: false }));
    }
  };

  // Hàm lấy thông tin chi tiết của khóa học
  const fetchCourseDetail = async () => {
    try {
      setLoading(true);
      setError(null);

      // Kiểm tra cache trước
      const cachedData = getFromCache();
      if (cachedData) {
        setCourse(cachedData);
        
        // Vẫn cần kiểm tra quyền truy cập với dữ liệu từ cache
        const hasAccess = checkPermission(cachedData);
        if (!hasAccess) {
          setError("Bạn không có quyền truy cập vào khóa học này");
        }
        
        setIsLoaded(true);
        setLoading(false);
        setPermissionChecked(true);
        return;
      }

      // Nếu không có cache hoặc cache hết hạn, gọi API
      const response = await fetch(`/api/courses/${id}`);
      
      if (!response.ok) {
        // Xử lý lỗi 401 (chưa đăng nhập)
        if (response.status === 401) {
          setError('Bạn cần đăng nhập để xem chi tiết khóa học');
          setLoading(false);
          setPermissionChecked(true);
          return;
        }
        
        if (response.status === 403) {
          setError('Bạn không có quyền truy cập vào khóa học này');
          setLoading(false);
          setPermissionChecked(true);
          return;
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Lỗi ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        const courseData = data.course;
        setCourse(courseData);
        saveToCache(courseData);
        
        // Kiểm tra quyền truy cập
        const hasAccess = checkPermission(courseData);
        if (!hasAccess) {
          setError("Bạn không có quyền truy cập vào khóa học này");
        }
        
        setPermissionChecked(true);
      } else {
        throw new Error(data.error || 'Không thể tải dữ liệu khóa học');
      }
    } catch (err) {
      setError(err.message || 'Đã xảy ra lỗi khi tải dữ liệu khóa học');
      setCourse(null);
      setPermissionChecked(true);
    } finally {
      setLoading(false);
      setIsLoaded(true);
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

  // Sử dụng useEffect để tải dữ liệu khi component được mount
  useEffect(() => {
    if (id) {
      fetchCourseDetail();
    }
  }, [id, enrolledCourses]);
  
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