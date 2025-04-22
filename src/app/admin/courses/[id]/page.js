'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, PencilIcon, TrashIcon, CloudArrowDownIcon, ExclamationCircleIcon, XMarkIcon, ArrowPathIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { use } from 'react';

export default function CourseDetailPage({ params }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showOriginalDataModal, setShowOriginalDataModal] = useState(false);
  const [originalData, setOriginalData] = useState(null);
  const [loadingOriginalData, setLoadingOriginalData] = useState(false);
  const [downloadingData, setDownloadingData] = useState(false);
  const [downloadError, setDownloadError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [formData, setFormData] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeSheet, setActiveSheet] = useState(0);
  
  // Hàm lấy tiêu đề của sheet
  const getSheetTitle = (index, sheets) => {
    if (!sheets || !sheets[index]) return `Khóa ${index + 1}`;
    const sheet = sheets[index];
    return sheet?.properties?.title || `Khóa ${index + 1}`;
  };

  // Lấy thông tin chi tiết của khóa học
  const fetchCourseDetail = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/courses/${id}?type=_id`);
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Dữ liệu khóa học đầy đủ:', data);
      setCourse(data);
      setFormData(data);
      
      // Hiệu ứng fade-in
      setTimeout(() => {
        setIsLoaded(true);
      }, 100);
      
      setLoading(false);
    } catch (error) {
      console.error("Lỗi khi lấy thông tin khóa học:", error);
      setError(`Không thể lấy thông tin khóa học: ${error.message}`);
      setLoading(false);
    }
  };

  // Hàm tải dữ liệu gốc
  const handleViewOriginalData = async () => {
    if (!course || !course.originalData) return;
    
    setShowOriginalDataModal(true);
    setLoadingOriginalData(true);
    
    try {
      // Lấy dữ liệu gốc từ dữ liệu khóa học
      setOriginalData(course.originalData);
    } catch (error) {
      console.error('Lỗi khi lấy dữ liệu gốc:', error);
      setOriginalData(null);
    } finally {
      setLoadingOriginalData(false);
    }
  };

  // Hàm tải xuống dữ liệu gốc
  const handleDownloadOriginalData = async () => {
    if (!course || !course.originalData) return;
    
    setDownloadingData(true);
    setDownloadError(null);
    
    try {
      // Tạo file JSON để tải xuống từ dữ liệu gốc có sẵn
      const blob = new Blob([JSON.stringify(course.originalData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Tạo thẻ a và kích hoạt sự kiện click để tải xuống
      const a = document.createElement('a');
      a.href = url;
      a.download = `kimvan-course-${course.kimvanId || course._id}.json`;
      document.body.appendChild(a);
      a.click();
      
      // Dọn dẹp
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error('Lỗi khi tải xuống dữ liệu gốc:', error);
      setDownloadError(error.message);
    } finally {
      setDownloadingData(false);
    }
  };

  // Hàm xóa khóa học
  const handleDelete = async () => {
    if (!course) return;
    
    if (window.confirm('Bạn có chắc chắn muốn xóa khóa học này?')) {
      try {
        const response = await fetch(`/api/courses/${course._id}`, {
          method: 'DELETE',
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Không thể xóa khóa học');
        }
        
        alert('Xóa khóa học thành công!');
        router.push('/admin/courses');
      } catch (err) {
        console.error('Lỗi khi xóa khóa học:', err);
        alert(`Lỗi khi xóa khóa học: ${err.message}`);
      }
    }
  };

  // Hàm đồng bộ khóa học
  const handleSync = async () => {
    if (!course || !course.kimvanId) return;
    
    if (window.confirm(`Bạn có muốn đồng bộ khóa học "${course.name}" không?`)) {
      try {
        setSyncing(true);
        setSyncResult({
          success: true,
          message: `Đang đồng bộ khóa học "${course.name}"...`,
          inProgress: true
        });
        
        // Sử dụng phương thức PATCH để đồng bộ khóa học
        const response = await fetch(`/api/courses/${course.kimvanId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        const syncData = await response.json();
        
        if (!response.ok) {
          throw new Error(syncData.message || 'Không thể đồng bộ khóa học');
        }
        
        // Hiển thị kết quả đồng bộ
        setSyncResult({
          success: true,
          message: syncData.message || 'Đồng bộ khóa học thành công',
          inProgress: false
        });
        
        // Tải lại thông tin khóa học
        await fetchCourseDetail();
      } catch (err) {
        console.error('Lỗi khi đồng bộ khóa học:', err);
        setSyncResult({
          success: false,
          message: `Lỗi đồng bộ: ${err.message}`,
          inProgress: false
        });
      } finally {
        setSyncing(false);
      }
    }
  };

  // Tải thông tin khóa học khi component được tạo
  useEffect(() => {
    fetchCourseDetail();
  }, [id]);

  // Set sheet đầu tiên nếu có dữ liệu sheets
  useEffect(() => {
    if (course?.originalData?.sheets && course.originalData.sheets.length > 0) {
      setActiveSheet(0);
    }
  }, [course]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-8 relative">
          <div className="text-center py-10">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600 mb-2"></div>
            <p className="text-gray-500">Đang tải thông tin khóa học...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-8 relative">
          <div className="bg-red-50 p-4 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <ExclamationCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Đã xảy ra lỗi</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => router.push('/admin/courses')}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    <ArrowLeftIcon className="-ml-0.5 mr-2 h-4 w-4" />
                    Quay lại danh sách
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-8 relative">
          <div className="text-center py-10">
            <div className="inline-block text-red-500 text-5xl mb-5">⚠️</div>
            <h2 className="text-xl font-medium text-gray-900 mb-2">Không tìm thấy khóa học</h2>
            <p className="text-gray-500 mb-6">Khóa học bạn đang tìm kiếm không tồn tại hoặc đã bị xóa.</p>
            <button
              onClick={() => router.push('/admin/courses')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <ArrowLeftIcon className="-ml-0.5 mr-2 h-4 w-4" />
              Quay lại danh sách khóa học
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-8 relative">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => router.push('/admin/courses')}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200"
          >
            <ArrowLeftIcon className="-ml-0.5 mr-2 h-4 w-4" />
            Quay lại danh sách
          </button>
          
          <div className="flex space-x-2">
            {course.kimvanId && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {syncing ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
                    Đang đồng bộ...
                  </>
                ) : (
                  <>
                    <ArrowPathIcon className="h-4 w-4 mr-2" />
                    Đồng bộ
                  </>
                )}
              </button>
            )}
            
            <button
              onClick={() => router.push(`/admin/courses/edit/${course._id}`)}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <PencilIcon className="h-4 w-4 mr-2" />
              Chỉnh sửa
            </button>
            
            <button
              onClick={handleDelete}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Xóa
            </button>
          </div>
        </div>
        
        {/* Thông báo kết quả đồng bộ */}
        {syncResult && (
          <div className={`bg-${syncResult.success ? 'green' : 'red'}-50 p-4 rounded-md mb-6`}>
            <div className="flex">
              <div className="flex-shrink-0">
                {syncResult.success ? (
                  <>
                    {syncResult.inProgress ? (
                      <ArrowPathIcon className="h-5 w-5 text-green-400 animate-spin" />
                    ) : (
                      <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </>
                ) : (
                  <ExclamationCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
                )}
              </div>
              <div className="ml-3">
                <p className={`text-sm font-medium text-${syncResult.success ? 'green' : 'red'}-800`}>
                  {syncResult.message}
                </p>
              </div>
              <div className="ml-auto pl-3">
                <div className="-mx-1.5 -my-1.5">
                  <button
                    onClick={() => setSyncResult(null)}
                    className={`inline-flex rounded-md p-1.5 text-${syncResult.success ? 'green' : 'red'}-500 hover:bg-${syncResult.success ? 'green' : 'red'}-100`}
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Thông tin khóa học */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900">Thông tin khóa học</h3>
          </div>
          <div className="p-6">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Tên khóa học</dt>
                <dd className="mt-1 text-lg font-medium text-gray-900">{course.name || 'Chưa có tên'}</dd>
              </div>
              
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Mô tả</dt>
                <dd className="mt-1 text-sm text-gray-900">{course.description || 'Chưa có mô tả'}</dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-gray-500">Giá (VND)</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {course.price ? course.price.toLocaleString('vi-VN') : 'Chưa có giá'}
                </dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-gray-500">Trạng thái</dt>
                <dd className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    course.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {course.status === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                  </span>
                </dd>
              </div>
              
              {course.kimvanId && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">ID Kimvan</dt>
                  <dd className="mt-1 text-sm text-gray-900">{course.kimvanId}</dd>
                </div>
              )}
              
              {course.updatedAt && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Cập nhật lần cuối</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(course.updatedAt).toLocaleString('vi-VN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
        
        {/* Dữ liệu gốc khóa học */}
        {course.originalData && (
          <div className="mt-6 bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Dữ liệu gốc</h3>
              <div className="flex space-x-2">
                <button
                  onClick={handleViewOriginalData}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Xem JSON
                </button>
                
                <button
                  onClick={handleDownloadOriginalData}
                  disabled={downloadingData}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                >
                  {downloadingData ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 animate-spin mr-1" />
                      Đang tải...
                    </>
                  ) : (
                    <>
                      <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                      Tải xuống
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Chọn khóa học khi có nhiều sheet */}
            {course.originalData?.sheets && course.originalData.sheets.length > 1 && (
              <div className="border-b border-gray-200 px-6 py-4 bg-gray-50">
                <h3 className="text-base font-medium text-gray-800 mb-3">Chọn khóa học:</h3>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {course.originalData.sheets.map((sheet, index) => (
                    <button
                      key={index}
                      onClick={() => setActiveSheet(index)}
                      className={`
                        px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap
                        ${activeSheet === index 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }
                      `}
                    >
                      <div className="flex items-center">
                        <span>{getSheetTitle(index, course.originalData.sheets)}</span>
                        {sheet?.data?.[0]?.rowData && (
                          <span className={`text-xs ml-2 px-2 py-0.5 rounded-full ${
                            activeSheet === index ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {(sheet.data[0].rowData.length - 1) || 0}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Hiển thị dữ liệu dưới dạng bảng */}
            {course.originalData?.sheets && course.originalData.sheets.length > 0 && (
              <div className="overflow-x-auto">
                {/* Hiển thị sheet được chọn */}
                <div key={activeSheet} className="mb-6">
                  <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                    <div className="font-medium text-gray-800 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      {getSheetTitle(activeSheet, course.originalData.sheets)}
                    </div>
                    {course.originalData.sheets[activeSheet]?.data?.[0]?.rowData && (
                      <div className="text-sm text-gray-600">
                        Tổng số: <span className="font-medium text-blue-600">
                          {(course.originalData.sheets[activeSheet].data[0].rowData.length - 1) || 0} buổi
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {course.originalData.sheets[activeSheet]?.data?.[0]?.rowData && course.originalData.sheets[activeSheet].data[0].rowData.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                          <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
                            {course.originalData.sheets[activeSheet].data[0].rowData[0]?.values?.map((cell, index) => (
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
                          {course.originalData.sheets[activeSheet].data[0].rowData.slice(1).map((row, rowIndex) => (
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
                                    ? (cell.formattedValue || '')
                                    : cell.hyperlink || cell.userEnteredFormat?.textFormat?.link?.uri
                                      ? (
                                          <a 
                                            href={cell.userEnteredFormat?.textFormat?.link?.uri} 
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
                                        ) 
                                      : (cell.formattedValue || '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="bg-white p-12 text-center">
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
                </div>
              </div>
            )}
            
            {downloadError && (
              <div className="p-6 text-sm text-red-600">
                <p>Lỗi khi tải xuống: {downloadError}</p>
              </div>
            )}
          </div>
        )}
        
        {/* Modal xem dữ liệu gốc */}
        {showOriginalDataModal && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Dữ liệu gốc</h3>
                <button
                  onClick={() => setShowOriginalDataModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-auto max-h-[calc(90vh-8rem)]">
                {loadingOriginalData ? (
                  <div className="text-center py-4">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600 mb-2"></div>
                    <p className="text-gray-500">Đang tải dữ liệu gốc...</p>
                  </div>
                ) : originalData ? (
                  <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-xs font-mono">
                    {JSON.stringify(originalData, null, 2)}
                  </pre>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-500">Không có dữ liệu gốc hoặc đã xảy ra lỗi khi tải dữ liệu.</p>
                  </div>
                )}
              </div>
              
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => setShowOriginalDataModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
