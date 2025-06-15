export default function LoadingState() {
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-8 relative">
        <div className="text-center py-10">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600 mb-2"></div>
          <p className="text-gray-500">Đang tải thông tin khóa học...</p>
        </div>
      </div>
    </div>
  );
} 