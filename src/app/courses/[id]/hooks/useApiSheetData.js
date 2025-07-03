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
    } catch (error) {
      // Bỏ qua lỗi khi lưu cache
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
      
      // Kiểm tra kích thước dữ liệu trước khi lưu
      try {
        const jsonData = JSON.stringify(cacheItem);
        const dataSize = new Blob([jsonData]).size;
        
        // Nếu dữ liệu quá lớn (> 1MB), không lưu cache
        if (dataSize > 1024 * 1024) {
          return;
        }
        
        // Lưu dữ liệu chi tiết sheet vào cache nếu đủ nhỏ
        const cacheKey = `sheet-detail-${sheetId}`;
        localStorage.setItem(cacheKey, jsonData);
        setCacheStatus(`saved-detail-${sheetId}`);
      } catch (storageError) {
        // Nếu gặp lỗi storage, bỏ qua việc lưu cache
      }
    } catch (error) {
      // Bỏ qua lỗi khi lưu cache
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
        return null;
      }
      
      setCacheStatus('hit-list');
      return cacheItem.data;
    } catch (error) {
      // Bỏ qua lỗi khi đọc cache
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
      
      try {
        const cacheItem = JSON.parse(cachedData);
        const now = Date.now();
        
        // Kiểm tra xem cache có còn hiệu lực không
        if (now - cacheItem.timestamp > CACHE_DURATION) {
          localStorage.removeItem(cacheKey);
          setCacheStatus(`expired-detail-${sheetId}`);
          return null;
        }
        
        setCacheStatus(`hit-detail-${sheetId}`);
        return cacheItem.data;
      } catch (parseError) {
        // Nếu không parse được JSON, xóa cache lỗi
        localStorage.removeItem(cacheKey);
        return null;
      }
    } catch (error) {
      // Bỏ qua lỗi khi đọc cache
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
    } catch (error) {
      // Bỏ qua lỗi khi xóa cache
    }
  };
  
  // Hàm xóa tất cả cache liên quan đến sheet
  const clearAllSheetCaches = () => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('sheet-list-') || key.startsWith('sheet-detail-')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      // Bỏ qua lỗi khi xóa tất cả cache
    }
  };
  
  // Hàm xử lý dữ liệu sheet vào database
  const processSheetToDb = async (sheetId) => {
    try {
      // Hiển thị thông báo đang xử lý
      setApiSheetError('Đang xử lý dữ liệu sheet vào database...');
      
      const response = await fetch(`/api/sheets/${sheetId}/process-to-db`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          background: false,
          preserveHyperlinks: true, // Đảm bảo giữ nguyên hyperlink
          includeHtmlData: true     // Bao gồm dữ liệu HTML đầy đủ
        })
      });
      
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Xóa thông báo lỗi
      setApiSheetError(null);
      
      // Xóa cache để đảm bảo lấy dữ liệu mới nhất
      clearCurrentCache();
      
      return result.success;
    } catch (error) {
      setApiSheetError(`Lỗi khi xử lý sheet: ${error.message}`);
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
        // Phân tích cấu trúc dữ liệu HTML để debug
        analyzeHtmlDataStructure(result.sheet);
        
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

  // Hàm phân tích cấu trúc dữ liệu HTML để debug
  const analyzeHtmlDataStructure = (sheetData) => {
    if (!sheetData || !sheetData.htmlData) {
      return;
    }

    // Kiểm tra cấu trúc dữ liệu HTML
    const structureTypes = {
      objectWithValues: 0,
      array: 0,
      other: 0,
      null: 0
    };
    
    // Kiểm tra số lượng hyperlink theo hàng
    const hyperlinksByRow = {};
    
    sheetData.htmlData.forEach((row, rowIndex) => {
      if (!row) {
        structureTypes.null++;
        return;
      }
      
      if (row.values && Array.isArray(row.values)) {
        structureTypes.objectWithValues++;
        
        // Đếm hyperlink trong hàng
        let rowHyperlinkCount = 0;
        row.values.forEach((cell, cellIndex) => {
          if (cell && cell.hyperlink) {
            rowHyperlinkCount++;
          }
        });
        
        if (rowHyperlinkCount > 0) {
          hyperlinksByRow[rowIndex] = rowHyperlinkCount;
        }
      } else if (Array.isArray(row)) {
        structureTypes.array++;
        
        // Đếm hyperlink trong hàng
        let rowHyperlinkCount = 0;
        row.forEach((cell, cellIndex) => {
          if (cell && cell.hyperlink) {
            rowHyperlinkCount++;
          }
        });
        
        if (rowHyperlinkCount > 0) {
          hyperlinksByRow[rowIndex] = rowHyperlinkCount;
        }
      } else {
        structureTypes.other++;
      }
    });
  };

  // Hàm phân tích cấu trúc dữ liệu sheet
  const analyzeSheetDataStructure = (sheetData) => {
    // Kiểm tra cấu trúc mới với rows và header
    if (sheetData && Array.isArray(sheetData.rows) && Array.isArray(sheetData.header)) {
      return {
        type: 'structured',
        hasHeader: true,
        hasRows: true,
        hasHyperlinks: Array.isArray(sheetData.hyperlinks) && sheetData.hyperlinks.length > 0
      };
    }
    
    // Kiểm tra cấu trúc values
    if (sheetData && Array.isArray(sheetData.values)) {
      return {
        type: 'values',
        hasValues: true,
        rowCount: sheetData.values.length - 1 // Trừ đi header
      };
    }
    
    return {
      type: 'unknown',
      isValid: false
    };
  };

  // Hàm lấy dữ liệu chi tiết sheet
  const fetchSheetDetail = async (sheetId) => {
    try {
      // Kiểm tra cache trước
      const cachedDetail = getSheetDetailFromCache(sheetId);
      if (cachedDetail) {
        // Cập nhật dữ liệu sheet từ cache
        setApiSheetData(prevData => {
          if (!prevData || !prevData.sheets) return prevData;
          
          return {
            ...prevData,
            sheets: prevData.sheets.map(sheet => {
              if (sheet._id === sheetId) {
                return {
                  ...sheet,
                  detail: cachedDetail
                };
              }
              return sheet;
            })
          };
        });
        
        return;
      }
      
      // Lấy dữ liệu từ database
      const dbResponse = await fetch(`/api/sheets/${sheetId}/from-db`, {
        method: 'GET',
        credentials: 'include'
      });
      
      const dbData = await dbResponse.json();
      
      // Nếu có dữ liệu từ database
      if (dbData.success && dbData.sheet) {
        // Phân tích cấu trúc dữ liệu
        const structure = analyzeSheetDataStructure(dbData.sheet);
        
        // Cập nhật dữ liệu sheet
        setApiSheetData(prevData => {
          if (!prevData || !prevData.sheets) return prevData;
          
          return {
            ...prevData,
            sheets: prevData.sheets.map(sheet => {
              if (sheet._id === sheetId) {
                return {
                  ...sheet,
                  detail: dbData.sheet,
                  source: 'database',
                  // Cập nhật tên sheet nếu chưa có
                  name: sheet.name || dbData.sheet.name
                };
              }
              return sheet;
            })
          };
        });
        
        // Lưu vào cache
        saveSheetDetailToCache(sheetId, dbData.sheet);
        
        return;
      }
      
      // Nếu không có dữ liệu từ database, lấy từ API
      const apiResponse = await fetch(`/api/sheets/${sheetId}`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!apiResponse.ok) {
        throw new Error(`Lỗi khi tải dữ liệu sheet: ${apiResponse.status}`);
      }
      
      const apiData = await apiResponse.json();
      
      if (apiData.success) {
        // Phân tích cấu trúc dữ liệu
        const structure = analyzeSheetDataStructure(apiData.sheet);
        
        // Cập nhật dữ liệu sheet
        setApiSheetData(prevData => {
          if (!prevData || !prevData.sheets) return prevData;
          
          return {
            ...prevData,
            sheets: prevData.sheets.map(sheet => {
              if (sheet._id === sheetId) {
                return {
                  ...sheet,
                  detail: apiData.sheet,
                  source: 'api'
                };
              }
              return sheet;
            })
          };
        });
        
        // Lưu vào cache
        saveSheetDetailToCache(sheetId, apiData.sheet);
      } else {
        setApiSheetError(`Không thể tải dữ liệu sheet: ${apiData.error || 'Lỗi không xác định'}`);
      }
    } catch (error) {
      setApiSheetError(`Lỗi khi tải dữ liệu sheet: ${error.message}`);
    }
  };
  
  // Hàm lấy dữ liệu sheet từ API
  const fetchApiSheetData = async () => {
    if (!courseId) return;
    
    setLoadingApiSheet(true);
    setApiSheetError(null);
    
    try {
      // Thử lấy từ cache trước
      const cachedData = getSheetListFromCache();
      if (cachedData) {
        setApiSheetData(cachedData);
        setLoadingApiSheet(false);
        return;
      }
      
      // Lấy danh sách sheets
      const response = await fetch(`/api/courses/${courseId}/sheets`, {
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
        // Lưu vào cache
        saveSheetListToCache(result);
        
        // Cập nhật state
        setApiSheetData(result);
        
        // Nếu có sheets, lấy chi tiết của sheet đầu tiên
        if (result.sheets && result.sheets.length > 0) {
          await fetchSheetDetail(result.sheets[0]._id);
        }
      } else {
        setApiSheetError(result.error || 'Không thể tải dữ liệu sheet');
      }
    } catch (error) {
      setApiSheetError(error.message);
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
  
  // Hàm lấy hyperlink từ dữ liệu HTML
  const getHyperlink = (rowIndex, cellIndex, sheetDetail) => {
    // Kiểm tra dữ liệu HTML tối ưu trước
    if (sheetDetail.optimizedHtmlData && sheetDetail.optimizedHtmlData.length > 0) {
      const optimizedRow = sheetDetail.optimizedHtmlData.find(row => row.rowIndex === rowIndex);
      if (optimizedRow && optimizedRow.hyperlinks) {
        const hyperlink = optimizedRow.hyperlinks.find(link => link.col === cellIndex);
        if (hyperlink) {
          return hyperlink.url;
        }
      }
    }
    
    // Nếu không có dữ liệu tối ưu, thử lấy từ dữ liệu HTML đầy đủ
    if (sheetDetail.htmlData && sheetDetail.htmlData[rowIndex]) {
      const htmlRow = sheetDetail.htmlData[rowIndex];
      
      // Đảm bảo htmlRow có cấu trúc chuẩn { values: [...] }
      if (htmlRow && htmlRow.values && Array.isArray(htmlRow.values) && htmlRow.values[cellIndex]) {
        const htmlCell = htmlRow.values[cellIndex];
        if (htmlCell && htmlCell.hyperlink) {
          return htmlCell.hyperlink;
        }
      }
    }
    
    return null;
  };
  
  return {
    apiSheetData,
    loadingApiSheet,
    apiSheetError,
    activeApiSheet,
    cacheStatus,
    setActiveApiSheet: changeActiveSheet,
    fetchApiSheetData,
    fetchSheetDetail,
    clearCache: clearCurrentCache,
    clearAllSheetCaches
  };
}