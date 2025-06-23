'use client';

import { useState, useEffect } from 'react';
import { 
  AcademicCapIcon,
  ExclamationCircleIcon, 
  UserCircleIcon, 
  DocumentTextIcon, 
  ClockIcon, 
  ArrowRightIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { FireIcon } from '@heroicons/react/24/solid';
import { useRouter } from 'next/navigation';

// Thời gian cache - Có thể điều chỉnh dễ dàng
const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 giờ 
const MAX_CACHE_ITEMS = 5; // Giữ tối đa 5 cache items

export default function MyCoursesPage() {
  const router = useRouter();
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cacheStatus, setCacheStatus] = useState('');
  
  // Các danh mục Level
  const courseLevels = ['Cơ bản', 'Trung cấp', 'Nâng cao', 'Chuyên sâu'];

  // Hàm lưu dữ liệu vào localStorage với quản lý cache
  const saveToCache = (data) => {
    try {
      // Tạo đối tượng cache với dữ liệu và thời gian
      const cacheItem = {
        data: data,
        timestamp: Date.now()
      };
      
      // Lưu dữ liệu khóa học vào cache
      localStorage.setItem('my-courses', JSON.stringify(cacheItem));
      
      // Dọn dẹp cache cũ
      cleanupOldCaches();
      
      setCacheStatus('saved');
    } catch (error) {
      console.error('Lỗi khi lưu cache:', error);
      // Thử xóa cache và lưu lại
      try {
        localStorage.removeItem('my-courses');
        localStorage.setItem('my-courses', JSON.stringify({
          data: data,
          timestamp: Date.now()
        }));
      } catch (e) {
        // Xử lý lỗi im lặng nếu vẫn không thể lưu
      }
    }
  };

  // Hàm dọn dẹp các cache cũ
  const cleanupOldCaches = () => {
    try {
      // Lấy tất cả keys trong localStorage
      const keys = Object.keys(localStorage);
      
      // Lọc các key liên quan đến cache khóa học
      const courseCacheKeys = keys.filter(key => 
        key.startsWith('courses-') || key === 'my-courses'
      );
      
      // Nếu có quá nhiều cache (sử dụng hằng số MAX_CACHE_ITEMS)
      if (courseCacheKeys.length > MAX_CACHE_ITEMS) {
        // Tạo mảng các đối tượng cache với key và timestamp
        const cacheItems = [];
        
        for (const key of courseCacheKeys) {
          try {
            const item = JSON.parse(localStorage.getItem(key));
            if (item && item.timestamp) {
              cacheItems.push({ key, timestamp: item.timestamp });
            }
          } catch (e) {
            // Bỏ qua cache không hợp lệ
            localStorage.removeItem(key);
          }
        }
        
        // Sắp xếp theo thời gian, cũ nhất lên đầu
        cacheItems.sort((a, b) => a.timestamp - b.timestamp);
        
        // Xóa các cache cũ nhất, giữ lại số lượng cache theo MAX_CACHE_ITEMS
        for (let i = 0; i < cacheItems.length - MAX_CACHE_ITEMS; i++) {
          localStorage.removeItem(cacheItems[i].key);
        }
      }
    } catch (e) {
      // Bỏ qua lỗi khi dọn dẹp cache
    }
  };

  // Hàm lấy dữ liệu từ localStorage
  const getFromCache = () => {
    try {
      const cachedData = localStorage.getItem('my-courses');
      if (!cachedData) return null;
      
      const cacheItem = JSON.parse(cachedData);
      const now = Date.now();
      
      // Kiểm tra xem cache có còn hiệu lực không (12 giờ)
      if (now - cacheItem.timestamp > CACHE_DURATION) {
        localStorage.removeItem('my-courses');
        setCacheStatus('expired');
        return null;
      }
      
      setCacheStatus('hit');
      return cacheItem.data;
    } catch (error) {
      console.error('Lỗi khi đọc cache:', error);
      // Xóa cache lỗi
      try {
        localStorage.removeItem('my-courses');
        console.log('Đã xóa cache lỗi');
      } catch (e) {
        // Bỏ qua nếu không thể xóa
      }
      return null;
    }
  };

  // Hàm để tải danh sách khóa học đã đăng ký từ API
  const fetchEnrolledCourses = async () => {
    try {
      setLoading(true);
      setError(null);

      // Kiểm tra cache trước
      const cachedData = getFromCache();
      if (cachedData) {
        setEnrolledCourses(cachedData.enrolledCourses);
        setAllCourses(cachedData.allCourses);
        setLoading(false);
        return;
      }

      // Lấy danh sách khóa học đã đăng ký
      const enrollmentsResponse = await fetch('/api/enrollments');
      
      if (!enrollmentsResponse.ok) {
        if (enrollmentsResponse.status === 401) {
          setError('Bạn cần đăng nhập để xem khóa học đã đăng ký');
          router.push('/login');
          return;
        }
        
        const errorData = await enrollmentsResponse.json().catch(() => ({}));
        const errorMessage = errorData.error || `Lỗi ${enrollmentsResponse.status}: ${enrollmentsResponse.statusText}`;
        throw new Error(errorMessage);
      }
      
      const enrollmentsData = await enrollmentsResponse.json();
      if (!enrollmentsData.success || !enrollmentsData.data) {
        throw new Error('Không thể lấy được danh sách khóa học đã đăng ký');
      }
      
      const enrollments = enrollmentsData.data;
      setEnrolledCourses(enrollments);
      
      // Lấy thêm thông tin chi tiết của tất cả khóa học
      const coursesResponse = await fetch('/api/minicourses');
      if (coursesResponse.ok) {
        const coursesData = await coursesResponse.json();
        if (coursesData && coursesData.success && coursesData.data && Array.isArray(coursesData.data.minicourses)) {
          setAllCourses(coursesData.data.minicourses);
          
          // Lưu vào cache
          saveToCache({
            enrolledCourses: enrollments,
            allCourses: coursesData.data.minicourses
          });
        }
      }
    } catch (err) {
      setError(err.message || 'Đã xảy ra lỗi khi tải dữ liệu khóa học.');
    } finally {
      setLoading(false);
    }
  };

  // Hàm làm mới dữ liệu
  const handleRefresh = () => {
    setLoading(true);
    
    // Xóa cache khi làm mới để đảm bảo lấy dữ liệu mới
    try {
      localStorage.removeItem('my-courses');
      setCacheStatus('cleared');
      console.log('Đã xóa cache khóa học');
    } catch (error) {
      console.error('Lỗi khi xóa cache:', error);
    }
    
    // Chờ 300ms để hiển thị trạng thái loading trước khi fetch
    setTimeout(() => {
      fetchEnrolledCourses();
    }, 300);
  };

  useEffect(() => {
    // Kiểm tra xem có dữ liệu trong cache không trước khi fetch
    const cachedData = getFromCache();
    if (cachedData) {
      setEnrolledCourses(cachedData.enrolledCourses);
      setAllCourses(cachedData.allCourses);
      setLoading(false);
      console.log('Đã tải dữ liệu khóa học từ cache');
    } else {
      fetchEnrolledCourses();
    }
  }, []);

  // Tạo ngẫu nhiên đánh giá cho khóa học
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

  // Hàm tìm thông tin chi tiết khóa học
  const findCourseDetails = (enrolledCourse) => {
    const courseId = enrolledCourse.courseId;
    return allCourses.find(course => 
      course._id === courseId || course.courseId === courseId
    );
  };

  // Lấy các khóa học đã đăng ký với thông tin chi tiết
  const getEnrolledCoursesWithDetails = () => {
    if (!enrolledCourses.length) return [];
    
    return enrolledCourses.map(enrollment => {
      const courseDetails = findCourseDetails(enrollment);
      return {
        ...enrollment,
        details: courseDetails || null
      };
    });
  };

  const enrolledCoursesWithDetails = getEnrolledCoursesWithDetails();

  return (
    <main className="relative bg-gradient-to-b from-gray-50 to-white min-h-screen w-full overflow-hidden">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/10 bg-[size:20px_20px] opacity-10"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 relative z-10">
          <div className="text-center md:text-left md:flex md:items-center md:justify-between">
            <div className="mb-8 md:mb-0 md:max-w-2xl">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-4 tracking-tight">
                <span className="text-yellow-300">Khóa học</span> của tôi
              </h1>
              <p className="text-indigo-100 text-lg md:text-xl max-w-2xl mx-auto md:mx-0">
                Danh sách các khóa học bạn đã đăng ký. Tiếp tục học tập và nâng cao kỹ năng của bạn!
              </p>
            </div>
            <div className="hidden lg:block relative w-64 h-64">
              <div className="absolute inset-0 bg-white bg-opacity-20 rounded-full animate-pulse"></div>
              <div className="absolute inset-4 bg-white bg-opacity-30 rounded-full flex items-center justify-center">
                <AcademicCapIcon className="h-24 w-24 text-white" />
              </div>
            </div>
          </div>

          {/* Các con số thống kê */}
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-white bg-opacity-10 rounded-lg p-4">
              <div className="text-2xl md:text-3xl font-bold text-white">{enrolledCourses.length}</div>
              <div className="text-indigo-100 text-sm">Khóa học đã đăng ký</div>
            </div>
            <div className="bg-white bg-opacity-10 rounded-lg p-4">
              <div className="text-2xl md:text-3xl font-bold text-white">
                {enrolledCoursesWithDetails.filter(course => course.details?.completed).length}
              </div>
              <div className="text-indigo-100 text-sm">Khóa học đã hoàn thành</div>
            </div>
            <div className="bg-white bg-opacity-10 rounded-lg p-4">
              <div className="text-2xl md:text-3xl font-bold text-white">
                {enrolledCoursesWithDetails.filter(course => !course.details?.completed).length}
              </div>
              <div className="text-indigo-100 text-sm">Khóa học đang học</div>
            </div>
            <div className="bg-white bg-opacity-10 rounded-lg p-4">
              <div className="text-2xl md:text-3xl font-bold text-white">4.8</div>
              <div className="text-indigo-100 text-sm">Đánh giá trung bình</div>
            </div>
          </div>
        </div>
      </div>

      {/* Danh sách khóa học */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Tiêu đề danh sách khóa học */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 px-2 md:px-0">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center mb-3 md:mb-0">
            <AcademicCapIcon className="h-7 w-7 mr-2 text-indigo-600" />
            Khóa học đã đăng ký
          </h2>
          <div className="flex items-center">
            <button
              onClick={handleRefresh}
              className="flex items-center px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
              title="Làm mới dữ liệu"
              disabled={loading}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className={`h-5 w-5 mr-1 ${loading ? 'animate-spin' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loading ? 'Đang tải...' : 'Làm mới'}
            </button>
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
                <div className="mt-3">
                  <button
                    onClick={handleRefresh}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="-ml-0.5 mr-1.5 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Thử lại
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600 mb-5"></div>
            <p className="text-gray-500 text-lg font-medium">Đang tải danh sách khóa học...</p>
            {cacheStatus === 'hit' && (
              <p className="text-xs text-green-600 mt-2">Đang tải từ bộ nhớ đệm...</p>
            )}
          </div>
        ) : (
          <div className="overflow-visible">
            {enrolledCoursesWithDetails.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {enrolledCoursesWithDetails.map((course, index) => {
                  const rating = getRandomRating();
                  const level = getRandomLevel();
                  const students = getRandomStudentCount();
                  const lessons = getRandomLessonCount();
                  const courseDetails = course.details || {};
                  
                  return (
                    <div 
                      key={course.courseId || index} 
                      className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col h-full group cursor-pointer"
                      onClick={() => router.push(`/courses/${course.courseId}`)}
                    >
                      <div className="h-40 bg-gradient-to-r from-indigo-600 to-purple-700 relative overflow-hidden">
                        {/* Background pattern */}
                        <div className="absolute inset-0 bg-grid-white/10 bg-[size:20px_20px] opacity-20"></div>
                        
                        {/* Course level badge */}
                        <div className="absolute top-3 right-3 px-3 py-1 bg-black bg-opacity-30 backdrop-blur-sm text-white text-xs rounded-full font-medium">
                          {level}
                        </div>
                        
                        {/* Course icon */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="h-20 w-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                            <AcademicCapIcon className="h-10 w-10 text-white" />
                          </div>
                        </div>
                        
                        {/* Enrolled badge */}
                        <div className="absolute top-3 left-3 px-3 py-1 bg-green-500 bg-opacity-90 backdrop-blur-sm text-white text-xs rounded-full font-medium flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Đã đăng ký
                        </div>
                        
                        {/* Gradient overlay at bottom */}
                        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-indigo-900 to-transparent opacity-70"></div>
                      </div>
                      
                      <div className="p-5 flex-grow">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-1">
                            {renderStars(rating)}
                            <span className="text-xs text-gray-500 ml-1">({rating.toFixed(1)})</span>
                          </div>
                          <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                            {courseDetails.category || 'Khóa học'}
                          </span>
                        </div>
                        
                        <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors line-clamp-2">
                          {courseDetails.name || `Khóa học #${index + 1}`}
                        </h3>
                        
                        <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                          {courseDetails.description || 'Khóa học chất lượng cao được thiết kế bởi các chuyên gia hàng đầu.'}
                        </p>
                        
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="flex items-center text-xs text-gray-500">
                            <UserCircleIcon className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                            <span>{students.toLocaleString()} học viên</span>
                          </div>
                          <div className="flex items-center text-xs text-gray-500">
                            <DocumentTextIcon className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                            <span>{lessons} bài học</span>
                          </div>
                          <div className="flex items-center text-xs text-gray-500">
                            <ClockIcon className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                            <span>{Math.round(lessons * 0.4)} giờ học</span>
                          </div>
                          <div className="flex items-center text-xs text-gray-500">
                            <FireIcon className="h-3.5 w-3.5 mr-1.5 text-orange-400" />
                            <span>Đã học {Math.floor(Math.random() * 100)}%</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="border-t border-gray-100 p-5 flex items-center justify-between bg-gray-50">
                        <div className="font-medium text-gray-600 text-sm">
                          Đăng ký: {new Date(course.enrollmentDate || Date.now()).toLocaleDateString('vi-VN')}
                        </div>
                        
                        <button className="inline-flex items-center justify-center px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors group-hover:bg-indigo-700">
                          <span>Tiếp tục học</span>
                          <ArrowRightIcon className="ml-1.5 h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-200 shadow-sm">
                <AcademicCapIcon className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">
                  Bạn chưa đăng ký khóa học nào
                </h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  Bạn chưa đăng ký khóa học nào. Hãy khám phá và đăng ký các khóa học để bắt đầu hành trình học tập của bạn.
                </p>
                <button
                  onClick={() => router.push('/khoa-hoc')}
                  className="inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-lg shadow-md text-base font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800"
                >
                  <AcademicCapIcon className="h-5 w-5 mr-2" />
                  Xem tất cả khóa học
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-50 border-t border-gray-100 py-6 mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Khoá học 6.0. Tất cả các quyền được bảo lưu.
          </p>
        </div>
      </div>
    </main>
  );
} 