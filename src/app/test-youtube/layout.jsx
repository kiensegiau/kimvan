export default function TestYoutubeLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-600 text-white p-4 shadow-md">
        <div className="container mx-auto">
          <h1 className="text-2xl font-bold">Hệ thống tự động tải video YouTube</h1>
          <p className="text-blue-100">Trang test tải video từ thiết bị</p>
        </div>
      </header>
      
      <main>
        {children}
      </main>
      
      <footer className="bg-gray-800 text-gray-300 p-4 mt-12">
        <div className="container mx-auto text-center">
          <p>© {new Date().getFullYear()} - Hệ thống tự động tải video YouTube</p>
        </div>
      </footer>
    </div>
  );
} 