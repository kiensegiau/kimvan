'use client';

import { useState, useEffect } from 'react';
import useUserData from '@/hooks/useUserData';
import useEnrolledCourses from '@/hooks/useEnrolledCourses';

export default function PermissionDebug({ courseId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [courseData, setCourseData] = useState(null);
  const [loading, setLoading] = useState(false);
  const { userData, loading: userLoading, refreshUserData } = useUserData();
  const { 
    isEnrolledInCourse, 
    loading: enrollmentLoading,
    refreshEnrollments
  } = useEnrolledCourses();
  
  // Lấy dữ liệu khóa học từ API để sử dụng cho debug
  useEffect(() => {
    const fetchCourseData = async () => {
      if (!courseId) return;
      
      setLoading(true);
      try {
        const response = await fetch(`/api/courses/${courseId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.course) {
            setCourseData(data.course);
          }
        }
      } catch (error) {
        console.error("Error fetching course data for debug:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCourseData();
  }, [courseId]);
  
  // Kiểm tra quyền trực tiếp từ userData để đảm bảo tính nhất quán
  const isAdmin = userData?.role === 'admin';
  const hasCanViewAllProperty = userData?.canViewAllCourses === true;
  const hasViewAllPermission = userData?.permissions?.includes('view_all_courses');
  
  // Kết hợp các điều kiện quyền
  const canViewAll = isAdmin || hasCanViewAllProperty || hasViewAllPermission;
  
  // Các trạng thái khác
  const isEnrolled = isEnrolledInCourse(courseId);
  const courseRequiresEnrollment = courseData ? courseData.requiresEnrollment !== false : true;
  
  // Xác định quyền truy cập dựa trên điều kiện quyền - chỉ ưu tiên canViewAllCourses (bỏ qua admin)
  const hasAccessToCourse = hasCanViewAllProperty || hasViewAllPermission || 
                           (!courseRequiresEnrollment || isEnrolled);

  const handleRefresh = async () => {
    await refreshUserData();
    await refreshEnrollments();
    alert('Đã làm mới dữ liệu người dùng!');
    window.location.reload();
  };

  if (userLoading || enrollmentLoading || loading) {
    return <div className="text-gray-500 text-sm">Đang tải thông tin quyền...</div>;
  }

  return (
    <div className="bg-blue-50 p-4 rounded-md mb-4">
      <div className="flex justify-between items-center">
        <div className="font-medium text-blue-800">
          Thông tin quyền truy cập (Debug)
        </div>
        <button 
          className="text-blue-600 text-sm hover:underline"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? 'Ẩn' : 'Hiện'}
        </button>
      </div>
      
      {isOpen && (
        <div className="mt-3 space-y-2 bg-white p-4 rounded border border-blue-200">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="font-medium">Email:</div>
            <div>{userData?.email || 'Không có'}</div>
            
            <div className="font-medium">Role:</div>
            <div className={isAdmin ? 'text-green-600' : 'text-gray-600'}>
              {userData?.role || 'Không có'}
              {isAdmin && ' ✓'}
            </div>
            
            <div className="font-medium">Quyền xem tất cả khóa học:</div>
            <div className={canViewAll ? 'text-green-600' : 'text-red-600'}>
              {canViewAll ? 'Có ✓' : 'Không'}
            </div>
            
            <div className="font-medium">Admin role:</div>
            <div className="text-gray-600">
              {isAdmin ? 'Có (không có đặc quyền)' : 'Không'}
            </div>
            
            <div className="font-medium">canViewAllCourses property:</div>
            <div className={hasCanViewAllProperty ? 'text-green-600' : 'text-gray-600'}>
              {hasCanViewAllProperty ? 'true ✓' : (userData?.canViewAllCourses === false ? 'false' : 'undefined')}
            </div>
            
            <div className="font-medium">view_all_courses permission:</div>
            <div className={hasViewAllPermission ? 'text-green-600' : 'text-gray-600'}>
              {hasViewAllPermission ? 'Có ✓' : 'Không'}
            </div>
            
            <div className="font-medium">Course ID:</div>
            <div>{courseId || 'Không có'}</div>
            
            <div className="font-medium">Course requires enrollment:</div>
            <div>{courseRequiresEnrollment ? 'Yes' : 'No'}</div>
            
            <div className="font-medium">Đã đăng ký khóa học:</div>
            <div className={isEnrolled ? 'text-green-600' : 'text-gray-600'}>
              {isEnrolled ? 'Có ✓' : 'Không'}
            </div>
            
            <div className="font-medium">Có quyền truy cập:</div>
            <div className={hasAccessToCourse ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
              {hasAccessToCourse ? 'Có ✓' : 'Không ⚠️'}
            </div>
          </div>
          
          <div className="mt-3 pt-3 border-t border-blue-100">
            <div className="font-medium mb-1">userData permissions:</div>
            <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto">
              {userData?.permissions ? JSON.stringify(userData.permissions, null, 2) : 'null'}
            </pre>
          </div>
          
          <div className="mt-3 pt-3 border-t border-blue-100">
            <div className="font-medium mb-1">courseData:</div>
            <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto max-h-32">
              {courseData ? JSON.stringify(courseData, null, 2) : 'null'}
            </pre>
          </div>
          
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleRefresh}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
            >
              Làm mới dữ liệu người dùng
            </button>
            
            <button
              onClick={() => {
                localStorage.clear();
                alert('Đã xóa tất cả dữ liệu cache!');
                window.location.reload();
              }}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm"
            >
              Xóa tất cả cache
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 