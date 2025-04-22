'use client';

import { useState, useEffect } from 'react';
import { sampleData } from './data';

export default function TablePage() {
  // State và dữ liệu
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentTab, setCurrentTab] = useState('danh-sach');
  
  // Dữ liệu bảng
  const tableData = sampleData;
  const rows = tableData?.sheets?.[0]?.data?.[0]?.rowData || [];
  const hasData = rows.length > 0;
  
  // Hiệu ứng loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Format ngày hiện tại
  const formatDate = () => {
    try {
      return new Date().toLocaleDateString('vi-VN', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch (error) {
      // Fallback nếu locale không được hỗ trợ
      return new Date().toLocaleDateString();
    }
  };

  // Render STT cell
  const renderSttCell = (value) => {
    return (
      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-800 group-hover:bg-blue-200 transition-colors duration-150">
        {value}
      </span>
    );
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
        {/* Tiêu đề và tabs */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Danh sách buổi học</h2>
              <div className="flex items-center text-sm text-gray-500 mt-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Cập nhật: {formatDate()}</span>
              </div>
            </div>
            
            <div className="flex mt-4 sm:mt-0">
              <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Xuất dữ liệu
              </button>
            </div>
          </div>
          
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setCurrentTab('danh-sach')}
                className={`pb-3 border-b-2 font-medium text-sm ${
                  currentTab === 'danh-sach'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Danh sách buổi học
              </button>
              <button
                onClick={() => setCurrentTab('thong-ke')}
                className={`pb-3 border-b-2 font-medium text-sm ${
                  currentTab === 'thong-ke'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Thống kê
              </button>
            </nav>
          </div>
        </div>

        {/* Nội dung */}
        {currentTab === 'danh-sach' && (
          <>
            {hasData ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {/* Thanh tiêu đề */}
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                  <div className="font-medium text-gray-800 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Thông tin khóa học
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
                        {rows[0].values.map((cell, index) => (
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
          </>
        )}
        
        {currentTab === 'thong-ke' && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-blue-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-1">Tính năng đang phát triển</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Tính năng thống kê đang được phát triển và sẽ sớm được cập nhật.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="md:flex md:justify-between md:items-center">
            <div className="md:flex md:space-x-12">
              <div>
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900">KimVan Education</h3>
                </div>
                <p className="text-sm text-gray-500 mt-2">Đem lại kiến thức cho mọi người</p>
              </div>
              
              <div className="mt-8 md:mt-0">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Hỗ trợ</h3>
                <ul className="mt-4 space-y-2">
                  <li>
                    <a href="#" className="text-sm text-gray-600 hover:text-gray-900">
                      Liên hệ
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-sm text-gray-600 hover:text-gray-900">
                      FAQ
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="mt-8 md:mt-0 text-sm text-gray-500">
              © {new Date().getFullYear()} KimVan Education. Đã đăng ký Bản quyền.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
