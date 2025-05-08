import { useState, useEffect } from 'react';
import { onAuthStateChanged, getCurrentUser } from '@/utils/auth';
import { routes, cookieConfig } from '@/config/env-config';
import { useRouter } from 'next/navigation';

/**
 * Hook xác thực người dùng
 * @param {Object} options - Các tùy chọn
 * @param {boolean} options.requireAuth - Yêu cầu đăng nhập
 * @param {string} options.requiredRole - Vai trò yêu cầu (vd: 'admin')
 * @param {boolean} options.redirectIfAuthed - Chuyển hướng nếu đã đăng nhập
 * @param {string} options.redirectTo - Đường dẫn chuyển hướng
 */
export function useAuth(options = {}) {
  const {
    requireAuth = false,
    requiredRole = null,
    redirectIfAuthed = false,
    redirectTo = ''
  } = options;

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Lấy token từ cookie phía client
        const getCookie = name => {
          const value = `; ${document.cookie}`;
          const parts = value.split(`; ${name}=`);
          if (parts.length === 2) return parts.pop().split(';').shift();
          return null;
        };

        const token = getCookie(cookieConfig.authCookieName);
        
        if (!token) {
          setUser(null);
          // Nếu yêu cầu đăng nhập mà không có token, chuyển hướng đến trang đăng nhập
          if (requireAuth) {
            const url = `${routes.login}?returnUrl=${encodeURIComponent(window.location.pathname)}`;
            router.push(url);
          }
          setLoading(false);
          return;
        }

        // Gọi API để xác thực token
        const response = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (data.valid && data.user) {
          setUser(data.user);
          
          // Kiểm tra quyền nếu có yêu cầu vai trò cụ thể
          if (requiredRole && data.user.role !== requiredRole && data.user.role !== 'admin') {
            // Nếu không đủ quyền, chuyển hướng về trang chủ
            router.push(routes.home);
          }
          
          // Chuyển hướng nếu đã đăng nhập và có cờ redirectIfAuthed
          if (redirectIfAuthed && redirectTo) {
            router.push(redirectTo);
          }
        } else {
          setUser(null);
          // Nếu token không hợp lệ và yêu cầu đăng nhập, chuyển hướng
          if (requireAuth) {
            const url = `${routes.login}?returnUrl=${encodeURIComponent(window.location.pathname)}`;
            router.push(url);
          }
        }
      } catch (err) {
        console.error('Lỗi xác thực:', err);
        setError(err.message);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    // Theo dõi thay đổi trạng thái xác thực
    const unsubscribe = onAuthStateChanged((firebaseUser) => {
      if (firebaseUser) {
        // Nếu có người dùng Firebase, kiểm tra token
        checkAuth();
      } else {
        // Nếu không có người dùng Firebase
        setUser(null);
        setLoading(false);
        
        // Chuyển hướng nếu yêu cầu đăng nhập
        if (requireAuth) {
          const url = `${routes.login}?returnUrl=${encodeURIComponent(window.location.pathname)}`;
          router.push(url);
        }
      }
    });

    // Cleanup
    return () => {
      unsubscribe();
    };
  }, [requireAuth, requiredRole, redirectIfAuthed, redirectTo, router]);

  // Lấy token hiện tại từ client
  const getIdToken = async () => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      return await currentUser.getIdToken();
    }
    return null;
  };

  // Các phương thức tiện ích
  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    hasRole: (role) => user?.role === role || user?.role === 'admin',
    getIdToken
  };
} 