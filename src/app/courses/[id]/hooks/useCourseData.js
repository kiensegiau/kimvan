import { useState, useEffect } from 'react';

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
        
        // Tải dữ liệu cho mỗi sheet
        const sheets = data.sheets || [];
        for (const sheet of sheets) {
          fetchSheetData(sheet._id);
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
    if (!id) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/courses/raw/${id}?type=_id`);
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Có lỗi xảy ra khi lấy dữ liệu');
      }
      
      console.log('Dữ liệu khóa học đầy đủ:', result.data);
      
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
      
      // Hiệu ứng fade-in
      setTimeout(() => {
        setIsLoaded(true);
      }, 100);
      
      // Tải danh sách sheets liên kết
      fetchLinkedSheets();
      
      setLoading(false);
    } catch (error) {
      console.error("Lỗi khi lấy thông tin khóa học:", error);
      setError(`Không thể lấy thông tin khóa học: ${error.message}`);
      setLoading(false);
    }
  };

  // Hàm làm mới dữ liệu khóa học
  const refreshCourseData = async () => {
    try {
      const response = await fetch(`/api/courses/raw/${id}?type=_id`);
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Có lỗi xảy ra khi lấy dữ liệu');
      }
      
      console.log('Dữ liệu khóa học đã được làm mới:', result.data);
      
      // Kiểm tra cấu trúc dữ liệu
      if (result.data && result.data.originalData && result.data.originalData.sheets) {
        const sheets = result.data.originalData.sheets;
        console.log(`Số lượng sheets: ${sheets.length}`);
        
        sheets.forEach((sheet, idx) => {
          if (sheet.data && sheet.data[0] && sheet.data[0].rowData) {
            console.log(`Sheet ${idx}: ${sheet.data[0].rowData.length} hàng`);
          } else {
            console.log(`Sheet ${idx}: Không có dữ liệu hàng`);
          }
        });
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
      
      // Tải lại danh sách sheets liên kết
      fetchLinkedSheets();
      
      alert('Đã làm mới dữ liệu khóa học thành công!');
    } catch (error) {
      console.error("Lỗi khi làm mới dữ liệu:", error);
      alert(`Không thể làm mới dữ liệu: ${error.message}`);
    }
  };

  // Kiểm tra xem item có ID course không và tải dữ liệu ban đầu
  useEffect(() => {
    if (id) {
      fetchCourseDetail();
    }
  }, [id]);

  return {
    course,
    setCourse,
    loading,
    error,
    formData,
    setFormData,
    isLoaded,
    activeSheet,
    setActiveSheet,
    getSheetTitle,
    linkedSheets,
    loadingSheets,
    sheetData,
    loadingSheetData,
    fetchLinkedSheets,
    fetchSheetData,
    fetchCourseDetail,
    refreshCourseData,
    setSheetData
  };
} 