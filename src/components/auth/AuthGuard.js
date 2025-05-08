'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { routes } from '@/config/env-config';
import { useEffect } from 'react';

/**
 * Component bảo vệ các trang yêu cầu xác thực
 * @param {Object} props - Props 
 * @param {React.ReactNode} props.children - Nội dung trang
 * @param {string} props.requiredRole - Vai trò yêu cầu (vd: 'admin')
 */
export default function AuthGuard({ children, requiredRole = null }) {
  const { user, loading, isAuthenticated, hasRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Đảm bảo chỉ kiểm tra sau khi loading hoàn tất
    if (!loading) {
      // Nếu không đăng nhập, chuyển hướng đến trang đăng nhập
      if (!isAuthenticated) {
        const returnUrl = encodeURIComponent(window.location.pathname);
        router.push(`${routes.login}?returnUrl=${returnUrl}`);
        return;
      }
      
      // Nếu có yêu cầu vai trò và không đủ quyền
      if (requiredRole && !hasRole(requiredRole)) {
        // Chuyển hướng về trang chủ
        router.push(routes.home);
      }
    }
  }, [loading, isAuthenticated, requiredRole, hasRole, router]);

  // Hiển thị spinner khi đang loading
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-10 w-10 border-4 border-blue-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }

  // Nếu không xác thực hoặc không đủ quyền, không hiển thị nội dung
  if (!isAuthenticated || (requiredRole && !hasRole(requiredRole))) {
    return null;
  }

  // Nếu đã đăng nhập và đủ quyền, hiển thị nội dung trang
  return children;
} 