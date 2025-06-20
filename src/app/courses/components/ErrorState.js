import { ExclamationCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

export default function ErrorState({ error }) {
  return (
    <div className="bg-white shadow-sm rounded-xl p-8 text-center max-w-2xl mx-auto">
      <div className="relative flex justify-center">
        <div className="absolute -inset-1 bg-red-100 rounded-full opacity-50 animate-pulse"></div>
        <div className="relative bg-red-50 p-4 rounded-full">
          <ExclamationCircleIcon className="h-12 w-12 text-red-500" />
        </div>
      </div>
      
      <h3 className="mt-6 text-xl font-bold text-gray-900">Đã xảy ra lỗi</h3>
      
      <div className="mt-3 text-base text-gray-500 max-w-md mx-auto">
        <p className="mb-2">
          {error || 'Không thể tải danh sách khóa học. Vui lòng thử lại sau.'}
        </p>
        <p className="text-sm text-gray-400">
          Mã lỗi: {error ? error.split(':')[0] : 'ERR_FETCH_FAILED'}
        </p>
      </div>
      
      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          <ArrowPathIcon className="h-5 w-5 mr-2" />
          Tải lại trang
        </button>
        
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center justify-center px-5 py-3 border border-gray-300 text-base font-medium rounded-lg shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          Quay lại trang trước
        </button>
      </div>
      
      <div className="mt-8 border-t border-gray-100 pt-6">
        <p className="text-sm text-gray-500">
          Nếu lỗi vẫn tiếp tục xảy ra, vui lòng liên hệ với chúng tôi qua email:
          <a href="mailto:support@example.com" className="text-blue-600 hover:text-blue-800 ml-1">
            support@example.com
          </a>
        </p>
      </div>
    </div>
  );
} 