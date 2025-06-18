import { useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';

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

export function useCourseData(id) {
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [cacheStatus, setCacheStatus] = useState('');
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [linkedSheets, setLinkedSheets] = useState([]);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [sheetData, setSheetData] = useState({});
  const [loadingSheetData, setLoadingSheetData] = useState({});
  
  // Hàm giải mã dữ liệu với xử lý lỗi tốt hơn
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
    // Trả về true nếu người dùng có quyền truy cập
    return courseData?.isEnrolled === true || 
           courseData?.canViewAllCourses === true ||
           courseData?.requiresEnrollment !== true;
  };
  
  // Hàm xóa cache
  const clearCache = () => {
    try {
      localStorage.removeItem(`course-${id}`);
      setCacheStatus('cleared');
      return true;
    } catch (e) {
      console.error('Lỗi khi xóa cache:', e);
      return false;
    }
  };

  // Hàm lưu vào cache
  const saveToCache = (data) => {
    try {
      // Thêm thời gian hết hạn và phiên bản cache
      const cacheData = {
        ...data,
        _cacheExpires: Date.now() + CACHE_DURATION,
        _cacheVersion: CACHE_VERSION
      };
      
      localStorage.setItem(`course-${id}`, JSON.stringify(cacheData));
      setCacheStatus('saved');
      return true;
    } catch (e) {
      console.error('Lỗi khi lưu cache:', e);
      return false;
    }
  };
  
  // Hàm lấy từ cache
  const getFromCache = () => {
    try {
      const cachedData = localStorage.getItem(`course-${id}`);
      if (!cachedData) return null;
      
      const parsedData = JSON.parse(cachedData);
      
      // Kiểm tra phiên bản cache
      if (parsedData._cacheVersion !== CACHE_VERSION) {
        console.log('Phiên bản cache không khớp, xóa cache cũ');
        clearCache();
        return null;
      }
      
      // Kiểm tra thời gian hết hạn
      if (parsedData._cacheExpires < Date.now()) {
        console.log('Cache đã hết hạn');
        clearCache();
        return null;
      }
      
      setCacheStatus('loaded');
      return parsedData;
    } catch (e) {
      console.error('Lỗi khi đọc cache:', e);
      clearCache();
      return null;
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
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        console.log('Danh sách sheets liên kết:', data.sheets);
        setLinkedSheets(data.sheets || []);
        
        // Tự động tải dữ liệu cho sheet đầu tiên
        const sheets = data.sheets || [];
        if (sheets.length > 0) {
          const firstSheet = sheets[0];
          console.log('Tự động tải dữ liệu sheet đầu tiên:', firstSheet.name);
          fetchSheetData(firstSheet._id);
        }
      } else {
        console.error('Lỗi khi lấy danh sách sheets:', data.error);
        setLinkedSheets([]);
      }
    } catch (error) {
      console.error('Lỗi khi lấy danh sách sheets liên kết:', error);
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
        console.log(`Dữ liệu sheet ${sheetId}:`, data.sheet);
        
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
        console.error(`Lỗi khi lấy dữ liệu sheet ${sheetId}:`, data.error);
      }
    } catch (error) {
      console.error(`Lỗi khi lấy dữ liệu sheet ${sheetId}:`, error);
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
      
      try {
        const permissionResponse = await fetch('/api/users/me');
        if (permissionResponse.ok) {
          const userData = await permissionResponse.json();
          currentPermissions = {
            [PERMISSION_KEYS.canViewAllCourses]: userData?.canViewAllCourses || false,
            [PERMISSION_KEYS.isEnrolled]: userData?.enrolledCourses?.includes(id) || false
          };
        } else {
          // Nếu không lấy được thông tin người dùng, giả định không có quyền
          currentPermissions = { 
            [PERMISSION_KEYS.canViewAllCourses]: false, 
            [PERMISSION_KEYS.isEnrolled]: false 
          };
        }
      } catch (permError) {
        // Nếu có lỗi khi kiểm tra quyền, giả định không có quyền
        currentPermissions = { 
          [PERMISSION_KEYS.canViewAllCourses]: false, 
          [PERMISSION_KEYS.isEnrolled]: false 
        };
        console.error('Lỗi khi kiểm tra quyền truy cập:', permError);
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
          if (clearCache()) {
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
      clearCache();
    }
  };
  
  // Hàm tải lại dữ liệu từ API
  const refreshCourseData = async (showLoading = true) => {
    try {
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
          clearCache();
          throw new Error(`Bạn không có quyền truy cập khóa học này. Vui lòng liên hệ quản trị viên.`);
        } else if (response.status === 400) {
          throw new Error(`ID khóa học không hợp lệ. Vui lòng kiểm tra lại đường dẫn.`);
        } else if (response.status === 404) {
          throw new Error(`Không tìm thấy khóa học với ID: ${id}`);
        } else {
          const errorMessage = errorData.message || errorData.error || `Lỗi ${response.status}: ${response.statusText}`;
          throw new Error(errorMessage);
        }
      }
      
      const encryptedResponse = await response.json();
      let fullCourseData;
      
      // Đồng nhất cách xử lý quyền truy cập
      const extractPermissions = (data) => {
        return {
          [PERMISSION_KEYS.isEnrolled]: data.isEnrolled || false,
          [PERMISSION_KEYS.canViewAllCourses]: data.canViewAllCourses || false,
          requiresEnrollment: data.requiresEnrollment || false
        };
      };
      
      // Kiểm tra nếu nhận được dữ liệu được mã hóa hoàn toàn
      if (encryptedResponse._secureData) {
        try {
          // Giải mã toàn bộ đối tượng
          fullCourseData = {
            ...decryptData(encryptedResponse._secureData),
            ...extractPermissions(encryptedResponse)
          };
          
          setCourse(fullCourseData);
          setPermissionChecked(true); // Đánh dấu đã kiểm tra quyền
          
          // Nếu không có quyền truy cập, ngừng xử lý
          if (!checkPermission(fullCourseData)) {
            setError(`Bạn không có quyền truy cập khóa học này. Vui lòng liên hệ quản trị viên.`);
            setLoading(false);
            return;
          }
          
          // Lưu vào cache
          saveToCache(fullCourseData);
        } catch (decryptError) {
          console.error('Lỗi khi giải mã dữ liệu:', decryptError);
          throw new Error(`Không thể giải mã dữ liệu khóa học: ${decryptError.message}`);
        }
      } else {
        // Nếu không có dữ liệu được mã hóa, sử dụng dữ liệu thô
        fullCourseData = {
          ...encryptedResponse,
          ...extractPermissions(encryptedResponse)
        };
        
        setCourse(fullCourseData);
        setPermissionChecked(true);
        
        // Nếu không có quyền truy cập, ngừng xử lý
        if (!checkPermission(fullCourseData)) {
          setError(`Bạn không có quyền truy cập khóa học này. Vui lòng liên hệ quản trị viên.`);
          setLoading(false);
          return;
        }
        
        // Lưu vào cache
        saveToCache(fullCourseData);
      }
      
      setLoading(false);
      
      // Hiệu ứng fade-in
      setTimeout(() => {
        setIsLoaded(true);
      }, 50);
      
      // Tải danh sách sheets liên kết
      fetchLinkedSheets();
      
    } catch (error) {
      console.error('Lỗi khi làm mới dữ liệu khóa học:', error);
      
      if (showLoading) {
        setError(`Không thể lấy thông tin khóa học: ${error.message}`);
        setLoading(false);
      }
    }
  };

  // Tải thông tin khóa học khi component mount
  useEffect(() => {
    fetchCourseDetail();
  }, [id]);
  
  // Tải danh sách sheets khi component mount
  useEffect(() => {
    if (course) {
      fetchLinkedSheets();
    }
  }, [course]);

  return {
    course,
    setCourse,
    loading,
    error,
    activeSheet,
    setActiveSheet,
    isLoaded,
    cacheStatus,
    permissionChecked,
    getSheetTitle,
    fetchCourseDetail,
    refreshCourseData,
    clearCache,
    linkedSheets,
    loadingSheets,
    sheetData,
    loadingSheetData,
    fetchLinkedSheets,
    fetchSheetData
  };
} 