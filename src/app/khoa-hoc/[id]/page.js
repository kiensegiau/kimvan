'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import React from 'react';

export default function CourseDetailPage() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const fetchCourseData = async () => {
      try {
        setLoading(true);
        const decodedId = decodeURIComponent(id);
        console.log('Đang tìm kiếm khóa học với ID đã giải mã:', decodedId);
        
        // Sử dụng API của chúng ta làm trung gian kết nối đến kimvan.id.vn
        const apiUrl = `/api/spreadsheets/${decodedId}`;
        console.log('Đang kết nối qua API của chúng ta:', apiUrl);
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        setCourse(data);
        
        // Log toàn bộ dữ liệu để kiểm tra
        console.log('Dữ liệu khóa học đầy đủ:', data);
        
        // Hiệu ứng fade-in
        setTimeout(() => {
          setIsLoaded(true);
        }, 100);
        
      } catch (err) {
        console.error('Lỗi khi tải dữ liệu khóa học:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchCourseData();
    }
  }, [id]);

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

  // Lấy tiêu đề của sheet
  const getSheetTitle = (index) => {
    if (!course || !course.sheets || !course.sheets[index]) return `Khóa ${index + 1}`;
    const sheet = course.sheets[index];
    return sheet?.properties?.title || `Khóa ${index + 1}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-14 w-14 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent shadow-lg"></div>
          <p className="mt-5 text-lg font-medium text-gray-700">Đang tải thông tin khóa học...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-50">
        <div className="text-center max-w-md p-8 bg-white rounded-xl shadow-xl">
          <div className="text-red-600 text-5xl mb-5">⚠️</div>
          <h1 className="text-2xl font-bold text-red-600 mb-4">Lỗi khi tải dữ liệu</h1>
          <p className="mb-6 text-gray-600">{error}</p>
          <Link href="/khoa-hoc" className="inline-block px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-md">
            ← Quay lại danh sách khóa học
          </Link>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-50">
        <div className="text-center max-w-md p-8 bg-white rounded-xl shadow-xl">
          <div className="text-yellow-600 text-5xl mb-5">🔍</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Không tìm thấy khóa học</h1>
          <p className="mb-6 text-gray-600">Khóa học bạn đang tìm kiếm không tồn tại hoặc đã bị xóa.</p>
          <Link href="/khoa-hoc" className="inline-block px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-md">
            ← Quay lại danh sách khóa học
          </Link>
        </div>
      </div>
    );
  }

  // Lấy thông tin sheet và dữ liệu từ khóa học
  const sheets = course.sheets || [];
  const hasMultipleSheets = sheets.length > 1;
  const currentSheet = sheets[activeSheet] || {};
  const rows = currentSheet?.data?.[0]?.rowData || [];
  const hasData = rows.length > 0;

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
            <Link href="/khoa-hoc" className="bg-blue-50 text-blue-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors">
              ← Quay lại
            </Link>
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
                            : cell.hyperlink || cell.userEnteredFormat?.textFormat?.link?.uri
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
                ID Khóa học: {id}
              </div>
              
              <div className="flex items-center">
                <span className="text-xs text-gray-700">Trang 1 / 1</span>
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
