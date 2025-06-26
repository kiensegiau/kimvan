'use client';

import { useRouter } from 'next/navigation';
import { use } from 'react';

// Import hooks
import { useCourseData } from './hooks/useCourseData';
import { useApiSheetData } from './hooks/useApiSheetData';
import useUserData from '@/hooks/useUserData';

// Import components
import ApiSheetData from './components/ApiSheetData';
import ErrorState from '../components/ErrorState';
import PermissionDenied from '../components/PermissionDenied';
import LoadingState from '../components/LoadingState';
import PermissionDebug from './components/PermissionDebug';

export default function CourseDetailPage({ params }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const { userData } = useUserData();

  // Sử dụng các custom hooks
  const { 
    course,
    loading,
    error, 
    isLoaded,
    permissionChecked,
    cacheStatus: courseCacheStatus,
    clearCache: clearCourseCache,
    refreshCourseData,
  } = useCourseData(id);
  
  // Sử dụng API Sheet
  const {
    apiSheetData,
    loadingApiSheet,
    apiSheetError,
    activeApiSheet,
    cacheStatus: sheetCacheStatus,
    setActiveApiSheet,
    fetchApiSheetData,
    fetchSheetDetail,
    clearCache: clearSheetCache,
  } = useApiSheetData(id);

  // Hàm làm mới tất cả cache
  const handleRefreshAll = () => {
    clearCourseCache();
    clearSheetCache();
    refreshCourseData();
    setTimeout(() => {
      fetchApiSheetData();
    }, 500); // Delay nhỏ để tránh các yêu cầu đồng thời
  };

  // Kiểm tra quyền đặc biệt và bỏ qua kiểm tra quyền thông thường nếu có quyền xem tất cả
  // Đã loại bỏ kiểm tra admin theo yêu cầu
  const hasViewAllPermission = userData?.canViewAllCourses === true;
  const shouldBypassPermissionCheck = hasViewAllPermission;

  // Kiểm tra quyền truy cập với xử lý đặc biệt cho admin và canViewAllCourses
  const hasAccessDenied = !shouldBypassPermissionCheck && permissionChecked && error && error.includes("không có quyền truy cập");

  if (loading) {
    return <LoadingState message="Đang tải thông tin khóa học..." />;
  }

  if (hasAccessDenied) {
    return (
      <>
        <PermissionDebug courseId={id} />
        <PermissionDenied message={error} redirectUrl="/courses" />
      </>
    );
  }

  // Hiển thị lỗi không liên quan đến quyền truy cập
  if (error && !error.includes("không có quyền truy cập")) {
    return <ErrorState error={error} redirectUrl="/courses" />;
  }

  // Hiển thị trạng thái cache
  const getCacheStatusBadge = (status) => {
    if (status === 'hit' || status?.startsWith('hit')) {
      return <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">Đã tải từ cache</span>;
    } else if (status === 'saved' || status?.startsWith('saved')) {
      return <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">Đã lưu vào cache</span>;
    } else if (status === 'cleared' || status?.startsWith('cleared')) {
      return <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded-full">Đã xóa cache</span>;
    } else if (status === 'expired' || status?.startsWith('expired')) {
      return <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-0.5 rounded-full">Cache hết hạn</span>;
    }
    return null;
  };

  return (
    <div className={`min-h-screen bg-gray-100 p-4 sm:p-6 transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
      <div className="mx-auto">
        {/* Debug component */}
        <PermissionDebug courseId={id} />
        
        {/* Header và nút điều hướng */}
        <div className="bg-white shadow-sm rounded-lg p-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{course?.name || 'Chi tiết khóa học'}</h1>
            <div className="flex items-center gap-2 mt-1">
              {getCacheStatusBadge(courseCacheStatus)}
              {getCacheStatusBadge(sheetCacheStatus)}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRefreshAll}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                onClick={handleRefreshAll}
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