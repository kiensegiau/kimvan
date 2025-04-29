export const metadata = {
  title: 'Công cụ xóa watermark PDF từ Google Drive',
  description: 'Xóa watermark từ file PDF trên Google Drive một cách nhanh chóng và dễ dàng',
};

export default function DriveWatermarkRemovalLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-700 text-white">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold">PDF Watermark Remover</h1>
          <nav>
            <ul className="flex space-x-4">
              <li>
                <a href="/" className="hover:underline">Trang chủ</a>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      
      <main className="flex-grow bg-gray-50">
        {children}
      </main>
      
      <footer className="bg-gray-800 text-white py-4">
        <div className="container mx-auto px-4 text-center text-sm">
          <p>Công cụ xóa watermark PDF từ Google Drive - Không lưu trữ file của bạn</p>
          <p className="mt-1 text-gray-400">Lưu ý: Chỉ sử dụng cho mục đích cá nhân và hợp pháp</p>
        </div>
      </footer>
    </div>
  );
} 