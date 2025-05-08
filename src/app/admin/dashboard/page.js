'use client';

import AuthGuard from '@/components/auth/AuthGuard';
import { useAuth } from '@/hooks/useAuth';

export default function AdminDashboardPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <AuthGuard requiredRole="admin">
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Bảng điều khiển quản trị</h1>
        
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Xin chào, {user?.displayName || 'Quản trị viên'}</h2>
          <p className="text-gray-700 mb-4">
            Đây là trang dành riêng cho quản trị viên. Chỉ người dùng có vai trò 'admin' mới có thể truy cập trang này.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium text-blue-800">Người dùng</h3>
              <p className="text-3xl font-bold text-blue-600">0</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-medium text-green-800">Bài viết</h3>
              <p className="text-3xl font-bold text-green-600">0</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-medium text-purple-800">Bình luận</h3>
              <p className="text-3xl font-bold text-purple-600">0</p>
            </div>
          </div>
          
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-3">Thông tin tài khoản</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p>{user?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">ID</p>
                  <p className="text-sm">{user?.uid}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Vai trò</p>
                  <p className="capitalize">{user?.role}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Trạng thái email</p>
                  <p>
                    {user?.emailVerified 
                      ? <span className="text-green-600">Đã xác thực</span>
                      : <span className="text-red-600">Chưa xác thực</span>
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
} 