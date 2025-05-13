'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeftIcon, 
  CheckCircleIcon, 
  ExclamationCircleIcon, 
  ArrowPathIcon,
  CommandLineIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';

export default function YouTubeChromeTokenPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [tokenStatus, setTokenStatus] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [cookieHelper, setCookieHelper] = useState(false);

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

  // Xử lý khi người dùng gửi token thủ công
  const handleSubmitToken = async () => {
    if (!tokenInput.trim()) {
      setError('Vui lòng nhập token hợp lệ');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/youtube/chrome-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: tokenInput })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccess(true);
        setTokenInput('');
        checkTokenStatus(); // Cập nhật trạng thái token
      } else {
        throw new Error(data.error || 'Không thể cập nhật token');
      }
    } catch (err) {
      console.error('Lỗi khi cập nhật token:', err);
      setError(err.message || 'Đã xảy ra lỗi khi cập nhật token');
    } finally {
      setLoading(false);
    }
  };

  // Xử lý xóa token hiện tại
  const handleDeleteToken = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/youtube/chrome-token', {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setSuccess(false);
        checkTokenStatus(); // Cập nhật trạng thái token
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

  // Mở trình duyệt để lấy KimVan cookie
  const openKimVanBrowser = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Mở trang helper trong cửa sổ mới
      const helperWindow = window.open('/api/youtube/kimvan-cookie-browser', 'kimvan_cookie_helper', 'width=800,height=700');
      
      if (!helperWindow) {
        throw new Error('Không thể mở cửa sổ trình duyệt. Vui lòng cho phép popup từ trang web này.');
      }
      
      setCookieHelper(true);
    } catch (err) {
      console.error('Lỗi khi mở trình duyệt KimVan:', err);
      setError(err.message || 'Đã xảy ra lỗi khi mở trình duyệt KimVan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => router.push('/admin/youtube-setup')}
            className="mr-4 p-2 rounded-md hover:bg-gray-100"
          >
            <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">Cập nhật Token YouTube qua Chrome</h1>
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

      {success && (
        <div className="bg-green-50 p-4 rounded-md mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <CheckCircleIcon className="h-5 w-5 text-green-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">
                Cập nhật thành công!
              </h3>
              <div className="mt-2 text-sm text-green-700">
                <p>Token YouTube và cookie đã được cập nhật thành công.</p>
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
          <div className="mb-6 border-b pb-5">
            <h2 className="text-lg font-medium text-gray-900 mb-1">Cập nhật Token YouTube qua Chrome</h2>
            <p className="text-sm text-gray-500 mb-2">
              Phương pháp này cho phép bạn cập nhật token YouTube bằng cách sử dụng trình duyệt Chrome. 
              Đặc biệt hữu ích khi phương pháp xác thực thông thường gặp vấn đề.
            </p>
            <div className="bg-blue-50 p-3 rounded-md mt-2">
              <div className="flex">
                <ShieldCheckIcon className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="ml-2">
                  <h4 className="text-sm font-medium text-blue-800">Mục đích cập nhật token:</h4>
                  <ul className="list-disc list-inside text-xs text-blue-700 mt-1 space-y-1">
                    <li>Khắc phục lỗi xác thực OAuth thông thường</li>
                    <li>Cho phép tải video lên YouTube khi API chính bị hạn chế</li>
                    <li>Cung cấp phương pháp thay thế để duy trì kết nối với YouTube API</li>
                    <li>Giúp hệ thống duy trì hoạt động nếu quy trình xác thực thông thường gặp vấn đề</li>
                    <li>Lưu thông tin cookie để sử dụng khi cần thiết cho các yêu cầu API tương lai</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Hiển thị trạng thái token hiện tại */}
          <div className="mb-6">
            <h3 className="text-md font-medium text-gray-900 mb-4">Trạng thái Token và Cookie hiện tại</h3>
            
            {loading ? (
              <div className="flex justify-center items-center py-6">
                <ArrowPathIcon className="animate-spin h-8 w-8 text-indigo-500" />
                <span className="ml-2 text-gray-500">Đang kiểm tra...</span>
              </div>
            ) : tokenStatus ? (
              <div className={`p-4 rounded-md border ${tokenStatus.exists && tokenStatus.valid ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <div className="flex items-start">
                  <div className={`flex-shrink-0 ${tokenStatus.exists && tokenStatus.valid ? 'text-green-500' : 'text-yellow-500'}`}>
                    {tokenStatus.exists && tokenStatus.valid ? (
                      <CheckCircleIcon className="h-5 w-5" />
                    ) : (
                      <ExclamationCircleIcon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="ml-3 flex-grow">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className="text-sm font-medium text-gray-900">
                        {tokenStatus.exists ? (tokenStatus.valid ? 'Token hợp lệ' : 'Token không hợp lệ') : 'Chưa cài đặt Token'}
                      </h4>
                      
                      {tokenStatus.cookieExists && (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full flex items-center">
                          <ShieldCheckIcon className="h-3 w-3 mr-1" />
                          Cookie đã lưu
                        </span>
                      )}
                      
                      {tokenStatus.timeRemaining && tokenStatus.valid && (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                          Còn lại: {tokenStatus.timeRemaining}
                        </span>
                      )}
                    </div>
                    
                    {tokenStatus.exists && tokenStatus.expiryDate && (
                      <p className="text-xs text-gray-600 mt-1">
                        Hết hạn: {new Date(tokenStatus.expiryDate).toLocaleString()}
                      </p>
                    )}
                    
                    {tokenStatus.exists && !tokenStatus.valid && tokenStatus.error && (
                      <p className="text-sm text-red-600 mt-2">
                        Lỗi: {tokenStatus.error}
                      </p>
                    )}
                    
                    {tokenStatus.channelInfo && tokenStatus.channelInfo.length > 0 && (
                      <div className="mt-3 p-2 bg-gray-50 rounded-md border border-gray-200">
                        <h5 className="text-xs font-medium text-gray-700 mb-1">Kênh YouTube được liên kết:</h5>
                        <ul className="space-y-1">
                          {tokenStatus.channelInfo.map((channel, idx) => (
                            <li key={idx} className="flex items-center text-xs">
                              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                              {channel.title} <span className="text-gray-400 ml-1">({channel.id})</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {tokenStatus.exists && (
                      <div className="mt-3">
                        <button
                          onClick={handleDeleteToken}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          Xóa cookie & token hiện tại
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                Không có thông tin token
              </div>
            )}
          </div>

          {/* Form nhập token thủ công */}
          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-md font-medium text-gray-900">Nhập Token thủ công từ Chrome</h3>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={openKimVanBrowser}
                  disabled={loading}
                  className="text-sm text-green-600 hover:text-green-800 flex items-center bg-green-50 px-3 py-1.5 rounded-md"
                >
                  <GlobeAltIcon className="h-5 w-5 mr-1" />
                  Mở KimVan trong trình duyệt
                </button>
                <button
                  type="button"
                  onClick={() => setShowInstructions(!showInstructions)}
                  className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center"
                >
                  <InformationCircleIcon className="h-5 w-5 mr-1" />
                  {showInstructions ? 'Ẩn hướng dẫn' : 'Xem hướng dẫn'}
                </button>
              </div>
            </div>

            {cookieHelper && (
              <div className="bg-green-50 p-4 rounded-md border border-green-200 mb-4">
                <h4 className="font-medium text-green-800 mb-2">Công cụ lấy cookie đã được mở</h4>
                <p className="text-sm text-green-700">
                  Cửa sổ trình duyệt để lấy cookie KimVan đã được mở. Vui lòng làm theo hướng dẫn trong cửa sổ đó để lấy cookie.
                </p>
                <p className="text-sm text-green-700 mt-2">
                  Sau khi có cookie, hãy quay lại đây và dán vào ô bên dưới.
                </p>
              </div>
            )}

            {showInstructions && (
              <div className="bg-blue-50 p-4 rounded-md border border-blue-200 mb-4">
                <h4 className="font-medium text-blue-800 mb-2">Hướng dẫn lấy token từ trình duyệt Chrome</h4>
                <ol className="list-decimal list-inside text-sm text-blue-700 space-y-2">
                  <li>Mở trình duyệt Chrome và truy cập <code className="bg-blue-100 px-1 rounded">https://accounts.google.com</code></li>
                  <li>Đăng nhập vào tài khoản Google của bạn (nếu chưa đăng nhập)</li>
                  <li>Nhấn F12 hoặc chuột phải và chọn "Inspect" để mở DevTools</li>
                  <li>Chuyển đến tab "Application" (nếu không thấy, hãy nhấp vào &gt;&gt; để tìm)</li>
                  <li>Ở cột bên trái, mở rộng mục "Cookies" và chọn "https://accounts.google.com"</li>
                  <li>Tìm cookie có tên "__Secure-3PSID" và sao chép giá trị của nó</li>
                  <li>Dán giá trị đó vào ô bên dưới và nhấn "Cập nhật Token"</li>
                </ol>
                <div className="mt-3 flex items-center bg-yellow-100 p-2 rounded">
                  <ExclamationCircleIcon className="h-5 w-5 text-yellow-600 mr-2" />
                  <p className="text-xs text-yellow-800">
                    Lưu ý: Token này có thể hết hạn sau một thời gian. Bạn sẽ cần cập nhật lại khi điều đó xảy ra.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-1 flex rounded-md shadow-sm">
              <div className="relative flex items-stretch flex-grow focus-within:z-10">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CommandLineIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full rounded-none rounded-l-md pl-10 sm:text-sm border-gray-300"
                  placeholder="Nhập token từ Chrome DevTools"
                />
              </div>
              <button
                type="button"
                onClick={handleSubmitToken}
                disabled={loading || !tokenInput.trim()}
                className="relative inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 text-sm font-medium rounded-r-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-indigo-300"
              >
                {loading ? (
                  <ArrowPathIcon className="animate-spin h-5 w-5" />
                ) : (
                  'Cập nhật Token'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}