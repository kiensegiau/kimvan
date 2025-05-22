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
    
        
        
        <div className="">
          {children}
        </div>
        
      
        
     
  );
} 