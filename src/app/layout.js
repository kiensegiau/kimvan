'use client';

import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from './components/Sidebar';
import { useState, useEffect } from 'react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

const inter = Inter({ subsets: ['latin'] });

// Metadata không thể dùng trong client component, nên đưa ra file riêng hoặc dùng cách khác
const siteTitle = 'Kimvan - Hệ thống học tập';
const siteDescription = 'Hệ thống học tập trực tuyến Kimvan';

export default function RootLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Kiểm tra kích thước màn hình khi component được tạo và khi resize
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    // Kiểm tra khi tải trang
    checkIfMobile();
    
    // Kiểm tra khi thay đổi kích thước màn hình
    window.addEventListener('resize', checkIfMobile);
    
    // Cleanup event listener
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  // Đóng sidebar tự động khi chuyển đến màn hình nhỏ
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  }, [isMobile]);

  return (
    <html lang="vi">
      <head>
        <title>{siteTitle}</title>
        <meta name="description" content={siteDescription} />
      </head>
      <body className={inter.className}>
        <div className="flex relative">
          {/* Overlay khi sidebar mở trên mobile */}
          {sidebarOpen && isMobile && (
            <div 
              className="fixed inset-0 bg-gray-900 bg-opacity-50 z-20 lg:hidden transition-opacity duration-200"
              onClick={() => setSidebarOpen(false)}
            ></div>
          )}
          
          {/* Sidebar */}
          <div className={`
            fixed top-0 left-0 h-full z-30 transform transition-all duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            lg:relative lg:z-0 w-64
          `}>
            <Sidebar />
          </div>
          
          {/* Toggle button chỉ hiển thị trên mobile */}
          <button
            className="fixed top-4 left-4 z-40 lg:hidden bg-white p-2 rounded-md shadow-md focus:outline-none"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? (
              <XMarkIcon className="h-6 w-6 text-gray-600" />
            ) : (
              <Bars3Icon className="h-6 w-6 text-gray-600" />
            )}
          </button>
          
          {/* Main content */}
          <main className={`
            flex-1 min-h-screen bg-gray-50 transition-all duration-300 ease-in-out
            ${sidebarOpen ? 'lg:ml-64' : ''}
            w-full
          `}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
