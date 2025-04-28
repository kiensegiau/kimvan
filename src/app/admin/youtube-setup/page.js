'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, CheckCircleIcon, ExclamationCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

export default function YouTubeSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tokenStatus, setTokenStatus] = useState(null);
  const [error, setError] = useState(null);
  const [authUrl, setAuthUrl] = useState('');
  const [setupSuccess, setSetupSuccess] = useState(false);

  useEffect(() => {
    checkTokenStatus();
  }, []);

  // Kiểm tra URL để xem có code xác thực từ Google không
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
      handleAuthCode(code);
    }
  }, []);

  // Hàm kiểm tra trạng thái token
  const checkTokenStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/youtube/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setTokenStatus(data);
        
        if (data.exists === false) {
          // Nếu không tìm thấy token, lấy URL xác thực
          getAuthUrl();
        }
      } else {
        throw new Error(data.error || 'Đã xảy ra lỗi khi kiểm tra trạng thái token');
      }
    } catch (err) {
      console.error('Lỗi khi kiểm tra token:', err);
      setError(err.message || 'Không thể kết nối đến API để kiểm tra token');
    } finally {
      setLoading(false);
    }
  };

  // Lấy URL xác thực từ Google
  const getAuthUrl = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/youtube/setup');
      const data = await response.json();
      
      if (response.ok && data.authUrl) {
        setAuthUrl(data.authUrl);
      } else {
        throw new Error(data.error || 'Không thể lấy URL xác thực');
      }
    } catch (err) {
      console.error('Lỗi khi lấy URL xác thực:', err);
      setError(err.message || 'Không thể kết nối đến API để lấy URL xác thực');
    } finally {
      setLoading(false);
    }
  };

  // Xử lý code xác thực nhận từ Google
  const handleAuthCode = async (code) => {
    try {
      setLoading(true);
      setError(null);
      
      // Xóa code khỏi URL để tránh lỗi khi refresh trang
      window.history.replaceState({}, document.title, '/admin/youtube-setup');
      
      const response = await fetch(`/api/youtube/setup?code=${code}`);
      const data = await response.json();
      
      if (response.ok) {
        setSetupSuccess(true);
        checkTokenStatus(); // Cập nhật trạng thái token
      } else {
        throw new Error(data.error || 'Không thể xác thực với Google');
      }
    } catch (err) {
      console.error('Lỗi khi xử lý code xác thực:', err);
      setError(err.message || 'Đã xảy ra lỗi khi xử lý xác thực');
    } finally {
      setLoading(false);
    }
  };

  // Xử lý xóa token hiện tại
  const deleteToken = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/youtube/setup', {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setSetupSuccess(false);
        // Refetch để cập nhật trạng thái
        checkTokenStatus();
      } else {
        throw new Error(data.error || 'Không thể xóa token');
      }
    } catch (err) {
      console.error('Lỗi khi xóa token:', err);
      setError(err.message || 'Đã xảy ra lỗi khi xóa token');
    } finally {
      setLoading(false);
    }
  };

  // Bắt đầu quá trình xác thực mới
  const startAuthentication = () => {
    if (authUrl) {
      window.location.href = authUrl;
    } else {
      getAuthUrl();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => router.push('/admin/courses')}
            className="mr-4 p-2 rounded-md hover:bg-gray-100"
          >
            <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">Thiết lập YouTube API</h1>
        </div>
        
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
          Làm mới trạng thái
        </button>
      </div>

      {setupSuccess && (
        <div className="bg-green-50 p-4 rounded-md mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <CheckCircleIcon className="h-5 w-5 text-green-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">
                Thiết lập thành công!
              </h3>
              <div className="mt-2 text-sm text-green-700">
                <p>Token YouTube API đã được lưu thành công.</p>
              </div>
            </div>
          </div>
        </div>
      )}

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

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Trạng thái YouTube API</h2>
          
          {loading ? (
            <div className="flex justify-center items-center py-6">
              <ArrowPathIcon className="animate-spin h-8 w-8 text-indigo-500" />
              <span className="ml-2 text-gray-500">Đang kiểm tra...</span>
            </div>
          ) : tokenStatus ? (
            <div className="space-y-6">
              {tokenStatus.exists ? (
                <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                  <div className="flex items-start">
                    <div className={`flex-shrink-0 ${tokenStatus.valid ? 'text-green-500' : 'text-red-500'}`}>
                      {tokenStatus.valid ? (
                        <CheckCircleIcon className="h-6 w-6" />
                      ) : (
                        <ExclamationCircleIcon className="h-6 w-6" />
                      )}
                    </div>
                    <div className="ml-3">
                      <h3 className="text-md font-medium text-gray-900">
                        {tokenStatus.valid ? 'Token hợp lệ' : 'Token không hợp lệ'}
                      </h3>
                      
                      {tokenStatus.expiryDate && (
                        <p className="text-sm text-gray-600 mt-1">
                          Hết hạn: {new Date(tokenStatus.expiryDate).toLocaleString()}
                        </p>
                      )}
                      
                      {tokenStatus.tokenInfo && (
                        <div className="mt-3 bg-gray-100 p-3 rounded-md">
                          <p className="text-xs text-gray-600 mb-1">Access Token: {tokenStatus.tokenInfo.access_token}</p>
                          {tokenStatus.tokenInfo.refresh_token && (
                            <p className="text-xs text-gray-600 mb-1">Refresh Token: {tokenStatus.tokenInfo.refresh_token}</p>
                          )}
                          {tokenStatus.tokenInfo.scope && (
                            <p className="text-xs text-gray-600">Scopes: {tokenStatus.tokenInfo.scope}</p>
                          )}
                        </div>
                      )}
                      
                      {!tokenStatus.valid && tokenStatus.error && (
                        <p className="text-sm text-red-600 mt-2">
                          Lỗi: {tokenStatus.error}
                        </p>
                      )}
                      
                      <div className="mt-4 flex space-x-3">
                        <button
                          onClick={startAuthentication}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Cấp lại quyền truy cập
                        </button>
                        
                        <button
                          onClick={deleteToken}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          Xóa token hiện tại
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 p-6 rounded-md border border-yellow-200 text-center">
                  <ExclamationCircleIcon className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa thiết lập YouTube API</h3>
                  <p className="text-gray-600 mb-6">
                    Để sử dụng tính năng tải lên YouTube và lưu trữ Drive, bạn cần cấp quyền truy cập cho ứng dụng.
                  </p>
                  <div className="bg-white p-3 rounded-md border border-gray-200 mb-4 text-left">
                    <p className="text-sm font-medium text-gray-700 mb-2">Quyền truy cập sẽ bao gồm:</p>
                    <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
                      <li>YouTube: Tải lên và quản lý video trên kênh của bạn</li>
                      <li>Google Drive: Lưu trữ và quản lý tệp trong Drive của bạn</li>
                    </ul>
                  </div>
                  <button
                    onClick={startAuthentication}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Thiết lập YouTube API
                  </button>
                </div>
              )}
              
              <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                <h3 className="font-medium text-blue-800 mb-2">Thông tin cấu hình</h3>
                <p className="text-sm text-blue-700">
                  Để hoàn tất thiết lập, bạn cần đảm bảo đã cấu hình các thông tin sau trong file <code>.env</code>:
                </p>
                <ul className="list-disc list-inside text-sm text-blue-700 mt-2">
                  <li>GOOGLE_CLIENT_ID</li>
                  <li>GOOGLE_CLIENT_SECRET</li>
                  <li>GOOGLE_REDIRECT_URI (mặc định: http://localhost:3000/admin/youtube-setup)</li>
                </ul>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                <h3 className="font-medium text-gray-800 mb-2">Giới hạn API</h3>
                <p className="text-sm text-gray-600">
                  YouTube API có giới hạn 10,000 đơn vị mỗi ngày. Mỗi video upload tiêu tốn khoảng 1,600 đơn vị.
                  Điều này đồng nghĩa với việc bạn chỉ có thể upload khoảng 6 video mỗi ngày.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-500">Không thể lấy thông tin trạng thái token</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 