'use client';

import { useRouter } from 'next/navigation';
import { use } from 'react';
import { useEffect, useState, useRef } from 'react';

// Import hooks
import { useCourseData } from './hooks/useCourseData';
import { useApiSheetData } from './hooks/useApiSheetData';
import useUserData from '@/hooks/useUserData';
import useEnrolledCourses from '@/hooks/useEnrolledCourses';

// Import components
import ApiSheetData from './components/ApiSheetData';
import ErrorState from '../components/ErrorState';
import PermissionDenied from '../components/PermissionDenied';
import LoadingState from '../components/LoadingState';

export default function CourseDetailPage({ params }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  
  // States để quản lý quyền và trạng thái tải
  const [accessState, setAccessState] = useState({
    isChecking: true,      // Đang kiểm tra quyền
    hasAccess: false,      // Kết quả cuối cùng
    checkComplete: false   // Đã hoàn tất kiểm tra
  });
  const lockRef = useRef(false); // Ngăn chặn kiểm tra trùng lặp
  const [refreshing, setRefreshing] = useState(false);
  
  // Lấy thông tin người dùng - Bước đầu tiên và quan trọng nhất
  const { userData, loading: userLoading, refreshUserData } = useUserData();

  // Đảm bảo useEnrolledCourses nhận userData để tránh gọi API lặp lại
  const { isEnrolledInCourse, refreshEnrollments } = useEnrolledCourses(userData);

  // Kiểm tra quyền đặc biệt ngay khi có userData
  const hasViewAllPermission = Boolean(userData?.canViewAllCourses === true || 
    (userData?.permissions && Array.isArray(userData?.permissions) && userData?.permissions.includes('view_all_courses')));
  
  // Xử lý lỗi localStorage đầy
  useEffect(() => {
    // Xóa các cache không quan trọng
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('cache-') && !key.includes('user')) {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error('Không thể xóa cache:', error);
    }
  }, []);

  // Chỉ tải thông tin khóa học khi userData đã sẵn sàng
  const { 
    course,
    loading: courseLoading,
    error, 
    isLoaded,
    permissionChecked,
    cacheStatus: courseCacheStatus,
    clearCache: clearCourseCache,
    refreshCourseData,
  } = useCourseData(id, userData, userLoading);

  // Một logic kiểm tra quyền tập trung duy nhất
  useEffect(() => {
    // Nếu đang refresh hoặc chưa có đủ thông tin, không làm gì cả
    if (refreshing || userLoading || !permissionChecked || lockRef.current) {
      return;
    }
    
    // Khóa quá trình kiểm tra để tránh kiểm tra trùng lặp
    lockRef.current = true;
    
    // QUAN TRỌNG: Xác định quyền truy cập nghiêm ngặt
    // User phải có một trong hai điều kiện:
    // 1. Có quyền xem tất cả (hasViewAllPermission)
    // 2. Đã đăng ký khóa học này (isEnrolledInCourse)
    const hasError = error && (error.includes("không có quyền") || error.includes("không được phép"));
    const isEnrolled = isEnrolledInCourse && isEnrolledInCourse(id);
    
    // Một admin KHÔNG có quyền xem tất cả nếu canViewAllCourses = false
    let finalHasAccess = false;
    
    if (hasViewAllPermission) {
      // Trường hợp 1: Người dùng có quyền xem tất cả
      console.log('✅ Có quyền vì hasViewAllPermission = true');
      finalHasAccess = true;
    } else if (isEnrolled) {
      // Trường hợp 2: Người dùng đã đăng ký khóa học này
      console.log('✅ Có quyền vì đã đăng ký khóa học');
      finalHasAccess = true;
    } else if (hasError) {
      // Trường hợp 3: Có lỗi quyền truy cập
      console.log('❌ Không có quyền: ' + error);
      finalHasAccess = false;
    } else {
      // Trường hợp 4: Nếu không chắc chắn, mặc định là không có quyền
      console.log('❌ Không có quyền (mặc định)');
      finalHasAccess = false;
    }
    
    console.log('🔒 KIỂM TRA QUYỀN CHÍNH THỨC:');
    console.log('  - userData:', userData ? 'Đã tải' : 'Chưa tải');
    console.log('  - Role:', userData?.role || 'N/A');
    console.log('  - canViewAllCourses:', userData?.canViewAllCourses);
    console.log('  - hasViewAllPermission:', hasViewAllPermission);
    console.log('  - isEnrolled:', isEnrolled);
    console.log('  - permissionChecked:', permissionChecked);
    console.log('  - error:', error);
    console.log('  - Kết quả cuối cùng:', finalHasAccess ? 'CÓ QUYỀN ✅' : 'KHÔNG CÓ QUYỀN ❌');
    
    // Cập nhật state một lần duy nhất
    setAccessState({
      isChecking: false,
      hasAccess: finalHasAccess,
      checkComplete: true
    });
    
  }, [userData, userLoading, permissionChecked, error, hasViewAllPermission, refreshing, isEnrolledInCourse, id]);

  // Chỉ khởi tạo useApiSheetData khi có quyền truy cập
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
  } = useApiSheetData(accessState.hasAccess ? id : null);

  // Chỉ tải dữ liệu sheet khi đã xác nhận có quyền và khóa học đã tải xong
  useEffect(() => {
    if (accessState.hasAccess && course && !loadingApiSheet && !accessState.isChecking) {
      console.log('📊 Đã xác nhận quyền truy cập, bắt đầu tải dữ liệu sheet');
      try {
        fetchApiSheetData();
      } catch (error) {
        console.error('Lỗi khi tải dữ liệu sheet:', error);
      }
    }
  }, [accessState, course, loadingApiSheet]);

  // Hàm làm mới tất cả cache
  const handleRefreshAll = () => {
    if (!accessState.hasAccess) {
      console.log('Không có quyền truy cập, bỏ qua làm mới dữ liệu');
      return;
    }
    
    try {
      clearCourseCache();
      clearSheetCache();
      refreshCourseData();
      setTimeout(() => {
        fetchApiSheetData();
      }, 500);
    } catch (error) {
      console.error('Lỗi khi làm mới cache:', error);
    }
  };
  
  // Hàm làm mới dữ liệu người dùng và kiểm tra quyền lại từ đầu
  const handleRefreshPermissions = async () => {
    setRefreshing(true);
    try {
      // Reset trạng thái kiểm tra quyền
      setAccessState({
        isChecking: true,
        hasAccess: false,
        checkComplete: false
      });
      
      // Mở khóa để cho phép kiểm tra lại
      lockRef.current = false;
      
      // Làm mới thông tin người dùng
      await refreshUserData();
      
      // Làm mới danh sách đăng ký
      if (refreshEnrollments) {
        await refreshEnrollments();
      }
      
      // Làm mới thông tin khóa học
      await refreshCourseData();
    } catch (error) {
      console.error('Lỗi khi làm mới thông tin người dùng:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Hiển thị trạng thái loading
  if (userLoading || accessState.isChecking || (accessState.hasAccess && courseLoading) || refreshing) {
    return <LoadingState message={
      refreshing 
        ? "Đang làm mới thông tin quyền truy cập..." 
        : accessState.isChecking 
          ? "Đang kiểm tra quyền truy cập..."
          : "Đang tải thông tin khóa học..."
    } />;
  }

  // Hiển thị lỗi quyền truy cập khi đã hoàn thành kiểm tra
  if (accessState.checkComplete && !accessState.hasAccess) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
        <PermissionDenied message={error || "Bạn không có quyền truy cập khóa học này"} redirectUrl="/courses" data-access-denied="true" />
        
        {/* Thông tin debug */}
        <div className="mt-4 p-4 bg-yellow-50 rounded-md border border-yellow-300">
          <h3 className="text-sm font-medium text-yellow-800">Thông tin kiểm tra quyền:</h3>
          <ul className="mt-2 text-sm text-yellow-700">
            <li>Role: {userData?.role || 'N/A'}</li>
            <li>canViewAllCourses: {userData?.canViewAllCourses ? 'true' : 'false'}</li>
            <li>hasViewAllPermission: {hasViewAllPermission ? 'true' : 'false'}</li>
            <li>Đã đăng ký khóa học: {isEnrolledInCourse && isEnrolledInCourse(id) ? 'true' : 'false'}</li>
            <li>error: {error ? `"${error}"` : 'Không có lỗi'}</li>
          </ul>
        </div>
        
        {/* Nút làm mới quyền truy cập */}
        <div className="mt-6 text-center">
          <button
            onClick={handleRefreshPermissions}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            Làm mới quyền truy cập
          </button>
          <p className="mt-2 text-sm text-gray-500">
            Nếu bạn vừa được cấp quyền truy cập, hãy nhấn nút trên để làm mới thông tin.
          </p>
        </div>
      </div>
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
              onClick={handleRefreshPermissions}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Làm mới quyền
            </button>
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
              {/* Hiển thị thông tin quyền truy cập */}
              <div className="bg-white px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">
                  Quyền truy cập
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {hasViewAllPermission ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <svg xmlns="http://www.w3.org/2000/svg" className="-ml-0.5 mr-1.5 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Có quyền xem tất cả khóa học
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      <svg xmlns="http://www.w3.org/2000/svg" className="-ml-0.5 mr-1.5 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Chỉ xem các khóa học đã đăng ký
                    </span>
                  )}
                </dd>
              </div>
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