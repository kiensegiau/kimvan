import { useState, useEffect } from 'react';

// Constants for cache
const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 giờ 
const MAX_CACHE_ITEMS = 5; // Giữ tối đa 5 cache items

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
  
  // Hàm lưu dữ liệu vào cache
  const saveToCache = (data) => {
    try {
      // Check if running in browser environment
      if (typeof window === 'undefined') return;
      
      // Tạo đối tượng cache với dữ liệu và thời gian
      const cacheItem = {
        data: data,
        timestamp: Date.now()
      };
      
      // Lưu dữ liệu vào cache
      const cacheKey = `course-detail-${id}`;
      localStorage.setItem(cacheKey, JSON.stringify(cacheItem));
      
      // Dọn dẹp cache cũ
      cleanupOldCaches();
      
      setCacheStatus('saved');
    } catch (error) {
      console.error('Lỗi khi lưu cache:', error);
      // Xử lý lỗi im lặng
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
      
      const cacheItem = JSON.parse(cachedData);
      const now = Date.now();
      
      // Kiểm tra xem cache có còn hiệu lực không
      if (now - cacheItem.timestamp > CACHE_DURATION) {
        localStorage.removeItem(cacheKey);
        setCacheStatus('expired');
        return null;
      }
      
      setCacheStatus('hit');
      return cacheItem.data;
    } catch (error) {
      console.error('Lỗi khi đọc cache:', error);
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
      if (typeof window === 'undefined') return;
      
      const cacheKey = `course-detail-${id}`;
      localStorage.removeItem(cacheKey);
      setCacheStatus('cleared');
    } catch (error) {
      console.error('Lỗi khi xóa cache:', error);
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
    if (!id) return;
    
    setLoading(true);
    setError(null);
    
    // Kiểm tra cache trước
    const cachedData = getFromCache();
    if (cachedData) {
      setCourse(cachedData);
      setFormData(cachedData);
      
      // Hiệu ứng fade-in
      setTimeout(() => {
        setIsLoaded(true);
      }, 100);
      
      // Vẫn tải danh sách sheets liên kết từ API
      fetchLinkedSheets();
      setLoading(false);
      return;
    }
    
    try {
      // Check if the ID is likely a MongoDB ObjectID (24 hex characters)
      const isMongoId = /^[0-9a-fA-F]{24}$/.test(id);
      const idType = isMongoId ? '_id' : 'kimvanId';
      
      const response = await fetch(`/api/courses/raw/${id}?type=${idType}`);
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Có lỗi xảy ra khi lấy dữ liệu');
      }
      
      // Xử lý các ô gộp trong dữ liệu gốc nếu có
      const processedData = { ...result.data };
      
      if (processedData.originalData?.sheets) {
        // Duyệt qua từng sheet
        processedData.originalData.sheets.forEach((sheet, sheetIndex) => {
          if (sheet.merges && sheet.merges.length > 0) {
            // Tạo bản đồ các ô đã gộp
            if (!processedData.originalData.mergedCellsMap) {
              processedData.originalData.mergedCellsMap = {};
            }
            
            sheet.merges.forEach(merge => {
              const startRow = merge.startRowIndex;
              const endRow = merge.endRowIndex;
              const startCol = merge.startColumnIndex;
              const endCol = merge.endColumnIndex;
              
              // Tính toán rowSpan và colSpan
              const rowSpan = endRow - startRow;
              const colSpan = endCol - startCol;
              
              // Đánh dấu ô chính (góc trên bên trái của vùng gộp)
              if (sheet.data && sheet.data[0] && sheet.data[0].rowData && sheet.data[0].rowData[startRow]) {
                if (!sheet.data[0].rowData[startRow].values) {
                  sheet.data[0].rowData[startRow].values = [];
                }
                
                if (!sheet.data[0].rowData[startRow].values[startCol]) {
                  sheet.data[0].rowData[startRow].values[startCol] = {};
                }
                
                sheet.data[0].rowData[startRow].values[startCol].rowSpan = rowSpan;
                sheet.data[0].rowData[startRow].values[startCol].colSpan = colSpan;
              }
              
              // Đánh dấu các ô khác trong vùng gộp để bỏ qua khi render
              for (let r = startRow; r < endRow; r++) {
                for (let c = startCol; c < endCol; c++) {
                  // Bỏ qua ô chính
                  if (r === startRow && c === startCol) continue;
                  
                  const key = `${r},${c}`;
                  processedData.originalData.mergedCellsMap[key] = { 
                    mainCell: { row: startRow, col: startCol },
                    sheetIndex: sheetIndex
                  };
                }
              }
            });
          }
        });
      }
      
      setCourse(processedData);
      setFormData(processedData);
      
      // Lưu vào cache
      saveToCache(processedData);
      
      // Hiệu ứng fade-in
      setTimeout(() => {
        setIsLoaded(true);
      }, 100);
      
      // Tải danh sách sheets liên kết
      fetchLinkedSheets();
    } catch (error) {
      setError(`Không thể tải thông tin khóa học: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Hàm làm mới dữ liệu khóa học
  const refreshCourseData = async () => {
    setLoading(true);
    setError(null);
    
    // Xóa cache hiện tại
    clearCurrentCache();
    
    try {
      // Check if the ID is likely a MongoDB ObjectID (24 hex characters)
      const isMongoId = /^[0-9a-fA-F]{24}$/.test(id);
      const idType = isMongoId ? '_id' : 'kimvanId';
      
      const response = await fetch(`/api/courses/raw/${id}?type=${idType}`);
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Có lỗi xảy ra khi lấy dữ liệu');
      }
      
      setCourse(result.data);
      
      // Lưu vào cache
      saveToCache(result.data);
      
      // Làm mới danh sách sheets liên kết
      fetchLinkedSheets();
    } catch (error) {
      setError(`Không thể làm mới dữ liệu khóa học: ${error.message}`);
    } finally {
      setLoading(false);
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

  return {
    course,
    loading,
    error,
    formData,
    isLoaded,
    activeSheet,
    linkedSheets,
    loadingSheets,
    sheetData,
    loadingSheetData,
    cacheStatus,
    getSheetTitle,
    setActiveSheet: handleChangeSheet,
    refreshCourseData,
    clearCache: clearCurrentCache
  };
} 