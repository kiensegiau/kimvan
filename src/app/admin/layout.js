'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  UserGroupIcon, 
  BookOpenIcon,
  Cog6ToothIcon,
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Kiểm tra nếu đang ở trang login
  const isLoginPage = pathname === '/admin/login';
  
  useEffect(() => {
    // Kiểm tra cookie để xác định trạng thái đăng nhập
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/admin/check');
        const data = await response.json();
        
        setIsLoggedIn(data.authenticated);
        
        // Nếu chưa đăng nhập và không phải trang login, chuyển hướng
        if (!data.authenticated && !isLoginPage) {
          router.push(`/admin/login?from=${pathname}`);
        }
      } catch (error) {
        console.error('Lỗi kiểm tra xác thực:', error);
        setIsLoggedIn(false);
        
        if (!isLoginPage) {
          router.push('/admin/login');
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, [pathname, isLoginPage, router]);
  
  // Xử lý đăng xuất
  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/admin/logout', {
        method: 'POST',
      });
      
      if (response.ok) {
        router.push('/admin/login');
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
    { name: 'Cài đặt', href: '/admin/settings', icon: Cog6ToothIcon },
  ];
  
  // Nếu đang ở trang login, chỉ hiển thị nội dung con
  if (isLoginPage) {
    return children;
  }
  
  // Hiển thị loading khi đang kiểm tra xác thực
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
      {/* Mobile sidebar */}
      <div className="lg:hidden">
        {sidebarOpen ? (
          <div className="fixed inset-0 z-40 flex">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-gray-600 bg-opacity-75" 
              onClick={() => setSidebarOpen(false)}
            ></div>
            
            {/* Sidebar */}
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
              <div className="absolute top-0 right-0 -mr-12 pt-2">
                <button
                  className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                  onClick={() => setSidebarOpen(false)}
                >
                  <XMarkIcon className="h-6 w-6 text-white" />
                </button>
              </div>
              
              <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
                <div className="flex-shrink-0 flex items-center px-4">
                  <h1 className="text-xl font-bold text-gray-900">KimVan Admin</h1>
                </div>
                <nav className="mt-5 px-2 space-y-1">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`${
                        pathname.startsWith(item.href)
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      } group flex items-center px-2 py-2 text-base font-medium rounded-md`}
                    >
                      <item.icon
                        className={`${
                          pathname.startsWith(item.href) ? 'text-gray-500' : 'text-gray-400 group-hover:text-gray-500'
                        } mr-4 flex-shrink-0 h-6 w-6`}
                      />
                      {item.name}
                    </Link>
                  ))}
                </nav>
              </div>
              <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
                <button
                  onClick={handleLogout}
                  className="flex-shrink-0 group block w-full flex items-center text-red-600"
                >
                  <ArrowLeftOnRectangleIcon className="mr-3 h-5 w-5 text-red-500" />
                  <span className="text-sm font-medium">Đăng xuất</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            className="fixed z-20 top-4 left-4 p-2 rounded-md bg-white shadow-md"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-6 w-6 text-gray-600" />
          </button>
        )}
      </div>
      
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:border-r lg:border-gray-200 lg:bg-white">
        <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4">
            <h1 className="text-xl font-bold text-gray-900">KimVan Admin</h1>
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
                } group flex items-center px-2 py-2 text-sm font-medium rounded-md`}
              >
                <item.icon
                  className={`${
                    pathname.startsWith(item.href) ? 'text-gray-500' : 'text-gray-400 group-hover:text-gray-500'
                  } mr-3 flex-shrink-0 h-6 w-6`}
                />
                {item.name}
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
      <div className="lg:pl-64 flex flex-col flex-1">
        <main className="flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
} 