'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { logout } from '@/utils/auth';
import { routes, cookieConfig } from '@/config/env-config';

export default function LogoutPage() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    const handleLogout = async () => {
      try {
        // Đăng xuất khỏi Firebase Auth
        await logout();
        
        // Xóa token cookie
        document.cookie = `${cookieConfig.authCookieName}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict; Secure=${cookieConfig.secure}`;
        
        // Chuyển hướng đến trang đăng nhập sau 2 giây
        setTimeout(() => {
          router.push(routes.login);
        }, 2000);
      } catch (error) {
        console.error('Lỗi đăng xuất:', error);
        setError('Đã xảy ra lỗi khi đăng xuất. Vui lòng thử lại.');
        setIsLoggingOut(false);
      }
    };
    
    handleLogout();
  }, [router]);
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="w-full max-w-md text-center">
        {isLoggingOut ? (
          <div className="space-y-4">
            <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <h2 className="text-xl font-medium text-gray-900">Đang đăng xuất...</h2>
            <p className="text-sm text-gray-600">Bạn sẽ được chuyển hướng đến trang đăng nhập sau khi đăng xuất thành công.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {error ? (
              <>
                <div className="rounded-md bg-red-50 p-4 mb-4 mx-auto max-w-md">
                  <div className="flex">
                    <div className="text-sm text-red-700">{error}</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsLoggingOut(true);
                    setTimeout(() => {
                      router.push(routes.login);
                    }, 500);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Quay lại đăng nhập
                </button>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
} 