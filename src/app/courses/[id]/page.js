'use client';

import { useRouter } from 'next/navigation';
import { use } from 'react';

// Import hooks
import { useCourseData } from './hooks/useCourseData';
import { useApiSheetData } from './hooks/useApiSheetData';

// Import components
import ApiSheetData from './components/ApiSheetData';

export default function CourseDetailPage({ params }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  // Sử dụng các custom hooks
  const { 
    course,
    loading,
    error, 
    isLoaded,
  } = useCourseData(id);
  
  // Sử dụng API Sheet
  const {
    apiSheetData,
    loadingApiSheet,
    apiSheetError,
    activeApiSheet,
    setActiveApiSheet,
    fetchApiSheetData,
    fetchSheetDetail
  } = useApiSheetData(id);

  // Hàm refresh để tải lại dữ liệu
  const handleRefreshData = () => {
    fetchApiSheetData();
  };

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
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Đã xảy ra lỗi</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => router.push('/courses')}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    <svg className="-ml-0.5 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
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

  return (
    <div className={`min-h-screen bg-gray-100 p-4 sm:p-6 transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
      <div className="mx-auto">
        {/* Header và nút điều hướng */}
        <div className="bg-white shadow-sm rounded-lg p-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">{course?.name || 'Chi tiết khóa học'}</h1>
          <div className="flex gap-2">
            <button
              onClick={handleRefreshData}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Làm mới dữ liệu
            </button>
            <button
              onClick={() => router.back()}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <svg className="-ml-0.5 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              Quay lại
            </button>
          </div>
        </div>

        {/* Thông tin khóa học */}
        <div className="bg-white shadow rounded-lg mb-6 overflow-hidden">
          <div className="px-4 py-5 sm:px-6 bg-gradient-to-r from-indigo-600 to-purple-600">
            <h3 className="text-lg leading-6 font-medium text-white">
              Thông tin khóa học
            </h3>
          </div>
          <div className="border-t border-gray-200">
            <dl>
              <div className="bg-gray-50 px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">
                  Tên khóa học
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {course?.name || 'N/A'}
                </dd>
              </div>
              <div className="bg-white px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">
                  Mô tả
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {course?.description || 'Không có mô tả'}
                </dd>
              </div>
              {course?.originalId && (
                <div className="bg-gray-50 px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    ID gốc
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {course.originalId}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Dữ liệu sheets - Chỉ hiển thị 1 trong 3 trạng thái: loading, error hoặc data */}
        {loadingApiSheet ? (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <div className="flex justify-center items-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600 mb-2 mr-3"></div>
              <p className="text-gray-600">Đang tải dữ liệu sheet...</p>
            </div>
          </div>
        ) : apiSheetError ? (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <div className="bg-red-50 p-4 rounded-md">
              <p className="text-red-700 font-medium mb-2">Lỗi khi tải dữ liệu</p>
              <p className="text-red-600 mb-4">{apiSheetError}</p>
              <button 
                onClick={handleRefreshData}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
              >
                <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Thử lại
              </button>
            </div>
          </div>
        ) : (
          <ApiSheetData
            apiSheetData={apiSheetData}
            loadingApiSheet={loadingApiSheet}
            apiSheetError={apiSheetError}
            activeApiSheet={activeApiSheet}
            setActiveApiSheet={setActiveApiSheet}
            fetchApiSheetData={fetchApiSheetData}
            fetchSheetDetail={fetchSheetDetail}
          />
        )}
      </div>
    </div>
  );
} 