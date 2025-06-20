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

      {/* Hiển thị bảng dữ liệu */}
      <div className="p-4">
        {!sheetDetail.data?.values || sheetDetail.data.values.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">Không có dữ liệu trong sheet này.</p>
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            {/* Chỉ báo cuộn ngang cho điện thoại */}
            <div className="md:hidden bg-blue-50 p-2 border-b border-blue-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-blue-600 text-sm">Vuốt ngang để xem thêm</span>
            </div>
            
            {/* Bảng hiển thị dữ liệu */}
            <table className="min-w-full border-collapse border border-gray-300 shadow-lg rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
                  {/* Hiển thị header từ dữ liệu */}
                  {sheetDetail.data.values[0] && sheetDetail.data.values[0].map((header, idx) => {
                    // Bỏ qua cột STT nếu cần
                    if (idx === 0 && (header === 'STT' || header === '#' || header === 'No.' || 
                                  header === 'No' || header === 'Số TT' || header === 'Số thứ tự')) {
                      return null;
                    }
                    
                    return (
                      <th 
                        key={idx}
                        className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider border border-indigo-500"
                      >
                        <div className="flex items-center">
                          {header}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="bg-white">
                {sheetDetail.data.values.slice(1).map((row, rowIndex) => (
                  <tr 
                    key={rowIndex} 
                    className="border-b hover:bg-blue-50 transition-colors duration-150 bg-white group"
                  >
                    {/* Hiển thị các ô dữ liệu */}
                    {row.map((cell, cellIndex) => {
                      // Bỏ qua cột STT nếu cần
                      if (cellIndex === 0 && row[0] && (
                        sheetDetail.data.values[0][0] === 'STT' || 
                        sheetDetail.data.values[0][0] === '#' || 
                        sheetDetail.data.values[0][0] === 'No.' ||
                        sheetDetail.data.values[0][0] === 'No' ||
                        sheetDetail.data.values[0][0] === 'Số TT' ||
                        sheetDetail.data.values[0][0] === 'Số thứ tự'
                      )) {
                        return null;
                      }
                      
                      // Lấy thông tin định dạng và hyperlink
                      const cellData = sheetDetail.htmlData && 
                                     sheetDetail.htmlData[rowIndex + 1] && 
                                     sheetDetail.htmlData[rowIndex + 1].values && 
                                     sheetDetail.htmlData[rowIndex + 1].values[cellIndex];
                      
                      // Kiểm tra ô gộp
                      const mergedCellKey = `${rowIndex + 1},${cellIndex}`;
                      const isMerged = sheetDetail.mergedCellsMap && sheetDetail.mergedCellsMap[mergedCellKey];
                      
                      // Nếu là ô đã gộp (không phải ô chính), bỏ qua
                      if (isMerged) return null;
                      
                      // Lấy rowSpan và colSpan nếu có
                      const rowSpan = cellData?.rowSpan || 1;
                      const colSpan = cellData?.colSpan || 1;
                      
                      // Lấy hyperlink nếu có
                      const hyperlink = cellData?.hyperlink;
                      
                      // Định dạng nội dung cell
                      let cellContent = cell || '';
                      
                      // Xử lý hiển thị cell theo loại dữ liệu
                      const cellStyle = "px-4 py-3 text-sm text-gray-800 border-r border-b";
                      const key = `${rowIndex}-${cellIndex}`;
                      
                      // Kiểm tra nếu nội dung dài thì hiển thị nút expand
                      const isLongContent = cellContent && cellContent.length > 100 && !hyperlink;
                      const isExpanded = expandedCells[key];
                      
                      if (isLongContent && !isExpanded) {
                        cellContent = cellContent.substring(0, 100) + '...';
                      }
                      
                      return (
                        <td 
                          key={cellIndex} 
                          className={cellStyle}
                          rowSpan={rowSpan}
                          colSpan={colSpan}
                        >
                          {hyperlink ? (
                            <a 
                              href={hyperlink} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {cellContent || hyperlink}
                            </a>
                          ) : (
                            <div>
                              {cellContent}
                              {isLongContent && (
                                <button 
                                  className="ml-2 text-xs text-blue-600 hover:text-blue-800"
                                  onClick={() => toggleCellExpansion(rowIndex, cellIndex)}
                                >
                                  {isExpanded ? 'Thu gọn' : 'Xem thêm'}
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
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