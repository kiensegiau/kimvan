import { useState, useEffect } from 'react';
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
    // Sử dụng các hàm kiểm tra từ hook useEnrolledCourses
    return hasAccessToCourse(id, courseData);
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
        
        // Cập nhật state
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

  // Hàm lấy chi tiết khóa học
  const fetchCourseDetail = async () => {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    
    try {
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
        
        // Tải danh sách sheets
        setTimeout(() => {
          fetchLinkedSheets();
        }, 300);
        return;
      }
      
      // Gọi API để lấy chi tiết khóa học
      const response = await fetch(`/api/courses/${id}`);
      
      if (!response.ok) {
        if (response.status === 401) {
          setError('Bạn cần đăng nhập để xem chi tiết khóa học');
          setLoading(false);
          return;
        } else if (response.status === 403) {
          setError('Bạn không có quyền truy cập khóa học này');
          setLoading(false);
          return;
        } else if (response.status === 404) {
          setError('Không tìm thấy khóa học này');
          setLoading(false);
          return;
        }
        
        const errorText = await response.text().catch(() => '');
        throw new Error(`Lỗi ${response.status}: ${errorText || response.statusText}`);
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
        
        // Tải danh sách sheets
        fetchLinkedSheets();
      } else {
        throw new Error(data.error || 'Không thể tải dữ liệu khóa học');
      }
    } catch (error) {
      console.error('Lỗi khi lấy chi tiết khóa học:', error);
      setError(error.message || 'Đã xảy ra lỗi khi tải dữ liệu khóa học');
    } finally {
      setLoading(false);
      setIsLoaded(true);
    }
  };

  // Tải dữ liệu khóa học khi component mount hoặc ID thay đổi
  useEffect(() => {
    fetchCourseDetail();
  }, [id, enrolledCourses]); // Thêm enrolledCourses vào dependencies
  
  // Trả về state và các hàm
  return {
    course,
    loading,
    error,
    activeSheet,
    setActiveSheet,
    isLoaded,
    cacheStatus,
    permissionChecked,
    linkedSheets,
    loadingSheets,
    sheetData,
    loadingSheetData,
    getSheetTitle,
    fetchCourseDetail,
    fetchLinkedSheets,
    fetchSheetData
  };
} 