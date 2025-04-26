'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  FaHome, 
  FaBook, 
  FaVideo, 
  FaUserShield,
  FaSignOutAlt,
  FaUserCircle
} from 'react-icons/fa';

const Sidebar = () => {
  const pathname = usePathname();

  const menuItems = [
    { name: 'Trang chủ', path: '/', icon: <FaHome className="w-5 h-5" /> },
    { name: 'Khóa học', path: '/khoa-hoc', icon: <FaBook className="w-5 h-5" /> },
    { name: 'Video', path: '/video-player', icon: <FaVideo className="w-5 h-5" /> },
    { name: 'Admin', path: '/admin', icon: <FaUserShield className="w-5 h-5" /> },
  ];

  return (
    <div className="h-screen w-64 bg-gradient-to-b from-blue-900 to-blue-800 text-white fixed left-0 top-0 flex flex-col">
      {/* Logo và tên */}
      <div className="p-6 border-b border-blue-700">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
            <span className="text-blue-800 font-bold text-xl">K</span>
          </div>
          <h1 className="text-xl font-bold">Kimvan</h1>
        </div>
      </div>

      {/* Menu chính */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.path}>
              <Link
                href={item.path}
                className={`flex items-center p-3 rounded-lg transition-all ${
                  pathname === item.path
                    ? 'bg-blue-700 text-white shadow-lg'
                    : 'text-blue-100 hover:bg-blue-700 hover:text-white'
                }`}
              >
                <span className="mr-3">{item.icon}</span>
                <span className="font-medium">{item.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* User profile và logout */}
      <div className="p-4 border-t border-blue-700">
        <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-700 cursor-pointer">
          <FaUserCircle className="w-6 h-6 text-blue-200" />
          <div className="flex-1">
            <p className="font-medium">Người dùng</p>
            <p className="text-sm text-blue-200">admin@kimvan.com</p>
          </div>
        </div>
        <button className="flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-700 w-full mt-2 text-blue-200">
          <FaSignOutAlt className="w-5 h-5" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar; 