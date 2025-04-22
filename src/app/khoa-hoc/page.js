'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function KhoaHoc() {
  const [courses, setCourses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filteredCourses, setFilteredCourses] = useState([]);

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

  useEffect(() => {
    // Danh sách ID khóa học mẫu
    const sampleCourses = [
      {
        id: "GXYIluW-XHl2t70uUId_QuXwzki8rsS0fQ0aaTjVvxHem7ZCq-HdsUPd-sT13lxKlOzW02V-GpOKcN5Zf6shmXXzMSrHKiRR", 
        name: "2K8 XPS | VẬT LÝ - VŨ NGỌC ANH",
        description: "Khóa học Vật lý ôn thi THPT Quốc gia dành cho học sinh 2K8"
      },
      {
        id: "4tKFsUi5Wf8eFN0_CZjARkxWHgSTvzvlIncwx4HGKJZltzAbm0CKFwliyBrlTIqbOVRWKAgJiGdaYOpoh9wGoLHUF_34BBgF", 
        name: "2K8 XPS | HÓA HỌC - PHẠM VĂN TRỌNG",
        description: "Khóa học Hóa học ôn thi THPT Quốc gia dành cho học sinh 2K8"
      },
      {
        id: "WRn91SKHWM2l1OsMD6K5wVlYK9uVf6-ciycBBRQxZbaUrTjm_9z_txWiTRCIPegFXzc0FqKqadKt0xRVbEVQpo8jKjdUyqsF", 
        name: "2K8 XPS | TOÁN - ĐỖ VĂN ĐỨC",
        description: "Khóa học Toán ôn thi THPT Quốc gia dành cho học sinh 2K8"
      },
      {
        id: "Dn9JLo16zP9RlsP0emxLE6gNSKm_fTOuCs8xgnaHDW6Fz8EyRnSL_zO-NRendI8jHy0c4egsb8hDt7--8DthYzHvNVwBngK6", 
        name: "2K8 XPS | TIẾNG ANH - NGUYỄN THỊ THÚY",
        description: "Khóa học Tiếng Anh ôn thi THPT Quốc gia dành cho học sinh 2K8"
      },
      {
        id: "TYPfY4brHpLrvIKc9ZTDzAo2rqsnhma7pbjWwP-RdjnaxJJhFcvrJUsGIFlU4-dQmnBCpfos9SJlotwFaN3LfMsEsNc2mII7", 
        name: "2K8 XPS | SINH HỌC - DƯƠNG THỊ HÀ",
        description: "Khóa học Sinh học ôn thi THPT Quốc gia dành cho học sinh 2K8"
      },
      {
        id: "aVeEbaNjSDLyy0XvxBLUk6k-B7a21Qe3YduGYRpuBE4-09v0VZ1sGCVScvDbLeET8z9JQ_hjN6IyNIs7OkVPagdp01OErCVc", 
        name: "2K8 XPS | SỬ - NGUYỄN QUỐC CHÍ",
        description: "Khóa học Lịch sử ôn thi THPT Quốc gia dành cho học sinh 2K8"
      }
    ];

    try {
      setLoading(true);
      // Sử dụng dữ liệu mẫu thay vì gọi API
      setCourses(sampleCourses);
      setFilteredCourses(sampleCourses);
      console.log('Đã tải danh sách khóa học mẫu:', sampleCourses.length);
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu khóa học:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Lọc khóa học dựa trên từ khóa tìm kiếm
    if (searchTerm.trim() === '') {
      setFilteredCourses(courses);
    } else {
      const filtered = courses.filter(course =>
        course.name && course.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCourses(filtered);
    }
  }, [searchTerm, courses]);

  // Hàm lấy màu nền dựa trên môn học
  const getSubjectColor = (subject) => {
    const colors = {
      'VẬT LÝ': 'bg-blue-100',
      'HÓA': 'bg-green-100',
      'TOÁN': 'bg-red-100',
      'TIẾNG ANH': 'bg-purple-100',
      'SINH HỌC': 'bg-emerald-100',
      'SỬ': 'bg-amber-100',
      'ĐỊA': 'bg-cyan-100',
      'GDCD': 'bg-orange-100'
    };
    
    return colors[subject] || 'bg-blue-100';
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
          <div className="max-w-md mx-auto mb-8">
            <input 
              type="text" 
              placeholder="Tìm kiếm khóa học..." 
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Link href="/" className="text-blue-600 hover:text-blue-800 font-medium">
            ← Trở về trang chủ
          </Link>
        </div>
        
        {filteredCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredCourses.map((course, index) => {
              const subject = extractSubject(course.name);
              const bgColorClass = getSubjectColor(subject);
              const icon = getSubjectIcon(subject);
              
              // Log để debug
              console.log(`Khóa học ${index}: ${course.name} - ID: ${course.id}`);
              
              return (
                <div key={course.id || index} className="bg-white rounded-xl shadow-lg overflow-hidden transform transition duration-300 hover:scale-105 hover:shadow-xl">
                  <div className={`${bgColorClass} h-48 flex items-center justify-center relative`}>
                    <div className="text-6xl">{icon}</div>
                    <div className="absolute top-3 right-3 bg-white bg-opacity-70 backdrop-blur-sm px-3 py-1 rounded-full">
                      <span className="text-blue-800 font-medium">2K8 XPS</span>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center mb-3">
                      <span className="px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                        {subject}
                      </span>
                    </div>
                    
                    <h2 className="text-xl font-bold text-gray-800 mb-2">{course.name}</h2>
                    <p className="text-gray-600 mb-4 line-clamp-2">{course.description}</p>
                    
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