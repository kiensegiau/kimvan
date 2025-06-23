export default function LoadingState({ message = "Đang tải dữ liệu..." }) {
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-8 relative">
        <div className="text-center py-10">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-600 text-lg">{message}</p>
        </div>
      </div>
    </div>
  );
} 