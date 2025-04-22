'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AcademicCapIcon,
  UserGroupIcon,
  TableCellsIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

export default function AdminDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const [stats, setStats] = useState({
    courses: 0,
    users: 0,
    spreadsheets: 0,
    analytics: 0,
  });

  useEffect(() => {
    // Kiểm tra trạng thái đăng nhập admin
    const checkAuthStatus = async () => {
      try {
        // Thay thế bằng API thực tế kiểm tra quyền admin
        const response = await fetch('/api/admin/auth-check');
        const data = await response.json();
        
        if (data.authenticated) {
          setIsAuthenticated(true);
        } else {
          // Chuyển hướng nếu không có quyền admin
          router.push('/');
        }
      } catch (error) {
        console.error('Lỗi kiểm tra xác thực:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, [router]);

  useEffect(() => {
    // Simulate fetching data
    setStats({
      courses: 12,
      users: 45,
      spreadsheets: 8,
      analytics: 156,
    });
  }, []);

  const statCards = [
    {
      name: 'Khóa học',
      value: stats.courses,
      icon: AcademicCapIcon,
      color: 'bg-blue-500',
    },
    {
      name: 'Người dùng',
      value: stats.users,
      icon: UserGroupIcon,
      color: 'bg-green-500',
    },
    {
      name: 'Bảng tính',
      value: stats.spreadsheets,
      icon: TableCellsIcon,
      color: 'bg-purple-500',
    },
    {
      name: 'Lượt xem',
      value: stats.analytics,
      icon: ChartBarIcon,
      color: 'bg-yellow-500',
    },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Đang tải...</h1>
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Sẽ được chuyển hướng bởi useEffect
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-500">Cập nhật lần cuối: {new Date().toLocaleString('vi-VN')}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div
            key={stat.name}
            className="relative overflow-hidden rounded-lg bg-white px-4 pt-5 pb-12 shadow sm:px-6 sm:pt-6"
          >
            <dt>
              <div className={`absolute rounded-md p-3 ${stat.color}`}>
                <stat.icon className="h-6 w-6 text-white" aria-hidden="true" />
              </div>
              <p className="ml-16 truncate text-sm font-medium text-gray-500">{stat.name}</p>
            </dt>
            <dd className="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
            </dd>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-medium text-gray-900">Hoạt động gần đây</h2>
          <div className="mt-4 space-y-4">
            <div className="flex items-center space-x-4">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <div>
                <p className="text-sm font-medium text-gray-900">Người dùng mới đăng ký</p>
                <p className="text-sm text-gray-500">5 phút trước</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="h-2 w-2 rounded-full bg-blue-500"></div>
              <div>
                <p className="text-sm font-medium text-gray-900">Khóa học mới được tạo</p>
                <p className="text-sm text-gray-500">15 phút trước</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="h-2 w-2 rounded-full bg-purple-500"></div>
              <div>
                <p className="text-sm font-medium text-gray-900">Bảng tính được cập nhật</p>
                <p className="text-sm text-gray-500">30 phút trước</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-medium text-gray-900">Thống kê nhanh</h2>
          <div className="mt-4 space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Tổng số khóa học</span>
              <span className="text-sm font-medium text-gray-900">12</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Tổng số người dùng</span>
              <span className="text-sm font-medium text-gray-900">45</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Tổng số bảng tính</span>
              <span className="text-sm font-medium text-gray-900">8</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Lượt xem hôm nay</span>
              <span className="text-sm font-medium text-gray-900">156</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 