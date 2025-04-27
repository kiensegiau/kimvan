'use client';

import { useState, useEffect, useRef } from 'react';
import { ExclamationCircleIcon, MagnifyingGlassIcon, AcademicCapIcon, CheckCircleIcon, UserCircleIcon, ArrowRightIcon, ClockIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { StarIcon, FireIcon } from '@heroicons/react/24/solid';
import { useRouter } from 'next/navigation';

export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isInView, setIsInView] = useState(false);
  const statsRef = useRef(null);

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
    
    // Thêm intersection observer để animation khi scroll vào view
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    
    if (statsRef.current) {
      observer.observe(statsRef.current);
    }
    
    return () => {
      if (statsRef.current) {
        observer.unobserve(statsRef.current);
      }
    };
  }, []);

  // Danh sách các danh mục khóa học
  const categories = [
    { id: 'all', name: 'Tất cả', icon: AcademicCapIcon },
    { id: 'popular', name: 'Phổ biến', icon: FireIcon },
    { id: 'new', name: 'Mới nhất', icon: StarIcon },
    { id: 'advanced', name: 'Nâng cao', icon: DocumentTextIcon }
  ];

  const filteredCourses = courses.filter(course =>
    (course.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.description?.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (selectedCategory === 'all' || course.category === selectedCategory)
  );

  // Các danh mục Level
  const courseLevels = ['Cơ bản', 'Trung cấp', 'Nâng cao', 'Chuyên sâu'];

  // Các Testimonials
  const testimonials = [
    {
      id: 1,
      name: 'Nguyễn Văn A',
      role: 'Học viên',
      content: 'Các khóa học cung cấp kiến thức chuyên sâu, giúp tôi nâng cao kỹ năng chuyên môn một cách rõ rệt. Giảng viên nhiệt tình và nội dung rất bổ ích.',
      rating: 5
    },
    {
      id: 2,
      name: 'Trần Thị B',
      role: 'Giám đốc nhân sự',
      content: 'Tôi đã cử nhiều nhân viên tham gia các khóa học và nhận thấy hiệu quả rõ rệt. Nội dung thiết thực, cập nhật và dễ ứng dụng vào công việc thực tế.',
      rating: 5
    },
    {
      id: 3,
      name: 'Phạm Văn C',
      role: 'Sinh viên',
      content: 'Các bài giảng rõ ràng, dễ hiểu và có nhiều bài tập thực hành. Tôi đã học được rất nhiều kỹ năng mới từ các khóa học này.',
      rating: 4.5
    }
  ];

  // Tạo hàm tạo ngẫu nhiên đánh giá cho khóa học
  const getRandomRating = () => {
    return (Math.floor(Math.random() * 10) + 40) / 10; // Tạo số ngẫu nhiên từ 4.0 đến 5.0
  };

  // Tạo ngẫu nhiên level khóa học
  const getRandomLevel = () => {
    return courseLevels[Math.floor(Math.random() * courseLevels.length)];
  };

  // Tạo số lượng học viên ngẫu nhiên
  const getRandomStudentCount = () => {
    return Math.floor(Math.random() * 4000) + 1000;
  };

  // Tạo số lượng bài học ngẫu nhiên
  const getRandomLessonCount = () => {
    return Math.floor(Math.random() * 30) + 50;
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
      <div className="relative bg-gradient-to-r from-indigo-700 to-purple-800 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('/hero-pattern.svg')] opacity-10"></div>
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-block animate-bounce mb-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-800 bg-opacity-50">
                ✨ Nền tảng học tập hàng đầu tại Việt Nam ✨
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 [text-shadow:_0_1px_10px_rgb(0_0_0_/_20%)]">
              Nâng cao kỹ năng với các khóa học chất lượng
            </h1>
            <p className="text-xl text-indigo-100 mb-8 max-w-2xl mx-auto">
              Khám phá hàng trăm khóa học được thiết kế bởi các chuyên gia hàng đầu, phù hợp cho mọi trình độ
            </p>
            <div className="relative max-w-xl mx-auto mb-8">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Tìm kiếm khóa học bạn quan tâm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-transparent rounded-md leading-5 bg-white bg-opacity-90 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-600 transition duration-150 ease-in-out shadow-md"
              />
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-700 hover:to-pink-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 transition-all duration-200">
                <UserCircleIcon className="h-5 w-5 mr-2" /> Đăng ký học ngay
              </button>
              <button className="inline-flex items-center px-4 py-2 border border-white rounded-md text-sm font-medium text-white bg-transparent hover:bg-white hover:bg-opacity-10 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 transition-all duration-200">
                Tư vấn miễn phí <ArrowRightIcon className="h-4 w-4 ml-2" />
              </button>
            </div>
          </div>
        </div>
        {/* Wave shape divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 80" fill="#ffffff" preserveAspectRatio="none">
            <path d="M0,32L60,37.3C120,43,240,53,360,58.7C480,64,600,64,720,56C840,48,960,32,1080,26.7C1200,21,1320,27,1380,29.3L1440,32L1440,80L1380,80C1320,80,1200,80,1080,80C960,80,840,80,720,80C600,80,480,80,360,80C240,80,120,80,60,80L0,80Z"></path>
          </svg>
        </div>
      </div>

      {/* Thống kê */}
      <div ref={statsRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className={`p-5 bg-white rounded-xl shadow-md border border-gray-100 transform transition-all duration-700 ${isInView ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`} style={{ transitionDelay: '0ms' }}>
            <div className="text-4xl font-bold text-indigo-600 mb-2">1,000+</div>
            <div className="text-sm text-gray-600">Khóa học</div>
          </div>
          <div className={`p-5 bg-white rounded-xl shadow-md border border-gray-100 transform transition-all duration-700 ${isInView ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`} style={{ transitionDelay: '200ms' }}>
            <div className="text-4xl font-bold text-indigo-600 mb-2">50,000+</div>
            <div className="text-sm text-gray-600">Học viên</div>
          </div>
          <div className={`p-5 bg-white rounded-xl shadow-md border border-gray-100 transform transition-all duration-700 ${isInView ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`} style={{ transitionDelay: '400ms' }}>
            <div className="text-4xl font-bold text-indigo-600 mb-2">100+</div>
            <div className="text-sm text-gray-600">Giảng viên</div>
          </div>
          <div className={`p-5 bg-white rounded-xl shadow-md border border-gray-100 transform transition-all duration-700 ${isInView ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`} style={{ transitionDelay: '600ms' }}>
            <div className="text-4xl font-bold text-indigo-600 mb-2">4.8</div>
            <div className="text-sm text-gray-600">Đánh giá trung bình</div>
          </div>
        </div>
      </div>

      {/* Danh mục */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center ${
                selectedCategory === category.id
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg hover:shadow-indigo-500/30'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:shadow'
              }`}
            >
              <category.icon className="h-4 w-4 mr-1.5" />
              {category.name}
            </button>
          ))}
        </div>

        {/* Tiêu đề danh sách khóa học */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center mb-3 md:mb-0">
            <AcademicCapIcon className="h-7 w-7 mr-2 text-indigo-600" />
            Danh sách khóa học
          </h2>
          <div className="flex items-center bg-gray-100 rounded-lg px-4 py-2">
            <span className="text-sm font-medium text-gray-800 mr-2">Sắp xếp:</span>
            <select className="bg-transparent text-sm text-gray-700 focus:outline-none border-none">
              <option>Mới nhất</option>
              <option>Phổ biến nhất</option>
              <option>Giá tăng dần</option>
              <option>Giá giảm dần</option>
            </select>
            <div className="ml-4 pl-4 border-l border-gray-300">
              <span className="text-sm font-medium text-gray-800">{filteredCourses.length} khóa học</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 p-4 mb-6 rounded-md shadow">
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
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600 mb-5"></div>
            <p className="text-gray-500 text-lg font-medium">Đang tải dữ liệu khóa học...</p>
            <p className="text-gray-400">Vui lòng đợi trong giây lát</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {filteredCourses.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredCourses.map((course, index) => {
                  const rating = getRandomRating();
                  const level = getRandomLevel();
                  const students = getRandomStudentCount();
                  const lessons = getRandomLessonCount();
                  const isHot = Math.random() > 0.7;
                  
                  return (
                    <div 
                      key={course._id} 
                      className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-all duration-300 hover:translate-y-[-6px] group"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="h-52 bg-indigo-100 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-90 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-5">
                          <span className="text-indigo-100 uppercase tracking-wider text-xs font-semibold mb-2">
                            {level}
                          </span>
                          <h3 className="text-2xl font-bold text-white text-center px-4 mb-3 [text-shadow:_0_1px_3px_rgb(0_0_0_/_30%)]">
                            {course.name}
                          </h3>
                          <div className="flex items-center justify-center">
                            <div className="bg-white bg-opacity-20 rounded-full px-3 py-1 text-xs text-white flex items-center mt-1">
                              <UserCircleIcon className="h-3 w-3 mr-1" />
                              {students.toLocaleString()} học viên
                            </div>
                          </div>
                        </div>
                        {/* Badge */}
                        {isHot && (
                          <div className="absolute top-3 right-3 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md animate-pulse">
                            <span className="flex items-center">
                              <FireIcon className="h-3 w-3 mr-1" /> HOT
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center">
                            <div className="flex mr-2">
                              {renderStars(rating)}
                            </div>
                            <span className="text-sm text-gray-500">({rating.toFixed(1)})</span>
                          </div>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                            {lessons} bài học
                          </span>
                        </div>
                        <p className="text-gray-600 mb-4 line-clamp-3 min-h-[4.5rem]">{course.description}</p>
                        <div className="border-t border-gray-100 pt-4">
                          <div className="flex flex-col space-y-2.5">
                            <div className="flex items-center">
                              <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                              <span className="text-sm text-gray-600">Học mọi lúc, mọi nơi</span>
                            </div>
                            <div className="flex items-center">
                              <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                              <span className="text-sm text-gray-600">Bài giảng chất lượng cao</span>
                            </div>
                            <div className="flex items-center">
                              <ClockIcon className="h-5 w-5 text-indigo-500 mr-2" />
                              <span className="text-sm text-gray-600">Truy cập vĩnh viễn</span>
                            </div>
                          </div>
                          <div className="mt-5 flex justify-between items-center">
                            <span className="text-xl font-bold text-indigo-600">
                              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(course.price)}
                            </span>
                            <button
                              onClick={() => router.push(`/khoa-hoc/${course._id}`)}
                              className="inline-flex items-center px-4 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
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
              <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-200 shadow-sm">
                <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">Không tìm thấy khóa học nào</h3>
                <p className="text-gray-500 mb-5 max-w-md mx-auto">Hãy thử tìm kiếm với từ khóa khác hoặc xem tất cả các khóa học</p>
                <button 
                  onClick={() => {setSearchTerm(''); setSelectedCategory('all');}}
                  className="inline-flex items-center px-5 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800"
                >
                  Xem tất cả khóa học
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Testimonials */}
      <div className="bg-gradient-to-b from-white to-indigo-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Đánh giá từ học viên</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Hàng ngàn học viên đã cải thiện kỹ năng và phát triển sự nghiệp thông qua các khóa học của chúng tôi
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial) => (
              <div key={testimonial.id} className="bg-white p-6 rounded-xl shadow-md border border-gray-100 hover:shadow-lg transition-all duration-300">
                <div className="flex mb-1">
                  {renderStars(testimonial.rating)}
                </div>
                <p className="text-gray-700 italic mb-4">"{testimonial.content}"</p>
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-semibold text-gray-900">{testimonial.name}</h4>
                    <p className="text-xs text-gray-500">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Phần khuyến mãi */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:flex lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl mb-2">
                Sẵn sàng nâng cao kỹ năng?
              </h2>
              <p className="mt-3 text-lg text-indigo-100 mb-6 lg:mb-0">
                Đăng ký ngay hôm nay và nhận ưu đãi giảm <span className="font-bold text-yellow-300">20%</span> cho tất cả các khóa học
                trong tháng này.
              </p>
            </div>
            <div className="lg:mt-0 lg:flex-shrink-0 space-y-3 sm:space-y-0 sm:flex sm:space-x-4">
              <div className="inline-flex rounded-md shadow">
                <a
                  href="#"
                  className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-indigo-700 bg-white hover:bg-indigo-50 transition-colors duration-200 shadow-lg hover:shadow-xl"
                >
                  Đăng ký ngay
                </a>
              </div>
              <div className="inline-flex rounded-md shadow">
                <a
                  href="#"
                  className="inline-flex items-center justify-center px-6 py-3 border border-white text-base font-medium rounded-md text-white bg-transparent hover:bg-white hover:bg-opacity-10 transition-colors duration-200"
                >
                  Tìm hiểu thêm
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Mini */}
      <div className="bg-gray-900 text-white py-3 text-center text-sm">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2023 Trang Khóa Học. Thiết kế bởi Kimvan.</p>
        </div>
      </div>
    </div>
  );
} 