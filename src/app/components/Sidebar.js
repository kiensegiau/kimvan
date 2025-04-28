'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  HomeIcon,
  AcademicCapIcon, 
  BookOpenIcon,
  CalendarIcon,
  DocumentTextIcon,
  InformationCircleIcon,
  UserCircleIcon,
  ChevronRightIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import { useState, useEffect } from 'react';

const Sidebar = ({ closeSidebar }) => {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);

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

  const handleMenuItemClick = () => {
    if (isMobile && closeSidebar) {
      closeSidebar();
    }
  };

  const menuItems = [
    { name: 'Trang chủ', path: '/', icon: <HomeIcon className="w-5 h-5" /> },
    { name: 'Khóa học', path: '/khoa-hoc', icon: <AcademicCapIcon className="w-5 h-5" /> },
    { name: 'Thư viện', path: '/thu-vien', icon: <BookOpenIcon className="w-5 h-5" /> },
    { name: 'Quản trị', path: '/admin', icon: <Cog6ToothIcon className="w-5 h-5" /> },
  ];

  return (
    <div className="h-screen w-64 bg-gradient-to-b from-indigo-700 to-indigo-900 text-white fixed left-0 top-0 flex flex-col shadow-xl">
      {/* Logo và tên */}
      <div className="p-5 border-b border-indigo-600/50">
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-xl">K</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Kimvan</h1>
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
                    ? 'bg-indigo-600 text-white'
                    : 'text-indigo-100 hover:bg-indigo-800 hover:text-white'
                }`}
                onClick={handleMenuItemClick}
              >
                <span className="mr-3">{item.icon}</span>
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
        <div className="flex items-center p-2">
          <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center mr-3">
            <UserCircleIcon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Học sinh</p>
            <p className="text-xs text-indigo-300">Lớp 11A1</p>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <button className="w-full flex items-center p-2 rounded-lg hover:bg-indigo-800 transition-colors">
            <UserCircleIcon className="w-5 h-5 text-indigo-300 mr-3" />
            <span className="text-sm">Trang cá nhân</span>
          </button>
          <button className="w-full flex items-center p-2 rounded-lg hover:bg-indigo-800 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-300 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="text-sm">Đăng xuất</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar; 