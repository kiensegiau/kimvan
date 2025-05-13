'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function KimVanCookieRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Hiển thị thông báo
    console.log('=== CHUYỂN HƯỚNG ĐẾN TRANG TOKEN MỚI ===');
    console.log('Trang kimvan-cookie đã được thay thế bằng kimvan-token');
    
    // Chuyển hướng đến trang mới
    router.push('/admin/kimvan-token');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
      <div className="animate-pulse mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold mb-2 text-center">Đang chuyển hướng...</h1>
      <p className="text-gray-600 text-center mb-4">Trang quản lý KimVan Cookie đã được nâng cấp lên Token</p>
      <div className="w-64 bg-gray-200 rounded-full h-2.5 mb-6">
        <div className="bg-blue-600 h-2.5 rounded-full w-full animate-[progress_2s_ease-in-out_infinite]"></div>
      </div>
      <p className="text-sm text-gray-500">Nếu không tự động chuyển hướng, hãy <a href="/admin/kimvan-token" className="text-blue-600 hover:underline">nhấn vào đây</a></p>
      
      <style jsx>{`
        @keyframes progress {
          0% { width: 0%; }
          50% { width: 100%; }
          100% { width: 0%; }
        }
      `}</style>
    </div>
  );
} 