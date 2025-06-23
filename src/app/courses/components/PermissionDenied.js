'use client';

import { useRouter } from 'next/navigation';

export default function PermissionDenied({ message, redirectUrl = '/courses' }) {
  const router = useRouter();
  
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-8 relative">
        <div className="bg-amber-50 p-6 rounded-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-semibold text-amber-800">Từ chối truy cập</h3>
              <div className="mt-2 text-amber-700">
                <p>{message || 'Bạn không có quyền truy cập tài nguyên này.'}</p>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => router.push(redirectUrl)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
                >
                  <svg className="-ml-0.5 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                  Quay lại danh sách
                </button>
              </div>
              <div className="mt-4 text-sm text-amber-600">
                <p>Nếu bạn cho rằng đây là lỗi, vui lòng liên hệ với quản trị viên để được hỗ trợ.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 