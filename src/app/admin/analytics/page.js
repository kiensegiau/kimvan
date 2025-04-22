'use client';

import { useState, useEffect } from 'react';
import {
  ChartBarIcon,
  UserGroupIcon,
  AcademicCapIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCourses: 0,
    totalSpreadsheets: 0,
    totalViews: 0,
  });

  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [
      {
        label: 'Lượt xem',
        data: [],
        backgroundColor: 'rgba(79, 70, 229, 0.5)',
        borderColor: 'rgb(79, 70, 229)',
        borderWidth: 1,
      },
    ],
  });

  useEffect(() => {
    // Simulate fetching data
    setTimeout(() => {
      setStats({
        totalUsers: 45,
        totalCourses: 12,
        totalSpreadsheets: 8,
        totalViews: 156,
      });

      setChartData({
        labels: ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6'],
        datasets: [
          {
            label: 'Lượt xem',
            data: [65, 59, 80, 81, 56, 55],
            backgroundColor: 'rgba(79, 70, 229, 0.5)',
            borderColor: 'rgb(79, 70, 229)',
            borderWidth: 1,
          },
        ],
      });

      setLoading(false);
    }, 1000);
  }, []);

  const statCards = [
    {
      name: 'Tổng số người dùng',
      value: stats.totalUsers,
      icon: UserGroupIcon,
      color: 'bg-blue-500',
    },
    {
      name: 'Tổng số khóa học',
      value: stats.totalCourses,
      icon: AcademicCapIcon,
      color: 'bg-green-500',
    },
    {
      name: 'Tổng số bảng tính',
      value: stats.totalSpreadsheets,
      icon: TableCellsIcon,
      color: 'bg-purple-500',
    },
    {
      name: 'Tổng lượt xem',
      value: stats.totalViews,
      icon: ChartBarIcon,
      color: 'bg-yellow-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Thống kê</h1>
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
          <h2 className="text-lg font-medium text-gray-900">Biểu đồ lượt xem</h2>
          <div className="mt-4 h-64">
            {/* Placeholder for chart */}
            <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
              <p className="text-gray-500">Biểu đồ sẽ được hiển thị ở đây</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-medium text-gray-900">Phân tích người dùng</h2>
          <div className="mt-4 space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Người dùng mới hôm nay</span>
              <span className="text-sm font-medium text-gray-900">5</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Người dùng đang hoạt động</span>
              <span className="text-sm font-medium text-gray-900">32</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Tỷ lệ chuyển đổi</span>
              <span className="text-sm font-medium text-gray-900">25%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Thời gian trung bình trên trang</span>
              <span className="text-sm font-medium text-gray-900">4 phút 32 giây</span>
            </div>
          </div>
        </div>
      </div>

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
          <div className="flex items-center space-x-4">
            <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
            <div>
              <p className="text-sm font-medium text-gray-900">Lượt xem tăng đột biến</p>
              <p className="text-sm text-gray-500">1 giờ trước</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 