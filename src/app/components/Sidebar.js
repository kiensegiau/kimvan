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
  Bars3Icon,
  XMarkIcon,
  ChartBarIcon,
  BellIcon,
  CogIcon
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import { useState, useEffect, useRef } from 'react';
import { logout } from '@/utils/auth-client';

const Sidebar = ({ closeSidebar }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const subMenuRef = useRef(null);

  useEffect(() => {
    const checkIfMobile = () => {
      const isMobileView = window.innerWidth < 1024;
      setIsMobile(isMobileView);
      
      // Tự động thu gọn trên mobile
      if (isMobileView && !collapsed) {
        setCollapsed(true);
      }
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, [collapsed]);

  // Xử lý click bên ngoài submenu để đóng
  useEffect(() => {
    function handleClickOutside(event) {
      if (subMenuRef.current && !subMenuRef.current.contains(event.target)) {
        setShowSubMenu(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/users/me');
        const result = await response.json();

        if (result.success && result.data) {
          setUserData({
            name: result.data.displayName || 'Người dùng',
            email: result.data.email || '',
            role: result.data.role || 'user'
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
    { 
      name: 'Trang chủ', 
      path: '/', 
      icon: <HomeIcon className="w-5 h-5" />,
      badge: null
    },
    { 
      name: 'Khóa học', 
      path: '/khoa-hoc', 
      icon: <AcademicCapIcon className="w-5 h-5" />,
      badge: { text: 'Mới', color: 'bg-green-500' }
    },
    { 
      name: 'Thư viện', 
      path: '/thu-vien', 
      icon: <BookOpenIcon className="w-5 h-5" />,
      badge: null,
      disabled: true
    },
    { 
      name: 'Thống kê', 
      path: '/thong-ke', 
      icon: <ChartBarIcon className="w-5 h-5" />,
      badge: null,
      disabled: true
    },
  ];

  const toggleCollapse = () => {
    setCollapsed(!collapsed);
  };

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
    <>
      {/* Overlay cho mobile */}
      {isMobile && !collapsed && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20"
          onClick={toggleCollapse}
        ></div>
      )}
      
      {/* Toggle button for mobile */}
      <button 
        onClick={toggleCollapse}
        className="fixed left-4 top-4 z-30 lg:hidden bg-indigo-600 p-2 rounded-lg text-white shadow-lg hover:bg-indigo-700 transition-all duration-300"
      >
        {collapsed ? <Bars3Icon className="w-6 h-6" /> : <XMarkIcon className="w-6 h-6" />}
      </button>

      <div 
        className={`h-screen bg-gradient-to-b from-indigo-800 to-indigo-950 text-white fixed left-0 top-0 flex flex-col shadow-2xl transition-all duration-300 z-30 
        ${collapsed ? 'w-0 lg:w-20 overflow-hidden' : 'w-72'}`}
      >
        {/* Button to collapse/expand on desktop */}
        <button 
          onClick={toggleCollapse}
          className="absolute right-4 top-4 text-indigo-300 hover:text-white transition-colors hidden lg:block"
        >
          {collapsed ? (
            <ChevronRightIcon className="w-5 h-5" />
          ) : (
            <XMarkIcon className="w-5 h-5" />
          )}
        </button>

        {/* Logo và tên */}
        <div className="p-5 border-b border-indigo-700/50 flex items-center justify-center lg:justify-start">
          <Link href="/" className={`flex items-center ${collapsed ? 'justify-center' : 'space-x-3'} group`}>
            <div className="min-w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-indigo-500/30 transition-all">
              <span className="text-white font-bold text-xl">K</span>
            </div>
            {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-xl font-bold text-white">Khoá học 6.0</h1>
              <p className="text-xs text-indigo-200">Học tập trực tuyến THPT</p>
            </div>
            )}
          </Link>
        </div>

        {/* Menu chính */}
        <nav className="flex-1 py-6 overflow-y-auto scrollbar-thin scrollbar-track-indigo-900 scrollbar-thumb-indigo-600">
          <div className={`${collapsed ? 'px-2' : 'px-4'}`}>
            {!collapsed && <p className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-2 px-3">Menu Chính</p>}
            <ul className="space-y-1.5">
              {menuItems.map((item) => (
                <li key={item.path}>
                  {item.disabled ? (
                    <button
                      className={`flex items-center ${collapsed ? 'justify-center px-2 py-3' : 'px-3 py-2.5'} rounded-lg transition-all duration-150 relative group w-full
                      text-indigo-100 hover:bg-indigo-700/30 hover:text-white opacity-70`}
                      onClick={() => alert(`Tính năng ${item.name} đang được phát triển!`)}
                    >
                      <span className={`${collapsed ? '' : 'mr-3'} text-indigo-300 group-hover:text-white`}>
                        {item.icon}
                      </span>
                      
                      {!collapsed && (
                        <>
                          <span className="font-medium">{item.name}</span>
                          {item.badge && (
                            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${item.badge.color} text-white`}>
                              {item.badge.text}
                            </span>
                          )}
                        </>
                      )}
                      
                      {/* Tooltip for collapsed state */}
                      {collapsed && (
                        <div className="absolute left-full ml-3 -translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all bg-indigo-900 text-white text-sm py-1.5 px-3 rounded whitespace-nowrap pointer-events-none">
                          {item.name}
                          {item.badge && (
                            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${item.badge.color} text-white`}>
                              {item.badge.text}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  ) : (
                    <Link
                      href={item.path}
                      className={`flex items-center ${collapsed ? 'justify-center px-2 py-3' : 'px-3 py-2.5'} rounded-lg transition-all duration-150 relative group
                      ${pathname === item.path
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md'
                        : 'text-indigo-100 hover:bg-indigo-700/50 hover:text-white'
                      }`}
                      onClick={handleMenuItemClick}
                    >
                      <span className={`${collapsed ? '' : 'mr-3'} ${pathname === item.path ? 'text-white' : 'text-indigo-300 group-hover:text-white'}`}>
                        {item.icon}
                      </span>
                      
                      {!collapsed && (
                        <>
                          <span className="font-medium">{item.name}</span>
                          {item.badge && (
                            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${item.badge.color} text-white`}>
                              {item.badge.text}
                            </span>
                          )}
                          {pathname === item.path ? (
                            <ChevronRightIcon className="ml-auto w-4 h-4" />
                          ) : null}
                        </>
                      )}
                      
                      {/* Tooltip for collapsed state */}
                      {collapsed && (
                        <div className="absolute left-full ml-3 -translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all bg-indigo-900 text-white text-sm py-1.5 px-3 rounded whitespace-nowrap pointer-events-none">
                          {item.name}
                          {item.badge && (
                            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${item.badge.color} text-white`}>
                              {item.badge.text}
                            </span>
                          )}
                        </div>
                      )}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
            
            {!collapsed && (
              <>
                <p className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mt-6 mb-2 px-3">Phụ trợ</p>
                <ul className="space-y-1.5">
                  <li>
                    <button
                      className="flex items-center px-3 py-2.5 rounded-lg transition-all duration-150 text-indigo-100 hover:bg-indigo-700/30 hover:text-white opacity-70 w-full"
                      onClick={() => alert('Tính năng Thông báo đang được phát triển!')}
                    >
                      <BellIcon className="mr-3 w-5 h-5 text-indigo-300" />
                      <span className="font-medium">Thông báo</span>
                      <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">3</span>
                    </button>
                  </li>
                  <li>
                    <Link
                      href="/ca-nhan"
                      className="flex items-center px-3 py-2.5 rounded-lg transition-all duration-150 text-indigo-100 hover:bg-indigo-700/50 hover:text-white w-full"
                      onClick={handleMenuItemClick}
                    >
                      <CogIcon className="mr-3 w-5 h-5 text-indigo-300" />
                      <span className="font-medium">Cài đặt</span>
                    </Link>
                  </li>
                </ul>
              </>
            )}
          </div>
        </nav>

        {/* User profile */}
        <div className={`${collapsed ? 'p-2' : 'p-4'} border-t border-indigo-700/50 bg-indigo-900/30`}>
          {collapsed ? (
            <div className="flex justify-center">
              <button
                onClick={() => setShowSubMenu(!showSubMenu)}
                className="relative group"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <UserCircleIcon className="w-6 h-6 text-white" />
                </div>
                
                {/* Sub menu popup */}
                {showSubMenu && (
                  <div 
                    ref={subMenuRef}
                    className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 bg-indigo-900 rounded-lg shadow-lg py-2 z-50"
                  >
                    <div className="px-4 py-2 border-b border-indigo-800">
                      <p className="font-medium text-sm truncate text-center">{userData?.name || 'Người dùng'}</p>
                      <p className="text-xs text-indigo-300 truncate text-center">{userData?.email || 'Chưa đăng nhập'}</p>
                    </div>
                    <div className="pt-2">
                      <Link 
                        href="/ca-nhan"
                        className="flex items-center px-4 py-2 hover:bg-indigo-800 transition-colors"
                        onClick={() => setShowSubMenu(false)}
                      >
                        <UserCircleIcon className="w-4 h-4 mr-2 text-indigo-300" />
                        <span className="text-sm">Trang cá nhân</span>
                      </Link>
                      <button 
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="w-full flex items-center px-4 py-2 hover:bg-indigo-800 transition-colors text-left disabled:opacity-50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span className="text-sm">{isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center p-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <UserCircleIcon className="w-6 h-6 text-white" />
                </div>
                <div className="ml-3 flex-1 overflow-hidden">
                  {loading ? (
                    <div className="animate-pulse">
                      <div className="h-4 bg-indigo-600 rounded w-3/4 mb-1"></div>
                      <div className="h-3 bg-indigo-700 rounded w-1/2"></div>
                    </div>
                  ) : (
                    <>
                      <p className="font-medium truncate">{userData?.name || 'Người dùng'}</p>
                      <div className="flex items-center text-xs text-indigo-300 mt-0.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1.5"></span>
                        <span>{getRoleDisplay(userData?.role)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link 
                  href="/ca-nhan" 
                  className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-150 ${
                    pathname === '/ca-nhan' 
                      ? 'bg-indigo-700 text-white' 
                      : 'hover:bg-indigo-800/50 text-indigo-100'
                  }`}
                >
                  <UserCircleIcon className={`w-5 h-5 mb-1 ${pathname === '/ca-nhan' ? 'text-white' : 'text-indigo-300'}`} />
                  <span className="text-xs font-medium">Hồ sơ</span>
                </Link>
                <button 
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-indigo-800/50 transition-all duration-150 text-indigo-100 disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="text-xs font-medium">{isLoggingOut ? 'Đang xử lý...' : 'Đăng xuất'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar; 