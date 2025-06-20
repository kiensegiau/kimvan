import { AcademicCapIcon, BookOpenIcon, UserGroupIcon, ClockIcon } from '@heroicons/react/24/outline';

export default function PageHeader() {
  return (
    <div className="relative">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl -z-10"></div>
      
      {/* Decorative pattern */}
      <div className="absolute inset-0 opacity-10 -z-10">
        <svg className="h-full w-full" width="100%" height="100%" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="pattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="10" r="1.5" fill="white" />
            </pattern>
          </defs>
          <rect width="800" height="800" fill="url(#pattern)" />
        </svg>
      </div>
      
      {/* Content */}
      <div className="relative py-10 px-8 rounded-2xl text-white">
        <div className="flex flex-col md:flex-row md:items-center">
          <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm w-fit">
            <AcademicCapIcon className="h-10 w-10 text-white" aria-hidden="true" />
          </div>
          <div className="mt-4 md:mt-0 md:ml-6">
            <h1 className="text-3xl font-bold">Khám phá khóa học</h1>
            <p className="mt-2 text-blue-100 max-w-3xl">
              Nâng cao kỹ năng của bạn với các khóa học chất lượng cao từ những giảng viên hàng đầu. 
              Chúng tôi cung cấp nội dung đa dạng phù hợp với mọi nhu cầu học tập.
            </p>
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-8">
          <div className="flex items-center bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <BookOpenIcon className="h-6 w-6 text-blue-200" />
            <div className="ml-3">
              <p className="text-sm text-blue-100">Khóa học</p>
              <p className="text-xl font-bold">100+</p>
            </div>
          </div>
          <div className="flex items-center bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <UserGroupIcon className="h-6 w-6 text-blue-200" />
            <div className="ml-3">
              <p className="text-sm text-blue-100">Học viên</p>
              <p className="text-xl font-bold">10,000+</p>
            </div>
          </div>
          <div className="flex items-center bg-white/10 backdrop-blur-sm rounded-lg p-3 col-span-2 md:col-span-1">
            <ClockIcon className="h-6 w-6 text-blue-200" />
            <div className="ml-3">
              <p className="text-sm text-blue-100">Giờ học</p>
              <p className="text-xl font-bold">5,000+</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 