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

  // Hàm lấy hyperlink từ dữ liệu HTML
  const getHyperlink = (rowIndex, cellIndex, sheetDetail) => {
    // Kiểm tra dữ liệu HTML tối ưu trước
    if (sheetDetail.optimizedHtmlData && sheetDetail.optimizedHtmlData.length > 0) {
      const optimizedRow = sheetDetail.optimizedHtmlData.find(row => row.rowIndex === rowIndex);
      if (optimizedRow && optimizedRow.hyperlinks) {
        const hyperlink = optimizedRow.hyperlinks.find(link => link.col === cellIndex);
        if (hyperlink) return hyperlink.url;
      }
    }
    
    // Nếu không có dữ liệu tối ưu, thử lấy từ dữ liệu HTML đầy đủ
    const htmlRow = sheetDetail.htmlData?.[rowIndex]?.values || [];
    const htmlCell = htmlRow[cellIndex];
    return htmlCell?.hyperlink;
  };

  // Hàm render cell có hyperlink
  const renderHyperlinkCell = (hyperlink, cellContent, rowIndex, cellIndex) => {
    const isExpanded = expandedCells[`${rowIndex}-${cellIndex}`];
    const displayContent = isExpanded ? cellContent : (
      cellContent?.length > 50 ? cellContent.substring(0, 47) + '...' : cellContent
    );
    
    let icon = null;
    if (isYoutubeLink(hyperlink)) {
      icon = <span className="text-red-500 mr-1" title="YouTube Video">🎬</span>;
    } else if (isPdfLink(hyperlink)) {
      icon = <span className="text-blue-500 mr-1" title="PDF">📄</span>;
    } else if (isGoogleDriveLink(hyperlink)) {
      icon = <span className="text-green-500 mr-1" title="Google Drive">📝</span>;
    }
    
    return (
      <div className="flex items-start">
        {icon}
        <a
          href={hyperlink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 hover:underline"
          onClick={(e) => {
            if (cellContent?.length > 50) {
              e.preventDefault();
              toggleCellExpansion(rowIndex, cellIndex);
            }
          }}
        >
          {displayContent || hyperlink}
        </a>
      </div>
    );
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
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hành động
                  </th>
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
              <tbody className="bg-white divide-y divide-gray-100">
                {sheetDetail.data.values.slice(1).map((row, rowIndex) => {
                  return (
                    <tr key={rowIndex} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleOpenEditRowModal(rowIndex, row)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleInsertRow(rowIndex)}
                            className="text-green-600 hover:text-green-800"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        </div>
                      </td>
                      {row.map((cell, cellIndex) => {
                        // Lấy hyperlink từ dữ liệu HTML
                        const hyperlink = getHyperlink(rowIndex + 1, cellIndex, sheetDetail);
                        
                        // Nếu có hyperlink
                        if (hyperlink) {
                          return (
                            <td key={cellIndex} className="px-6 py-4 text-sm">
                              {renderHyperlinkCell(hyperlink, cell, rowIndex, cellIndex)}
                            </td>
                          );
                        }
                        
                        // Xử lý cell thông thường
                        return (
                          <td 
                            key={cellIndex} 
                            className="px-6 py-4 text-sm text-gray-900"
                            onClick={() => handleQuickEdit(rowIndex, cellIndex, cell)}
                          >
                            {cell || ''}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
} 