'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  HomeIcon,
  AcademicCapIcon, 
  PlayIcon,
  UserGroupIcon,
  BookOpenIcon,
  CogIcon,
  BellIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline';
import { useState, useEffect } from 'react';

const Sidebar = ({ closeSidebar }) => {
  const pathname = usePathname();
  const [showNotifications, setShowNotifications] = useState(false);
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

  // Xử lý sự kiện khi nhấn vào một mục menu
  const handleMenuItemClick = () => {
    if (isMobile && closeSidebar) {
      closeSidebar();
    }
  };

  const mainMenuItems = [
    { name: 'Trang chủ', path: '/', icon: <HomeIcon className="w-5 h-5" /> },
    { name: 'Khóa học', path: '/khoa-hoc', icon: <AcademicCapIcon className="w-5 h-5" /> },
    { name: 'Bài giảng video', path: '/video-player', icon: <PlayIcon className="w-5 h-5" /> },
    { name: 'Tài liệu học tập', path: '/tai-lieu', icon: <BookOpenIcon className="w-5 h-5" /> },
  ];
  
  const adminMenuItems = [
    { name: 'Quản lý người dùng', path: '/admin/users', icon: <UserGroupIcon className="w-5 h-5" /> },
    { name: 'Quản lý khóa học', path: '/admin', icon: <CogIcon className="w-5 h-5" /> }
  ];

  // Danh sách thông báo mẫu
  const notifications = [
    {
      id: 1,
      title: 'Khóa học mới',
      message: 'Khóa học Lập trình Web Frontend vừa được thêm vào.',
      time: '5 phút trước',
      read: false
    },
    {
      id: 2,
      title: 'Cập nhật nội dung',
      message: 'Bài giảng "JavaScript cơ bản" đã được cập nhật.',
      time: '2 giờ trước',
      read: true
    }
  ];

  return (
    <div className="h-screen w-64 bg-gradient-to-b from-indigo-900 via-indigo-800 to-indigo-900 text-white fixed left-0 top-0 flex flex-col shadow-xl">
      {/* Logo và tên */}
      <div className="p-5 border-b border-indigo-700/50">
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-pink-500/20 transition-all duration-300">
            <span className="text-white font-bold text-xl">K</span>
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-white to-indigo-200 bg-clip-text text-transparent">Kimvan</h1>
            <p className="text-xs text-indigo-200">Nền tảng học tập trực tuyến</p>
          </div>
        </Link>
      </div>

      {/* Menu chính */}
      <nav className="flex-1 p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-indigo-700 scrollbar-track-transparent">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-2 px-3">Menu chính</p>
          <ul className="space-y-1">
            {mainMenuItems.map((item) => (
              <li key={item.path}>
                <Link
                  href={item.path}
                  className={`flex items-center p-3 rounded-lg transition-all ${
                    pathname === item.path
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg'
                      : 'text-indigo-100 hover:bg-indigo-800/60 hover:text-white'
                  }`}
                  onClick={handleMenuItemClick}
                >
                  <span className={`mr-3 ${pathname === item.path ? 'text-white' : 'text-indigo-300'}`}>{item.icon}</span>
                  <span className="font-medium">{item.name}</span>
                  {pathname === item.path && (
                    <span className="ml-auto w-1.5 h-5 bg-pink-500 rounded-full"></span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Menu admin */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-2 px-3">Quản trị</p>
          <ul className="space-y-1">
            {adminMenuItems.map((item) => (
              <li key={item.path}>
                <Link
                  href={item.path}
                  className={`flex items-center p-3 rounded-lg transition-all ${
                    pathname === item.path
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg'
                      : 'text-indigo-100 hover:bg-indigo-800/60 hover:text-white'
                  }`}
                  onClick={handleMenuItemClick}
                >
                  <span className={`mr-3 ${pathname === item.path ? 'text-white' : 'text-indigo-300'}`}>{item.icon}</span>
                  <span className="font-medium">{item.name}</span>
                  {pathname === item.path && (
                    <span className="ml-auto w-1.5 h-5 bg-pink-500 rounded-full"></span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Thống kê */}
        <div className="bg-indigo-800/40 rounded-lg p-4 mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-3">Thống kê học tập</p>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-indigo-100">Hoàn thành</span>
              <span className="text-sm font-medium text-indigo-100">68%</span>
            </div>
            <div className="w-full h-2 bg-indigo-700/50 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-400 to-pink-500 rounded-full" style={{ width: '68%' }}></div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="bg-indigo-700/30 p-2 rounded text-center">
                <p className="text-xs text-indigo-200">Khóa học</p>
                <p className="text-lg font-bold text-white">12</p>
              </div>
              <div className="bg-indigo-700/30 p-2 rounded text-center">
                <p className="text-xs text-indigo-200">Chứng chỉ</p>
                <p className="text-lg font-bold text-white">3</p>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Thông báo */}
      <div className="px-4 py-2 border-t border-indigo-700/50 relative">
        <button 
          onClick={() => setShowNotifications(!showNotifications)} 
          className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-indigo-800/60 transition-colors"
        >
          <div className="flex items-center">
            <BellIcon className="w-5 h-5 text-indigo-300 mr-3" />
            <span className="font-medium">Thông báo</span>
          </div>
          <span className="bg-pink-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {notifications.filter(n => !n.read).length}
          </span>
        </button>
        
        {showNotifications && (
          <div className="absolute bottom-16 left-4 right-4 bg-indigo-800 rounded-lg shadow-lg overflow-hidden z-10">
            <div className="p-3 border-b border-indigo-700 bg-indigo-900/50">
              <p className="font-medium">Thông báo gần đây</p>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {notifications.map(notification => (
                <div key={notification.id} className={`p-3 border-b border-indigo-700/50 hover:bg-indigo-700/30 ${!notification.read ? 'bg-indigo-700/20' : ''}`}>
                  <div className="flex justify-between">
                    <p className="text-sm font-medium">{notification.title}</p>
                    {!notification.read && <span className="w-2 h-2 bg-pink-500 rounded-full"></span>}
                  </div>
                  <p className="text-xs text-indigo-300 mt-1">{notification.message}</p>
                  <p className="text-xs text-indigo-400 mt-2">{notification.time}</p>
                </div>
              ))}
            </div>
            <div className="p-2 bg-indigo-900/50 text-center">
              <button className="text-xs text-indigo-300 hover:text-white transition-colors">
                Xem tất cả thông báo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User profile */}
      <div className="p-4 border-t border-indigo-700/50">
        <div className="flex items-center p-2 rounded-lg hover:bg-indigo-800/60 transition-colors cursor-pointer">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-indigo-500 flex items-center justify-center shadow-lg mr-3">
            <UserCircleIcon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Nguyễn Văn A</p>
            <p className="text-xs text-indigo-300">Học viên</p>
          </div>
        </div>
        <button className="mt-2 w-full py-2 px-3 rounded-lg border border-indigo-700 text-sm font-medium text-indigo-200 hover:bg-indigo-800/60 hover:text-white transition-colors flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Đăng xuất
        </button>
      </div>
    </div>
  );
};

export default Sidebar; 