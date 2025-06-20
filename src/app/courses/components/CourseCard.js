import Link from 'next/link';
import Image from 'next/image';
import { StarIcon, UserCircleIcon, ClockIcon } from '@heroicons/react/24/solid';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

export default function CourseCard({ course }) {
  // Generate random rating between 4.0 and 5.0
  const rating = course.rating || (4 + Math.random()).toFixed(1);
  
  // Generate random student count between 50 and 1500
  const studentCount = course.studentCount || Math.floor(Math.random() * 1450 + 50);
  
  // Generate random lesson count between 10 and 50
  const lessonCount = course.lessonCount || Math.floor(Math.random() * 40 + 10);
  
  // Format price
  const formatPrice = (price) => {
    if (!price) return 'Miễn phí';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  };

  // Generate random colors for course card if no image
  const getRandomGradient = () => {
    const gradients = [
      'from-blue-500 to-indigo-600',
      'from-purple-500 to-pink-500',
      'from-green-500 to-teal-500',
      'from-yellow-400 to-orange-500',
      'from-red-500 to-pink-500',
      'from-cyan-500 to-blue-500',
    ];
    return gradients[Math.floor(Math.random() * gradients.length)];
  };

  const gradient = getRandomGradient();

  return (
    <div className="group bg-white rounded-xl shadow-sm overflow-hidden flex flex-col h-full transition-all duration-300 hover:shadow-lg hover:translate-y-[-4px]">
      {/* Course image */}
      <div className={`relative h-48 bg-gradient-to-r ${gradient}`}>
        {course.imageUrl ? (
          <div className="relative w-full h-full">
            <Image 
              src={course.imageUrl} 
              alt={course.name || 'Khóa học'} 
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white text-5xl font-bold opacity-80">
              {course.name ? course.name.charAt(0).toUpperCase() : 'K'}
            </span>
          </div>
        )}
        
        {/* Badge for popular courses */}
        {(studentCount > 1000 || rating >= 4.8) && (
          <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            HOT
          </div>
        )}
      </div>
      
      {/* Course content */}
      <div className="p-6 flex-grow flex flex-col">
        {/* Course title */}
        <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
          {course.name || 'Khóa học chưa có tên'}
        </h3>
        
        {/* Course description */}
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {course.description || 'Chưa có mô tả cho khóa học này.'}
        </p>
        
        {/* Divider */}
        <div className="w-12 h-1 bg-blue-600 rounded mb-4"></div>
        
        {/* Course meta */}
        <div className="flex flex-wrap items-center text-sm text-gray-500 mb-3 gap-4">
          <div className="flex items-center">
            <div className="flex items-center bg-yellow-50 px-2 py-1 rounded-md">
              <StarIcon className="h-4 w-4 text-yellow-500 mr-1" />
              <span className="font-medium">{rating}</span>
            </div>
          </div>
          <div className="flex items-center">
            <UserCircleIcon className="h-4 w-4 text-blue-500 mr-1" />
            <span>{studentCount.toLocaleString('vi-VN')}+ học viên</span>
          </div>
          <div className="flex items-center">
            <ClockIcon className="h-4 w-4 text-green-500 mr-1" />
            <span>{lessonCount} bài học</span>
          </div>
        </div>
        
        {/* Instructor */}
        {course.instructor && (
          <div className="text-sm text-gray-600 mb-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">{course.instructor}</span>
          </div>
        )}
        
        {/* Price and CTA */}
        <div className="mt-auto pt-4 flex items-center justify-between border-t border-gray-100">
          <div>
            <span className="text-lg font-bold text-blue-600">
              {formatPrice(course.price)}
            </span>
            {course.originalPrice && course.originalPrice > course.price && (
              <span className="text-sm text-gray-400 line-through ml-2">
                {formatPrice(course.originalPrice)}
              </span>
            )}
          </div>
          <Link 
            href={`/khoa-hoc/${course._id || course.id}`}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            Chi tiết
            <ArrowRightIcon className="h-4 w-4 ml-1" />
          </Link>
        </div>
      </div>
    </div>
  );
} 