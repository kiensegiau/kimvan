'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Home() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/spreadsheets/create/fullcombokhoa2k8');
        
        if (!response.ok) {
          throw new Error(`Lỗi khi tải dữ liệu: ${response.status}`);
        }
        
        const data = await response.json();
        setCourses(data);
      } catch (err) {
        console.error('Lỗi khi tải danh sách khóa học:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCourses();
  }, []);
  
  // Hàm trích xuất môn học từ tên
  const extractSubject = (name) => {
    if (!name) return 'Khóa học';
    
    const subjects = ['VẬT LÝ', 'HÓA', 'TOÁN', 'TIẾNG ANH', 'SINH HỌC', 'SỬ', 'ĐỊA', 'GDCD'];
    
    for (const subject of subjects) {
      if (name.includes(subject)) {
        return subject;
      }
    }
    
    return 'Khóa học';
  };
  
  // Hàm lấy tên giáo viên từ tên khóa học
  const extractTeacher = (name) => {
    if (!name) return '';
    
    const parts = name.split('-');
    if (parts.length > 1) {
      return parts[1].trim();
    }
    
    return '';
  };

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8 p-6">
          <h1 className="text-3xl font-bold text-center mb-2">Danh sách khóa học</h1>
          <p className="text-gray-600 text-center mb-8">Hệ thống chuyển hướng Kimvan</p>
          
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
              <p className="ml-4 text-lg font-medium text-gray-700">Đang tải danh sách khóa học...</p>
            </div>
          ) : error ? (
            <div className="text-center py-10">
              <div className="text-red-600 text-5xl mb-4">⚠️</div>
              <h2 className="text-xl font-semibold text-red-600 mb-2">Lỗi khi tải dữ liệu</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Thử lại
              </button>
            </div>
          ) : courses.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-yellow-600 text-5xl mb-4">📚</div>
              <h2 className="text-xl font-semibold mb-2">Không có khóa học nào</h2>
              <p className="text-gray-600">Hiện tại không có khóa học nào được tìm thấy.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course) => {
                const subject = extractSubject(course.name);
                const teacher = extractTeacher(course.name);
                
                return (
                  <Link 
                    href={`/khoa-hoc/${encodeURIComponent(course.id)}`}
                    key={course.id}
                    className="block bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition duration-300"
                  >
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                          {subject}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold mb-2 text-gray-900">{course.name}</h3>
                      
                      {teacher && (
                        <div className="flex items-center text-gray-600 mb-3">
                          <span className="mr-2">👨‍🏫</span>
                          <span>{teacher}</span>
                        </div>
                      )}
                      
                      <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                        <span className="text-sm text-gray-500">ID: {course.id.substring(0, 10)}...</span>
                        <span className="text-blue-600 font-medium hover:text-blue-700">
                          Xem chi tiết →
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
