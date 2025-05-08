'use client';

import { Inter } from 'next/font/google';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';

const inter = Inter({ subsets: ['latin'] });

/**
 * Layout chung cho các trang xác thực (đăng nhập, đăng ký, quên mật khẩu)
 * Cung cấp giao diện nhất quán với logo và các liên kết xác thực
 */
export default function AuthLayout({ children }) {
  return (
    <div className={`${inter.className} flex min-h-screen flex-col items-center justify-center bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-12`}>
      <div className="w-full max-w-md space-y-8">
        {/* Logo và tiêu đề */}
        <div className="flex flex-col items-center">
          <Link href="/" className="mb-6">
            <Image 
              src="/logo.png" 
              alt="Kimvan Logo"
              width={120}
              height={40}
              priority
              className="h-10 w-auto object-contain"
            />
          </Link>
        </div>
        
        {/* Form đăng nhập hoặc đăng ký */}
        <div className="rounded-xl bg-white px-8 py-10 shadow-md">
          {children}
        </div>
        
        {/* Footer với các liên kết */}
        <div className="mt-4 text-center text-sm text-gray-600">
          <p className="mt-2">
            © {new Date().getFullYear()} Kimvan. Đã đăng ký bản quyền.
          </p>
        </div>
      </div>
    </div>
  );
} 