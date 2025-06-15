import { useRouter } from 'next/navigation';

export default function NotFoundState() {
  const router = useRouter();
  
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-8 relative">
        <div className="text-center py-10">
          <div className="inline-block text-red-500 text-5xl mb-5">⚠️</div>
          <h2 className="text-xl font-medium text-gray-900 mb-2">Không tìm thấy khóa học</h2>
          <p className="text-gray-500 mb-6">Khóa học bạn đang tìm kiếm không tồn tại hoặc đã bị xóa.</p>
          <button
            onClick={() => router.push('/khoa-hoc')}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <svg className="-ml-0.5 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Quay lại danh sách khóa học
          </button>
        </div>
      </div>
    </div>
  );
} 