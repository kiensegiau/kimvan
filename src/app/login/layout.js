import AuthLayout from '../auth/layout';

/**
 * Layout cho trang đăng nhập sử dụng layout xác thực chung
 */
export default function LoginLayout({ children }) {
  return <AuthLayout>{children}</AuthLayout>;
} 