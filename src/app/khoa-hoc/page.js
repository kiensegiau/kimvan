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
      name: 'Nguyễn Minh Tuấn',
      role: 'Học sinh lớp 12',
      content: 'Khóa học Toán nâng cao đã giúp em hiểu sâu hơn về các khái niệm phức tạp. Thầy cô rất tận tâm và luôn sẵn sàng giải đáp mọi thắc mắc. Nhờ khóa học này mà em đã cải thiện đáng kể điểm số của mình.',
      rating: 5
    },
    {
      id: 2,
      name: 'Trần Thị Hương',
      role: 'Học sinh lớp 11',
      content: 'Em đã tham gia khóa học Hóa học và thấy rất bổ ích. Các bài giảng rất dễ hiểu với nhiều ví dụ thực tế. Đặc biệt là phần bài tập và đề thi thử giúp em rất nhiều trong việc ôn tập.',
      rating: 5
    },
    {
      id: 3,
      name: 'Phạm Đức Anh',
      role: 'Học sinh lớp 12',
      content: 'Các bài giảng Vật lý rõ ràng, dễ hiểu và có nhiều bài tập thực hành. Em đã học được rất nhiều kiến thức mới từ khóa học này. Đặc biệt là phần thực hành giúp em nắm vững kiến thức ngay lập tức.',
      rating: 4.5
    },
    {
      id: 4,
      name: 'Lê Thanh Hà',
      role: 'Học sinh lớp 10',
      content: 'Khóa học Ngữ văn đã mở ra cho em nhiều góc nhìn mới về các tác phẩm văn học. Tài liệu học tập phong phú, bài tập thực tế và feedback chi tiết từ giáo viên. Đây là một trong những khóa học chất lượng nhất mà em từng tham gia.',
      rating: 5
    },
    {
      id: 5,
      name: 'Vũ Hoàng Nam',
      role: 'Học sinh lớp 12',
      content: 'Em đã tham gia khóa học Tiếng Anh và thấy rất hữu ích. Các bài học tình huống thực tế giúp em tự tin hơn trong giao tiếp. Kiến thức học được đã giúp em đạt điểm cao trong kỳ thi học kỳ vừa qua.',
      rating: 4.5
    },
    {
      id: 6,
      name: 'Đặng Thị Minh Ngọc',
      role: 'Học sinh lớp 11',
      content: 'Khóa học Sinh học của trang web này đã giúp em nắm vững các khái niệm phức tạp. Em đặc biệt ấn tượng với phần thực hành và các mô hình 3D được giới thiệu trong khóa học.',
      rating: 4
    },
    {
      id: 7,
      name: 'Hoàng Văn Bình',
      role: 'Học sinh lớp 10',
      content: 'Em đã hoàn thành khóa học Tin học và rất hài lòng với chất lượng. Từ một người mới bắt đầu, giờ đây em đã có thể tự tin lập trình các ứng dụng đơn giản. Cảm ơn các thầy cô đã tận tâm giảng dạy!',
      rating: 5
    },
    {
      id: 8,
      name: 'Ngô Thị Thu Trang',
      role: 'Học sinh lớp 11',
      content: 'Khóa học Địa lý rất thú vị với nhiều hình ảnh và video. Nội dung được trình bày dễ hiểu, phù hợp với chương trình học tại trường. Em rất vui vì được học thêm nhiều kiến thức mới về thế giới.',
      rating: 4.5
    },
    {
      id: 9,
      name: 'Bùi Quang Hiếu',
      role: 'Học sinh lớp 12',
      content: 'Khóa học Luyện thi đại học đã giúp em chuẩn bị tốt cho kỳ thi sắp tới. Các thủ thuật và phương pháp được giảng dạy rất thực tế, giúp em tiết kiệm được rất nhiều thời gian ôn tập.',
      rating: 4
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
      
   

      {/* Danh mục */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
       

        {/* Tiêu đề danh sách khóa học */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 px-2 md:px-0">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center mb-3 md:mb-0">
            <AcademicCapIcon className="h-7 w-7 mr-2 text-indigo-600" />
            Danh sách khóa học
          </h2>
          <div className="flex items-center bg-gray-100 rounded-lg px-4 py-2 overflow-x-auto whitespace-nowrap">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCourses.map((course, index) => {
                  const rating = getRandomRating();
                  const level = getRandomLevel();
                  const students = getRandomStudentCount();
                  
                  return (
                    <div 
                      key={course._id} 
                      className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-all duration-200 flex flex-col h-full"
                      onClick={() => router.push(`/khoa-hoc/${course._id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="h-16 bg-gradient-to-r from-indigo-600 to-purple-700 relative">
                        <div className="absolute -bottom-5 left-4 w-10 h-10 bg-white rounded-md shadow flex items-center justify-center">
                          <AcademicCapIcon className="h-6 w-6 text-indigo-600" />
                        </div>
                        <div className="absolute top-0 right-0 px-2 py-1 bg-indigo-800 bg-opacity-50 text-white text-xs">
                          {level}
                        </div>
                      </div>
                      
                      <div className="p-4 pt-6 flex-grow">
                        <h3 className="text-base font-medium text-gray-900 mb-3">{course.name}</h3>
                        <div className="flex items-center text-xs text-gray-500 mb-1">
                          <UserCircleIcon className="h-3 w-3 mr-1 text-gray-400" />
                          <span>{students.toLocaleString()} học viên</span>
                        </div>
                      </div>
                      
                      <div className="border-t border-gray-100 p-3 bg-gray-50 flex items-center justify-between">
                        <div className="flex items-center">
                          <StarIcon className="h-4 w-4 text-yellow-400" />
                          <span className="ml-1 text-xs font-medium text-gray-600">{rating.toFixed(1)}</span>
                        </div>
                        <div className="font-medium text-indigo-600 text-sm">
                          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(course.price)}
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
      <div className="bg-gradient-to-b from-white to-indigo-50 py-10 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 md:mb-4">Đánh giá từ học viên</h2>
            <p className="text-base md:text-lg text-gray-600 max-w-3xl mx-auto">
              Hàng ngàn học viên đã cải thiện kỹ năng và phát triển sự nghiệp thông qua các khóa học của chúng tôi
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {testimonials.map((testimonial) => (
              <div key={testimonial.id} className="bg-white p-5 rounded-xl shadow-md border border-gray-100 hover:shadow-lg transition-all duration-300 flex flex-col h-full">
                <div className="flex mb-3">
                  {renderStars(testimonial.rating)}
                  <span className="ml-2 text-xs text-gray-500">({testimonial.rating.toFixed(1)})</span>
                </div>
                <p className="text-gray-700 italic mb-4 text-sm flex-grow">{testimonial.content}</p>
                <div className="flex items-center pt-3 border-t border-gray-100">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
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
          
          <div className="mt-8 text-center">
            <button className="inline-flex items-center px-5 py-2 border border-indigo-500 rounded-md text-sm font-medium text-indigo-600 bg-white hover:bg-indigo-50 transition-colors duration-200">
              Xem thêm đánh giá
            </button>
          </div>
        </div>
      </div>
            
      {/* Phần khuyến mãi */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 py-12 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:flex lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white sm:text-4xl mb-2">
                Sẵn sàng nâng cao kỹ năng?
              </h2>
              <p className="mt-3 text-base md:text-lg text-indigo-100 mb-6 lg:mb-0">
                Đăng ký ngay hôm nay và nhận ưu đãi giảm <span className="font-bold text-yellow-300">20%</span> cho tất cả các khóa học
                trong tháng này.
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
          <p>© 2023 Trang Khóa Học. Thiết kế bởi Kimvan.</p>
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