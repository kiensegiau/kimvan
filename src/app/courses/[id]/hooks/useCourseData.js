import { useState, useEffect, useCallback } from 'react';
import CryptoJS from 'crypto-js';
import useUserData from '@/hooks/useUserData';

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
    
    // Trả về true nếu người dùng có quyền truy cập
    return courseData.isEnrolled === true || 
           courseData.canViewAllCourses === true ||
           courseData.requiresEnrollment !== true;
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
    setLoading(true);
    setError(null); // Reset error trước khi fetch
    
    try {
      // Kiểm tra xem đã đăng nhập hay chưa và lấy thông tin quyền truy cập
      let hasPermissionChange = false;
      let currentPermissions = null;
      
      // Sử dụng userData từ hook useUserData thay vì gọi API
      if (!userDataLoading && userData) {
        currentPermissions = {
          [PERMISSION_KEYS.canViewAllCourses]: userData?.canViewAllCourses || false,
          [PERMISSION_KEYS.isEnrolled]: userData?.enrollments?.some(e => e.courseId === id) || false
        };
      } else {
        // Nếu không lấy được thông tin người dùng, giả định không có quyền
        currentPermissions = { 
          [PERMISSION_KEYS.canViewAllCourses]: false, 
          [PERMISSION_KEYS.isEnrolled]: false 
        };
      }

      // Kiểm tra cache trước
      const cachedCourse = getFromCache();
      
      // So sánh quyền hiện tại với quyền được lưu trong cache
      if (cachedCourse) {
        const cachedPermissions = {
          [PERMISSION_KEYS.canViewAllCourses]: cachedCourse[PERMISSION_KEYS.canViewAllCourses] || false,
          [PERMISSION_KEYS.isEnrolled]: cachedCourse[PERMISSION_KEYS.isEnrolled] || false
        };
        
        // Kiểm tra xem quyền có thay đổi không
        if (
          (cachedPermissions[PERMISSION_KEYS.canViewAllCourses] && !currentPermissions[PERMISSION_KEYS.canViewAllCourses]) || 
          (cachedPermissions[PERMISSION_KEYS.isEnrolled] && !currentPermissions[PERMISSION_KEYS.isEnrolled])
        ) {
          // Quyền đã bị thu hồi, xóa cache ngay lập tức
          if (clearCurrentCache()) {
            hasPermissionChange = true;
            console.log('Phát hiện thay đổi quyền truy cập, đã xóa cache');
          }
        } 
        else if (
          (!cachedPermissions[PERMISSION_KEYS.canViewAllCourses] && !cachedPermissions[PERMISSION_KEYS.isEnrolled]) && 
          (currentPermissions[PERMISSION_KEYS.canViewAllCourses] || currentPermissions[PERMISSION_KEYS.isEnrolled])
        ) {
          // Người dùng có quyền mới, cập nhật cache
          hasPermissionChange = true;
        }
      }

      // Kiểm tra cache nếu không có thay đổi quyền
      if (!hasPermissionChange && cachedCourse) {
        // Cập nhật thông tin quyền truy cập vào dữ liệu cache
        cachedCourse[PERMISSION_KEYS.canViewAllCourses] = currentPermissions[PERMISSION_KEYS.canViewAllCourses];
        cachedCourse[PERMISSION_KEYS.isEnrolled] = currentPermissions[PERMISSION_KEYS.isEnrolled];
        
        // Sử dụng dữ liệu cache
        setCourse(cachedCourse);
        setFormData(cachedCourse);
        setPermissionChecked(true);
        setLoading(false);
        
        // Hiệu ứng fade-in
        setTimeout(() => {
          setIsLoaded(true);
        }, 50);
        
        // Tải lại dữ liệu mới trong nền để cập nhật quyền và nội dung
        refreshCourseData(false);
        return;
      }
      
      // Nếu không có cache hoặc cache hết hạn hoặc quyền thay đổi, fetch từ API
      await refreshCourseData(true);
      
    } catch (error) {
      console.error('Lỗi khi lấy thông tin khóa học:', error);
      setError(`Không thể lấy thông tin khóa học: ${error.message}`);
      setLoading(false);
      
      // Xóa cache nếu có lỗi để buộc tải lại dữ liệu trong lần tới
      clearCurrentCache();
    }
  };
  
  // Hàm tải lại dữ liệu từ API
  const refreshCourseData = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      
      // Tham số API đồng nhất
      const apiParams = new URLSearchParams({
        type: 'auto',
        secure: 'true',
        requireEnrollment: 'true',
        checkViewPermission: 'true',
        _: Date.now()
      });
      
      // Sử dụng tham số secure=true để nhận dữ liệu được mã hóa hoàn toàn
      // Thêm tham số requireEnrollment=true để kiểm tra quyền truy cập
      const response = await fetch(`/api/courses/${id}?${apiParams.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Xử lý các mã lỗi cụ thể
        if (response.status === 403) {
          // Không có quyền truy cập, xóa cache ngay lập tức
          clearCurrentCache();
          throw new Error(`Bạn không có quyền truy cập khóa học này. Vui lòng liên hệ quản trị viên.`);
        } else if (response.status === 400) {
          throw new Error(`ID khóa học không hợp lệ. Vui lòng kiểm tra lại đường dẫn.`);
        } else if (response.status === 404) {
          throw new Error(`Khóa học không tồn tại hoặc không có quyền truy cập`);
        } else {
          throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
        }
      }
      
      const data = await response.json();
      
      // Kiểm tra nếu dữ liệu được mã hóa
      if (data._secureData) {
        try {
          // Giải mã dữ liệu
          const decryptedData = decryptData(data._secureData);
          
          // Xử lý các ô gộp nếu có
          const processedData = { ...decryptedData };
          
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
          
          setCourse(processedData);
          setFormData(processedData);
          setPermissionChecked(true);
          setLoading(false);
          
          // Hiệu ứng fade-in
          setTimeout(() => {
            setIsLoaded(true);
          }, 50);
          
          // Lưu dữ liệu vào cache
          saveToCache(processedData);
        } catch (decryptError) {
          console.error('Lỗi khi giải mã dữ liệu:', decryptError);
          throw new Error(`Không thể giải mã dữ liệu khóa học: ${decryptError.message}`);
        }
      } else if (data.success === false) {
        throw new Error(`Không thể tải dữ liệu khóa học: ${data.message || data.error || 'Lỗi không xác định'}`);
      } else {
        // Xử lý dữ liệu không được mã hóa
        setCourse(data);
        setFormData(data);
        setPermissionChecked(true);
        setLoading(false);
        
        // Hiệu ứng fade-in
        setTimeout(() => {
          setIsLoaded(true);
        }, 50);
        
        // Lưu dữ liệu vào cache
        saveToCache(data);
      }
    } catch (error) {
      console.error('Lỗi khi tải lại dữ liệu khóa học:', error);
      setError(`Lỗi khi tải lại dữ liệu khóa học: ${error.message}`);
      setLoading(false);
      
      // Xóa cache nếu có lỗi để buộc tải lại dữ liệu trong lần tới
      clearCurrentCache();
    }
  };

  // Hàm thay đổi sheet đang active
  const handleChangeSheet = (index) => {
    setActiveSheet(index);
  };
  
  // Sử dụng useEffect để tải dữ liệu khi component được mount
  useEffect(() => {
    if (id) {
      fetchCourseDetail();
    }
  }, [id]);
  
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