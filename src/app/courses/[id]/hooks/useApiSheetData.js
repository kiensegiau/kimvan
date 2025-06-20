import { useState, useEffect } from 'react';

// Constants for cache
const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 giờ 
const MAX_CACHE_ITEMS = 5; // Giữ tối đa 5 cache items

export function useApiSheetData(courseId) {
  const [apiSheetData, setApiSheetData] = useState(null);
  const [loadingApiSheet, setLoadingApiSheet] = useState(false);
  const [apiSheetError, setApiSheetError] = useState(null);
  const [activeApiSheet, setActiveApiSheet] = useState(0);
  const [cacheStatus, setCacheStatus] = useState('');
  
  // Hàm lưu dữ liệu vào cache
  const saveSheetListToCache = (data) => {
    try {
      // Check if running in browser environment
      if (typeof window === 'undefined') return;
      
      // Tạo đối tượng cache với dữ liệu và thời gian
      const cacheItem = {
        data: data,
        timestamp: Date.now()
      };
      
      // Lưu dữ liệu sheet vào cache
      const cacheKey = `sheet-list-${courseId}`;
      localStorage.setItem(cacheKey, JSON.stringify(cacheItem));
      
      // Dọn dẹp cache cũ
      cleanupOldCaches();
      
      setCacheStatus('saved-list');
      console.log(`✅ Đã lưu danh sách sheet cho khóa học ${courseId} vào cache`);
    } catch (error) {
      console.error('Lỗi khi lưu cache sheet list:', error);
    }
  };
  
  // Hàm lưu dữ liệu chi tiết sheet vào cache
  const saveSheetDetailToCache = (sheetId, data) => {
    try {
      // Check if running in browser environment
      if (typeof window === 'undefined') return;
      
      // Tạo đối tượng cache với dữ liệu và thời gian
      const cacheItem = {
        data: data,
        timestamp: Date.now()
      };
      
      // Lưu dữ liệu chi tiết sheet vào cache
      const cacheKey = `sheet-detail-${sheetId}`;
      localStorage.setItem(cacheKey, JSON.stringify(cacheItem));
      
      setCacheStatus(`saved-detail-${sheetId}`);
      console.log(`✅ Đã lưu chi tiết sheet ${sheetId} vào cache`);
    } catch (error) {
      console.error('Lỗi khi lưu cache sheet detail:', error);
    }
  };
  
  // Hàm lấy dữ liệu danh sách sheet từ cache
  const getSheetListFromCache = () => {
    try {
      // Check if running in browser environment
      if (typeof window === 'undefined') return null;
      
      const cacheKey = `sheet-list-${courseId}`;
      const cachedData = localStorage.getItem(cacheKey);
      if (!cachedData) return null;
      
      const cacheItem = JSON.parse(cachedData);
      const now = Date.now();
      
      // Kiểm tra xem cache có còn hiệu lực không
      if (now - cacheItem.timestamp > CACHE_DURATION) {
        localStorage.removeItem(cacheKey);
        setCacheStatus('expired-list');
        console.log(`🕒 Cache danh sách sheet của khóa học ${courseId} đã hết hạn`);
        return null;
      }
      
      setCacheStatus('hit-list');
      console.log(`✅ Đã lấy danh sách sheet của khóa học ${courseId} từ cache`);
      return cacheItem.data;
    } catch (error) {
      console.error('Lỗi khi đọc cache danh sách sheet:', error);
      return null;
    }
  };
  
  // Hàm lấy dữ liệu chi tiết sheet từ cache
  const getSheetDetailFromCache = (sheetId) => {
    try {
      // Check if running in browser environment
      if (typeof window === 'undefined') return null;
      
      const cacheKey = `sheet-detail-${sheetId}`;
      const cachedData = localStorage.getItem(cacheKey);
      if (!cachedData) return null;
      
      const cacheItem = JSON.parse(cachedData);
      const now = Date.now();
      
      // Kiểm tra xem cache có còn hiệu lực không
      if (now - cacheItem.timestamp > CACHE_DURATION) {
        localStorage.removeItem(cacheKey);
        setCacheStatus(`expired-detail-${sheetId}`);
        console.log(`🕒 Cache chi tiết sheet ${sheetId} đã hết hạn`);
        return null;
      }
      
      setCacheStatus(`hit-detail-${sheetId}`);
      console.log(`✅ Đã lấy chi tiết sheet ${sheetId} từ cache`);
      return cacheItem.data;
    } catch (error) {
      console.error('Lỗi khi đọc cache chi tiết sheet:', error);
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
      
      // Lọc các key liên quan đến cache sheet
      const sheetListCacheKeys = keys.filter(key => key.startsWith('sheet-list-'));
      const sheetDetailCacheKeys = keys.filter(key => key.startsWith('sheet-detail-'));
      
      // Xử lý cache danh sách sheet
      if (sheetListCacheKeys.length > MAX_CACHE_ITEMS) {
        const cacheItems = [];
        
        for (const key of sheetListCacheKeys) {
          try {
            const item = JSON.parse(localStorage.getItem(key));
            if (item && item.timestamp) {
              cacheItems.push({ key, timestamp: item.timestamp });
            }
          } catch (e) {
            localStorage.removeItem(key);
          }
        }
        
        cacheItems.sort((a, b) => a.timestamp - b.timestamp);
        
        for (let i = 0; i < cacheItems.length - MAX_CACHE_ITEMS; i++) {
          localStorage.removeItem(cacheItems[i].key);
          console.log(`🗑️ Đã xóa cache danh sách sheet cũ: ${cacheItems[i].key}`);
        }
      }
      
      // Xử lý cache chi tiết sheet
      if (sheetDetailCacheKeys.length > MAX_CACHE_ITEMS * 3) { // Cho phép nhiều cache chi tiết hơn
        const cacheItems = [];
        
        for (const key of sheetDetailCacheKeys) {
          try {
            const item = JSON.parse(localStorage.getItem(key));
            if (item && item.timestamp) {
              cacheItems.push({ key, timestamp: item.timestamp });
            }
          } catch (e) {
            localStorage.removeItem(key);
          }
        }
        
        cacheItems.sort((a, b) => a.timestamp - b.timestamp);
        
        for (let i = 0; i < cacheItems.length - (MAX_CACHE_ITEMS * 3); i++) {
          localStorage.removeItem(cacheItems[i].key);
          console.log(`🗑️ Đã xóa cache chi tiết sheet cũ: ${cacheItems[i].key}`);
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
      
      const listCacheKey = `sheet-list-${courseId}`;
      localStorage.removeItem(listCacheKey);
      
      // Xóa chi tiết của sheet đã được tải
      if (apiSheetData && apiSheetData.sheets) {
        apiSheetData.sheets.forEach(sheet => {
          const detailCacheKey = `sheet-detail-${sheet._id}`;
          localStorage.removeItem(detailCacheKey);
        });
      }
      
      setCacheStatus('cleared');
      console.log(`🗑️ Đã xóa tất cả cache liên quan đến khóa học ${courseId}`);
    } catch (error) {
      console.error('Lỗi khi xóa cache:', error);
    }
  };
  
  // Hàm lấy dữ liệu sheet từ API
  const fetchApiSheetData = async () => {
    if (!courseId) return;
    
    setLoadingApiSheet(true);
    setApiSheetError(null);
    
    // Kiểm tra cache trước
    const cachedData = getSheetListFromCache();
    if (cachedData) {
      setApiSheetData(cachedData);
      
      // Nếu có sheets và có sheet đầu tiên, kiểm tra xem có chi tiết đã cache chưa
      if (cachedData.sheets && cachedData.sheets.length > 0) {
        const firstSheetId = cachedData.sheets[0]._id;
        const cachedDetail = getSheetDetailFromCache(firstSheetId);
        
        if (cachedDetail) {
          // Cập nhật dữ liệu sheet trong state với dữ liệu từ cache
          setApiSheetData(prevData => {
            if (!prevData || !prevData.sheets) return prevData;
            
            const updatedSheets = prevData.sheets.map(sheet => {
              if (sheet._id === firstSheetId) {
                return { ...sheet, detail: cachedDetail };
              }
              return sheet;
            });
            
            return { ...prevData, sheets: updatedSheets };
          });
        } else {
          // Nếu không có cache chi tiết, tải từ API
          await fetchSheetDetail(firstSheetId);
        }
      }
      
      setLoadingApiSheet(false);
      return;
    }
    
    try {
      // The API endpoint handles both MongoDB ObjectIDs and kimvanIds
      const response = await fetch(`/api/courses/${courseId}/sheets`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Lỗi ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      
      if (result.success) {
        // Lưu kết quả vào cache
        saveSheetListToCache(result);
        
        setApiSheetData(result);
        
        // Nếu có sheets
        if (result.sheets && result.sheets.length > 0) {
          // Lấy dữ liệu chi tiết của sheet đầu tiên
          const firstSheetId = result.sheets[0]._id;
          await fetchSheetDetail(firstSheetId);
        }
      } else {
        setApiSheetError(result.error || result.message || 'Không thể lấy dữ liệu sheet từ API');
      }
    } catch (error) {
      console.error('Lỗi khi lấy dữ liệu sheet từ API:', error);
      setApiSheetError(error.message || 'Đã xảy ra lỗi khi lấy dữ liệu sheet');
    } finally {
      setLoadingApiSheet(false);
    }
  };
  
  // Hàm lấy chi tiết của một sheet
  const fetchSheetDetail = async (sheetId) => {
    if (!sheetId) {
      setApiSheetError('Không thể tải chi tiết: ID sheet không hợp lệ');
      return null;
    }
    
    // Kiểm tra cache trước
    const cachedDetail = getSheetDetailFromCache(sheetId);
    if (cachedDetail) {
      // Cập nhật dữ liệu sheet trong state với dữ liệu từ cache
      setApiSheetData(prevData => {
        if (!prevData || !prevData.sheets) return prevData;
        
        const updatedSheets = prevData.sheets.map(sheet => {
          if (sheet._id === sheetId) {
            return { ...sheet, detail: cachedDetail };
          }
          return sheet;
        });
        
        return { ...prevData, sheets: updatedSheets };
      });
      
      setApiSheetError(null);
      return cachedDetail;
    }
    
    setLoadingApiSheet(true);
    
    try {
      // Sử dụng tham số fetchData=true để lấy đầy đủ dữ liệu bao gồm cả HTML
      const response = await fetch(`/api/sheets/${sheetId}?fetchData=true`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Lỗi ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      
      if (result.success) {
        // Lưu vào cache
        saveSheetDetailToCache(sheetId, result.sheet);
        
        // Cập nhật dữ liệu sheet trong state
        setApiSheetData(prevData => {
          if (!prevData || !prevData.sheets) return prevData;
          
          const updatedSheets = prevData.sheets.map(sheet => {
            if (sheet._id === sheetId) {
              return { ...sheet, detail: result.sheet };
            }
            return sheet;
          });
          
          return { ...prevData, sheets: updatedSheets };
        });
        
        setApiSheetError(null);
        return result.sheet;
      } else {
        setApiSheetError(result.error || result.message || `Không thể lấy chi tiết sheet`);
        return null;
      }
    } catch (error) {
      console.error('Lỗi khi tải chi tiết sheet:', error);
      setApiSheetError(`Lỗi khi tải chi tiết sheet: ${error.message}`);
      return null;
    } finally {
      setLoadingApiSheet(false);
    }
  };
  
  // Hàm chuyển đổi sheet active
  const changeActiveSheet = async (index) => {
    setActiveApiSheet(index);
    
    // Nếu đã có dữ liệu sheet
    if (apiSheetData && apiSheetData.sheets && apiSheetData.sheets[index]) {
      const sheet = apiSheetData.sheets[index];
      
      // Nếu chưa có chi tiết, lấy chi tiết
      if (!sheet.detail) {
        await fetchSheetDetail(sheet._id);
      }
    } else {
      setApiSheetError("Không thể chuyển sheet: Không tìm thấy dữ liệu sheet hoặc index không hợp lệ");
    }
  };
  
  // Lấy dữ liệu ban đầu khi component mount
  useEffect(() => {
    if (courseId) {
      fetchApiSheetData();
    }
  }, [courseId]);
  
  return {
    apiSheetData,
    loadingApiSheet,
    apiSheetError,
    activeApiSheet,
    cacheStatus,
    setActiveApiSheet: changeActiveSheet,
    fetchApiSheetData,
    fetchSheetDetail,
    clearCache: clearCurrentCache
  };
} 