'use client';

import { useState, useEffect, useRef } from 'react';
import { ExclamationCircleIcon, MagnifyingGlassIcon, AcademicCapIcon, CheckCircleIcon, UserCircleIcon, ArrowRightIcon, ClockIcon, DocumentTextIcon, FunnelIcon, ChevronDownIcon, PlusIcon } from '@heroicons/react/24/outline';
import { StarIcon, FireIcon } from '@heroicons/react/24/solid';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

// Thời gian cache - Có thể điều chỉnh dễ dàng
const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 giờ 
const MAX_CACHE_ITEMS = 5; // Giữ tối đa 5 cache items

export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isInView, setIsInView] = useState(false);
  const statsRef = useRef(null);
  const [cacheStatus, setCacheStatus] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [enrolledOnly, setEnrolledOnly] = useState(false); // Mặc định hiển thị tất cả khóa học
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [canViewAllCourses, setCanViewAllCourses] = useState(false); // Quyền xem tất cả khóa học
  const [viewAllMode, setViewAllMode] = useState(false); // Công tắc bật/tắt chế độ xem tất cả
  
  // Thêm các state mới cho bộ lọc
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [priceRange, setPriceRange] = useState([0, 10000000]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Xử lý logic tìm kiếm khi nhấn nút
  const handleSearch = () => {
    setSearchTerm(searchQuery);
  };
  
  // Xử lý logic tìm kiếm khi nhấn Enter
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      setSearchTerm(searchQuery);
    }
  };
  
  // Xử lý reset bộ lọc
  const resetFilters = () => {
    setSelectedCategory('all');
    setSelectedLevel('all');
    setSortBy('newest');
    setPriceRange([0, 10000000]);
    setSearchQuery('');
    setSearchTerm('');
  };

  // Hàm lưu dữ liệu vào localStorage với quản lý cache
  const saveToCache = (data) => {
    try {
      // Tạo đối tượng cache với dữ liệu và thời gian
      const cacheItem = {
        data: data,
        timestamp: Date.now()
      };
      
      // Lưu dữ liệu khóa học vào cache
      localStorage.setItem('courses-list', JSON.stringify(cacheItem));
      
      // Dọn dẹp cache cũ
      cleanupOldCaches();
      
      setCacheStatus('saved');
    } catch (error) {
      console.error('Lỗi khi lưu cache:', error);
      // Thử xóa cache và lưu lại
      try {
        localStorage.removeItem('courses-list');
        localStorage.setItem('courses-list', JSON.stringify({
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
        key.startsWith('courses-') || key === 'courses-list'
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
      const cachedData = localStorage.getItem('courses-list');
      if (!cachedData) return null;
      
      const cacheItem = JSON.parse(cachedData);
      const now = Date.now();
      
      // Kiểm tra xem cache có còn hiệu lực không (12 giờ)
      if (now - cacheItem.timestamp > CACHE_DURATION) {
        localStorage.removeItem('courses-list');
        setCacheStatus('expired');
        return null;
      }
      
      setCacheStatus('hit');
      return cacheItem.data;
          } catch (error) {
      console.error('Lỗi khi đọc cache:', error);
      // Xóa cache lỗi
      try {
        localStorage.removeItem('courses-list');
        console.log('Đã xóa cache lỗi');
      } catch (e) {
        // Bỏ qua nếu không thể xóa
      }
      return null;
    }
  };

  // Hàm kiểm tra quyền xem tất cả khóa học
  const checkViewAllPermission = async () => {
    try {
      const response = await fetch('/api/users/me');
      if (response.ok) {
        const userData = await response.json();
        if (userData && userData.user) {
          setCanViewAllCourses(!!userData.user.canViewAllCourses);
          return !!userData.user.canViewAllCourses;
        }
      }
      return false;
    } catch (error) {
      console.error('Lỗi khi kiểm tra quyền xem tất cả khóa học:', error);
      return false;
    }
  };

  // Hàm để tải danh sách khóa học từ API
  const fetchCourses = async () => {
    try {
      setLoading(true);
      setError(null); // Reset error trước khi fetch
      
      // Kiểm tra quyền xem tất cả khóa học
      const hasViewAllPermission = await checkViewAllPermission();
      
      // Trước tiên lấy danh sách khóa học đã đăng ký
      try {
        const enrollmentsResponse = await fetch('/api/enrollments');
        
        if (enrollmentsResponse.ok) {
          const enrollmentsData = await enrollmentsResponse.json();
          if (enrollmentsData.success && enrollmentsData.data) {
            setEnrolledCourses(enrollmentsData.data);
          }
        } else if (enrollmentsResponse.status === 401) {
          // Người dùng chưa đăng nhập
          setError('Bạn cần đăng nhập để xem khóa học đã đăng ký');
          setLoading(false);
          return;
        }
      } catch (enrollError) {
        console.error('Lỗi khi lấy khóa học đã đăng ký:', enrollError);
      }
      
      // Tránh kiểm tra cache ở đây vì đã kiểm tra trong useEffect 
      // để tránh việc fetch lại API không cần thiết
      
      // Nếu không có cache hoặc cache hết hạn, fetch từ API
      const response = await fetch('/api/minicourses');
      
      if (!response.ok) {
        // Xử lý trường hợp lỗi 401 (chưa đăng nhập)
        if (response.status === 401) {
          setError('Bạn cần đăng nhập để xem danh sách khóa học');
          setCourses([]);
          setLoading(false);
          return;
        }
        
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Lỗi ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      // Kiểm tra cấu trúc dữ liệu trả về từ API mới
      if (data && data.success && data.data && Array.isArray(data.data.minicourses)) {
        setCourses(data.data.minicourses);
        // Lưu vào cache
        saveToCache(data.data.minicourses);
      } else {
        // Xử lý trường hợp dữ liệu không đúng định dạng
        setCourses([]);
      }
    } catch (err) {
      setError(err.message || 'Đã xảy ra lỗi khi tải dữ liệu khóa học.');
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  // Thử lại khi gặp lỗi
  const handleRetry = () => {
    setLoading(true);
    
    // Xóa cache khi thử lại để đảm bảo lấy dữ liệu mới
    try {
      localStorage.removeItem('courses-list');
      setCacheStatus('cleared');
      console.log('Đã xóa cache khóa học');
    } catch (error) {
      console.error('Lỗi khi xóa cache:', error);
    }
    
    // Chờ 300ms để hiển thị trạng thái loading trước khi fetch
    setTimeout(() => {
      fetchCourses();
    }, 300);
  };

  useEffect(() => {
    // Kiểm tra xem có dữ liệu trong cache không trước khi fetch
    const cachedData = getFromCache();
    if (cachedData) {
      setCourses(cachedData);
      setLoading(false);
      console.log('Đã tải dữ liệu khóa học từ cache');
    } else {
      fetchCourses();
    }
    
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
    
    // Hàm dọn dẹp tự động chạy khi component bị hủy
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

  // Các danh mục Level
  const courseLevels = ['Cơ bản', 'Trung cấp', 'Nâng cao', 'Chuyên sâu'];
  
  // Các lựa chọn sắp xếp
  const sortOptions = [
    { id: 'newest', label: 'Mới nhất' },
    { id: 'popular', label: 'Phổ biến nhất' },
    { id: 'rating', label: 'Đánh giá cao' },
    { id: 'price_asc', label: 'Giá thấp đến cao' },
    { id: 'price_desc', label: 'Giá cao đến thấp' }
  ];

  // Hàm lọc và sắp xếp khóa học
  const getFilteredCourses = () => {
    // Tạo bản sao để tránh thay đổi trực tiếp mảng gốc
    let result = [...courses];
    
    // Thêm thông tin để debug
    console.log(`Đang lọc ${courses.length} khóa học`);
    
    // Lọc các khóa học đã đăng ký nếu chế độ chỉ hiển thị khóa học đã đăng ký được bật
    if (enrolledOnly && enrolledCourses.length > 0) {
      const enrolledCourseIds = enrolledCourses.map(enrollment => enrollment.courseId);
      result = result.filter(course => 
        enrolledCourseIds.includes(course._id) || 
        enrolledCourseIds.includes(course.courseId)
      );
      console.log(`Sau khi lọc theo đăng ký: ${result.length} khóa học`);
    }
    
    // Lọc theo từ khóa tìm kiếm - tối ưu để không phải lọc nếu không có từ khóa
    if (searchTerm && searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(course => 
        (course.name?.toLowerCase().includes(term) ||
        course.description?.toLowerCase().includes(term))
      );
      console.log(`Sau khi lọc theo từ khóa "${term}": ${result.length} khóa học`);
    }
    
    // Lọc theo danh mục
    if (selectedCategory !== 'all') {
      result = result.filter(course => course.category === selectedCategory);
    }
    
    // Lọc theo cấp độ
    if (selectedLevel !== 'all') {
      result = result.filter(course => {
        // Giả sử cấp độ được lưu trong thuộc tính level của khóa học
        // Nếu không có, chúng ta sẽ không lọc theo cấp độ
        return course.level === selectedLevel;
      });
    }
    
    // Lọc theo khoảng giá
    result = result.filter(course => {
      const price = course.price || 0;
      return price >= priceRange[0] && price <= priceRange[1];
    });
    
    // Sắp xếp khóa học
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        break;
      case 'popular':
        result.sort((a, b) => (b.enrollmentCount || 0) - (a.enrollmentCount || 0));
        break;
      case 'rating':
        result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'price_asc':
        result.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'price_desc':
        result.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      default:
        break;
    }
    
    return result;
  };

  const filteredCourses = getFilteredCourses();

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
    <main className="relative bg-gradient-to-b from-gray-50 to-white min-h-screen w-full overflow-hidden">
      
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/10 bg-[size:20px_20px] opacity-10"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 relative z-10">
          <div className="text-center md:text-left md:flex md:items-center md:justify-between">
            <div className="mb-8 md:mb-0 md:max-w-2xl">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-4 tracking-tight">
                <span className="text-yellow-300">
                  {enrolledOnly ? "Khóa học" : "Tất cả khóa học"}
                </span>
                {enrolledOnly ? " đã đăng ký" : " có sẵn"}
              </h1>
              <p className="text-indigo-100 text-lg md:text-xl max-w-2xl mx-auto md:mx-0">
                {enrolledOnly 
                  ? "Danh sách các khóa học bạn đã đăng ký. Tiếp tục học tập và nâng cao kỹ năng của bạn!"
                  : "Khám phá và đăng ký các khóa học chất lượng cao để nâng cao kiến thức và kỹ năng của bạn."
                }
              </p>
            </div>
            <div className="hidden lg:block relative w-64 h-64">
              <div className="absolute inset-0 bg-white bg-opacity-20 rounded-full animate-pulse"></div>
              <div className="absolute inset-4 bg-white bg-opacity-30 rounded-full flex items-center justify-center">
                <AcademicCapIcon className="h-24 w-24 text-white" />
              </div>
            </div>
          </div>

          {/* Thanh tìm kiếm */}
          <div className="mt-8 md:mt-12 relative max-w-3xl mx-auto">
            <div className="bg-white shadow-lg rounded-xl overflow-hidden p-1 flex flex-col sm:flex-row">
              <div className="flex-grow flex items-center px-4 py-3">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 mr-3" />
                <input
                  type="text"
                  placeholder="Tìm kiếm khóa học..."
                  className="flex-grow focus:outline-none text-gray-600"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                />
              </div>
              
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center px-4 py-3 text-indigo-700 hover:bg-indigo-50 rounded-lg sm:border-l sm:border-gray-200 transition-colors duration-150"
              >
                <FunnelIcon className="h-5 w-5 mr-2" />
                <span className="text-sm font-medium">Bộ lọc</span>
                <ChevronDownIcon className={`h-4 w-4 ml-1 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
              </button>
              
              <button 
                onClick={handleSearch}
                className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-6 py-3 rounded-lg font-medium hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200 shadow-md"
              >
                Tìm kiếm
              </button>
            </div>
            
            {/* Bộ lọc mở rộng */}
            {showFilters && (
              <div className="absolute z-30 mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-100 p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Danh mục</label>
                  <select 
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <option value="all">Tất cả danh mục</option>
                    <option value="programming">Tin học</option>
                    <option value="language">Ngoại ngữ</option>
                    <option value="softskill">Kỹ năng mềm</option>
                    <option value="science">Khoa học tự nhiên</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cấp độ</label>
                  <select 
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={selectedLevel}
                    onChange={(e) => setSelectedLevel(e.target.value)}
                  >
                    <option value="all">Tất cả cấp độ</option>
                    <option value="Cơ bản">Cơ bản</option>
                    <option value="Trung cấp">Trung cấp</option>
                    <option value="Nâng cao">Nâng cao</option>
                    <option value="Chuyên sâu">Chuyên sâu</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sắp xếp theo</label>
                  <select 
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    {sortOptions.map(option => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </div>
                
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Khoảng giá (VNĐ)</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <input
                        type="number" 
                        min="0"
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        placeholder="Từ"
                        value={priceRange[0]}
                        onChange={(e) => setPriceRange([parseInt(e.target.value) || 0, priceRange[1]])}
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        min="0"
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        placeholder="Đến"
                        value={priceRange[1]}
                        onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value) || 10000000])}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="md:col-span-3 flex justify-between mt-4">
                  <button 
                    onClick={resetFilters}
                    className="text-gray-600 text-sm font-medium hover:text-indigo-600 flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Đặt lại bộ lọc
                  </button>
                  <button 
                    onClick={() => {
                      handleSearch();
                      setShowFilters(false);
                    }}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
                  >
                    Áp dụng bộ lọc
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Các con số thống kê */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-white bg-opacity-10 rounded-lg p-4">
              <div className="text-2xl md:text-3xl font-bold text-white">{enrolledCourses.length}</div>
              <div className="text-indigo-100 text-sm">Khóa học đã đăng ký</div>
            </div>
            <div className="bg-white bg-opacity-10 rounded-lg p-4">
              <div className="text-2xl md:text-3xl font-bold text-white">{courses.length}</div>
              <div className="text-indigo-100 text-sm">Tổng số khóa học</div>
            </div>
            <div className="bg-white bg-opacity-10 rounded-lg p-4">
              <div className="text-2xl md:text-3xl font-bold text-white">
                {filteredCourses.length}
              </div>
              <div className="text-indigo-100 text-sm">
                Khóa học hiển thị
              </div>
            </div>
            <div className="bg-white bg-opacity-10 rounded-lg p-4">
              <div className="text-2xl md:text-3xl font-bold text-white">4.8</div>
              <div className="text-indigo-100 text-sm">Đánh giá trung bình</div>
            </div>
          </div>
        </div>
      </div>

      {/* Danh mục */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Tabs danh mục */}
        <div className="mb-8 overflow-x-auto no-scrollbar">
          <div className="flex space-x-2 md:space-x-4 min-w-max">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  selectedCategory === category.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <category.icon className={`h-5 w-5 ${selectedCategory === category.id ? 'text-white' : 'text-indigo-600'} mr-2`} />
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Tiêu đề danh sách khóa học */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 px-2 md:px-0">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center mb-3 md:mb-0">
            <AcademicCapIcon className="h-7 w-7 mr-2 text-indigo-600" />
            {searchTerm 
              ? `Kết quả tìm kiếm "${searchTerm}"` 
              : enrolledOnly 
                ? 'Khóa học đã đăng ký' 
                : 'Tất cả khóa học'
            }
          </h2>
          <div className="flex items-center gap-2">
            <div className="bg-gray-100 rounded-lg p-1 flex items-center">
              <button
                onClick={() => setEnrolledOnly(true)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  enrolledOnly 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                Đã đăng ký
              </button>
              <button
                onClick={() => setEnrolledOnly(false)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  !enrolledOnly 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                Tất cả
              </button>
            </div>
            <button
              onClick={handleRetry}
              className="flex items-center px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
              title="Làm mới dữ liệu"
              disabled={loading}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className={`h-5 w-5 mr-1 ${loading && cacheStatus === 'cleared' ? 'animate-spin' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loading && cacheStatus === 'cleared' ? 'Đang tải...' : 'Làm mới'}
            </button>
            <div className="flex items-center bg-gray-100 rounded-lg px-4 py-2 overflow-x-auto whitespace-nowrap">
              <span className="text-sm font-medium text-gray-800 mr-2">Sắp xếp:</span>
              <select 
                className="bg-transparent text-sm text-gray-700 focus:outline-none border-none"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                {sortOptions.map(option => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
              <div className="ml-4 pl-4 border-l border-gray-300">
                <span className="text-sm font-medium text-gray-800">{filteredCourses.length} khóa học</span>
                {selectedCategory !== 'all' && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                    {categories.find(c => c.id === selectedCategory)?.name}
                    <button 
                      onClick={() => setSelectedCategory('all')} 
                      className="ml-1 text-indigo-600 hover:text-indigo-800"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
              </div>
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
                <div className="mt-3">
                  <button
                    onClick={handleRetry}
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
          <p className="text-gray-500 text-lg font-medium">Đang tải dữ liệu khóa học...</p>
          {cacheStatus === 'hit' && (
            <p className="text-xs text-green-600 mt-2">Đang tải từ bộ nhớ đệm...</p>
          )}
        </div>
        ) : (
        <div className="overflow-visible">
            {filteredCourses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCourses.map((course, index) => {
                const rating = getRandomRating();
                const level = getRandomLevel();
                const students = getRandomStudentCount();
                const lessons = getRandomLessonCount();
                
                // Kiểm tra xem khóa học đã đăng ký chưa
                const isEnrolled = enrolledCourses.some(enrollment => 
                  enrollment.courseId === course._id || enrollment.courseId === course.courseId
                );
                
                return (
                  <div 
                    key={course._id} 
                    className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col h-full group cursor-pointer"
                    onClick={() => router.push(`/khoa-hoc/${course.kimvanId || course._id}`)}
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
                      {isEnrolled && (
                        <div className="absolute top-3 left-3 px-3 py-1 bg-green-500 bg-opacity-90 backdrop-blur-sm text-white text-xs rounded-full font-medium flex items-center">
                          <CheckCircleIcon className="h-3 w-3 mr-1" />
                          Đã đăng ký
                        </div>
                      )}
                      
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
                          {course.category || 'Khóa học'}
                        </span>
                      </div>
                      
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors line-clamp-2">
                        {course.name}
                      </h3>
                      
                      <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                        {course.description || 'Khóa học chất lượng cao được thiết kế bởi các chuyên gia hàng đầu.'}
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
                          <span>Mới cập nhật</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-200 shadow-sm">
              <MagnifyingGlassIcon className="mx-auto h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                {searchTerm 
                  ? `Không tìm thấy khóa học nào cho "${searchTerm}"` 
                  : enrolledOnly
                    ? 'Bạn chưa đăng ký khóa học nào'
                    : 'Không tìm thấy khóa học nào'
                }
              </h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                {searchTerm
                  ? `Không tìm thấy khóa học phù hợp với tiêu chí tìm kiếm của bạn. Hãy thử tìm kiếm với từ khóa khác hoặc điều chỉnh bộ lọc.`
                  : enrolledOnly
                    ? 'Bạn chưa đăng ký khóa học nào. Hãy khám phá và đăng ký các khóa học để bắt đầu hành trình học tập của bạn.'
                    : 'Không tìm thấy khóa học nào. Vui lòng thử lại sau hoặc liên hệ với quản trị viên.'
                }
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                {(searchTerm || selectedCategory !== 'all' || selectedLevel !== 'all') && (
                  <button
                    onClick={resetFilters}
                    className="inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-lg shadow-md text-base font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Xóa bộ lọc
                  </button>
                )}
                {enrolledOnly && (
                  <button
                    onClick={() => setEnrolledOnly(false)}
                    className="inline-flex items-center justify-center px-6 py-3 border border-indigo-600 rounded-lg text-base font-medium text-indigo-700 bg-white hover:bg-indigo-50"
                  >
                    <AcademicCapIcon className="h-5 w-5 mr-2" />
                    Xem tất cả khóa học
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>

    {/* Testimonials */}
  <div className="bg-gradient-to-b from-white to-indigo-50 py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-12 md:mb-16">
        <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 text-sm font-medium rounded-full mb-3">
          Phản hồi từ học viên
        </span>
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
          Học viên nói gì về chúng tôi?
        </h2>
          <p className="text-base md:text-lg text-gray-600 max-w-3xl mx-auto">
          Hàng ngàn học viên đã cải thiện kỹ năng và phát triển sự nghiệp thông qua các khóa học chất lượng cao của chúng tôi
          </p>
        </div>
      
      <div className="relative">
        {/* Decorative elements */}
        <div className="hidden md:block absolute -top-10 -left-8 w-20 h-20 bg-yellow-100 rounded-full opacity-20"></div>
        <div className="hidden md:block absolute -bottom-10 -right-8 w-32 h-32 bg-indigo-100 rounded-full opacity-40"></div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {testimonials.slice(0, 6).map((testimonial) => (
            <div 
              key={testimonial.id} 
              className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 hover:shadow-lg transition-all duration-300 flex flex-col h-full relative"
            >
              {/* Quote icon */}
              <div className="absolute -top-3 -left-3 w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z"></path>
                </svg>
              </div>
              
              <div className="flex mb-3">
                {renderStars(testimonial.rating)}
                <span className="ml-2 text-xs text-gray-500">({testimonial.rating.toFixed(1)})</span>
              </div>
              
              <p className="text-gray-700 mb-5 text-sm italic flex-grow line-clamp-4">"{testimonial.content}"</p>
              
              <div className="flex items-center pt-4 border-t border-gray-100">
                <div className="h-12 w-12 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                  {testimonial.name.charAt(0)}
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-semibold text-gray-900">{testimonial.name}</h4>
                  <p className="text-xs text-gray-600">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-12 text-center">
          <button className="inline-flex items-center px-6 py-3 border border-indigo-600 rounded-lg text-base font-medium text-indigo-600 bg-white hover:bg-indigo-50 transition-colors duration-200 shadow-sm">
            Xem thêm đánh giá
            <ArrowRightIcon className="ml-2 h-5 w-5" />
          </button>
        </div>
        </div>
      </div>
    </div>
          
    {/* Phần khuyến mãi */}
  <div className="bg-gradient-to-r from-indigo-600 to-purple-700 py-16 md:py-24 relative overflow-hidden">
    {/* Tạo mẫu nền */}
    <div className="absolute inset-0 bg-grid-white/10 bg-[size:20px_20px] opacity-10"></div>
    
    {/* Các hình trang trí */}
    <div className="hidden md:block absolute top-10 left-10 w-32 h-32 bg-white bg-opacity-10 rounded-full blur-2xl"></div>
    <div className="hidden md:block absolute bottom-10 right-10 w-40 h-40 bg-purple-300 bg-opacity-10 rounded-full blur-3xl"></div>
    
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="lg:flex lg:items-center lg:justify-between">
          <div className="max-w-xl">
          <span className="inline-block px-3 py-1 bg-white bg-opacity-20 text-white text-sm font-medium rounded-full mb-3 backdrop-blur-sm">
            Ưu đãi đặc biệt
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-4">
            Sẵn sàng nâng cao kỹ năng của bạn?
            </h2>
          <p className="text-base md:text-lg text-indigo-100 mb-6 lg:mb-0">
            Đăng ký ngay hôm nay và nhận ưu đãi <span className="font-bold text-yellow-300">giảm 20%</span> cho tất cả các khóa học cao cấp. Cơ hội học tập chất lượng với chi phí tiết kiệm!
          </p>
          
          <div className="mt-6 hidden md:flex items-center">
            <div className="flex -space-x-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 w-10 rounded-full bg-white bg-opacity-20 border-2 border-indigo-500 flex items-center justify-center text-white font-bold">
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
            </div>
            <div className="ml-4 text-sm text-white">
              <span className="font-semibold text-yellow-300">+5,000</span> học viên đã đăng ký
            </div>
          </div>
        </div>
        
        <div className="mt-8 lg:mt-0 lg:flex-shrink-0">
          <div className="bg-white p-6 rounded-2xl shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Đăng ký nhận ưu đãi</h3>
            <p className="text-sm text-gray-600 mb-4">Điền thông tin để nhận mã giảm giá 20% cho tất cả khóa học.</p>
            
            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Họ và tên của bạn"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>
              <div>
                <input
                  type="email"
                  placeholder="Email của bạn"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>
              <button className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white py-2.5 rounded-lg font-medium hover:from-indigo-700 hover:to-indigo-800 transition-colors duration-200 shadow-md">
                Nhận ưu đãi ngay
              </button>
            </div>
            
            <p className="text-xs text-gray-500 mt-3 text-center">
              Chúng tôi tôn trọng quyền riêng tư của bạn và không chia sẻ thông tin với bên thứ ba.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>

  {/* Footer */}
  <footer className="bg-gray-900 text-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <h3 className="text-lg font-semibold mb-4">Về chúng tôi</h3>
          <p className="text-gray-400 text-sm mb-4">Chúng tôi cung cấp các khóa học chất lượng cao, giúp học viên đạt được mục tiêu học tập và phát triển sự nghiệp.</p>
          <div className="flex space-x-4">
            <a href="#" className="text-gray-400 hover:text-white">
              <span className="sr-only">Facebook</span>
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
              </svg>
            </a>
            <a href="#" className="text-gray-400 hover:text-white">
              <span className="sr-only">Instagram</span>
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
              </svg>
            </a>
            <a href="#" className="text-gray-400 hover:text-white">
              <span className="sr-only">Twitter</span>
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
              </svg>
              </a>
            </div>
        </div>
        
        <div>
          <h3 className="text-lg font-semibold mb-4">Khóa học phổ biến</h3>
          <ul className="space-y-2 text-sm text-gray-400">
            <li><a href="#" className="hover:text-white transition-colors duration-200">Lập trình Python cơ bản</a></li>
            <li><a href="#" className="hover:text-white transition-colors duration-200">Marketing Online</a></li>
            <li><a href="#" className="hover:text-white transition-colors duration-200">Thiết kế đồ họa</a></li>
            <li><a href="#" className="hover:text-white transition-colors duration-200">Tiếng Anh giao tiếp</a></li>
            <li><a href="#" className="hover:text-white transition-colors duration-200">Phát triển kỹ năng lãnh đạo</a></li>
          </ul>
        </div>
        
        <div>
          <h3 className="text-lg font-semibold mb-4">Liên kết nhanh</h3>
          <ul className="space-y-2 text-sm text-gray-400">
            <li><a href="#" className="hover:text-white transition-colors duration-200">Trang chủ</a></li>
            <li><a href="#" className="hover:text-white transition-colors duration-200">Khóa học</a></li>
            <li><a href="#" className="hover:text-white transition-colors duration-200">Giới thiệu</a></li>
            <li><a href="#" className="hover:text-white transition-colors duration-200">Liên hệ</a></li>
            <li><a href="#" className="hover:text-white transition-colors duration-200">Hỗ trợ</a></li>
          </ul>
        </div>
        
        <div>
          <h3 className="text-lg font-semibold mb-4">Liên hệ</h3>
          <ul className="space-y-3 text-sm text-gray-400">
            <li className="flex items-start">
              <svg className="h-5 w-5 text-gray-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>123 Đường ABC, Quận 1, TP. Hồ Chí Minh</span>
            </li>
            <li className="flex items-start">
              <svg className="h-5 w-5 text-gray-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>support@example.com</span>
            </li>
            <li className="flex items-start">
              <svg className="h-5 w-5 text-gray-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span>0123 456 789</span>
            </li>
          </ul>
          
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Đăng ký nhận tin</h4>
            <div className="flex">
              <input
                type="email"
                placeholder="Email của bạn"
                className="px-3 py-2 w-full text-sm bg-gray-800 border border-gray-700 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-white"
              />
              <button className="bg-indigo-600 px-4 rounded-r-lg hover:bg-indigo-700 transition-colors duration-200">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
            </div>
        </div>
      </div>
      
      <div className="border-t border-gray-800 mt-10 pt-6 flex flex-col md:flex-row justify-between items-center">
        <p className="text-sm text-gray-400">© 2025 Trang Khóa Học. Thiết kế bởi Khoá học 6.0. Bảo lưu mọi quyền.</p>
        <div className="mt-4 md:mt-0">
          <ul className="flex space-x-6 text-xs text-gray-400">
            <li><a href="#" className="hover:text-white transition-colors duration-200">Điều khoản sử dụng</a></li>
            <li><a href="#" className="hover:text-white transition-colors duration-200">Chính sách bảo mật</a></li>
            <li><a href="#" className="hover:text-white transition-colors duration-200">Cookie</a></li>
          </ul>
</div>
      </div>
    </div>
  </footer>

    {/* Thêm meta viewport để đảm bảo responsive trên mobile */}
    <style jsx global>{`
      @media (max-width: 640px) {
        html {
          font-size: 14px;
        }
      }
    
    /* Sửa vấn đề 2 thanh cuộn */
    html, body {
      overflow-x: hidden;
      max-width: 100%;
      margin: 0;
      padding: 0;
      position: relative;
    }
    
    body {
      overflow-y: auto;
      overflow-x: hidden;
    }
    
    /* Ẩn thanh cuộn ngang trên các phần tử có overflow */
    .no-scrollbar::-webkit-scrollbar {
      display: none;
    }
    
    .no-scrollbar {
      -ms-overflow-style: none;  /* IE và Edge */
      scrollbar-width: none;  /* Firefox */
    }
    `}</style>
</main>
);
} 