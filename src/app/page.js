import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Chào mừng đến với Next.js
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Đây là trang web đầu tiên của bạn được xây dựng bằng Next.js. 
            Hãy bắt đầu tạo những điều tuyệt vời!
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/docs"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Tài liệu
            </a>
            <a
              href="/about"
              className="px-6 py-3 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Giới thiệu
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
