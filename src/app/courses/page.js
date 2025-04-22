'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  // Hàm lấy màu nền dựa trên môn học
  const getSubjectColor = (subject) => {
    const colors = {
      'VẬT LÝ': 'from-blue-600 to-indigo-700',
      'HÓA': 'from-green-600 to-teal-700',
      'TOÁN': 'from-red-600 to-rose-700',
      'TIẾNG ANH': 'from-purple-600 to-fuchsia-700',
      'SINH HỌC': 'from-emerald-600 to-green-700',
      'SỬ': 'from-amber-600 to-yellow-700',
      'ĐỊA': 'from-cyan-600 to-sky-700',
      'GDCD': 'from-orange-600 to-amber-700'
    };
    
    return colors[subject] || 'from-blue-600 to-indigo-700';
  };

  // Hàm lấy icon dựa trên môn học
  const getSubjectIcon = (subject) => {
    switch(subject) {
      case 'VẬT LÝ': return '⚡';
      case 'HÓA': return '🧪';
      case 'TOÁN': return '📊';
      case 'TIẾNG ANH': return '🌎';
      case 'SINH HỌC': return '🧬';
      case 'SỬ': return '📜';
      case 'ĐỊA': return '🌏';
      case 'GDCD': return '⚖️';
      default: return '📚';
    }
  };

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/spreadsheets/create/fullcombokhoa2k8');
        
        if (!response.ok) {
          throw new Error(`Lỗi: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        setCourses(data);
      } catch (err) {
        console.error('Lỗi khi tải dữ liệu khóa học:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-lg font-medium text-gray-700">Đang tải dữ liệu khóa học...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-50">
        <div className="text-center max-w-md p-8 bg-white rounded-lg shadow-lg">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-red-600 mb-4">Lỗi khi tải dữ liệu</h1>
          <p className="mb-6 text-gray-600">{error}</p>
          <Link href="/" className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
            ← Trở về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-blue-600 text-lg font-semibold">XPS IMOE 2025</span>
          <h1 className="text-4xl font-bold text-gray-900 mt-2 mb-4">
            Danh sách khóa học Full Combo 2K8
          </h1>
          <p className="max-w-2xl mx-auto text-gray-600 mb-8">
            Trọn bộ tài liệu và khóa học giúp bạn chuẩn bị tốt nhất cho kỳ thi THPT Quốc gia. 
            Học với những giảng viên chất lượng cao.
          </p>
          <Link href="/" className="text-blue-600 hover:text-blue-800 font-medium">
            ← Trở về trang chủ
          </Link>
        </div>
        
        {courses && courses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {courses.map((course, index) => {
              const subject = extractSubject(course.name);
              const teacher = extractTeacher(course.name);
              const gradientClass = getSubjectColor(subject);
              const icon = getSubjectIcon(subject);
              
              // Log ID để debug
              console.log(`Course ${index}: ${course.name} - ID: ${course.id}`);
              
              return (
                <div key={index} className="bg-white rounded-xl shadow-lg overflow-hidden transform transition duration-300 hover:scale-105 hover:shadow-xl">
                  <div className={`bg-gradient-to-r ${gradientClass} h-32 flex items-center justify-center relative`}>
                    <div className="text-white text-6xl">{icon}</div>
                    <div className="absolute top-3 right-3 bg-white bg-opacity-30 backdrop-blur-sm px-3 py-1 rounded-full">
                      <span className="text-white font-medium">2K8 XPS</span>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <div className="flex items-center mb-3">
                      <span className="px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                        {subject}
                      </span>
                    </div>
                    
                    <h2 className="text-xl font-bold text-gray-800 mb-2">{course.name}</h2>
                    
                    {teacher && (
                      <div className="mb-4 flex items-center">
                        <div className="bg-gray-200 rounded-full h-8 w-8 flex items-center justify-center mr-2">
                          <span className="text-gray-700 font-medium">👨‍🏫</span>
                        </div>
                        <span className="text-gray-700">{teacher}</span>
                      </div>
                    )}
                    
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <Link 
                        href={`/khoa-hoc/${encodeURIComponent(course.id)}`}
                        className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition"
                      >
                        Xem chi tiết khóa học
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-xl shadow">
            <div className="text-gray-400 text-5xl mb-4">📚</div>
            <p className="text-gray-600 text-xl">Không có khóa học nào được tìm thấy.</p>
          </div>
        )}
      </div>
    </div>
  );
} 