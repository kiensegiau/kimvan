import { useState, useEffect } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

export default function ApiSheetData({ 
  apiSheetData, 
  loadingApiSheet, 
  apiSheetError,
  activeApiSheet,
  setActiveApiSheet,
  fetchApiSheetData,
  fetchSheetDetail
}) {
  const [expandedCells, setExpandedCells] = useState({});
  const [debugInfo, setDebugInfo] = useState({});

  // Debug useEffect để kiểm tra dữ liệu sheet
  useEffect(() => {
    if (apiSheetData && apiSheetData.sheets && apiSheetData.sheets.length > 0) {
      const currentSheet = apiSheetData.sheets[activeApiSheet];
      const sheetDetail = currentSheet?.detail;
      
      console.log('ApiSheetData component - apiSheetData:', apiSheetData);
      console.log('ApiSheetData component - currentSheet:', currentSheet);
      console.log('ApiSheetData component - sheetDetail:', sheetDetail);
      
      // Lưu thông tin debug
      setDebugInfo({
        hasSheets: apiSheetData.sheets.length > 0,
        activeSheetIndex: activeApiSheet,
        activeSheetId: currentSheet?._id,
        hasDetail: !!sheetDetail,
        hasValues: sheetDetail?.data?.values?.length > 0,
        valueCount: sheetDetail?.data?.values?.length || 0,
        htmlDataCount: sheetDetail?.data?.htmlData?.length || 0
      });
      
      // Nếu có sheet nhưng không có chi tiết, tải chi tiết
      if (currentSheet && !currentSheet.detail && !loadingApiSheet) {
        console.log('Tự động tải chi tiết sheet:', currentSheet._id);
        fetchSheetDetail(currentSheet._id);
      }
    }
  }, [apiSheetData, activeApiSheet, loadingApiSheet, fetchSheetDetail]);

  const toggleCellExpansion = (rowIndex, cellIndex) => {
    const key = `${rowIndex}-${cellIndex}`;
    setExpandedCells(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
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

  // Hàm xử lý nội dung cell để phát hiện và chuyển đổi URL thành liên kết
  const renderCellContent = (content) => {
    if (!content) return '';
    
    // Kiểm tra công thức HYPERLINK từ Google Sheets
    const hyperlinkRegex = /=HYPERLINK\("([^"]+)"(?:,\s*"([^"]+)")?\)/i;
    const hyperlinkMatch = typeof content === 'string' ? content.match(hyperlinkRegex) : null;
    
    if (hyperlinkMatch) {
      let url = hyperlinkMatch[1];
      const displayText = hyperlinkMatch[2] || url;
      
      // Kiểm tra loại link để hiển thị icon phù hợp
      let icon = null;
      if (isYoutubeLink(url)) {
        icon = <span className="text-red-500 mr-1" title="YouTube Video">🎬</span>;
      } else if (isGoogleDriveLink(url)) {
        icon = <span className="text-blue-500 mr-1" title="Google Drive">📄</span>;
      } else if (url.includes('docs.google.com/document')) {
        icon = <span className="text-green-500 mr-1" title="Google Docs">📝</span>;
      } else if (isPdfLink(url)) {
        icon = <span className="text-red-500 mr-1" title="PDF">📕</span>;
      }
      
      return (
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-blue-600 hover:underline"
        >
          {icon}{displayText}
        </a>
      );
    }
    
    // Kiểm tra xem nội dung có phải là URL không
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    // Nếu nội dung chỉ chứa URL
    if (typeof content === 'string' && urlRegex.test(content) && content.trim().match(urlRegex)[0] === content.trim()) {
      // Xác định loại URL để hiển thị icon phù hợp
      let icon = null;
      if (isYoutubeLink(content)) {
        icon = <span className="text-red-500 mr-1" title="YouTube Video">🎬</span>;
      } else if (isGoogleDriveLink(content)) {
        icon = <span className="text-blue-500 mr-1" title="Google Drive">📄</span>;
      } else if (content.includes('docs.google.com/document')) {
        icon = <span className="text-green-500 mr-1" title="Google Docs">📝</span>;
      } else if (isPdfLink(content)) {
        icon = <span className="text-red-500 mr-1" title="PDF">📕</span>;
      }
      
      return (
        <a 
          href={content} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-blue-600 hover:underline"
        >
          {icon}{content}
        </a>
      );
    }
    
    return content;
  };

  if (apiSheetError) {
    return (
      <div className="mt-6 bg-white rounded-lg border border-red-200 overflow-hidden w-full p-4">
        <div className="bg-red-50 p-4 rounded text-red-700">
          <p className="font-medium">Lỗi khi tải dữ liệu sheet</p>
          <p>{apiSheetError}</p>
        </div>
      </div>
    );
  }

  if (loadingApiSheet) {
    return (
      <div className="mt-6 bg-white rounded-lg border border-gray-200 overflow-hidden w-full p-8">
        <div className="flex justify-center items-center">
          <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600">Đang tải dữ liệu sheets...</span>
        </div>
      </div>
    );
  }

  if (!apiSheetData || !apiSheetData.sheets || apiSheetData.sheets.length === 0) {
    return (
      <div className="mt-6 bg-white rounded-lg border border-gray-200 overflow-hidden w-full p-8">
        <div className="text-center p-8">
          <div className="inline-block p-4 rounded-full bg-gray-100 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Không có sheets liên kết</h3>
          <p className="text-gray-600 max-w-md mx-auto mb-4">
            Khóa học này chưa có sheets nào được liên kết.
          </p>
          <button
            onClick={fetchApiSheetData}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Làm mới dữ liệu
          </button>
        </div>
      </div>
    );
  }

  // Lấy sheet đang active
  const currentSheet = apiSheetData.sheets[activeApiSheet];
  
  // Kiểm tra xem currentSheet có tồn tại không
  if (!currentSheet) {
    return (
      <div className="mt-6 bg-white rounded-lg border border-red-200 overflow-hidden w-full p-4">
        <div className="bg-red-50 p-4 rounded text-red-700">
          <p className="font-medium">Lỗi hiển thị sheet</p>
          <p>Không tìm thấy sheet đang chọn (index: {activeApiSheet})</p>
          <button
            onClick={fetchApiSheetData}
            className="mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Làm mới dữ liệu
          </button>
        </div>
        
        {/* Debug info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 bg-gray-800 text-gray-200 p-3 rounded text-xs">
            <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
          </div>
        )}
      </div>
    );
  }
  
  const sheetDetail = currentSheet?.detail;

  // Kiểm tra chi tiết sheet
  if (!sheetDetail) {
    return (
      <div className="mt-6 bg-white rounded-lg border border-gray-200 overflow-hidden w-full">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h3 className="text-lg font-medium text-gray-900">Dữ liệu khóa học</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => fetchSheetDetail(currentSheet._id)}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200"
            >
              <ArrowPathIcon className="h-4 w-4 mr-1" />
              Tải dữ liệu
            </button>
          </div>
        </div>
        
        <div className="p-8 text-center">
          <div className="inline-block p-4 rounded-full bg-yellow-100 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có dữ liệu chi tiết</h3>
          <p className="text-gray-600 max-w-md mx-auto mb-4">
            Đã tìm thấy sheet <strong>{currentSheet.name}</strong> nhưng chưa tải được dữ liệu chi tiết.
          </p>
          <button
            onClick={() => fetchSheetDetail(currentSheet._id)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-500 hover:bg-yellow-600"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Tải dữ liệu chi tiết
          </button>
        </div>
        
        {/* Debug info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="m-4 bg-gray-800 text-gray-200 p-3 rounded text-xs">
            <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
          </div>
        )}
      </div>
    );
  }

  // Thay thế phần renderTable trong component return để hỗ trợ hiển thị URL
  const renderTable = () => {
    if (!sheetDetail?.data?.values || sheetDetail.data.values.length <= 1) {
      return (
        <div className="p-6 text-center bg-gray-50 rounded-lg my-4">
          <p className="text-gray-500">Không có dữ liệu để hiển thị.</p>
        </div>
      );
    }

    const values = sheetDetail.data.values;
    const htmlData = sheetDetail.data.htmlData || [];

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {values[0].map((header, index) => (
                <th 
                  key={index} 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {values.slice(1).map((row, rowIndex) => {
              // Lấy dữ liệu HTML tương ứng nếu có
              const htmlRow = htmlData[rowIndex + 1]?.values || [];
              
              return (
                <tr key={rowIndex} className="hover:bg-gray-50">
                  {row.map((cell, cellIndex) => {
                    // Kiểm tra xem có dữ liệu HTML không
                    const htmlCell = htmlRow[cellIndex];
                    const hyperlink = htmlCell?.hyperlink;
                    
                    // Nếu có hyperlink trong dữ liệu HTML
                    if (hyperlink) {
                      // Xác định loại liên kết để hiển thị icon phù hợp
                      let icon = null;
                      if (isYoutubeLink(hyperlink)) {
                        icon = <span className="text-red-500 mr-1" title="YouTube Video">🎬</span>;
                      } else if (isGoogleDriveLink(hyperlink)) {
                        icon = <span className="text-blue-500 mr-1" title="Google Drive">📄</span>;
                      } else if (hyperlink.includes('docs.google.com/document')) {
                        icon = <span className="text-green-500 mr-1" title="Google Docs">📝</span>;
                      } else if (isPdfLink(hyperlink)) {
                        icon = <span className="text-red-500 mr-1" title="PDF">📕</span>;
                      }
                      
                      const key = `${rowIndex}-${cellIndex}`;
                      const isExpanded = expandedCells[key];
                      const cellContent = cell || hyperlink;
                      
                      return (
                        <td key={cellIndex} className="px-6 py-4">
                          <div className={`${cellContent.length > 50 && !isExpanded ? 'cursor-pointer' : ''}`}>
                            {cellContent.length > 50 && !isExpanded ? (
                              <div onClick={() => toggleCellExpansion(rowIndex, cellIndex)}>
                                <a 
                                  href={hyperlink} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-blue-600 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {icon}{cellContent.substring(0, 50)}...
                                </a>
                                <span className="text-xs text-blue-500 ml-1">(click để xem thêm)</span>
                              </div>
                            ) : (
                              <div>
                                <a 
                                  href={hyperlink} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-blue-600 hover:underline"
                                >
                                  {icon}{cellContent}
                                </a>
                                {cellContent.length > 50 && (
                                  <button 
                                    className="text-xs text-blue-500 ml-1"
                                    onClick={() => toggleCellExpansion(rowIndex, cellIndex)}
                                  >
                                    (thu gọn)
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    }
                    
                    // Xử lý các cell thông thường
                    const key = `${rowIndex}-${cellIndex}`;
                    const isExpanded = expandedCells[key];
                    const cellContent = cell || '';
                    
                    if (cellContent.length > 50 && !isExpanded) {
                      return (
                        <td key={cellIndex} className="px-6 py-4 cursor-pointer" onClick={() => toggleCellExpansion(rowIndex, cellIndex)}>
                          <div>
                            {renderCellContent(cellContent.substring(0, 50))}
                            <span className="text-xs text-blue-500 ml-1">(click để xem thêm)</span>
                          </div>
                        </td>
                      );
                    }
                    
                    return (
                      <td key={cellIndex} className="px-6 py-4">
                        <div>
                          {renderCellContent(cellContent)}
                          {cellContent.length > 50 && isExpanded && (
                            <button 
                              className="text-xs text-blue-500 ml-1"
                              onClick={() => toggleCellExpansion(rowIndex, cellIndex)}
                            >
                              (thu gọn)
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
    );
  };

  return (
    <div className="mt-6 bg-white rounded-lg border border-gray-200 overflow-hidden w-full">
      <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h3 className="text-lg font-medium text-gray-900">Dữ liệu khóa học</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={fetchApiSheetData}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200"
          >
            <ArrowPathIcon className="h-4 w-4 mr-1" />
            Làm mới dữ liệu
          </button>
        </div>
      </div>

      {/* Chọn khóa học khi có nhiều sheet */}
      {apiSheetData.sheets.length > 1 && (
        <div className="border-b border-gray-200 px-4 sm:px-6 py-4 bg-gray-50">
          <h3 className="text-base font-medium text-gray-800 mb-3">Chọn sheet:</h3>
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-2">
            {apiSheetData.sheets.map((sheet, index) => (
              <button
                key={index}
                onClick={() => setActiveApiSheet(index)}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap
                  ${activeApiSheet === index 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                <div className="flex items-center">
                  <span>{sheet.name}</span>
                  {sheet.detail?.data?.values && (
                    <span className={`text-xs ml-2 px-2 py-0.5 rounded-full ${
                      activeApiSheet === index ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {(sheet.detail.data.values.length - 1) || 0}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hiển thị thông tin sheet hiện tại */}
      <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2">
        <div className="font-medium text-gray-800 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {currentSheet.name}
        </div>
        <div className="flex items-center gap-2">
          {sheetDetail?.data?.values && (
            <div className="text-sm text-gray-600">
              Số dòng: <span className="font-medium text-blue-600">
                {(sheetDetail.data.values.length - 1) || 0}
              </span>
            </div>
          )}
          
          <button 
            onClick={() => fetchSheetDetail(currentSheet._id)}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-600 bg-blue-50 hover:bg-blue-100"
          >
            <ArrowPathIcon className="h-4 w-4 mr-1" />
            Làm mới dữ liệu
          </button>
        </div>
      </div>

      {/* Hiển thị dữ liệu sheet */}
      <div className="px-4 sm:px-6 py-4">
        {sheetDetail?.data?.values && sheetDetail.data.values.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {sheetDetail.data.values[0].map((header, index) => (
                    <th 
                      key={index} 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sheetDetail.data.values.slice(1).map((row, rowIndex) => {
                  // Lấy dữ liệu HTML tương ứng nếu có
                  const htmlRow = sheetDetail.data.htmlData?.[rowIndex + 1]?.values || [];
                  
                  return (
                    <tr key={rowIndex} className="hover:bg-gray-50">
                      {row.map((cell, cellIndex) => {
                        // Kiểm tra xem có dữ liệu HTML không
                        const htmlCell = htmlRow[cellIndex];
                        const hyperlink = htmlCell?.hyperlink;
                        
                        // Nếu có hyperlink trong dữ liệu HTML
                        if (hyperlink) {
                          // Xác định loại liên kết để hiển thị icon phù hợp
                          let icon = null;
                          if (isYoutubeLink(hyperlink)) {
                            icon = <span className="text-red-500 mr-1" title="YouTube Video">🎬</span>;
                          } else if (isGoogleDriveLink(hyperlink)) {
                            icon = <span className="text-blue-500 mr-1" title="Google Drive">📄</span>;
                          } else if (hyperlink.includes('docs.google.com/document')) {
                            icon = <span className="text-green-500 mr-1" title="Google Docs">📝</span>;
                          } else if (isPdfLink(hyperlink)) {
                            icon = <span className="text-red-500 mr-1" title="PDF">📕</span>;
                          }
                          
                          const key = `${rowIndex}-${cellIndex}`;
                          const isExpanded = expandedCells[key];
                          const cellContent = cell || hyperlink;
                          
                          return (
                            <td key={cellIndex} className="px-6 py-4">
                              <div className={`${cellContent.length > 50 && !isExpanded ? 'cursor-pointer' : ''}`}>
                                {cellContent.length > 50 && !isExpanded ? (
                                  <div onClick={() => toggleCellExpansion(rowIndex, cellIndex)}>
                                    <a 
                                      href={hyperlink} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-blue-600 hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {icon}{cellContent.substring(0, 50)}...
                                    </a>
                                    <span className="text-xs text-blue-500 ml-1">(click để xem thêm)</span>
                                  </div>
                                ) : (
                                  <div>
                                    <a 
                                      href={hyperlink} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-blue-600 hover:underline"
                                    >
                                      {icon}{cellContent}
                                    </a>
                                    {cellContent.length > 50 && (
                                      <button 
                                        className="text-xs text-blue-500 ml-1"
                                        onClick={() => toggleCellExpansion(rowIndex, cellIndex)}
                                      >
                                        (thu gọn)
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        }
                        
                        // Xử lý các cell thông thường
                        const key = `${rowIndex}-${cellIndex}`;
                        const isExpanded = expandedCells[key];
                        const cellContent = cell || '';
                        
                        if (cellContent.length > 50 && !isExpanded) {
                          return (
                            <td key={cellIndex} className="px-6 py-4 cursor-pointer" onClick={() => toggleCellExpansion(rowIndex, cellIndex)}>
                              <div>
                                {renderCellContent(cellContent.substring(0, 50))}
                                <span className="text-xs text-blue-500 ml-1">(click để xem thêm)</span>
                              </div>
                            </td>
                          );
                        }
                        
                        return (
                          <td key={cellIndex} className="px-6 py-4">
                            <div>
                              {renderCellContent(cellContent)}
                              {cellContent.length > 50 && isExpanded && (
                                <button 
                                  className="text-xs text-blue-500 ml-1"
                                  onClick={() => toggleCellExpansion(rowIndex, cellIndex)}
                                >
                                  (thu gọn)
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
        ) : (
          <div className="p-6 text-center bg-gray-50 rounded-lg">
            <p className="text-gray-500">Không có dữ liệu để hiển thị.</p>
          </div>
        )}
      </div>
      
      {/* Debug info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="m-4 bg-gray-800 text-gray-200 p-3 rounded text-xs">
          <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
        </div>
      )}
    </div>
  );
} 