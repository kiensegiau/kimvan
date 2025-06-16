import { useState, useEffect } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

export default function LinkedSheets({ 
  id, 
  linkedSheets, 
  loadingSheets, 
  fetchLinkedSheets, 
  sheetData, 
  loadingSheetData, 
  fetchSheetData,
  handleLinkClick,
  setSheetData
}) {
  const [activeSheetId, setActiveSheetId] = useState(null);

  // Tự động chọn sheet đầu tiên khi tải xong danh sách sheets
  useEffect(() => {
    if (linkedSheets && linkedSheets.length > 0 && !loadingSheets) {
      const firstSheet = linkedSheets[0];
      if (firstSheet) {
        setActiveSheetId(firstSheet._id);
        if (!sheetData[firstSheet._id] || !sheetData[firstSheet._id].data) {
          console.log("Auto-loading first sheet:", firstSheet.name);
          fetchSheetData(firstSheet._id);
        }
      }
    }
  }, [linkedSheets, loadingSheets]);

  return (
    <div className="mt-6">
      <div className="flex items-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h2 className="text-xl font-semibold text-gray-800">Chọn khóa học:</h2>
      </div>
      
      <div className="flex flex-wrap gap-3 mb-6">
        {loadingSheets ? (
          <div className="w-full flex justify-center items-center py-8">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-600">Đang tải danh sách khóa học...</span>
          </div>
        ) : linkedSheets.length === 0 ? (
          <div className="w-full bg-gray-50 p-6 rounded-lg text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-600 mb-4">Chưa có khóa học nào được liên kết.</p>
          </div>
        ) : (
          linkedSheets.map((sheet) => (
            <button
              key={sheet._id}
              onClick={() => {
                setActiveSheetId(sheet._id);
                if (!sheetData[sheet._id] || !sheetData[sheet._id].data) {
                  fetchSheetData(sheet._id);
                }
              }}
              className={`
                px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap
                ${activeSheetId === sheet._id ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}
                flex items-center space-x-2 min-w-[200px] justify-center shadow-sm
              `}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>{sheet.name}</span>
              {sheetData[sheet._id] && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-indigo-500 text-white text-xs">
                  {sheetData[sheet._id].data?.values?.length - 1 || 0}
                </span>
              )}
            </button>
          ))
        )}
        
        <button
          onClick={fetchLinkedSheets}
          className="px-4 py-3 rounded-lg text-sm font-medium bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 transition-colors duration-200 flex items-center space-x-2 shadow-sm"
        >
          <ArrowPathIcon className={`h-5 w-5 ${loadingSheets ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </button>
      </div>
      
      {/* Hiển thị sheet đã chọn */}
      {linkedSheets.map((sheet) => (
        sheetData[sheet._id] && activeSheetId === sheet._id && (
          <div key={`content-${sheet._id}`} className="mb-8 bg-white rounded-lg border border-gray-200 overflow-hidden shadow-md">
            <div className="px-6 py-4 bg-indigo-600 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-medium">{sheet.name}</h3>
                {sheetData[sheet._id].data?.values && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-indigo-500 text-white text-xs">
                    Tổng số: {sheetData[sheet._id].data.values.length - 1}
                  </span>
                )}
              </div>
              <div className="mt-2 sm:mt-0 flex flex-wrap gap-2">
                <button 
                  onClick={() => fetchSheetData(sheet._id)}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-500 hover:bg-indigo-400"
                >
                  <ArrowPathIcon className={`h-4 w-4 mr-1 ${loadingSheetData[sheet._id] ? 'animate-spin' : ''}`} />
                  Làm mới
                </button>
              </div>
            </div>
            
            {sheet.description && (
              <div className="px-6 py-3 bg-indigo-50 border-b border-indigo-100">
                <p className="text-sm text-indigo-800">{sheet.description}</p>
              </div>
            )}
            
            {/* Chọn sheet khi có nhiều sheet */}
            {sheetData[sheet._id]?.data?.sheets && sheetData[sheet._id].data.sheets.length > 1 && (
              <div className="border-b border-gray-200 px-4 sm:px-6 py-4 bg-indigo-50">
                <h3 className="text-base font-medium text-indigo-900 mb-3">Chọn sheet:</h3>
                <div className="flex flex-wrap gap-2 overflow-x-auto pb-2">
                  {sheetData[sheet._id].data.sheets.map((subSheet, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        // Lưu chỉ mục sheet đang chọn vào state
                        setSheetData(prev => ({
                          ...prev,
                          [sheet._id]: {
                            ...prev[sheet._id],
                            activeSubSheet: index
                          }
                        }));
                      }}
                      className={`
                        px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap
                        ${(sheetData[sheet._id].activeSubSheet === index || (!sheetData[sheet._id].activeSubSheet && index === 0)) 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50'
                        }
                      `}
                    >
                      <div className="flex items-center">
                        <span>{subSheet?.properties?.title || `Sheet ${index + 1}`}</span>
                        {subSheet?.data?.[0]?.rowData && (
                          <span className={`text-xs ml-2 px-2 py-0.5 rounded-full ${
                            (sheetData[sheet._id].activeSubSheet === index || (!sheetData[sheet._id].activeSubSheet && index === 0))
                              ? 'bg-indigo-500 text-white' 
                              : 'bg-indigo-100 text-indigo-800'
                          }`}>
                            {(subSheet.data[0].rowData.length - 1) || 0}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <div className="px-4 py-4">
              {loadingSheetData[sheet._id] ? (
                <div className="flex justify-center items-center py-8">
                  <ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-500" />
                  <span className="ml-2 text-gray-600">Đang tải dữ liệu sheet...</span>
                </div>
              ) : !sheetData[sheet._id].data?.values ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">Chưa có dữ liệu sheet. Nhấn "Làm mới dữ liệu" để tải.</p>
                  <button 
                    onClick={() => fetchSheetData(sheet._id)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    <ArrowPathIcon className="h-5 w-5 mr-2" />
                    Tải dữ liệu sheet
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <SheetTable sheetData={sheetData[sheet._id]} handleLinkClick={handleLinkClick} />
                </div>
              )}
            </div>
          </div>
        )
      ))}
    </div>
  );
}

function SheetTable({ sheetData, handleLinkClick }) {
  const [expandedCells, setExpandedCells] = useState({});

  const toggleCellExpansion = (rowIdx, cellIdx) => {
    const key = `${rowIdx}-${cellIdx}`;
    setExpandedCells(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Function to extract cell value from different formats
  const getCellValue = (cell) => {
    // If cell is null or undefined
    if (cell === null || cell === undefined) {
      return '';
    }
    
    // If cell is a string, return it directly
    if (typeof cell === 'string') {
      return cell;
    }
    
    // If cell is an object with formatted value
    if (typeof cell === 'object') {
      // Google Sheets API can return different formats
      if (cell.formattedValue !== undefined) {
        return cell.formattedValue;
      }
      
      // Check for userEnteredValue
      if (cell.userEnteredValue) {
        const userValue = cell.userEnteredValue;
        if (userValue.stringValue !== undefined) return userValue.stringValue;
        if (userValue.numberValue !== undefined) return String(userValue.numberValue);
        if (userValue.boolValue !== undefined) return String(userValue.boolValue);
        if (userValue.formulaValue !== undefined) return userValue.formulaValue;
      }
      
      // Check for effectiveValue
      if (cell.effectiveValue) {
        const effValue = cell.effectiveValue;
        if (effValue.stringValue !== undefined) return effValue.stringValue;
        if (effValue.numberValue !== undefined) return String(effValue.numberValue);
        if (effValue.boolValue !== undefined) return String(effValue.boolValue);
      }
      
      // Check for hyperlink
      if (cell.hyperlink) {
        return cell.hyperlink;
      }
      
      // Last resort - try JSON stringify
      try {
        return JSON.stringify(cell);
      } catch (e) {
        console.error("Failed to stringify cell:", e);
        return "[Complex cell data]";
      }
    }
    
    // Default fallback
    return String(cell);
  };

  const isYoutubeLink = (url) => {
    if (!url) return false;
    return url.includes('youtube.com') || url.includes('youtu.be');
  };
  
  const isPdfLink = (url) => {
    if (!url) return false;
    return url.toLowerCase().endsWith('.pdf');
  };
  
  const isGoogleDriveLink = (url) => {
    if (!url) return false;
    return url.includes('drive.google.com') || url.includes('docs.google.com');
  };

  // Xác định loại link
  const getLinkType = (url) => {
    if (!url) return null;
    if (isYoutubeLink(url)) return 'youtube';
    if (isPdfLink(url)) return 'pdf';
    if (isGoogleDriveLink(url)) return 'drive';
    return 'external';
  };
  
  // Cải thiện hàm phát hiện URL
  const findUrls = (text) => {
    if (!text || typeof text !== 'string') return null;
    
    // Regex để tìm URL trong văn bản - cải tiến để bắt nhiều mẫu URL hơn
    const urlRegex = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi;
    
    const matches = text.match(urlRegex);
    
    if (matches && matches.length > 0) {
      // Đảm bảo URL bắt đầu bằng http:// hoặc https://
      let url = matches[0];
      if (url.startsWith('www.')) {
        url = 'https://' + url;
      }
      return url;
    }
    
    return null;
  };

  // Check if data is available and in the expected format
  if (!sheetData || !sheetData.data) {
    console.error("Invalid sheet data:", sheetData);
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <p className="text-red-600">Lỗi: Dữ liệu không hợp lệ</p>
        <pre className="mt-2 text-xs overflow-auto max-h-40 bg-white p-2 rounded border">
          {JSON.stringify(sheetData, null, 2)}
        </pre>
      </div>
    );
  }

  // Handle different data formats - support both values and htmlData formats
  let headers = [];
  let rows = [];

  try {
    if (sheetData.data.values) {
      // Format 1: Direct values array
      headers = sheetData.data.values[0] || [];
      rows = sheetData.data.values.slice(1) || [];
    } else if (sheetData.data.sheets && sheetData.activeSubSheet !== undefined) {
      // Format 2: Complex sheet format with selected subsheet
      const activeSheet = sheetData.data.sheets[sheetData.activeSubSheet];
      if (activeSheet && activeSheet.data && activeSheet.data[0] && activeSheet.data[0].rowData) {
        // Extract headers and rows from the complex format
        const rowData = activeSheet.data[0].rowData;
        
        // Extract headers from first row
        if (rowData[0] && rowData[0].values) {
          headers = rowData[0].values.map(cell => getCellValue(cell));
        }
        
        // Extract data rows
        rows = rowData.slice(1).map(row => {
          if (row && row.values) {
            return row.values.map(cell => getCellValue(cell));
          }
          return [];
        });
      }
    } else {
      console.error("Unsupported data format:", sheetData.data);
      return (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-yellow-700">Định dạng dữ liệu không được hỗ trợ</p>
          <pre className="mt-2 text-xs overflow-auto max-h-40 bg-white p-2 rounded border">
            {JSON.stringify(sheetData.data, null, 2)}
          </pre>
        </div>
      );
    }
  } catch (error) {
    console.error("Error processing sheet data:", error);
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <p className="text-red-600">Lỗi khi xử lý dữ liệu: {error.message}</p>
        <pre className="mt-2 text-xs overflow-auto max-h-40 bg-white p-2 rounded border">
          {JSON.stringify(sheetData, null, 2)}
        </pre>
      </div>
    );
  }

  // If no data after processing, show empty state
  if (!headers.length || !rows.length) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-md text-center">
        <p className="text-gray-600">Không có dữ liệu để hiển thị</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 shadow-md">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gradient-to-r from-indigo-600 to-purple-600">
              {headers.map((header, idx) => {
                // Bỏ qua cột đầu tiên
                if (idx === 0) {
                  return null;
                }
                
                return (
                  <th 
                    key={idx} 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider border-r border-indigo-500 last:border-r-0"
                  >
                    <div className="flex items-center">
                      {header}
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                      </svg>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => {
              // Skip empty rows or invalid row format
              if (!row || !Array.isArray(row) || row.length === 0) {
                console.warn("Skipping invalid row:", row);
                return null;
              }
              
              return (
                <tr 
                  key={rowIdx} 
                  className={`border-b ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-indigo-50 transition-colors duration-150`}
                >
                  {row.map((cell, cellIdx) => {
                    // Bỏ qua cột đầu tiên
                    if (cellIdx === 0) {
                      return null;
                    }
                    
                    // Extract cell value
                    const cellValue = getCellValue(cell);
                    
                    // Kiểm tra xem ô này có nằm trong vùng gộp không
                    const isMerged = sheetData.data.merges?.some(merge => {
                      return (
                        rowIdx + 1 >= merge.startRowIndex && 
                        rowIdx + 1 < merge.endRowIndex && 
                        cellIdx >= merge.startColumnIndex && 
                        cellIdx < merge.endColumnIndex &&
                        // Kiểm tra xem đây có phải là ô chính không
                        !(rowIdx + 1 === merge.startRowIndex && cellIdx === merge.startColumnIndex)
                      );
                    });
                    
                    if (isMerged) {
                      // Nếu ô này đã được gộp và không phải là ô chính, bỏ qua
                      return null;
                    }
                    
                    // Lấy thông tin rowSpan và colSpan từ merges
                    const mergeInfo = sheetData.data.merges?.find(merge => 
                      rowIdx + 1 === merge.startRowIndex && 
                      cellIdx === merge.startColumnIndex
                    );
                    
                    const rowSpan = mergeInfo ? mergeInfo.endRowIndex - mergeInfo.startRowIndex : 1;
                    const colSpan = mergeInfo ? mergeInfo.endColumnIndex - mergeInfo.startColumnIndex : 1;
                    
                    // Xác định nếu ô có link
                    const cellText = cellValue || '';
                    
                    // Check for hyperlink in cell object
                    let url = null;
                    if (typeof cell === 'object' && cell !== null) {
                      if (cell.hyperlink) {
                        url = cell.hyperlink;
                      } else if (cell.userEnteredValue && cell.userEnteredValue.formulaValue && 
                                cell.userEnteredValue.formulaValue.includes('HYPERLINK')) {
                        // Try to extract URL from HYPERLINK formula
                        const formula = cell.userEnteredValue.formulaValue;
                        const urlMatch = formula.match(/HYPERLINK\("([^"]+)"/);
                        if (urlMatch && urlMatch[1]) {
                          url = urlMatch[1];
                        }
                      }
                    }
                    
                    // If no hyperlink found in cell object, try to find URL in text
                    if (!url) {
                      url = findUrls(cellText);
                    }
                    
                    const hasLink = !!url;
                    const linkType = getLinkType(url);
                    
                    // Chuẩn bị nội dung hiển thị
                    let displayText = cellText;
                    if (hasLink && cellText.trim() === url) {
                      // Nếu cell chỉ chứa URL, hiển thị "Mở liên kết" thay vì URL đầy đủ
                      displayText = "Mở liên kết";
                    }
                    
                    // Kiểm tra xem nội dung có dài không
                    const content = hasLink && cellText.trim() === url ? displayText : cellText;
                    const isLongContent = typeof content === 'string' && content.length > 50;
                    const key = `${rowIdx}-${cellIdx}`;
                    const isExpanded = expandedCells[key] || false;
                    
                    return (
                      <td 
                        key={cellIdx}
                        className={`px-6 py-4 text-sm border-r last:border-r-0 ${hasLink ? 'text-indigo-600' : 'text-gray-800'}`}
                        rowSpan={rowSpan}
                        colSpan={colSpan}
                      >
                        <div className="relative group">
                          <div className={`${isLongContent && !isExpanded ? 'line-clamp-2' : ''}`}>
                            {hasLink ? (
                              <div className="flex items-start">
                                {linkType === 'youtube' && (
                                  <span className="mr-2 text-red-600 flex-shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                                    </svg>
                                  </span>
                                )}
                                {linkType === 'pdf' && (
                                  <span className="mr-2 text-red-600 flex-shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M11.363 2c4.155 0 2.637 6 2.637 6s6-1.65 6 2.457v11.543h-16v-20h7.363zm.826-2h-10.189v24h20v-14.386c0-2.391-6.648-9.614-9.811-9.614z"/>
                                    </svg>
                                  </span>
                                )}
                                {linkType === 'drive' && (
                                  <span className="mr-2 text-blue-600 flex-shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M7.71 3.52L1.15 15l3.42 5.99 6.56-11.47L7.71 3.52zm-.46 10.42l-1.66 2.91H15.1l1.66-2.91H7.25zm8.79-8.71L13.04 10h5.43l3.1-5.42c-.34-.61-.67-1.24-1.85-1.24h-8.76l-.91 1.59h5.99zm5.9 6.32l-3.89 6.84-.01.01h.01C18.97 19.07 20 17.9 20 16.37v-6.76l-1.94 3.38z"/>
                                    </svg>
                                  </span>
                                )}
                                {linkType === 'external' && (
                                  <span className="mr-2 text-blue-600 flex-shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  </span>
                                )}
                                <button 
                                  onClick={(e) => {
                                    e.preventDefault();
                                    if (handleLinkClick) {
                                      handleLinkClick(url, cellText);
                                    } else {
                                      window.open(url, '_blank');
                                    }
                                  }}
                                  className="hover:underline text-indigo-600 hover:text-indigo-800 flex items-center cursor-pointer bg-transparent border-0 p-0 font-normal"
                                >
                                  <span className="flex-1">{content}</span>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <span>{content || <em className="text-gray-400">Trống</em>}</span>
                            )}
                          </div>
                          
                          {/* Nút xem thêm/rút gọn */}
                          {isLongContent && (
                            <button
                              onClick={() => toggleCellExpansion(rowIdx, cellIdx)}
                              className="mt-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                            >
                              {isExpanded ? 'Thu gọn' : 'Xem thêm...'}
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
} 