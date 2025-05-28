'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  HomeIcon,
  AcademicCapIcon, 
  BookOpenIcon,
  CalendarIcon,
  DocumentTextIcon,
  InformationCircleIcon,
  UserCircleIcon,
  ChevronRightIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline';
import { useState, useEffect } from 'react';
import { logout } from '@/utils/auth-client';

const Sidebar = ({ closeSidebar }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/users/me');
        const result = await response.json();

        if (result.success && result.user) {
          setUserData({
            name: result.user?.displayName || '',
            email: result.user?.email || '',
            role: result.user?.role || 'user'
          });
        }
      } catch (error) {
        console.error('Lỗi khi lấy thông tin người dùng:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleMenuItemClick = () => {
    if (isMobile && closeSidebar) {
      closeSidebar();
    }
  };
  
  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      
      // Gọi hàm đăng xuất từ auth-client
      await logout();
      
      // Hard reload để đảm bảo tất cả state được làm mới
      window.location.href = '/login';
    } catch (error) {
      console.error('Lỗi đăng xuất:', error);
      setIsLoggingOut(false);
      alert('Đã xảy ra lỗi khi đăng xuất. Vui lòng thử lại.');
    }
  };

  const menuItems = [
    { name: 'Trang chủ', path: '/', icon: <HomeIcon className="w-5 h-5" /> },
    { name: 'Khóa học', path: '/khoa-hoc', icon: <AcademicCapIcon className="w-5 h-5" /> },
    { name: 'Khóa học của tôi', path: '/khoa-hoc-cua-toi', icon: <ClipboardDocumentListIcon className="w-5 h-5" /> },
    { name: 'Thư viện', path: '/thu-vien', icon: <BookOpenIcon className="w-5 h-5" /> },
  ];

  // Hiển thị vai trò người dùng
  const getRoleDisplay = (role) => {
    switch (role) {
      case 'admin':
        return 'Quản trị viên';
      case 'teacher':
        return 'Giảng viên';
      default:
        return 'Học viên';
    }
  };

  return (
    <div className="h-screen w-64 bg-gradient-to-b from-indigo-700 to-indigo-900 text-white fixed left-0 top-0 flex flex-col shadow-xl">
      {/* Logo và tên */}
      <div className="p-5 border-b border-indigo-600/50">
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-xl">K</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Khoá học 6.0</h1>
            <p className="text-xs text-indigo-200">Học tập trực tuyến THPT</p>
          </div>
        </Link>
      </div>

      {/* Menu chính */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.path}>
              <Link
                href={item.path}
                className={`flex items-center p-3 rounded-lg transition-all ${
                  pathname === item.path
                    ? 'bg-indigo-700 text-white'
                    : 'text-indigo-100 hover:bg-indigo-800 hover:text-white'
                }`}
                onClick={handleMenuItemClick}
              >
                <span className={`mr-3 ${pathname === item.path ? 'text-white' : 'text-indigo-300'}`}>{item.icon}</span>
                <span className="font-medium">{item.name}</span>
                {pathname === item.path && (
                  <ChevronRightIcon className="ml-auto w-4 h-4" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Thống kê đơn giản */}
      <div className="p-4 bg-indigo-800/40 mx-4 mb-4 rounded-lg">
        <p className="text-sm font-medium mb-2">Tiến độ học tập</p>
        <div className="w-full h-2 bg-indigo-900/50 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-400 rounded-full" style={{ width: '65%' }}></div>
        </div>
        <p className="text-xs text-right mt-1 text-indigo-200">65% hoàn thành</p>
      </div>

      {/* User profile */}
      <div className="p-4 border-t border-indigo-600/50">
        <div className="flex items-center p-2 bg-indigo-800/40 rounded-lg mb-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-400 to-purple-500 flex items-center justify-center mr-3 shadow-md">
            <UserCircleIcon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 overflow-hidden">
            {loading ? (
              <div className="animate-pulse">
                <div className="h-4 bg-indigo-600 rounded w-3/4 mb-1"></div>
                <div className="h-3 bg-indigo-700 rounded w-1/2"></div>
              </div>
            ) : (
              <>
                {userData?.name && (
                  <p className="font-medium truncate text-white">{userData.name}</p>
                )}
                <p className="text-xs text-indigo-200 truncate">{userData?.email || 'Chưa đăng nhập'}</p>
                {userData?.role && (
                  <div className="mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-600 text-indigo-100">
                      {getRoleDisplay(userData.role)}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Link 
            href="/ca-nhan" 
            className={`w-full flex items-center p-2 rounded-lg transition-colors ${
              pathname === '/ca-nhan' 
                ? 'bg-indigo-700 text-white' 
                : 'hover:bg-indigo-800 text-indigo-100'
            }`}
            onClick={handleMenuItemClick}
          >
            <UserCircleIcon className={`w-5 h-5 mr-3 ${pathname === '/ca-nhan' ? 'text-white' : 'text-indigo-300'}`} />
            <span className="text-sm">Trang cá nhân</span>
            {pathname === '/ca-nhan' && (
              <ChevronRightIcon className="ml-auto w-4 h-4" />
            )}
          </Link>
          <button 
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center p-2 rounded-lg hover:bg-indigo-800 transition-colors text-indigo-100 disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-300 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="text-sm">{isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar; 