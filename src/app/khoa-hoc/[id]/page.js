'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function CourseDetailPage() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const fetchCourseData = async () => {
      try {
        setLoading(true);
        const decodedId = decodeURIComponent(id);
        console.log('Đang tìm kiếm khóa học với ID đã giải mã:', decodedId);
        
        // Sử dụng API của chúng ta làm trung gian kết nối đến kimvan.id.vn
        const apiUrl = `/api/spreadsheets/${decodedId}`;
        console.log('Đang kết nối qua API của chúng ta:', apiUrl);
        
        const detailResponse = await fetch(apiUrl);
        
        if (!detailResponse.ok) {
          throw new Error(`Lỗi khi lấy chi tiết khóa học: ${detailResponse.status}`);
        }
        
        const detailData = await detailResponse.json();
        
        // Tạo thông tin cơ bản cho khóa học từ ID
        let courseName = "Khóa học Full Combo 2K8";
        
        // Nếu có dữ liệu sheets và có thông tin về tên
        if (detailData.sheets && detailData.sheets[0] && detailData.sheets[0].properties) {
          courseName = detailData.sheets[0].properties.title || courseName;
        }
        
        // Tạo đối tượng khóa học
        setCourse({
          id: decodedId,
          name: courseName,
          details: detailData
        });
        
        console.log('Đã tải dữ liệu khóa học thành công:', decodedId);
        
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

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-lg font-medium text-gray-700">Đang tải thông tin khóa học...</p>
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
          <Link href="/khoa-hoc" className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
            ← Quay lại danh sách khóa học
          </Link>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-50">
        <div className="text-center max-w-md p-8 bg-white rounded-lg shadow-lg">
          <div className="text-yellow-600 text-5xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Không tìm thấy khóa học</h1>
          <p className="mb-6 text-gray-600">Khóa học bạn đang tìm kiếm không tồn tại hoặc đã bị xóa.</p>
          <Link href="/khoa-hoc" className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
            ← Quay lại danh sách khóa học
          </Link>
        </div>
      </div>
    );
  }

  const subject = extractSubject(course.name);
  const teacher = extractTeacher(course.name);

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link href="/khoa-hoc" className="text-blue-600 hover:text-blue-800 font-medium flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Quay lại danh sách khóa học
          </Link>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium bg-white bg-opacity-30 px-3 py-1 rounded-full backdrop-blur-sm">
                  {subject}
                </span>
                <h1 className="text-3xl font-bold mt-4">{course.name}</h1>
                
                {teacher && (
                  <div className="mt-4 flex items-center">
                    <div className="bg-white bg-opacity-20 rounded-full h-10 w-10 flex items-center justify-center mr-3">
                      <span className="text-white font-medium">👨‍🏫</span>
                    </div>
                    <span className="text-white text-lg">{teacher}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'overview'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Tổng quan khóa học
              </button>
              <button
                onClick={() => setActiveTab('lessons')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'lessons'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Danh sách bài học
              </button>
              <button
                onClick={() => setActiveTab('materials')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'materials'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Tài liệu học tập
              </button>
            </nav>
          </div>
          
          <div className="p-6">
            {activeTab === 'overview' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Giới thiệu khóa học</h2>
                <p className="text-gray-600 mb-6">
                  Đây là khóa học {subject} được giảng dạy bởi {teacher}. 
                  Khóa học này cung cấp kiến thức từ cơ bản đến nâng cao, giúp học sinh chuẩn bị tốt cho kỳ thi THPT Quốc gia.
                </p>
                
                <div className="bg-blue-50 rounded-lg p-5 border border-blue-100">
                  <h3 className="text-lg font-medium text-blue-800 mb-3">Thông tin chung</h3>
                  <ul className="space-y-2 text-blue-700">
                    <li className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Môn học: {subject}</span>
                    </li>
                    <li className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Giảng viên: {teacher}</span>
                    </li>
                    <li className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Đối tượng: Học sinh lớp 12 (2K8)</span>
                    </li>
                    <li className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>ID Khóa học: {id}</span>
                    </li>
                  </ul>
                </div>
                
                <div className="mt-8 flex space-x-4">
                  <a 
                    href={`/api/spreadsheets/${course.id}/LIVE/2K8/redirect`}
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition"
                  >
                    Xem video bài giảng
                  </a>
                  <a 
                    href={`/api/spreadsheets/${course.id}/TÀI LIỆU/2K8/redirect`}
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex-1 text-center bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition"
                  >
                    Tải tài liệu
                  </a>
                </div>
              </div>
            )}
            
            {activeTab === 'lessons' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Danh sách bài học</h2>
                <p className="text-gray-600 mb-6">
                  Dưới đây là danh sách các bài học trong khóa học này. Nhấn vào từng bài để xem chi tiết.
                </p>
                
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <div className="bg-gray-50 py-3 px-4 text-gray-600 font-medium text-sm">
                    Nội dung đang được cập nhật...
                  </div>
                  
                  <div className="text-center py-10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="mt-4 text-gray-500">Danh sách bài học sẽ sớm được cập nhật</p>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'materials' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Tài liệu học tập</h2>
                <p className="text-gray-600 mb-6">
                  Truy cập vào các tài liệu học tập được cung cấp kèm với khóa học. Tài liệu bao gồm bài tập, đề thi và tài liệu tham khảo.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <a 
                    href={`/api/spreadsheets/${course.id}/TÀI LIỆU/2K8/redirect`}
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-blue-50 transition"
                  >
                    <div className="bg-blue-100 rounded-lg p-3 mr-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Tài liệu học tập</h3>
                      <p className="text-sm text-gray-500">Tải các tài liệu học tập của khóa học</p>
                    </div>
                  </a>
                  
                  <a 
                    href={`/api/spreadsheets/${course.id}/BTVN/2K8/redirect`}
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-blue-50 transition"
                  >
                    <div className="bg-green-100 rounded-lg p-3 mr-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Bài tập về nhà</h3>
                      <p className="text-sm text-gray-500">Tải bài tập về nhà và đáp án</p>
                    </div>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 