'use client';

import { useState, useRef, useEffect } from 'react';
import { ArrowRightIcon, AcademicCapIcon, UserCircleIcon, ClockIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { StarIcon, FireIcon } from '@heroicons/react/24/solid';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [isInView, setIsInView] = useState(false);
  const statsRef = useRef(null);
  const [featuredCourses, setFeaturedCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
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
    
    // Gọi API lấy danh sách khóa học
    const fetchFeaturedCourses = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/courses');
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Không thể tải dữ liệu khóa học');
        }
        
        // Lấy 3 khóa học nổi bật (có thể lọc theo các tiêu chí khác)
        const featured = data.slice(0, 3);
        setFeaturedCourses(featured);
      } catch (err) {
        console.error('Lỗi khi tải danh sách khóa học:', err);
        setError(err.message || 'Đã xảy ra lỗi khi tải dữ liệu khóa học.');
        setFeaturedCourses([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchFeaturedCourses();
    
    return () => {
      if (statsRef.current) {
        observer.unobserve(statsRef.current);
      }
    };
  }, []);

  // Các danh mục Level
  const courseLevels = ['Cơ bản', 'Trung cấp', 'Nâng cao', 'Chuyên sâu'];

  // Tạo Mảng sao từ đánh giá
  const renderStars = (rating) => {
    const stars = [];
    const roundedRating = Math.round(rating * 2) / 2; // Làm tròn đến 0.5 gần nhất
    
    for (let i = 1; i <= 5; i++) {
      if (i <= roundedRating) {
        stars.push(<StarIcon key={i} className="h-4 w-4 text-yellow-400" />);
      } else if (i - 0.5 === roundedRating) {
        stars.push(<StarIcon key={i} className="h-4 w-4 text-yellow-400 opacity-50" />);
      } else {
        stars.push(<StarIcon key={i} className="h-4 w-4 text-gray-300" />);
      }
    }
    
    return stars;
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-indigo-700 to-purple-800 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('/hero-pattern.svg')] opacity-10"></div>
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 lg:py-28 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-block animate-bounce mb-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-800 bg-opacity-50">
                ✨ Nền tảng học tập hàng đầu tại Việt Nam ✨
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight mb-3 md:mb-4 [text-shadow:_0_1px_10px_rgb(0_0_0_/_20%)]">
              Nâng cao kỹ năng với <span className="text-pink-300">Kimvan</span>
            </h1>
            <p className="text-base md:text-xl text-indigo-100 mb-6 md:mb-8 max-w-2xl mx-auto px-4 md:px-0">
              Hệ thống học tập trực tuyến hàng đầu với hàng trăm khóa học chất lượng cao từ các chuyên gia hàng đầu
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 px-4 md:px-0">
              <button 
                onClick={() => router.push('/khoa-hoc')}
                className="inline-flex items-center justify-center px-5 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-700 hover:to-pink-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 transition-all duration-200 w-full sm:w-auto"
              >
                <AcademicCapIcon className="h-5 w-5 mr-2" /> Khám phá khóa học
              </button>
              <button className="inline-flex items-center justify-center px-5 py-3 border border-white rounded-md text-sm font-medium text-white bg-transparent hover:bg-white hover:bg-opacity-10 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 transition-all duration-200 w-full sm:w-auto mt-3 sm:mt-0">
                Đăng ký ngay <ArrowRightIcon className="h-4 w-4 ml-2" />
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

      {/* Tính năng */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Lựa chọn hàng đầu cho việc học trực tuyến</h2>
          <p className="text-lg text-gray-600">
            Kimvan cung cấp nền tảng học tập toàn diện với nhiều tính năng ưu việt
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 hover:shadow-lg transition-all duration-300 hover:translate-y-[-5px]">
            <div className="bg-indigo-100 rounded-full w-14 h-14 flex items-center justify-center mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-gray-900">Khóa học đa dạng</h3>
            <p className="text-gray-600 mb-4">
              Nhiều khóa học chất lượng cao từ các giáo viên hàng đầu, phù hợp cho mọi trình độ và nhu cầu học tập.
            </p>
            <ul className="space-y-2">
              <li className="flex items-start">
                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-600">Hơn 20 lĩnh vực khác nhau</span>
              </li>
              <li className="flex items-start">
                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-600">Cập nhật thường xuyên</span>
              </li>
              <li className="flex items-start">
                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-600">Phù hợp với mọi trình độ</span>
              </li>
            </ul>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 hover:shadow-lg transition-all duration-300 hover:translate-y-[-5px]">
            <div className="bg-indigo-100 rounded-full w-14 h-14 flex items-center justify-center mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-gray-900">Video bài giảng</h3>
            <p className="text-gray-600 mb-4">
              Học mọi lúc mọi nơi với video bài giảng chất lượng cao, được thiết kế để giúp bạn hiểu sâu và nhớ lâu.
            </p>
            <ul className="space-y-2">
              <li className="flex items-start">
                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-600">Video chất lượng HD</span>
              </li>
              <li className="flex items-start">
                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-600">Xem offline</span>
              </li>
              <li className="flex items-start">
                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-600">Điều chỉnh tốc độ xem</span>
              </li>
            </ul>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 hover:shadow-lg transition-all duration-300 hover:translate-y-[-5px]">
            <div className="bg-indigo-100 rounded-full w-14 h-14 flex items-center justify-center mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-gray-900">Giáo viên chuyên nghiệp</h3>
            <p className="text-gray-600 mb-4">
              Đội ngũ giáo viên giàu kinh nghiệm và tận tâm, luôn sẵn sàng hỗ trợ bạn trong quá trình học tập.
            </p>
            <ul className="space-y-2">
              <li className="flex items-start">
                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-600">Chuyên gia đầu ngành</span>
              </li>
              <li className="flex items-start">
                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-600">Hỗ trợ 24/7</span>
              </li>
              <li className="flex items-start">
                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-600">Cộng đồng học tập</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Khóa học nổi bật */}
      <div className="bg-gradient-to-b from-white to-indigo-50 py-14 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Khóa học nổi bật</h2>
            <p className="text-lg text-gray-600">
              Những khóa học được yêu thích nhất tại Kimvan
            </p>
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
            <div className="text-center py-16">
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600 mb-5"></div>
              <p className="text-gray-500 text-lg font-medium">Đang tải dữ liệu khóa học...</p>
              <p className="text-gray-400">Vui lòng đợi trong giây lát</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {featuredCourses.length > 0 ? (
                featuredCourses.map((course, index) => {
                  const level = getRandomLevel();
                  const students = getRandomStudentCount();
                  const lessons = getRandomLessonCount();
                  const isHot = Math.random() > 0.7;
                  
                  return (
                    <div 
                      key={course._id || index} 
                      className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-all duration-300 hover:translate-y-[-6px] group"
                    >
                      <div className="h-44 sm:h-52 bg-indigo-100 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-90 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-5">
                          <span className="text-indigo-100 uppercase tracking-wider text-xs font-semibold mb-2">
                            {level}
                          </span>
                          <h3 className="text-xl md:text-2xl font-bold text-white text-center px-4 mb-2 md:mb-3 [text-shadow:_0_1px_3px_rgb(0_0_0_/_30%)]">
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
                      <div className="p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center">
                            <div className="flex mr-2">
                              {renderStars(4.5)} {/* Sử dụng rating mặc định hoặc lấy từ API nếu có */}
                            </div>
                            <span className="text-sm text-gray-500">(4.5)</span>
                          </div>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                            {lessons} bài học
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm sm:text-base mb-4 line-clamp-2">{course.description}</p>
                        <div className="border-t border-gray-100 pt-4">
                          <div className="flex items-center">
                            <ClockIcon className="h-5 w-5 text-indigo-500 mr-2" />
                            <span className="text-sm text-gray-600">Truy cập vĩnh viễn</span>
                          </div>
                          <div className="mt-4 flex items-center justify-between">
                            <span className="text-xl font-bold text-indigo-600">
                              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(course.price)}
                            </span>
                            <button
                              onClick={() => router.push(`/khoa-hoc/${course._id}`)}
                              className="inline-flex items-center px-3 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
                            >
                              Xem chi tiết
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-1 sm:col-span-2 lg:col-span-3 text-center py-16 bg-white rounded-xl border border-gray-200 shadow-sm">
                  <p className="text-gray-500 text-lg">Chưa có khóa học nổi bật</p>
                  <button
                    onClick={() => router.push('/khoa-hoc')}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Xem tất cả khóa học
                  </button>
                </div>
              )}
            </div>
          )}
          
          <div className="text-center mt-10">
            <button
              onClick={() => router.push('/khoa-hoc')}
              className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
            >
              Xem tất cả khóa học <ArrowRightIcon className="ml-2 h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Phần CTA */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:flex lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white sm:text-4xl mb-2">
                Bắt đầu hành trình học tập ngay hôm nay
              </h2>
              <p className="mt-3 text-base md:text-lg text-indigo-100 mb-6 lg:mb-0">
                Đăng ký tài khoản và nhận ưu đãi giảm <span className="font-bold text-yellow-300">20%</span> cho khóa học đầu tiên.
              </p>
            </div>
            <div className="lg:mt-0 lg:flex-shrink-0 space-y-3 sm:space-y-0 sm:flex sm:space-x-4">
              <div className="inline-flex rounded-md shadow w-full sm:w-auto">
                <a
                  href="#"
                  className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-indigo-700 bg-white hover:bg-indigo-50 transition-colors duration-200 shadow-lg hover:shadow-xl"
                >
                  Đăng ký ngay
                </a>
              </div>
              <div className="inline-flex rounded-md shadow w-full sm:w-auto">
                <a
                  href="#"
                  className="w-full inline-flex items-center justify-center px-6 py-3 border border-white text-base font-medium rounded-md text-white bg-transparent hover:bg-white hover:bg-opacity-10 transition-colors duration-200"
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
          <p>© 2023 Kimvan. Hệ thống học tập trực tuyến hàng đầu.</p>
        </div>
      </div>

      {/* Thêm meta viewport để đảm bảo responsive trên mobile */}
      <style jsx global>{`
        @media (max-width: 640px) {
          html {
            font-size: 14px;
          }
        }
      `}</style>
    </div>
  );
}
