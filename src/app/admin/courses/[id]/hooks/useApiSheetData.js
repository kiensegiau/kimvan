import { useState, useEffect } from 'react';

export function useApiSheetData(courseId) {
  const [apiSheetData, setApiSheetData] = useState(null);
  const [loadingApiSheet, setLoadingApiSheet] = useState(false);
  const [apiSheetError, setApiSheetError] = useState(null);
  const [activeApiSheet, setActiveApiSheet] = useState(0);
  
  // Hàm lấy dữ liệu sheet từ API
  const fetchApiSheetData = async () => {
    if (!courseId) return;
    
    setLoadingApiSheet(true);
    setApiSheetError(null);
    
    try {
      const response = await fetch(`/api/courses/${courseId}/sheets`);
      
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        console.log('Dữ liệu API sheet:', result);
        
        // Nếu có sheets
        if (result.sheets && result.sheets.length > 0) {
          // Lấy dữ liệu chi tiết của sheet đầu tiên
          const firstSheetId = result.sheets[0]._id;
          await fetchSheetDetail(firstSheetId);
        }
        
        setApiSheetData(result);
      } else {
        setApiSheetError(result.message || 'Không thể lấy dữ liệu sheet từ API');
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
    if (!sheetId) return;
    
    try {
      const response = await fetch(`/api/sheets/${sheetId}?fetchData=true`);
      
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`Chi tiết sheet ${sheetId}:`, result.sheet);
        
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
        
        return result.sheet;
      } else {
        console.error(`Không thể lấy chi tiết sheet ${sheetId}:`, result.message);
      }
    } catch (error) {
      console.error(`Lỗi khi lấy chi tiết sheet ${sheetId}:`, error);
    }
    
    return null;
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
    setActiveApiSheet: changeActiveSheet,
    fetchApiSheetData,
    fetchSheetDetail
  };
} 