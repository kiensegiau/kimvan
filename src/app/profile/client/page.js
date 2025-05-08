'use client';

import AuthGuard from '@/components/auth/AuthGuard';
import { useAuth } from '@/hooks/useAuth';

export default function ProfilePage() {
  // Trang này tự động được bảo vệ bởi AuthGuard
  // và đã được xác thực khi hiển thị
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Hồ sơ người dùng</h1>
        
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex flex-col md:flex-row">
            <div className="w-full md:w-1/3 mb-6 md:mb-0">
              {user?.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || 'Avatar người dùng'} 
                  className="rounded-full w-32 h-32 mx-auto border-4 border-gray-200"
                />
              ) : (
                <div className="rounded-full w-32 h-32 mx-auto bg-blue-500 flex items-center justify-center">
                  <span className="text-3xl text-white font-bold">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
              )}
            </div>
            
            <div className="w-full md:w-2/3">
              <h2 className="text-xl font-bold">
                {user?.displayName || 'Người dùng'}
              </h2>
              
              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p>{user?.email}</p>
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
                
                <div>
                  <p className="text-sm text-gray-500">Vai trò</p>
                  <p className="capitalize">{user?.role || 'Người dùng'}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">ID người dùng</p>
                  <p className="text-sm text-gray-700">{user?.uid}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
} 