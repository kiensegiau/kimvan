import { useState } from 'react';
import { ArrowDownTrayIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

export default function ApiSheetData({ 
  apiSheetData, 
  loadingApiSheet, 
  apiSheetError,
  activeApiSheet,
  setActiveApiSheet,
  fetchApiSheetData,
  fetchSheetDetail,
  handleQuickEdit,
  setShowAddRowModal,
  handleOpenEditRowModal,
  handleInsertRow
}) {
  const [expandedCells, setExpandedCells] = useState({});

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
            Khóa học này chưa có sheets nào được liên kết. Vui lòng thêm sheet mới để quản lý dữ liệu khóa học.
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
  const sheetDetail = currentSheet?.detail;

  return (
    <div className="mt-6 bg-white rounded-lg border border-gray-200 overflow-hidden w-full">
      <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h3 className="text-lg font-medium text-gray-900">Dữ liệu khóa học (API)</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={fetchApiSheetData}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200"
          >
            <ArrowPathIcon className="h-4 w-4 mr-1" />
            Làm mới dữ liệu
          </button>
          
          <button
            onClick={() => setShowAddRowModal(true)}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Thêm hàng mới
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
          
          <a 
            href={currentSheet.sheetUrl || `https://docs.google.com/spreadsheets/d/${currentSheet.sheetId}`} 
            target="_blank"
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-green-600 bg-green-50 hover:bg-green-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Mở Google Sheet
          </a>
          
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
        {!sheetDetail ? (
          <div className="flex justify-center items-center py-8">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-600">Đang tải dữ liệu sheet...</span>
          </div>
        ) : !sheetDetail.data?.values || sheetDetail.data.values.length === 0 ? (
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider border border-indigo-500">
                    Hành động
                  </th>
                  
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
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                          </svg>
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
                    {/* Cột hành động */}
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500 border-r">
                      <div className="flex items-center space-x-1">
                        <button 
                          onClick={() => handleOpenEditRowModal(rowIndex)}
                          className="p-1 text-gray-400 hover:text-indigo-600 rounded-full hover:bg-indigo-50"
                          title="Sửa hàng"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </button>
                        
                        <button 
                          onClick={() => handleInsertRow(rowIndex)}
                          className="p-1 text-gray-400 hover:text-green-600 rounded-full hover:bg-green-50"
                          title="Chèn hàng sau"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    
                    {/* Hiển thị các ô dữ liệu */}
                    {row.map((cell, cellIndex) => {
                      // Bỏ qua cột STT (thường là cột đầu tiên)
                      if (cellIndex === 0 && sheetDetail.data.values[0] && 
                         (sheetDetail.data.values[0][0] === 'STT' || 
                          sheetDetail.data.values[0][0] === '#' || 
                          sheetDetail.data.values[0][0] === 'No.' || 
                          sheetDetail.data.values[0][0] === 'No' || 
                          sheetDetail.data.values[0][0] === 'Số TT' ||
                          sheetDetail.data.values[0][0] === 'Số thứ tự')) {
                        return null;
                      }
                      
                      // Xác định nếu ô có link (dựa trên mẫu dữ liệu như https://...)
                      const urlRegex = /https?:\/\/[^\s]+/;
                      const cellText = cell || '';
                      const url = typeof cellText === 'string' && urlRegex.test(cellText) 
                        ? cellText.match(urlRegex)[0] 
                        : null;
                      const hasLink = !!url;
                      
                      // Xác định loại link (youtube, pdf, drive)
                      const linkType = hasLink 
                        ? isYoutubeLink(url) 
                          ? 'youtube' 
                          : isPdfLink(url) 
                            ? 'pdf' 
                            : isGoogleDriveLink(url) 
                              ? 'drive' 
                              : 'external'
                        : null;
                      
                      // Kiểm tra xem nội dung có dài không để quyết định có nên hiển thị chế độ thu gọn
                      const content = cell || '';
                      const isLongContent = typeof content === 'string' && content.length > 50;
                      const key = `${rowIndex}-${cellIndex}`;
                      const isExpanded = expandedCells[key] || false;
                      
                      return (
                        <td 
                          key={cellIndex}
                          className={`${
                            hasLink ? 'has-link cursor-pointer' : ''
                          } px-4 py-3 text-sm text-gray-800 border group-hover:bg-blue-50`}
                        >
                          <div className="relative group/cell">
                            {/* Nút sửa nhanh */}
                            <button
                              className="absolute right-1 top-1 opacity-0 group-hover/cell:opacity-100 p-1 bg-white rounded-full shadow hover:bg-blue-100 transition-opacity duration-200"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickEdit(
                                  rowIndex,
                                  cellIndex,
                                  cell || '',
                                  url || '',
                                  sheetDetail.data.values[0][cellIndex] || ''
                                );
                              }}
                              title="Sửa nhanh"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                              </svg>
                            </button>
                            
                            {/* Nội dung ô */}
                            <div className={`${isLongContent && !isExpanded ? 'line-clamp-2' : ''}`}>
                              {hasLink ? (
                                <div className={`flex items-start ${linkType ? `link-${linkType}` : ''}`}>
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
                                        <path d="M11.363 2c4.155 0 2.637 6 2.637 6s6-1.65 6 2.457v11.543h-16v-20h7.363zm.826-2h-10.189v24h20v-14.386c0-2.391-6.648-9.614-9.811-9.614zm4.811 13h-2.628v3.686h.907v-1.472h1.49v-.732h-1.49v-.698h1.721v-.784zm-4.9 0h-1.599v3.686h1.599c.537 0 .961-.181 1.262-.535.555-.648.587-2.568-.062-3.025-.298-.21-.712-.126-1.2-.126zm-.692.783h.496c.473 0 .802.173.915.644.162.673.046 1.633-.457 1.633h-.954v-2.277zm-2.74-.783h-1.668v3.686h.907v-1.277h.761c.619 0 1.064-.277 1.064-.901 0-.622-.454-.908-1.064-.908zm-.761.732h.546c.235 0 .467.028.467.384 0 .344-.224.394-.467.394h-.546v-.778z"/>
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
                                  <span className={`${hasLink ? 'text-blue-600 hover:underline' : ''}`}>
                                    {content || <em className="text-gray-400">Trống</em>}
                                  </span>
                                </div>
                              ) : (
                                <span>{content || <em className="text-gray-400">Trống</em>}</span>
                              )}
                            </div>
                            
                            {/* Nút xem thêm/rút gọn */}
                            {isLongContent && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCellExpansion(rowIndex, cellIndex);
                                }}
                                className="mt-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {isExpanded ? 'Thu gọn' : 'Xem thêm...'}
                              </button>
                            )}
                          </div>
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
    </div>
  );
} 