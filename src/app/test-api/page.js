'use client';

import { useState, useEffect } from 'react';
import { sampleData } from './data';

export default function TablePage() {
  // State và dữ liệu
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeSheet, setActiveSheet] = useState(0);
  
  // Dữ liệu bảng
  const tableData = sampleData;
  const sheets = tableData?.sheets || [];
  const hasMultipleSheets = sheets.length > 1;
  
  // Lấy dữ liệu của sheet đang active
  const currentSheet = sheets[activeSheet] || {};
  const rows = currentSheet?.data?.[0]?.rowData || [];
  const hasData = rows.length > 0;
  
  // Lấy tiêu đề của sheet
  const getSheetTitle = (index) => {
    const sheet = sheets[index];
    return sheet?.properties?.title || `Khóa ${index + 1}`;
  };
  
  // Hiệu ứng loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Render STT cell
  const renderSttCell = (value) => {
    return value;
  };

  // Render link cell
  const renderLinkCell = (cell) => {
    if (!cell.userEnteredFormat?.textFormat?.link?.uri) {
      return cell.formattedValue || '';
    }
    
    return (
      <a 
        href={cell.userEnteredFormat.textFormat.link.uri} 
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center text-blue-600 font-medium hover:text-blue-800 transition-colors duration-150 group"
      >
        <span>{cell.formattedValue || ''}</span>
        <span className="ml-1.5 p-1 rounded-md group-hover:bg-blue-100 transition-colors duration-150">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </span>
      </a>
    );
  };

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
            </svg>
            <h1 className="text-xl font-semibold text-gray-900">
              KimVan <span className="text-blue-600">Education</span>
            </h1>
          </div>
          
          <div className="flex space-x-3 items-center">
            <button 
              type="button"
              aria-label="Thông báo"
              className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
              </svg>
              <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500"></span>
            </button>
            <button className="bg-blue-50 text-blue-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors">
              Đăng nhập
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-opacity duration-700 ease-in-out ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
        {/* Chọn khóa học khi có nhiều sheet */}
        {hasMultipleSheets && (
          <div className="mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="border-b border-gray-200 px-6 py-4 bg-gray-50">
                <h3 className="text-base font-medium text-gray-800">Danh sách khóa học</h3>
              </div>
              
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sheets.map((sheet, index) => (
                    <div 
                      key={index}
                      onClick={() => setActiveSheet(index)}
                      className={`
                        cursor-pointer rounded-lg border transition-all duration-200 overflow-hidden 
                        ${activeSheet === index 
                          ? 'border-blue-500 ring-2 ring-blue-200' 
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }
                      `}
                    >
                      <div className={`
                        p-4 flex items-center
                        ${activeSheet === index ? 'bg-blue-50' : ''}
                      `}>
                        <div className={`
                          flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center mr-3
                          ${activeSheet === index ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}
                        `}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className={`font-medium ${activeSheet === index ? 'text-blue-700' : 'text-gray-900'}`}>
                            {getSheetTitle(index)}
                          </h4>
                          {sheet?.data?.[0]?.rowData && (
                            <p className="text-xs text-gray-500 mt-1">
                              {(sheet.data[0].rowData.length - 1) || 0} buổi học
                            </p>
                          )}
                        </div>
                        {activeSheet === index && (
                          <div className="ml-auto">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bảng dữ liệu */}
        {hasData ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Thanh tiêu đề */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="font-medium text-gray-800 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                {getSheetTitle(activeSheet)}
              </div>
              <div className="text-sm text-gray-600">
                Tổng số: <span className="font-medium text-blue-600">{rows.length - 1} buổi</span>
              </div>
            </div>
            
            {/* Bảng dữ liệu */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
                    {rows[0]?.values?.map((cell, index) => (
                      <th 
                        key={index} 
                        className={`px-6 py-3.5 text-left text-xs font-medium text-white uppercase tracking-wider ${
                          index === 0 ? 'text-center w-16' : ''
                        }`}
                      >
                        <div className="flex items-center">
                          {cell.formattedValue || ''}
                          {index > 0 && 
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                            </svg>
                          }
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rows.slice(1).map((row, rowIndex) => (
                    <tr 
                      key={rowIndex} 
                      className="group hover:bg-blue-50 transition-colors duration-150"
                    >
                      {row.values && row.values.map((cell, cellIndex) => (
                        <td 
                          key={cellIndex} 
                          className={`px-6 py-4 text-sm ${
                            cellIndex === 0 
                              ? 'whitespace-nowrap font-medium text-gray-900 text-center' 
                              : 'text-gray-700'
                          }`}
                        >
                          {cellIndex === 0 
                            ? renderSttCell(cell.formattedValue || '') 
                            : cell.hyperlink 
                              ? renderLinkCell(cell) 
                              : (cell.formattedValue || '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer bảng */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
              <div className="text-xs text-gray-500">
                Dữ liệu được cập nhật tự động từ hệ thống
              </div>
              
              <div className="flex items-center">
                <span className="text-xs text-gray-700">Trang 1 / 1</span>
                <div className="flex ml-2">
                  <button disabled className="px-2 py-1 border border-gray-300 rounded-l-md bg-gray-100 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button disabled className="px-2 py-1 border border-gray-300 rounded-r-md border-l-0 bg-gray-100 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white p-12 rounded-lg shadow-sm border border-gray-200 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 text-blue-600 mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">Không có dữ liệu</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Hiện không có thông tin buổi học nào được tìm thấy trong hệ thống.
            </p>
          </div>
        )}
      </main>

     
    </div>
  );
}
