'use client';

import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from './components/Sidebar';
import { useState, useEffect } from 'react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { usePathname } from 'next/navigation';
import { setupTokenRefreshInterval } from '@/utils/auth-client';

const inter = Inter({ subsets: ['latin'] });

// Metadata không thể dùng trong client component, nên đưa ra file riêng hoặc dùng cách khác
const siteTitle = 'Khoá học 6.0 - Hệ thống học tập';
const siteDescription = 'Hệ thống học tập trực tuyến Khoá học 6.0';

// Đường dẫn của các trang xác thực, không hiển thị sidebar
const authPaths = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/logout'
];

export default function RootLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();
  
  // Kiểm tra xem có phải trang xác thực hay không
  const isAuthPage = authPaths.some(path => pathname === path);

  // Kiểm tra kích thước màn hình khi component được tạo và khi resize
  useEffect(() => {
    const checkIfMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      
      // Automatically set sidebar state based on screen size
      if (!mobile && !sidebarOpen && !isAuthPage) {
        setSidebarOpen(true);
      }
    };
    
    // Kiểm tra khi tải trang
    checkIfMobile();
    
    // Kiểm tra khi thay đổi kích thước màn hình
    window.addEventListener('resize', checkIfMobile);
    
    // Cleanup event listener
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, [sidebarOpen, isAuthPage]);

  // Đóng sidebar tự động khi chuyển đến màn hình nhỏ hoặc trang xác thực
  useEffect(() => {
    if (isMobile || isAuthPage) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  }, [isMobile, isAuthPage]);

  // Thêm cơ chế tự động làm mới token
  useEffect(() => {
    // Thiết lập interval kiểm tra token mỗi 15 phút
    const intervalId = setupTokenRefreshInterval(15);
    
    // Dọn dẹp khi component unmount
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return (
    <html lang="vi">
      <head>
        <title>{siteTitle}</title>
        <meta name="description" content={siteDescription} />
      </head>
      <body className={inter.className}>
        {isAuthPage ? (
          // Layout đơn giản cho trang xác thực
          <div className="min-h-screen">
            {children}
          </div>
        ) : (
          // Layout có sidebar cho các trang khác
          <div className="flex h-screen overflow-hidden">
            {/* Sidebar */}
            <div className={`
              fixed top-0 left-0 h-full z-30 transform transition-all duration-300 ease-in-out
              ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
              lg:static lg:z-0 w-64 flex-shrink-0
            `}>
              <Sidebar closeSidebar={() => isMobile && setSidebarOpen(false)} />
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
            
            {/* Overlay to close sidebar when clicking outside on mobile */}
            {sidebarOpen && isMobile && (
              <div 
                className="fixed inset-0 z-20 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              ></div>
            )}
            
            {/* Main content */}
            <main className="flex-1 overflow-y-auto  w-full">
              {children}
            </main>
          </div>
        )}
      </body>
    </html>
  );
}
