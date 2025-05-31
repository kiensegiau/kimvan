'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  UserGroupIcon, 
  BookOpenIcon,
  Cog6ToothIcon,
  ArrowLeftOnRectangleIcon,
  ExclamationCircleIcon,
  VideoCameraIcon,
  TableCellsIcon
} from '@heroicons/react/24/outline';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  
  // Không cần kiểm tra xác thực trong layout vì đã xử lý trong middleware
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  // State cho trạng thái token YouTube
  const [youtubeTokenStatus, setYoutubeTokenStatus] = useState(null);
  const [checkingToken, setCheckingToken] = useState(false);
  
  // Kiểm tra nếu đang ở trang thiết lập YouTube
  const isYoutubeSetupPage = pathname === '/admin/youtube-setup';
  
  // Kiểm tra token YouTube nếu đang ở trang admin
  useEffect(() => {
    if (isLoggedIn) {
      checkYouTubeToken();
    }
  }, [isLoggedIn]);
  
  // Hàm kiểm tra trạng thái token YouTube
  const checkYouTubeToken = async () => {
    try {
      setCheckingToken(true);
      
      const response = await fetch('/api/youtube/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      setYoutubeTokenStatus(data);
    } catch (err) {
      console.error('Lỗi khi kiểm tra token YouTube:', err);
      setYoutubeTokenStatus({
        exists: false,
        valid: false,
        error: 'Không thể kết nối đến API để kiểm tra token'
      });
    } finally {
      setCheckingToken(false);
    }
  };
  
  // Xử lý đăng xuất
  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });
      
      if (response.ok) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Lỗi đăng xuất:', error);
      alert('Đã xảy ra lỗi khi đăng xuất. Vui lòng thử lại.');
    }
  };
  
  // Các mục menu điều hướng
  const navigation = [
    { name: 'Người dùng', href: '/admin/users', icon: UserGroupIcon },
    { name: 'Khóa học', href: '/admin/courses', icon: BookOpenIcon },
    { name: 'YouTube', href: '/admin/youtube-setup', icon: VideoCameraIcon },
    { name: 'Test Spreadsheet', href: '/test-spreadsheet', icon: TableCellsIcon },
    { name: 'Cài đặt', href: '/admin/settings', icon: Cog6ToothIcon },
  ];
  
  // Nếu đang ở trang login, chỉ hiển thị nội dung con
  if (pathname === '/login') {
    return children;
  }
  
  // Hiển thị loading khi đang kiểm tra xác thực - không còn cần thiết nhưng giữ lại cấu trúc
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-500">Đang tải...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Desktop sidebar - chỉ hiển thị trên desktop */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:border-r lg:border-gray-200 lg:bg-white">
        <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4">
            <h1 className="text-xl font-bold text-gray-900">Khoá học 6.0 Admin</h1>
          </div>
          <nav className="mt-5 flex-1 px-2 bg-white space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`${
                  pathname.startsWith(item.href)
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                } group flex items-center px-2 py-2 text-sm font-medium rounded-md relative`}
              >
                <item.icon
                  className={`${
                    pathname.startsWith(item.href) ? 'text-gray-500' : 'text-gray-400 group-hover:text-gray-500'
                  } mr-3 flex-shrink-0 h-6 w-6`}
                />
                {item.name}
                {item.name === 'YouTube' && youtubeTokenStatus && 
                 (!youtubeTokenStatus.exists || (youtubeTokenStatus.exists && !youtubeTokenStatus.valid)) && (
                  <span className="ml-auto bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded-full text-xs">
                    !
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
          <button
            onClick={handleLogout}
            className="flex items-center text-red-600"
          >
            <ArrowLeftOnRectangleIcon className="mr-3 h-5 w-5 text-red-500" />
            <span className="text-sm font-medium">Đăng xuất</span>
          </button>
        </div>
      </div>
      
      {/* Main content */}
      <div className="lg:pl-64 flex flex-col flex-1 pb-16 lg:pb-0">
        {/* Tiêu đề trang trên mobile */}
        <div className="lg:hidden bg-white shadow-sm p-4 flex justify-between items-center">
          <h1 className="text-lg font-bold text-gray-900">Khoá học 6.0 Admin</h1>
          <button
            onClick={handleLogout}
            className="flex items-center text-red-600"
          >
            <ArrowLeftOnRectangleIcon className="h-5 w-5 text-red-500" />
          </button>
        </div>
        
        <main className="flex-1 p-4 sm:p-6">
          {children}
        </main>
        
        {/* Thanh điều hướng dưới cho mobile */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center py-2 px-3 ${
                pathname.startsWith(item.href)
                  ? 'text-indigo-600'
                  : 'text-gray-600'
              }`}
            >
              <div className="relative">
                <item.icon className="h-6 w-6" />
                {item.name === 'YouTube' && youtubeTokenStatus && 
                (!youtubeTokenStatus.exists || (youtubeTokenStatus.exists && !youtubeTokenStatus.valid)) && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 bg-yellow-400 rounded-full"></span>
                )}
              </div>
              <span className="text-xs mt-1">{item.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
} 