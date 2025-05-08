'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { routes } from '@/config/env-config';

export default function RegisterPage() {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    terms: false
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    message: '',
    color: ''
  });
  
  const [csrfToken, setCsrfToken] = useState('');
  
  // Lấy CSRF token khi component mount
  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        const response = await fetch('/api/csrf');
        const data = await response.json();
        if (data.token) {
          setCsrfToken(data.token);
        }
      } catch (error) {
        console.error('Lỗi lấy CSRF token:', error);
      }
    };
    
    fetchCsrfToken();
  }, []);
  
  // Xóa thông báo lỗi sau 5 giây
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('');
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [error]);
  
  // Kiểm tra độ mạnh của mật khẩu
  useEffect(() => {
    if (formData.password) {
      checkPasswordStrength(formData.password);
    } else {
      setPasswordStrength({
        score: 0,
        message: '',
        color: ''
      });
    }
  }, [formData.password]);
  
  // Hàm kiểm tra độ mạnh của mật khẩu
  const checkPasswordStrength = (password) => {
    let score = 0;
    let message = '';
    let color = '';
    
    // Kiểm tra độ dài
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    
    // Kiểm tra chữ hoa/thường
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    
    // Kiểm tra số và ký tự đặc biệt
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    
    // Xác định thông báo và màu sắc dựa trên điểm số
    if (score < 3) {
      message = 'Yếu';
      color = 'bg-red-500';
    } else if (score < 5) {
      message = 'Trung bình';
      color = 'bg-yellow-500';
    } else {
      message = 'Mạnh';
      color = 'bg-green-500';
    }
    
    setPasswordStrength({ score, message, color });
  };
  
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Xác thực form
    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }
    
    if (formData.password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }
    
    if (passwordStrength.score < 3) {
      setError('Vui lòng sử dụng mật khẩu mạnh hơn để bảo vệ tài khoản của bạn');
      return;
    }
    
    if (!formData.terms) {
      setError('Bạn phải đồng ý với Điều khoản dịch vụ và Chính sách bảo mật');
      return;
    }
    
    setLoading(true);
    
    try {
      // Gọi API đăng ký thay vì trực tiếp dùng Firebase
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          _csrf: csrfToken
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Đăng ký thất bại. Vui lòng thử lại.');
      }
      
      // Chuyển hướng đến trang chủ sau khi đăng ký thành công
      router.push(routes.home);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Hiển thị thanh độ mạnh mật khẩu
  const renderPasswordStrengthBar = () => {
    if (!formData.password) return null;
    
    return (
      <div className="mt-1">
        <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full ${passwordStrength.color} transition-all duration-300 ease-in-out`}
            style={{ width: `${(passwordStrength.score / 6) * 100}%` }}
          ></div>
        </div>
        <p className={`text-xs mt-1 ${passwordStrength.score < 3 ? 'text-red-600' : passwordStrength.score < 5 ? 'text-yellow-600' : 'text-green-600'}`}>
          {passwordStrength.message}
        </p>
      </div>
    );
  };
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Đăng ký tài khoản mới
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Tạo tài khoản để truy cập vào hệ thống
          </p>
        </div>
        
        {error && (
          <div className="rounded-md bg-red-50 p-4 mb-4 transition-opacity duration-300">
            <div className="flex">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {/* CSRF token ẩn */}
          <input type="hidden" name="_csrf" value={csrfToken} />
          
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="relative block w-full rounded-md border-0 p-2 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm mt-1"
                placeholder="your.email@example.com"
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Mật khẩu
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="relative block w-full rounded-md border-0 p-2 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm mt-1"
                placeholder="Mật khẩu mạnh (ít nhất 8 ký tự)"
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
              />
              {renderPasswordStrengthBar()}
              <p className="text-xs text-gray-500 mt-1">
                Mật khẩu nên có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt
              </p>
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Xác nhận mật khẩu
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className="relative block w-full rounded-md border-0 p-2 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm mt-1"
                placeholder="Nhập lại mật khẩu"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="terms"
                name="terms"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                checked={formData.terms}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="terms" className="text-gray-900">
                Tôi đồng ý với 
                <a href="/terms" className="font-semibold text-blue-600 hover:text-blue-500 mx-1">
                  Điều khoản dịch vụ
                </a>
                và
                <a href="/privacy" className="font-semibold text-blue-600 hover:text-blue-500 mx-1">
                  Chính sách bảo mật
                </a>
              </label>
            </div>
          </div>
          
          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:bg-blue-300"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang đăng ký...
                </span>
              ) : (
                'Đăng ký'
              )}
            </button>
          </div>
        </form>
        
        <p className="mt-2 text-center text-sm text-gray-600">
          Đã có tài khoản?{' '}
          <Link href={routes.login} className="font-semibold text-blue-600 hover:text-blue-500">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
} 