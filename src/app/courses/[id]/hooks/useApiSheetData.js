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
        return null;
      }
      
      setCacheStatus('hit-list');
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
      console.error('Lỗi khi xóa cache:', error);
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
      console.error('Lỗi khi xóa tất cả cache sheet:', e);
    }
  };
  
  // Hàm xử lý dữ liệu sheet vào database
  const processSheetToDb = async (sheetId) => {
    try {
      console.log(`🔄 Bắt đầu xử lý sheet ${sheetId} vào database...`);
      
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
      console.log(`✅ Kết quả xử lý sheet ${sheetId}:`, result);
      
      // Xóa thông báo lỗi
      setApiSheetError(null);
      
      // Xóa cache để đảm bảo lấy dữ liệu mới nhất
      clearCurrentCache();
      
      return result.success;
    } catch (error) {
      console.error('❌ Lỗi khi xử lý dữ liệu sheet:', error);
      setApiSheetError(`Lỗi khi xử lý sheet: ${error.message}`);
      return false;
    }
  };

  // Hàm lấy dữ liệu sheet từ database
  const fetchSheetFromDb = async (sheetId) => {
    try {
      console.log(`🔍 Đang lấy dữ liệu sheet ${sheetId} từ database...`);
      
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
      console.log(`📥 Dữ liệu nhận được từ database cho sheet ${sheetId}:`, result);
      
      if (result.success) {
        // Phân tích cấu trúc dữ liệu HTML để debug
        analyzeHtmlDataStructure(result.sheet);
        
        // Kiểm tra và log số lượng hyperlink
        let hyperlinkCount = 0;
        if (result.sheet?.htmlData) {
          result.sheet.htmlData.forEach((row, rowIndex) => {
            // Kiểm tra cấu trúc dữ liệu
            if (!row) return;
            
            // Kiểm tra nếu row là một đối tượng có thuộc tính values là mảng
            if (row.values && Array.isArray(row.values)) {
              row.values.forEach((cell, cellIndex) => {
                if (cell && cell.hyperlink) {
                  hyperlinkCount++;
                  console.log(`🔗 Hyperlink tại [${rowIndex},${cellIndex}]: ${cell.hyperlink}`);
                }
              });
            } 
            // Trường hợp row là một mảng (cấu trúc khác)
            else if (Array.isArray(row)) {
              row.forEach((cell, cellIndex) => {
                if (cell && cell.hyperlink) {
                  hyperlinkCount++;
                  console.log(`🔗 Hyperlink tại [${rowIndex},${cellIndex}]: ${cell.hyperlink}`);
                }
              });
            }
          });
        }
        console.log(`🔢 Tổng số hyperlink: ${hyperlinkCount}`);
        
        console.log(`✅ Dữ liệu sheet ${sheetId}:`, {
          totalRows: result.sheet.values?.length || 0,
          hasHtmlData: !!result.sheet.htmlData,
          hasOptimizedData: !!result.sheet.optimizedHtmlData,
          storageMode: result.sheet.storageMode
        });
        return result.sheet;
      } else if (result.needsFallback) {
        console.log(`⚠️ Sheet ${sheetId} cần được xử lý vào database`);
        // Nếu cần xử lý dữ liệu
        const processed = await processSheetToDb(sheetId);
        if (processed) {
          console.log(`🔄 Thử lấy lại dữ liệu sau khi xử lý cho sheet ${sheetId}`);
          // Thử lấy lại dữ liệu sau khi xử lý
          return await fetchSheetFromDb(sheetId);
        }
      }
      
      throw new Error(result.error || 'Không thể lấy dữ liệu sheet');
    } catch (error) {
      console.error(`❌ Lỗi khi lấy dữ liệu sheet ${sheetId}:`, error);
      throw error;
    }
  };

  // Hàm phân tích cấu trúc dữ liệu HTML để debug
  const analyzeHtmlDataStructure = (sheetData) => {
    if (!sheetData || !sheetData.htmlData) {
      console.log('❌ Không có dữ liệu HTML để phân tích');
      return;
    }

    console.log('🔍 Phân tích cấu trúc dữ liệu HTML:');
    console.log(`- Số lượng hàng HTML: ${sheetData.htmlData.length}`);
    
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
            console.log(`  + Hyperlink tại [${rowIndex},${cellIndex}]: ${cell.hyperlink}`);
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
            console.log(`  + Hyperlink tại [${rowIndex},${cellIndex}]: ${cell.hyperlink}`);
          }
        });
        
        if (rowHyperlinkCount > 0) {
          hyperlinksByRow[rowIndex] = rowHyperlinkCount;
        }
      } else {
        structureTypes.other++;
      }
    });
    
    console.log('- Phân loại cấu trúc dữ liệu HTML:');
    console.log(`  + Hàng có cấu trúc { values: [...] }: ${structureTypes.objectWithValues}`);
    console.log(`  + Hàng có cấu trúc mảng: ${structureTypes.array}`);
    console.log(`  + Hàng có cấu trúc khác: ${structureTypes.other}`);
    console.log(`  + Hàng null/undefined: ${structureTypes.null}`);
    
    console.log('- Phân bố hyperlink theo hàng:');
    Object.keys(hyperlinksByRow).forEach(rowIndex => {
      console.log(`  + Hàng ${rowIndex}: ${hyperlinksByRow[rowIndex]} hyperlink`);
    });
    
    // Kiểm tra nếu dữ liệu values và htmlData có khớp nhau không
    if (sheetData.values) {
      console.log(`- So sánh số lượng hàng: values=${sheetData.values.length}, htmlData=${sheetData.htmlData.length}`);
      
      if (sheetData.values.length !== sheetData.htmlData.length) {
        console.log('⚠️ Cảnh báo: Số lượng hàng không khớp giữa values và htmlData!');
        console.log('  Điều này có thể gây ra lỗi định vị hyperlink.');
      }
    }
  };

  // Hàm lấy chi tiết của một sheet
  const fetchSheetDetail = async (sheetId) => {
    if (!sheetId) return;
    
    try {
      console.log(`🔍 Bắt đầu lấy chi tiết sheet ${sheetId}...`);
      
      // Thử lấy từ cache trước
      const cachedData = getSheetDetailFromCache(sheetId);
      if (cachedData) {
        console.log(`📦 Sử dụng dữ liệu cache cho sheet ${sheetId}`);
        return cachedData;
      }
      
      // Lấy dữ liệu từ database
      const sheetData = await fetchSheetFromDb(sheetId);
      
      // Lưu vào cache
      saveSheetDetailToCache(sheetId, sheetData);
      console.log(`💾 Đã lưu dữ liệu sheet ${sheetId} vào cache`);
      
      // Cập nhật dữ liệu sheet trong state
      setApiSheetData(prevData => {
        if (!prevData || !prevData.sheets) return prevData;
        
        const updatedSheets = prevData.sheets.map(sheet => {
          if (sheet._id === sheetId) {
            return { ...sheet, detail: sheetData };
          }
          return sheet;
        });
        
        return { ...prevData, sheets: updatedSheets };
      });
      
      return sheetData;
    } catch (error) {
      console.error(`❌ Lỗi khi lấy chi tiết sheet ${sheetId}:`, error);
      throw error;
    }
  };
  
  // Hàm lấy dữ liệu sheet từ API
  const fetchApiSheetData = async () => {
    if (!courseId) return;
    
    setLoadingApiSheet(true);
    setApiSheetError(null);
    
    try {
      console.log(`🔍 Bắt đầu lấy danh sách sheets cho khóa học ${courseId}...`);
      
      // Thử lấy từ cache trước
      const cachedData = getSheetListFromCache();
      if (cachedData) {
        console.log(`📦 Sử dụng danh sách sheets từ cache`);
        setApiSheetData(cachedData);
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
        console.log(`📥 Danh sách sheets nhận được:`, {
          totalSheets: result.sheets?.length || 0,
          sheets: result.sheets?.map(s => ({
            id: s._id,
            name: s.name
          }))
        });
        
        // Lưu vào cache
        saveSheetListToCache(result);
        console.log(`💾 Đã lưu danh sách sheets vào cache`);
        
        // Cập nhật state
        setApiSheetData(result);
        
        // Nếu có sheets, lấy chi tiết của sheet đầu tiên
        if (result.sheets && result.sheets.length > 0) {
          console.log(`🔄 Lấy chi tiết của sheet đầu tiên:`, result.sheets[0]._id);
          await fetchSheetDetail(result.sheets[0]._id);
        }
      } else {
        setApiSheetError(result.error || 'Không thể tải dữ liệu sheet');
      }
    } catch (error) {
      console.error('❌ Lỗi khi tải dữ liệu sheet:', error);
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
          console.log(`🔍 Tìm thấy hyperlink tối ưu [${rowIndex},${cellIndex}]: ${hyperlink.url}`);
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
          console.log(`🔍 Tìm thấy hyperlink đầy đủ [${rowIndex},${cellIndex}]: ${htmlCell.hyperlink}`);
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