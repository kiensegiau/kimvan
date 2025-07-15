'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  VideoCameraIcon, 
  KeyIcon, 
  CloudArrowUpIcon, 
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

export default function YouTubeSetup() {
  const [tokenStatus, setTokenStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    checkTokenStatus();
  }, []);
  
  // Kiểm tra trạng thái token hiện tại
  const checkTokenStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/youtube/chrome-token', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      setTokenStatus(data);
    } catch (err) {
      console.error('Lỗi khi kiểm tra token YouTube:', err);
      setError('Không thể kết nối đến API để kiểm tra token');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Cài đặt YouTube</h1>
        
        <button
          onClick={checkTokenStatus}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          disabled={loading}
        >
          {loading ? (
            <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-5 w-5" />
          ) : (
            <ArrowPathIcon className="-ml-1 mr-2 h-5 w-5" />
          )}
          Làm mới
        </button>
      </div>
      
      {error && (
        <div className="bg-red-50 p-4 rounded-md mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <ExclamationCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Đã xảy ra lỗi
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Thẻ trạng thái Token */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center">
            <KeyIcon className="h-6 w-6 text-gray-600 mr-3" />
            <h3 className="text-lg leading-6 font-medium text-gray-900">Trạng thái Token YouTube</h3>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Token được sử dụng để xác thực với YouTube API
          </p>
        </div>
        
        <div className="px-4 py-5 sm:p-6">
          {loading ? (
            <div className="text-center py-4">
              <ArrowPathIcon className="animate-spin h-8 w-8 text-indigo-500 mx-auto" />
              <p className="mt-2 text-gray-500">Đang kiểm tra token...</p>
            </div>
          ) : tokenStatus ? (
            <div className="space-y-4">
              <div className={`p-4 rounded-md ${tokenStatus.valid ? 'bg-green-50' : 'bg-yellow-50'}`}>
                <div className="flex">
                  <div className="flex-shrink-0">
                    {tokenStatus.valid ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-400" />
                    ) : (
                      <ExclamationCircleIcon className="h-5 w-5 text-yellow-400" />
                    )}
                  </div>
                  <div className="ml-3">
                    <h3 className={`text-sm font-medium ${tokenStatus.valid ? 'text-green-800' : 'text-yellow-800'}`}>
                      {tokenStatus.valid ? 'Token hợp lệ' : 'Token không hợp lệ'}
                    </h3>
                    <div className={`mt-2 text-sm ${tokenStatus.valid ? 'text-green-700' : 'text-yellow-700'}`}>
                      <p>
                        {tokenStatus.exists 
                          ? `Token ${tokenStatus.valid ? 'còn hạn' : 'đã hết hạn'}, còn lại: ${tokenStatus.timeRemaining}` 
                          : 'Chưa thiết lập token'}
                      </p>
                      {tokenStatus.channelInfo && tokenStatus.channelInfo.length > 0 && (
                        <p className="mt-1">Kênh: {tokenStatus.channelInfo[0].title}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <Link
                href="/admin/youtube/chrome-token"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <KeyIcon className="-ml-1 mr-2 h-5 w-5" />
                {tokenStatus.exists ? 'Cập nhật Token' : 'Thiết lập Token'}
              </Link>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500">Không thể tải thông tin token</p>
              <Link
                href="/admin/youtube/chrome-token"
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <KeyIcon className="-ml-1 mr-2 h-5 w-5" />
                Thiết lập Token
              </Link>
            </div>
          )}
        </div>
      </div>
      
      {/* Các chức năng liên quan đến YouTube */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center">
            <VideoCameraIcon className="h-6 w-6 text-gray-600 mr-3" />
            <h3 className="text-lg leading-6 font-medium text-gray-900">Chức năng YouTube</h3>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Các chức năng liên quan đến YouTube
          </p>
        </div>
        
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-indigo-400 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
              <div className="flex-shrink-0">
                <CloudArrowUpIcon className="h-10 w-10 text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0">
                <Link href="/admin/youtube/upload" className="focus:outline-none">
                  <span className="absolute inset-0" aria-hidden="true" />
                  <p className="text-sm font-medium text-gray-900">Upload Video</p>
                  <p className="text-sm text-gray-500 truncate">
                    Tải video lên YouTube bằng token trình duyệt
                  </p>
                </Link>
              </div>
            </div>
            
            <div className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-indigo-400 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
              <div className="flex-shrink-0">
                <ClockIcon className="h-10 w-10 text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0">
                <Link href="/admin/youtube/cron" className="focus:outline-none">
                  <span className="absolute inset-0" aria-hidden="true" />
                  <p className="text-sm font-medium text-gray-900">Lịch đăng video</p>
                  <p className="text-sm text-gray-500 truncate">
                    Quản lý lịch tải video tự động
                  </p>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Hướng dẫn */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Hướng dẫn</h3>
        </div>
        <div className="px-4 py-5 sm:p-6 prose max-w-none">
          <h4>Cách sử dụng tính năng YouTube</h4>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              <strong>Cấu hình Token:</strong> Trước tiên, bạn cần cập nhật token Chrome cho YouTube bằng cách truy cập trang "Cập nhật Token".
            </li>
            <li>
              <strong>Upload Video:</strong> Sau khi đã có token hợp lệ, bạn có thể tải video lên YouTube qua trang "Upload Video".
            </li>
            <li>
              <strong>Lịch tải tự động:</strong> Bạn có thể lên lịch tải video tự động qua trang "Lịch đăng video".
            </li>
          </ol>
          <p className="mt-4">
            <strong>Lưu ý:</strong> Token YouTube sẽ hết hạn sau một khoảng thời gian, bạn cần cập nhật định kỳ để đảm bảo các tính năng hoạt động liên tục.
          </p>
        </div>
      </div>
    </div>
  );
} 