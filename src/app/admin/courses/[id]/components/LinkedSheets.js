import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

export default function LinkedSheets({ 
  id, 
  linkedSheets, 
  loadingSheets, 
  fetchLinkedSheets, 
  sheetData, 
  loadingSheetData, 
  fetchSheetData,
  setSheetData
}) {
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
            <a
              href={`/admin/sheets?course=${id}`}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Thêm khóa học mới
            </a>
          </div>
        ) : (
          linkedSheets.map((sheet) => (
            <button
              key={sheet._id}
              onClick={() => fetchSheetData(sheet._id)}
              className={`
                px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap
                ${sheetData[sheet._id] ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}
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
        
        <a
          href={`/admin/sheets?course=${id}`}
          className="px-4 py-3 rounded-lg text-sm font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors duration-200 flex items-center space-x-2 shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Thêm khóa học</span>
        </a>
        
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
        sheetData[sheet._id] && (
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
                <a 
                  href={`/admin/sheets/${sheet._id}`}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-500 hover:bg-indigo-400"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Chi tiết
                </a>
                <a 
                  href={sheet.sheetUrl || `https://docs.google.com/spreadsheets/d/${sheet.sheetId}`} 
                  target="_blank"
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-500 hover:bg-indigo-400"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Mở Google Sheet
                </a>
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
                  <SheetTable sheetData={sheetData[sheet._id]} />
                </div>
              )}
            </div>
          </div>
        )
      ))}
    </div>
  );
}

function SheetTable({ sheetData }) {
  const [expandedCells, setExpandedCells] = useState({});

  const toggleCellExpansion = (rowIdx, cellIdx) => {
    const key = `${rowIdx}-${cellIdx}`;
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

  // Xác định loại link
  const getLinkType = (url) => {
    if (!url) return null;
    if (isYoutubeLink(url)) return 'youtube';
    if (isPdfLink(url)) return 'pdf';
    if (isGoogleDriveLink(url)) return 'drive';
    return 'external';
  };

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 shadow-md">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gradient-to-r from-indigo-600 to-purple-600">
              {sheetData.data.values[0] && sheetData.data.values[0].map((header, idx) => {
                // Bỏ qua cột STT (thường là cột đầu tiên)
                if (idx === 0 && (header === 'STT' || header === '#' || header === 'No.' || 
                              header === 'No' || header === 'Số TT' || header === 'Số thứ tự')) {
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
            {sheetData.data.values.slice(1).map((row, rowIdx) => (
              <tr 
                key={rowIdx} 
                className={`border-b ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-indigo-50'} hover:bg-indigo-100 transition-colors duration-150`}
              >
                {row.map((cell, cellIdx) => {
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
                  
                  // Bỏ qua cột STT (thường là cột đầu tiên)
                  if (cellIdx === 0 && sheetData.data.values[0] && 
                    (sheetData.data.values[0][0] === 'STT' || 
                    sheetData.data.values[0][0] === '#' || 
                    sheetData.data.values[0][0] === 'No.' || 
                    sheetData.data.values[0][0] === 'No' || 
                    sheetData.data.values[0][0] === 'Số TT' ||
                    sheetData.data.values[0][0] === 'Số thứ tự')) {
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
                  const urlRegex = /https?:\/\/[^\s]+/;
                  const cellText = cell || '';
                  const url = typeof cellText === 'string' && urlRegex.test(cellText) 
                    ? cellText.match(urlRegex)[0] 
                    : null;
                  const hasLink = !!url;
                  const linkType = getLinkType(url);
                  
                  // Kiểm tra xem nội dung có dài không
                  const content = cell || '';
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
                              <a href={url} target="_blank" className="hover:underline">
                                {content || url}
                              </a>
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 