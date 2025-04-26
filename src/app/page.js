'use client';

export default function Home() {
  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Chào mừng đến với Kimvan</h1>
            <p className="text-xl text-gray-600 mb-8">Hệ thống học tập trực tuyến hàng đầu</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-blue-50 p-6 rounded-xl">
                <div className="text-4xl mb-4">📚</div>
                <h2 className="text-xl font-semibold mb-2">Khóa học đa dạng</h2>
                <p className="text-gray-600">Nhiều khóa học chất lượng cao từ các giáo viên hàng đầu</p>
              </div>
              
              <div className="bg-green-50 p-6 rounded-xl">
                <div className="text-4xl mb-4">🎬</div>
                <h2 className="text-xl font-semibold mb-2">Video bài giảng</h2>
                <p className="text-gray-600">Học mọi lúc mọi nơi với video bài giảng chất lượng cao</p>
              </div>
              
              <div className="bg-purple-50 p-6 rounded-xl">
                <div className="text-4xl mb-4">👨‍🏫</div>
                <h2 className="text-xl font-semibold mb-2">Giáo viên chuyên nghiệp</h2>
                <p className="text-gray-600">Đội ngũ giáo viên giàu kinh nghiệm và tận tâm</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
