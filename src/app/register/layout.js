import AuthLayout from '../auth/layout';

/**
 * Layout cho trang đăng ký sử dụng layout xác thực chung
 */
export default function RegisterLayout({ children }) {
  return <AuthLayout>{children}</AuthLayout>;
} 