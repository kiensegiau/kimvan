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
      console.log("Bắt đầu tải dữ liệu sheets cho courseId:", courseId);
      const response = await fetch(`/api/courses/${courseId}/sheets`);
      
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        console.log('Dữ liệu API sheet:', result);
        
        // Nếu có sheets
        if (result.sheets && result.sheets.length > 0) {
          console.log(`Đã tìm thấy ${result.sheets.length} sheets`);
          
          // Lấy dữ liệu chi tiết của sheet đầu tiên
          const firstSheetId = result.sheets[0]._id;
          console.log("Lấy chi tiết của sheet đầu tiên:", firstSheetId);
          await fetchSheetDetail(firstSheetId);
        } else {
          console.log("Không tìm thấy sheets nào cho khóa học này");
        }
        
        setApiSheetData(result);
      } else {
        console.error("API trả về lỗi:", result.message);
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
    if (!sheetId) {
      console.error("fetchSheetDetail: Không có sheetId");
      return null;
    }
    
    console.log(`Bắt đầu tải chi tiết sheet ${sheetId}`);
    
    try {
      // Sử dụng tham số fetchData=true để lấy đầy đủ dữ liệu bao gồm cả HTML
      const response = await fetch(`/api/sheets/${sheetId}?fetchData=true`);
      
      if (!response.ok) {
        console.error(`Lỗi HTTP khi lấy chi tiết sheet: ${response.status}`);
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`Chi tiết sheet ${sheetId}:`, result.sheet);
        
        // Kiểm tra xem dữ liệu có đầy đủ không
        if (!result.sheet.data || !result.sheet.data.values) {
          console.warn(`Sheet ${sheetId} không có dữ liệu values!`);
        } else {
          console.log(`Sheet ${sheetId} có ${result.sheet.data.values.length} hàng dữ liệu`);
          
          // Kiểm tra có dữ liệu HTML cho hyperlink không
          if (result.sheet.data.htmlData) {
            console.log(`Sheet ${sheetId} có dữ liệu HTML cho hyperlink`);
          } else {
            console.log(`Sheet ${sheetId} không có dữ liệu HTML cho hyperlink`);
          }
        }
        
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
        return null;
      }
    } catch (error) {
      console.error(`Lỗi khi lấy chi tiết sheet ${sheetId}:`, error);
      return null;
    }
  };
  
  // Hàm chuyển đổi sheet active
  const changeActiveSheet = async (index) => {
    console.log(`Chuyển đổi sang sheet với index ${index}`);
    setActiveApiSheet(index);
    
    // Nếu đã có dữ liệu sheet
    if (apiSheetData && apiSheetData.sheets && apiSheetData.sheets[index]) {
      const sheet = apiSheetData.sheets[index];
      console.log(`Sheet đã chọn: ${sheet.name} (ID: ${sheet._id})`);
      
      // Nếu chưa có chi tiết, lấy chi tiết
      if (!sheet.detail) {
        console.log(`Sheet ${sheet._id} chưa có chi tiết, tải chi tiết...`);
        await fetchSheetDetail(sheet._id);
      } else {
        console.log(`Sheet ${sheet._id} đã có chi tiết, không cần tải lại`);
      }
    } else {
      console.warn("Không thể chuyển sheet: Không tìm thấy dữ liệu sheet hoặc index không hợp lệ");
    }
  };
  
  // Lấy dữ liệu ban đầu khi component mount
  useEffect(() => {
    if (courseId) {
      console.log("useEffect khởi tạo - fetchApiSheetData cho courseId:", courseId);
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