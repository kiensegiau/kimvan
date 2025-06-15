import { useState } from 'react';

export function useRowEditing({ course, setCourse, activeSheet, setShowQuickEditModal, setQuickEditData, setShowAddRowModal, setNewRowData, setInsertPosition, setShowEditRowModal, setEditRowData, setEditingRowIndex, setActualRowIndex, fetchCourseDetail }) {
  const [updatingCell, setUpdatingCell] = useState(false);
  const [updatingRow, setUpdatingRow] = useState(false);
  const [addingRow, setAddingRow] = useState(false);
  
  // Hàm mở modal sửa hàng
  const handleOpenEditRowModal = (rowIndex) => {
    if (!course?.originalData?.sheets || !course.originalData.sheets[activeSheet]) {
      alert('Không thể sửa hàng vì không có dữ liệu sheet');
      return;
    }
    
    // Lấy tất cả các hàng
    const allRows = course.originalData.sheets[activeSheet].data[0]?.rowData || [];
    if (!allRows || allRows.length < 2) {
      alert('Không đủ dữ liệu để sửa');
      return;
    }

    console.log("=== PHÂN TÍCH THÔNG TIN CHI TIẾT ===");
    console.log("1. Hàng được chọn (rowIndex từ UI):", rowIndex);

    // Dữ liệu bảng được hiển thị bằng rowData.slice(1).map((row, rowIndex) => ...)
    // Do đó, rowIndex = 0 thực sự là phần tử thứ 1 của mảng gốc (sau khi đã slice)
    // Để lấy vị trí thật trong mảng gốc, ta cộng thêm 1
    const actualRow = rowIndex + 1;
    
    // Log để kiểm tra đúng không
    console.log("2. Các hàng đầu tiên trong mảng dữ liệu gốc:");
    for (let i = 0; i < Math.min(5, allRows.length); i++) {
      console.log(`   Hàng ${i}:`, allRows[i]?.values?.map(cell => cell.formattedValue || '-') || 'Không có dữ liệu');
    }
    console.log("3. Hàng được chọn để sửa (theo tính toán):");
    console.log(`   Hàng ${actualRow}:`, allRows[actualRow]?.values?.map(cell => cell.formattedValue || '-') || 'Không có dữ liệu');

    if (actualRow >= allRows.length) {
      alert(`Hàng dữ liệu vượt quá giới hạn (${actualRow}/${allRows.length})`);
      return;
    }

    // Lấy dữ liệu của hàng cần sửa
    const dataRow = allRows[actualRow];
    if (!dataRow || !dataRow.values) {
      alert(`Không thể lấy dữ liệu hàng để sửa (vị trí ${actualRow})`);
      return;
    }

    // Tìm header (lấy hàng đầu tiên có dữ liệu làm header)
    let headerRow = null;
    for (let i = 0; i < allRows.length; i++) {
      if (allRows[i]?.values && Array.isArray(allRows[i].values) && allRows[i].values.length > 0) {
        headerRow = allRows[i];
        break;
      }
    }

    if (!headerRow || !headerRow.values) {
      alert('Không tìm thấy header trong dữ liệu');
      return;
    }

    console.log("4. Header được sử dụng:", headerRow.values.map(cell => cell.formattedValue || '-'));
    
    // Tạo object dữ liệu từ header và data
    const rowData = {};
    headerRow.values.forEach((headerCell, idx) => {
      const headerName = headerCell.formattedValue || `Cột ${idx + 1}`;
      const cell = dataRow.values[idx] || {};
      
      // Lưu trữ cả displayText và url cho mọi trường
      // Lấy URL từ link.uri nếu có (ưu tiên cao nhất)
      let url = '';
      if (cell.userEnteredFormat?.textFormat?.link?.uri) {
        url = cell.userEnteredFormat.textFormat.link.uri;
      } else if (cell.hyperlink && cell.hyperlink.startsWith('http')) {
        url = cell.hyperlink;
      }
      
      // Lưu cả displayText và url riêng biệt cho mọi trường
      rowData[headerName] = {
        displayText: cell.formattedValue || '',
        url: url
      };
    });
    
    // Log để xác nhận dữ liệu hàng được chọn đúng
    console.log("5. Dữ liệu sẽ hiển thị trong form sửa:", rowData);
    
    // Lưu lại các giá trị quan trọng để sử dụng khi cập nhật
    setEditRowData(rowData);
    setEditingRowIndex(rowIndex);
    setActualRowIndex(actualRow);
    setShowEditRowModal(true);
  };
  
  // Hàm thay đổi giá trị khi sửa hàng
  const handleEditRowChange = (header, value, field = null) => {
    setEditRowData(prev => {
      // Nếu đây là trường link và chỉ định field (displayText hoặc url)
      if (field) {
        const currentValue = prev[header] || { displayText: '', url: '' };
        return {
          ...prev,
          [header]: {
            ...currentValue,
            [field]: value
          }
        };
      } 
      // Nếu đây là trường thông thường
      else {
        return {
          ...prev,
          [header]: value
        };
      }
    });
  };
  
  // Hàm cập nhật hàng đã sửa
  const handleUpdateRow = async (editRowData, actualRowIndex) => {
    if (!course || !course._id || actualRowIndex === null) return;
    
    try {
      setUpdatingRow(true);
      
      // Lấy tất cả các hàng
      const allRows = course.originalData.sheets[activeSheet].data[0]?.rowData || [];
      if (!allRows || allRows.length < 2) {
        throw new Error('Không đủ dữ liệu để cập nhật');
      }
      
      console.log("=== CẬP NHẬT DỮ LIỆU ===");
      console.log("1. Vị trí hàng cần cập nhật (actualRowIndex):", actualRowIndex);
      
      // Sử dụng actualRowIndex đã được lưu trữ từ lúc mở modal
      const currentRow = allRows[actualRowIndex];
      if (!currentRow || !currentRow.values) {
        throw new Error(`Không tìm thấy dữ liệu hàng để cập nhật (vị trí ${actualRowIndex})`);
      }
      
      console.log("2. Dữ liệu hàng cần cập nhật:", 
        currentRow.values.map(cell => cell.formattedValue || '-'));
      
      // Tìm header (lấy hàng đầu tiên có dữ liệu làm header)
      let headerRow = null;
      for (let i = 0; i < allRows.length; i++) {
        if (allRows[i]?.values && Array.isArray(allRows[i].values) && allRows[i].values.length > 0) {
          headerRow = allRows[i];
          break;
        }
      }
      
      if (!headerRow || !headerRow.values) {
        throw new Error('Không tìm thấy header trong dữ liệu');
      }
      
      // Clone dữ liệu hàng hiện tại để giữ nguyên cấu trúc
      const rowValues = JSON.parse(JSON.stringify(currentRow.values || []));
      
      // Cập nhật từng ô dựa trên dữ liệu đã sửa
      if (headerRow && headerRow.values) {
        headerRow.values.forEach((headerCell, idx) => {
          const headerName = headerCell.formattedValue || '';
          const newValue = editRowData[headerName];
          
          if (!rowValues[idx]) {
            rowValues[idx] = { formattedValue: '' };
          }
          
          if (typeof newValue === 'object') {
            // Cập nhật formattedValue từ displayText
            rowValues[idx].formattedValue = newValue.displayText || '';
            
            // Cập nhật URL nếu có
            if (newValue.url) {
              rowValues[idx].hyperlink = newValue.url;
              if (!rowValues[idx].userEnteredFormat) rowValues[idx].userEnteredFormat = {};
              if (!rowValues[idx].userEnteredFormat.textFormat) rowValues[idx].userEnteredFormat.textFormat = {};
              rowValues[idx].userEnteredFormat.textFormat.link = { uri: newValue.url };
            } else {
              // Nếu URL bị xóa
              delete rowValues[idx].hyperlink;
              if (rowValues[idx].userEnteredFormat?.textFormat?.link) {
                delete rowValues[idx].userEnteredFormat.textFormat.link;
              }
            }
          }
        });
      }
      
      console.log("3. Dữ liệu sau khi sửa:", 
        rowValues.map(cell => cell.formattedValue || '-'));
      
      // Gọi API để cập nhật hàng
      const response = await fetch(`/api/courses/${course._id}/update-row`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sheetIndex: activeSheet,
          rowIndex: actualRowIndex,
          rowData: rowValues
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Không thể cập nhật hàng');
      }
      
      // Đóng modal và làm mới dữ liệu
      setShowEditRowModal(false);
      setActualRowIndex(null); // Reset actualRowIndex
      alert('Cập nhật hàng thành công!');
      await fetchCourseDetail();
    } catch (error) {
      console.error('Lỗi khi cập nhật hàng:', error);
      alert(`Lỗi khi cập nhật hàng: ${error.message}`);
    } finally {
      setUpdatingRow(false);
    }
  };

  // Hàm mở modal chèn hàng
  const handleInsertRow = (rowIndex) => {
    if (!course?.originalData?.sheets || !course.originalData.sheets[activeSheet]) {
      alert('Không thể chèn hàng vì không có dữ liệu sheet');
      return;
    }
    
    // Lấy tất cả các hàng
    const allRows = course.originalData.sheets[activeSheet].data[0]?.rowData || [];
    if (!allRows || allRows.length < 1) {
      alert('Không đủ dữ liệu để chèn hàng');
      return;
    }

    // Tìm header (lấy hàng đầu tiên có dữ liệu làm header)
    let headerRow = null;
    for (let i = 0; i < allRows.length; i++) {
      if (allRows[i]?.values && Array.isArray(allRows[i].values) && allRows[i].values.length > 0) {
        headerRow = allRows[i];
        break;
      }
    }

    if (!headerRow || !headerRow.values) {
      alert('Không tìm thấy header trong dữ liệu');
      return;
    }

    // Tạo object dữ liệu mới từ header
    const rowData = {};
    headerRow.values.forEach((headerCell, idx) => {
      const headerName = headerCell.formattedValue || `Cột ${idx + 1}`;
      // Tạo dữ liệu trống cho mỗi cột
      rowData[headerName] = {
        displayText: '',
        url: ''
      };
      
      // Đặt giá trị mặc định cho cột STT nếu có
      if (idx === 0 && (headerName.toLowerCase().includes('stt') || headerName.toLowerCase().includes('số thứ tự'))) {
        rowData[headerName] = {
          displayText: `${rowIndex + 2}`, // +2 vì rowIndex bắt đầu từ 0 và đã có header
          url: ''
        };
      }
    });
    
    // Lưu vị trí chèn
    setInsertPosition(rowIndex + 1); // +1 vì cần chèn sau hàng hiện tại
    setNewRowData(rowData);
    setShowAddRowModal(true);
  };

  // Hàm thay đổi giá trị khi thêm/chèn hàng mới
  const handleNewRowChange = (header, value, field = null) => {
    setNewRowData(prev => {
      // Nếu đây là trường link và chỉ định field (displayText hoặc url)
      if (field) {
        const currentValue = prev[header] || { displayText: '', url: '' };
        return {
          ...prev,
          [header]: {
            ...currentValue,
            [field]: value
          }
        };
      } 
      // Nếu đây là trường thông thường
      else {
        return {
          ...prev,
          [header]: value
        };
      }
    });
  };

  // Hàm thêm hàng mới hoặc chèn hàng
  const handleAddRow = async (newRowData, insertPosition) => {
    if (!course || !course._id) return;
    
    try {
      setAddingRow(true);
      
      // Lấy tất cả các hàng
      const allRows = course.originalData.sheets[activeSheet].data[0]?.rowData || [];
      if (!allRows) {
        throw new Error('Không có dữ liệu để thêm hàng');
      }
      
      // Tìm header
      let headerRow = null;
      for (let i = 0; i < allRows.length; i++) {
        if (allRows[i]?.values && Array.isArray(allRows[i].values) && allRows[i].values.length > 0) {
          headerRow = allRows[i];
          break;
        }
      }
      
      if (!headerRow || !headerRow.values) {
        throw new Error('Không tìm thấy header trong dữ liệu');
      }
      
      // Tạo dữ liệu hàng mới
      const rowValues = [];
      
      headerRow.values.forEach((headerCell, idx) => {
        const headerName = headerCell.formattedValue || '';
        const newValue = newRowData[headerName];
        
        const cellData = { formattedValue: '' };
        
        if (typeof newValue === 'object') {
          // Cập nhật formattedValue từ displayText
          cellData.formattedValue = newValue.displayText || '';
          
          // Cập nhật URL nếu có
          if (newValue.url) {
            cellData.hyperlink = newValue.url;
            cellData.userEnteredFormat = {
              textFormat: {
                link: { uri: newValue.url }
              }
            };
          }
        }
        
        rowValues.push(cellData);
      });
      
      // Xác định vị trí chèn hàng
      const insertAt = insertPosition !== null ? insertPosition + 1 : allRows.length; // +1 để tính cả header
      
      console.log(`Thêm hàng mới tại vị trí: ${insertAt}, insertPosition: ${insertPosition}`);
      
      // Gọi API để thêm/chèn hàng
      const response = await fetch(`/api/courses/${course._id}/add-row`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sheetIndex: activeSheet,
          rowIndex: insertAt,
          rowData: rowValues
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Không thể thêm hàng');
      }
      
      // Đóng modal và làm mới dữ liệu
      setShowAddRowModal(false);
      setInsertPosition(null);
      alert(insertPosition !== null ? 'Chèn hàng thành công!' : 'Thêm hàng mới thành công!');
      await fetchCourseDetail();
    } catch (error) {
      console.error('Lỗi khi thêm hàng:', error);
      alert(`Lỗi khi thêm hàng: ${error.message}`);
    } finally {
      setAddingRow(false);
    }
  };

  // Add new function to handle quick cell editing
  const handleQuickEdit = (rowIndex, cellIndex, value, url, header) => {
    setQuickEditData({
      rowIndex,
      colIndex: cellIndex,
      value: value || '',
      url: url || '',
      header
    });
    setShowQuickEditModal(true);
  };

  // Add new function to update a single cell
  const handleUpdateCell = async (quickEditData) => {
    if (!course || !course._id) return;
    
    try {
      setUpdatingCell(true);
      
      // Calculate the actual row index (adding 1 to account for header row)
      const actualRowIndex = quickEditData.rowIndex + 1;
      
      // Get current row data
      const allRows = course.originalData.sheets[activeSheet].data[0]?.rowData || [];
      if (!allRows || allRows.length <= actualRowIndex) {
        throw new Error(`Không tìm thấy dữ liệu hàng để cập nhật (vị trí ${actualRowIndex})`);
      }
      
      const currentRow = allRows[actualRowIndex];
      if (!currentRow || !currentRow.values) {
        throw new Error(`Không có dữ liệu hàng để cập nhật (vị trí ${actualRowIndex})`);
      }
      
      // Clone current cell data
      const rowValues = JSON.parse(JSON.stringify(currentRow.values || []));
      const cellIndex = quickEditData.colIndex;
      
      // Update cell value
      if (!rowValues[cellIndex]) {
        rowValues[cellIndex] = { formattedValue: '' };
      }
      
      // Update value and URL
      rowValues[cellIndex].formattedValue = quickEditData.value;
      
      if (quickEditData.url) {
        rowValues[cellIndex].hyperlink = quickEditData.url;
        if (!rowValues[cellIndex].userEnteredFormat) rowValues[cellIndex].userEnteredFormat = {};
        if (!rowValues[cellIndex].userEnteredFormat.textFormat) rowValues[cellIndex].userEnteredFormat.textFormat = {};
        rowValues[cellIndex].userEnteredFormat.textFormat.link = { uri: quickEditData.url };
      } else {
        // If URL is removed
        delete rowValues[cellIndex].hyperlink;
        if (rowValues[cellIndex].userEnteredFormat?.textFormat?.link) {
          delete rowValues[cellIndex].userEnteredFormat.textFormat.link;
        }
      }
      
      // Call API to update the cell
      const response = await fetch(`/api/courses/${course._id}/update-cell`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sheetIndex: activeSheet,
          rowIndex: actualRowIndex,
          cellIndex: cellIndex,
          cellData: rowValues[cellIndex]
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Không thể cập nhật ô');
      }
      
      // Update local state without fetching all data again
      const updatedCourse = JSON.parse(JSON.stringify(course));
      updatedCourse.originalData.sheets[activeSheet].data[0].rowData[actualRowIndex].values[cellIndex] = rowValues[cellIndex];
      setCourse(updatedCourse);
      
      // Close modal 
      setShowQuickEditModal(false);
      
      // Success notification without blocking alert
      const notification = document.createElement('div');
      notification.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50 animate-fade-in-out';
      notification.textContent = 'Đã cập nhật ô thành công!';
      document.body.appendChild(notification);
      
      // Remove notification after 2 seconds
      setTimeout(() => {
        notification.classList.add('animate-fade-out');
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 500);
      }, 2000);
      
    } catch (error) {
      console.error('Lỗi khi cập nhật ô:', error);
      alert(`Lỗi khi cập nhật ô: ${error.message}`);
    } finally {
      setUpdatingCell(false);
    }
  };

  return {
    handleOpenEditRowModal,
    handleEditRowChange,
    handleUpdateRow,
    handleInsertRow,
    handleNewRowChange,
    handleAddRow,
    handleQuickEdit,
    handleUpdateCell,
    updatingRow,
    addingRow,
    updatingCell
  };
}