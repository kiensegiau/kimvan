import { AcademicCapIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export default function EmptyState() {
  return (
    <div className="text-center py-16 px-6 bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="flex justify-center">
        <div className="relative">
          <div className="absolute -inset-1 bg-blue-100 rounded-full opacity-30 animate-pulse"></div>
          <div className="relative bg-blue-50 p-4 rounded-full">
            <MagnifyingGlassIcon className="h-12 w-12 text-blue-500" />
          </div>
        </div>
      </div>
      
      <h3 className="mt-6 text-xl font-bold text-gray-900">Không tìm thấy khóa học</h3>
      
      <p className="mt-3 text-base text-gray-500 max-w-md mx-auto">
        Không có khóa học nào phù hợp với các tiêu chí tìm kiếm của bạn.
      </p>
      
      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <button 
          onClick={() => window.location.reload()} 
          className="inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <AcademicCapIcon className="h-5 w-5 mr-2" />
          Xem tất cả khóa học
        </button>
        
        <button 
          onClick={() => window.history.back()} 
          className="inline-flex items-center justify-center px-4 py-2.5 border border-gray-300 text-sm font-medium rounded-lg shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Quay lại
        </button>
      </div>
      
      <div className="mt-8 text-sm text-gray-500">
        <p>Gợi ý: Thử tìm kiếm với từ khóa khác hoặc điều chỉnh bộ lọc</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <span className="px-3 py-1 bg-gray-100 rounded-full hover:bg-gray-200 cursor-pointer">Toán học</span>
          <span className="px-3 py-1 bg-gray-100 rounded-full hover:bg-gray-200 cursor-pointer">Tiếng Anh</span>
          <span className="px-3 py-1 bg-gray-100 rounded-full hover:bg-gray-200 cursor-pointer">Lập trình</span>
        </div>
      </div>
    </div>
  );
} 