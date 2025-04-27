'use client';

import { useState, useEffect } from 'react';
import { ExclamationCircleIcon, MagnifyingGlassIcon, AcademicCapIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import { useRouter } from 'next/navigation';

export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Hàm để tải danh sách khóa học từ API
  const fetchCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/courses');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Không thể tải dữ liệu khóa học');
      }
      
      setCourses(data);
    } catch (err) {
      console.error('Lỗi khi tải danh sách khóa học:', err);
      setError(err.message || 'Đã xảy ra lỗi khi tải dữ liệu khóa học.');
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  // Tạo danh sách các danh mục giả định
  const categories = [
    { id: 'all', name: 'Tất cả' },
    { id: 'popular', name: 'Phổ biến' },
    { id: 'new', name: 'Mới nhất' },
    { id: 'advanced', name: 'Nâng cao' }
  ];

  const filteredCourses = courses.filter(course =>
    (course.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.description?.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (selectedCategory === 'all' || course.category === selectedCategory)
  );

  // Tạo hàm tạo ngẫu nhiên đánh giá cho khóa học
  const getRandomRating = () => {
    return (Math.floor(Math.random() * 10) + 40) / 10; // Tạo số ngẫu nhiên từ 4.0 đến 5.0
  };

  // Tạo Mảng sao từ đánh giá
  const renderStars = (rating) => {
    const stars = [];
    const roundedRating = Math.round(rating * 2) / 2; // Làm tròn đến 0.5 gần nhất
    
    for (let i = 1; i <= 5; i++) {
      if (i <= roundedRating) {
        stars.push(<StarIcon key={i} className="h-5 w-5 text-yellow-400" />);
      } else if (i - 0.5 === roundedRating) {
        stars.push(<StarIcon key={i} className="h-5 w-5 text-yellow-400 opacity-50" />);
      } else {
        stars.push(<StarIcon key={i} className="h-5 w-5 text-gray-300" />);
      }
    }
    
    return stars;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <div className="relative bg-indigo-700 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('/hero-pattern.svg')] opacity-10"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
              Nâng cao kỹ năng với các khóa học chất lượng
            </h1>
            <p className="text-xl text-indigo-100 mb-8">
              Khám phá hàng trăm khóa học được thiết kế bởi các chuyên gia hàng đầu
            </p>
            <div className="relative max-w-xl mx-auto">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Tìm kiếm khóa học bạn quan tâm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-transparent rounded-md leading-5 bg-white bg-opacity-90 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-600 transition duration-150 ease-in-out"
              />
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-b from-transparent to-white"></div>
      </div>

      {/* Thống kê */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
            <div className="text-3xl font-bold text-indigo-600 mb-2">1,000+</div>
            <div className="text-sm text-gray-600">Khóa học</div>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
            <div className="text-3xl font-bold text-indigo-600 mb-2">50,000+</div>
            <div className="text-sm text-gray-600">Học viên</div>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
            <div className="text-3xl font-bold text-indigo-600 mb-2">100+</div>
            <div className="text-sm text-gray-600">Giảng viên</div>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
            <div className="text-3xl font-bold text-indigo-600 mb-2">4.8</div>
            <div className="text-sm text-gray-600">Đánh giá trung bình</div>
          </div>
        </div>
      </div>

      {/* Danh mục */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                selectedCategory === category.id
                  ? 'bg-indigo-600 text-white shadow-md hover:bg-indigo-700'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        {/* Tiêu đề danh sách khóa học */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <AcademicCapIcon className="h-6 w-6 mr-2 text-indigo-600" />
            Danh sách khóa học
          </h2>
          <div className="text-sm text-gray-500">
            {filteredCourses.length} khóa học
          </div>
        </div>

        {error && (
          <div className="bg-red-50 p-4 mb-6 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <ExclamationCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Đã xảy ra lỗi
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-3 border-b-3 border-indigo-600 mb-4"></div>
            <p className="text-gray-500 text-lg">Đang tải dữ liệu khóa học...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {filteredCourses.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredCourses.map((course) => {
                  const rating = getRandomRating();
                  
                  return (
                    <div 
                      key={course._id} 
                      className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-all duration-300 hover:translate-y-[-4px] group"
                    >
                      <div className="h-48 bg-indigo-100 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 opacity-80"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <h3 className="text-2xl font-bold text-white text-center px-4">
                            {course.name}
                          </h3>
                        </div>
                        {/* Badge */}
                        {Math.random() > 0.7 && (
                          <div className="absolute top-3 right-3 bg-yellow-400 text-gray-900 text-xs font-bold px-2 py-1 rounded-md">
                            HOT
                          </div>
                        )}
                      </div>
                      <div className="p-6">
                        <div className="flex items-center mb-3">
                          <div className="flex mr-2">
                            {renderStars(rating)}
                          </div>
                          <span className="text-sm text-gray-500">({rating.toFixed(1)})</span>
                        </div>
                        <p className="text-gray-600 mb-4 line-clamp-3 min-h-[4.5rem]">{course.description}</p>
                        <div className="border-t border-gray-100 pt-4">
                          <div className="flex flex-col space-y-2">
                            <div className="flex items-center">
                              <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                              <span className="text-sm text-gray-600">80+ bài học</span>
                            </div>
                            <div className="flex items-center">
                              <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                              <span className="text-sm text-gray-600">Học mọi lúc, mọi nơi</span>
                            </div>
                          </div>
                          <div className="mt-4 flex justify-between items-center">
                            <span className="text-xl font-bold text-indigo-600">
                              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(course.price)}
                            </span>
                            <button
                              onClick={() => router.push(`/khoa-hoc/${course._id}`)}
                              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                            >
                              Xem chi tiết
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-200">
                <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">Không tìm thấy khóa học nào</h3>
                <p className="text-gray-500 mb-4">Hãy thử tìm kiếm với từ khóa khác hoặc xem tất cả các khóa học</p>
                <button 
                  onClick={() => {setSearchTerm(''); setSelectedCategory('all');}}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Xem tất cả khóa học
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Phần khuyến mãi */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 py-16 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:flex lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Sẵn sàng nâng cao kỹ năng?
              </h2>
              <p className="mt-3 text-lg text-indigo-100">
                Đăng ký ngay hôm nay và nhận ưu đãi giảm 20% cho tất cả các khóa học
                trong tháng này.
              </p>
            </div>
            <div className="mt-8 flex lg:mt-0 lg:flex-shrink-0">
              <div className="inline-flex rounded-md shadow">
                <a
                  href="#"
                  className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-indigo-700 bg-white hover:bg-indigo-50 transition-colors duration-200"
                >
                  Đăng ký ngay
                </a>
              </div>
              <div className="ml-3 inline-flex rounded-md shadow">
                <a
                  href="#"
                  className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-800 bg-opacity-60 hover:bg-opacity-70 transition-colors duration-200"
                >
                  Tìm hiểu thêm
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 