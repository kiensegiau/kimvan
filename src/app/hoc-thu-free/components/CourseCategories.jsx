import React, { useState } from 'react';
import { motion } from 'framer-motion';

const CourseCategories = () => {
  const [activeTab, setActiveTab] = useState('math');

  const mathCourses = [
    { 
      id: 'm1',
      teacher: 'Thầy Đỗ Văn Đức', 
      description: 'Trọn Bộ Lộ Trình IOME', 
      students: '1,250+', 
      rating: '4.9',
      lessons: 42,
      hours: 68,
      featured: true
    },
    { 
      id: 'm2',
      teacher: 'Cô Ngọc Huyền LB', 
      description: 'Trọn Bộ Lộ Trình STEEP', 
      students: '980+', 
      rating: '4.8',
      lessons: 38,
      hours: 54,
      featured: false
    },
    { 
      id: 'm3',
      teacher: 'Thầy Nguyễn Quốc Chí', 
      description: 'Trọn Bộ Lộ Trình Chuyên Đề, Luyện Đề', 
      students: '1,450+', 
      rating: '4.9',
      lessons: 46,
      hours: 72,
      featured: true
    },
    { 
      id: 'm4',
      teacher: 'Thầy Nguyễn Đăng Ái (TDM)', 
      description: 'Trọn Bộ Lộ Trình TDM X,Y,Z', 
      students: '1,100+', 
      rating: '4.7',
      lessons: 35,
      hours: 58,
      featured: false
    },
    { 
      id: 'm5',
      teacher: 'Thầy Hồ Thức Thuận', 
      description: 'Trọn Bộ Lộ Trình CTG, Thực Chiến', 
      students: '1,320+', 
      rating: '4.8',
      lessons: 40,
      hours: 65,
      featured: false
    },
    { 
      id: 'm6',
      teacher: 'Khóa Toán DPAD', 
      description: 'Trọn Bộ Lộ Trình VIP', 
      students: '2,200+', 
      rating: '4.9',
      lessons: 50,
      hours: 85,
      featured: true
    },
    { 
      id: 'm7',
      teacher: 'Khóa Toán LIMC', 
      description: 'Trọn Bộ Lộ Trình VIP', 
      students: '1,800+', 
      rating: '4.8',
      lessons: 48,
      hours: 76,
      featured: false
    },
    { 
      id: 'm8',
      teacher: 'Thầy Lê Quang Sinh', 
      description: 'Trọn Bộ Lộ Trình Chuyên Đề, VDC, Tổng Ôn, Luyện Đề', 
      students: '1,600+', 
      rating: '4.9',
      lessons: 52,
      hours: 88,
      featured: true
    }
  ];

  const physicsCourses = [
    { 
      id: 'p1',
      teacher: 'Thầy Vũ Tuấn Anh', 
      description: 'Trọn Bộ Lộ Trình CTG, Thực Chiến', 
      students: '1,150+', 
      rating: '4.8',
      lessons: 38,
      hours: 62,
      featured: true
    },
    { 
      id: 'p2',
      teacher: 'Thầy Vũ Ngọc Anh (Mapstudy)', 
      description: 'Trọn Bộ Lộ Trình IOME', 
      students: '1,050+', 
      rating: '4.7',
      lessons: 36,
      hours: 58,
      featured: false
    },
    { 
      id: 'p3',
      teacher: 'Thầy Đỗ Ngọc Hà', 
      description: 'Trọn Bộ Lộ Trình Zoom H, Zoom T', 
      students: '980+', 
      rating: '4.8',
      lessons: 34,
      hours: 56,
      featured: false
    },
    { 
      id: 'p4',
      teacher: 'Thầy Bùi Xuân Đạt', 
      description: 'Trọn Bộ Lộ Trình Chuyên Đề, VDC, Tổng Ôn, Luyện Đề', 
      students: '1,400+', 
      rating: '4.9',
      lessons: 44,
      hours: 72,
      featured: true
    },
    { 
      id: 'p5',
      teacher: 'Thầy Chu Văn Biên', 
      description: 'Trọn Bộ Lộ Trình VIP', 
      students: '1,750+', 
      rating: '4.9',
      lessons: 46,
      hours: 78,
      featured: true
    }
  ];

  const activeCourses = activeTab === 'math' ? mathCourses : physicsCourses;

  return (
    <section className="py-20 bg-[#f8fafc] dark:bg-gray-900">
      <div className="container px-4 mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.span 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-block py-1.5 px-4 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900 dark:to-red-800 text-red-600 dark:text-red-300 font-medium rounded-full text-xs uppercase tracking-wider mb-4"
          >
            Khóa học 2007
          </motion.span>
          
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-white dark:via-gray-200 dark:to-white bg-clip-text text-transparent"
          >
            Danh Mục Khóa Học Chất Lượng Cao
          </motion.h2>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-gray-600 dark:text-gray-400 max-w-3xl mx-auto text-lg"
          >
            Tổng hợp các khóa học được thiết kế bởi đội ngũ giảng viên hàng đầu, giúp học sinh chinh phục kỳ thi với kết quả xuất sắc
          </motion.p>
        </div>

        {/* Tabs */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row justify-center items-center mb-12 space-y-4 sm:space-y-0"
        >
          <div className="bg-white dark:bg-gray-800 p-1.5 rounded-xl shadow-md flex items-center">
            <button
              onClick={() => setActiveTab('math')}
              className={`px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'math'
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-200 dark:shadow-red-900/30'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Môn Toán 2007
            </button>
            <button
              onClick={() => setActiveTab('physics')}
              className={`px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'physics'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/30'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Môn Lý 2007
            </button>
          </div>
        </motion.div>

        {/* Featured Courses */}
        <div className="mb-16">
          <motion.h3 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-2xl font-bold text-gray-900 dark:text-white mb-8 flex items-center"
          >
            <span className={`inline-block w-2 h-8 rounded-full mr-3 ${activeTab === 'math' ? 'bg-red-500' : 'bg-blue-500'}`}></span>
            Khóa Học Nổi Bật
          </motion.h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {activeCourses.filter(course => course.featured).slice(0, 2).map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 group flex flex-col md:flex-row"
              >
                <div className={`md:w-2/5 h-60 md:h-auto ${activeTab === 'math' ? 'bg-gradient-to-br from-red-500 to-red-700' : 'bg-gradient-to-br from-blue-500 to-blue-700'} relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-black opacity-20"></div>
                  <div className="absolute top-4 left-4">
                    <span className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">Nổi bật</span>
                  </div>
                  <div className="absolute bottom-0 left-0 w-full p-6 text-white">
                    <h4 className="text-xl font-bold mb-1">{course.teacher}</h4>
                    <p className="text-white text-opacity-90 text-sm">{course.description}</p>
                  </div>
                </div>
                
                <div className="p-6 md:p-8 md:w-3/5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center mb-4">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <svg key={i} xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${i < Math.floor(parseFloat(course.rating)) ? 'text-yellow-400' : 'text-gray-300'}`} viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                        <span className="text-gray-700 dark:text-gray-300 font-bold ml-2">{course.rating}</span>
                      </div>
                      <span className="mx-2 text-gray-400">•</span>
                      <span className="text-gray-600 dark:text-gray-400 text-sm">{course.students} học sinh</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-gray-50 dark:bg-gray-800/80 p-3 rounded-lg">
                        <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">Số bài học</div>
                        <div className="text-gray-900 dark:text-white font-bold">{course.lessons} bài</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800/80 p-3 rounded-lg">
                        <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">Thời lượng</div>
                        <div className="text-gray-900 dark:text-white font-bold">{course.hours} giờ</div>
                      </div>
                    </div>
                  </div>
                  
                  <button className={`w-full py-3.5 ${activeTab === 'math' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white font-medium rounded-xl transition-colors duration-300 flex items-center justify-center group`}>
                    Xem chi tiết khóa học
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* All Courses */}
        <div>
          <motion.h3 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-2xl font-bold text-gray-900 dark:text-white mb-8 flex items-center"
          >
            <span className={`inline-block w-2 h-8 rounded-full mr-3 ${activeTab === 'math' ? 'bg-red-500' : 'bg-blue-500'}`}></span>
            Tất Cả Khóa Học
          </motion.h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {activeCourses.map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6 + index * 0.05 }}
                className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 group flex flex-col h-full"
              >
                <div className={`h-48 ${activeTab === 'math' ? 'bg-gradient-to-r from-red-400 to-red-600' : 'bg-gradient-to-r from-blue-400 to-blue-600'} relative overflow-hidden`}>
                  {course.featured && (
                    <div className="absolute top-4 left-4">
                      <span className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">Nổi bật</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black opacity-10"></div>
                  <div className="absolute bottom-0 left-0 w-full p-5 text-white">
                    <h4 className="text-lg font-bold mb-1 group-hover:translate-x-1 transition-transform duration-300">{course.teacher}</h4>
                    <p className="text-white text-opacity-90 text-sm line-clamp-1">{course.description}</p>
                  </div>
                </div>
                
                <div className="p-5 flex flex-col flex-grow">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="text-gray-700 dark:text-gray-300 font-bold ml-1.5 text-sm">{course.rating}</span>
                    </div>
                    <span className="text-gray-600 dark:text-gray-400 text-xs">{course.students} học sinh</span>
                  </div>
                  
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      {course.lessons} bài học
                    </div>
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {course.hours} giờ
                    </div>
                  </div>
                </div>
                
                <div className="px-5 pb-5 mt-auto">
                  <button className={`w-full py-2.5 ${activeTab === 'math' ? 'text-red-600 hover:bg-red-600' : 'text-blue-600 hover:bg-blue-600'} hover:text-white border ${activeTab === 'math' ? 'border-red-600' : 'border-blue-600'} font-medium rounded-lg transition-colors duration-300 flex items-center justify-center text-sm`}>
                    Xem chi tiết
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1.5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CourseCategories;