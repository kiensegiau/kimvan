'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  AcademicCapIcon,
  UserGroupIcon,
  TableCellsIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

export default function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (path) => {
    return pathname.startsWith(path) ? 'bg-indigo-700 text-white' : 'text-indigo-100 hover:bg-indigo-600 hover:text-white';
  };

  const menuItems = [
    { name: 'Trang chủ', path: '/admin', icon: HomeIcon },
    { name: 'Khóa học', path: '/admin/courses', icon: AcademicCapIcon },
    { name: 'Người dùng', path: '/admin/users', icon: UserGroupIcon },
    { name: 'Bảng tính', path: '/admin/spreadsheets', icon: TableCellsIcon },
    { name: 'Thống kê', path: '/admin/analytics', icon: ChartBarIcon },
    { name: 'Cài đặt', path: '/admin/settings', icon: Cog6ToothIcon },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-40 flex md:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)}></div>
        <div className="relative flex w-full max-w-xs flex-1 flex-col bg-indigo-800">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="sr-only">Đóng sidebar</span>
              <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
            </button>
          </div>
          <div className="h-0 flex-1 overflow-y-auto pt-5 pb-4">
            <div className="flex flex-shrink-0 items-center px-4">
              <h1 className="text-xl font-bold text-white">KIMVAN ADMIN</h1>
            </div>
            <nav className="mt-5 space-y-1 px-2">
              {menuItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.path}
                  className={`group flex items-center rounded-md px-2 py-2 text-base font-medium ${isActive(item.path)}`}
                >
                  <item.icon className="mr-4 h-6 w-6 flex-shrink-0" aria-hidden="true" />
                  {item.name}
                </Link>
              ))}
              <Link
                href="/"
                className="group flex items-center rounded-md px-2 py-2 text-base font-medium text-indigo-100 hover:bg-indigo-600 hover:text-white"
              >
                <ArrowLeftOnRectangleIcon className="mr-4 h-6 w-6 flex-shrink-0" aria-hidden="true" />
                Quay lại trang chủ
              </Link>
            </nav>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
        <div className="flex min-h-0 flex-1 flex-col bg-indigo-800">
          <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
            <div className="flex flex-shrink-0 items-center px-4">
              <h1 className="text-xl font-bold text-white">KIMVAN ADMIN</h1>
            </div>
            <nav className="mt-5 flex-1 space-y-1 px-2">
              {menuItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.path}
                  className={`group flex items-center rounded-md px-2 py-2 text-sm font-medium ${isActive(item.path)}`}
                >
                  <item.icon className="mr-3 h-6 w-6 flex-shrink-0" aria-hidden="true" />
                  {item.name}
                </Link>
              ))}
              <Link
                href="/"
                className="group flex items-center rounded-md px-2 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-600 hover:text-white"
              >
                <ArrowLeftOnRectangleIcon className="mr-3 h-6 w-6 flex-shrink-0" aria-hidden="true" />
                Quay lại trang chủ
              </Link>
            </nav>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col md:pl-64">
        <div className="sticky top-0 z-10 bg-white pl-1 pt-1 sm:pl-3 sm:pt-3 md:hidden">
          <button
            type="button"
            className="-ml-0.5 -mt-0.5 inline-flex h-12 w-12 items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Mở sidebar</span>
            <Bars3Icon className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        <main className="flex-1">
          <div className="py-6">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
} 