'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

export default function RegisterPage() {
  const router = useRouter();
  const { user, register } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [csrfToken, setCsrfToken] = useState('');
  const [addToGoogleGroup, setAddToGoogleGroup] = useState(false);

  // Chuyển hướng nếu đã đăng nhập
  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  // Lấy CSRF token khi trang được tải
  useEffect(() => {
    // Lấy CSRF token từ cookie hoặc tạo mới
    const token = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrf-token='))
      ?.split('=')[1];
      
    if (token) {
      setCsrfToken(token);
    }
  }, []);

  // Xử lý đăng ký
  const handleRegister = async (e) => {
    e.preventDefault();
    
    // Kiểm tra dữ liệu đầu vào
    if (!email || !password || !confirmPassword) {
      setError('Vui lòng điền đầy đủ thông tin');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Mật khẩu không khớp');
      return;
    }
    
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      // Gọi hàm đăng ký từ hook useAuth
      const result = await register(email, password, csrfToken, addToGoogleGroup);
      
      if (result.success) {
        router.push('/');
      } else {
        setError(result.error || 'Đăng ký không thành công');
      }
    } catch (err) {
      console.error('Lỗi đăng ký:', err);
      setError(err.message || 'Đã xảy ra lỗi khi đăng ký');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
          Đăng ký tài khoản
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        {error && (
          <div className="bg-red-50 p-4 rounded-md mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Lỗi đăng ký</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <form className="space-y-6" onSubmit={handleRegister}>
          <input type="hidden" name="_csrf" value={csrfToken} />
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium leading-6 text-gray-900">
              Địa chỉ email
            </label>
            <div className="mt-2">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium leading-6 text-gray-900">
              Mật khẩu
            </label>
            <div className="mt-2">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium leading-6 text-gray-900">
              Xác nhận mật khẩu
            </label>
            <div className="mt-2">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              />
            </div>
          </div>
          
          <div className="flex items-center">
            <input
              id="addToGoogleGroup"
              name="addToGoogleGroup"
              type="checkbox"
              checked={addToGoogleGroup}
              onChange={(e) => setAddToGoogleGroup(e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="addToGoogleGroup" className="ml-2 block text-sm text-gray-900">
              Tự động thêm vào Google Group (kha-hc-60@googlegroups.com)
            </label>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:bg-indigo-300"
            >
              {loading ? 'Đang đăng ký...' : 'Đăng ký'}
            </button>
          </div>
        </form>

        <p className="mt-10 text-center text-sm text-gray-500">
          Đã có tài khoản?{' '}
          <Link href="/login" className="font-semibold leading-6 text-indigo-600 hover:text-indigo-500">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
} 