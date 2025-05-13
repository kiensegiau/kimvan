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

export default function KimVanCookiePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [cookieStatus, setCookieStatus] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [cookieInput, setCookieInput] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [cookieHelper, setCookieHelper] = useState(false);

  useEffect(() => {
    checkCookieStatus();
  }, []);

  // Kiểm tra trạng thái cookie hiện tại
  const checkCookieStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/youtube/kimvan-cookie', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      setCookieStatus(data);
    } catch (err) {
      console.error('Lỗi khi kiểm tra cookie KimVan:', err);
      setError('Không thể kết nối đến API để kiểm tra cookie');
    } finally {
      setLoading(false);
    }
  };

  // Xử lý khi người dùng gửi cookie thủ công
  const handleSubmitCookie = async () => {
    if (!cookieInput.trim()) {
      setError('Vui lòng nhập cookie hợp lệ');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/youtube/kimvan-cookie', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cookie: cookieInput })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccess(true);
        setCookieInput('');
        checkCookieStatus(); // Cập nhật trạng thái cookie
      } else {
        throw new Error(data.error || 'Không thể cập nhật cookie');
      }
    } catch (err) {
      console.error('Lỗi khi cập nhật cookie:', err);
      setError(err.message || 'Đã xảy ra lỗi khi cập nhật cookie');
    } finally {
      setLoading(false);
    }
  };

  // Xử lý xóa cookie hiện tại
  const handleDeleteCookie = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/youtube/kimvan-cookie', {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setSuccess(false);
        checkCookieStatus(); // Cập nhật trạng thái cookie
      } else {
        throw new Error(data.error || 'Không thể xóa cookie');
      }
    } catch (err) {
      console.error('Lỗi khi xóa cookie:', err);
      setError(err.message || 'Đã xảy ra lỗi khi xóa cookie');
    } finally {
      setLoading(false);
    }
  };

  // Mở trình duyệt để lấy KimVan cookie
  const openKimVanBrowser = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Mở trang KimVan trong cửa sổ pop-up
      const popupWindow = window.open('/api/youtube/kimvan-cookie-browser', 'kimvan_cookie_helper', 'width=800,height=600');
      
      if (!popupWindow) {
        throw new Error('Không thể mở cửa sổ pop-up. Vui lòng cho phép pop-up từ trang web này.');
      }
      
      setCookieHelper(true);
      
      // Lắng nghe thông điệp từ cửa sổ pop-up (nếu có cookie được phát hiện)
      window.addEventListener('message', function cookieMessageHandler(event) {
        if (event.data && event.data.cookie) {
          setCookieInput(event.data.cookie);
          setSuccess(true);
          window.removeEventListener('message', cookieMessageHandler);
        }
      });
      
    } catch (err) {
      console.error('Lỗi khi mở cửa sổ cookie helper:', err);
      setError(err.message || 'Đã xảy ra lỗi khi mở cửa sổ helper');
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
          <h1 className="text-2xl font-semibold text-gray-900">Cập nhật Cookie KimVan</h1>
        </div>
        
        <button
          onClick={checkCookieStatus}
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
                <p>Cookie KimVan đã được cập nhật thành công.</p>
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
            <h2 className="text-lg font-medium text-gray-900 mb-1">Cập nhật Cookie KimVan</h2>
            <p className="text-sm text-gray-500 mb-2">
              Cookie KimVan cho phép kết nối với hệ thống KimVan mà không cần đăng nhập lại mỗi lần.
              Cookie được lưu trữ trong file JSON bền vững trên máy chủ.
            </p>
          </div>

          {/* Hiển thị trạng thái cookie hiện tại */}
          <div className="mb-6">
            <h3 className="text-md font-medium text-gray-900 mb-4">Trạng thái Cookie hiện tại</h3>
            
            {loading ? (
              <div className="flex justify-center items-center py-6">
                <ArrowPathIcon className="animate-spin h-8 w-8 text-indigo-500" />
                <span className="ml-2 text-gray-500">Đang kiểm tra...</span>
              </div>
            ) : cookieStatus && cookieStatus.exists ? (
              <div className={`p-4 rounded-md border ${cookieStatus.valid ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <div className="flex items-start">
                  <div className={`flex-shrink-0 ${cookieStatus.valid ? 'text-green-500' : 'text-yellow-500'}`}>
                    {cookieStatus.valid ? (
                      <CheckCircleIcon className="h-5 w-5" />
                    ) : (
                      <ExclamationCircleIcon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="ml-3 flex-grow">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className="text-sm font-medium text-gray-900">
                        {cookieStatus.valid ? 'Cookie hợp lệ' : 'Cookie không hợp lệ hoặc đã hết hạn'}
                      </h4>
                      
                      {cookieStatus.timeRemaining && cookieStatus.valid && (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                          Còn lại: {cookieStatus.timeRemaining}
                        </span>
                      )}
                    </div>
                    
                    {cookieStatus.expiryDate && (
                      <p className="text-xs text-gray-600 mt-1">
                        Hết hạn: {new Date(cookieStatus.expiryDate).toLocaleString()}
                      </p>
                    )}
                    
                    <div className="mt-3">
                      <button
                        onClick={handleDeleteCookie}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Xóa cookie hiện tại
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                Chưa có cookie KimVan nào được lưu trữ
              </div>
            )}
          </div>

          {/* Form nhập cookie thủ công */}
          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-md font-medium text-gray-900">Cập nhật Cookie KimVan</h3>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={openKimVanBrowser}
                  disabled={loading}
                  className="text-sm text-green-600 hover:text-green-800 flex items-center bg-green-50 px-3 py-1.5 rounded-md"
                >
                  <GlobeAltIcon className="h-5 w-5 mr-1" />
                  Mở trình duyệt để lấy cookie
                </button>
              </div>
            </div>

            {cookieHelper && (
              <div className="bg-green-50 p-4 rounded-md border border-green-200 mb-4">
                <h4 className="font-medium text-green-800 mb-2">
                  {cookieInput ? 'Cookie KimVan đã được tự động phát hiện!' : 'Trình duyệt Chrome đã được mở'}
                </h4>
                
                {cookieInput ? (
                  <div>
                    <p className="text-sm text-green-700">
                      Cookie đã được tự động phát hiện và điền vào ô bên dưới. Nhấn nút "Cập nhật Cookie" để lưu lại.
                    </p>
                    <div className="mt-2 bg-white p-2 rounded border border-green-100">
                      <span className="text-xs font-mono bg-gray-50 px-2 py-1 rounded">
                        {cookieInput.substring(0, 20)}...{cookieInput.substring(cookieInput.length - 20)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-green-700">
                      Trình duyệt Chrome đã được mở với trang KimVan. Vui lòng thực hiện các bước sau:
                    </p>
                    <ol className="list-decimal list-inside text-sm text-green-700 mt-2 space-y-1">
                      <li>Đăng nhập vào tài khoản KimVan của bạn</li>
                      <li>Hệ thống sẽ tự động phát hiện cookie sau khi bạn đăng nhập</li>
                      <li>Nếu không tự động phát hiện được, bạn cần thực hiện thủ công:</li>
                      <li className="ml-5">- Nhấn F12 hoặc chuột phải và chọn "Inspect" để mở DevTools</li>
                      <li className="ml-5">- Chuyển đến tab "Application"</li>
                      <li className="ml-5">- Mở rộng mục "Cookies" và chọn "https://kimvan.id.vn"</li>
                      <li className="ml-5">- Tìm cookie có tên "__Secure-authjs.session-token"</li>
                      <li className="ml-5">- Sao chép giá trị cookie và dán vào ô bên dưới</li>
                    </ol>
                  </div>
                )}
              </div>
            )}

            <div className="mt-1 flex rounded-md shadow-sm">
              <div className="relative flex items-stretch flex-grow focus-within:z-10">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CommandLineIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={cookieInput}
                  onChange={(e) => setCookieInput(e.target.value)}
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full rounded-none rounded-l-md pl-10 sm:text-sm border-gray-300"
                  placeholder="Dán cookie KimVan vào đây"
                />
              </div>
              <button
                type="button"
                onClick={handleSubmitCookie}
                disabled={loading || !cookieInput.trim()}
                className="relative inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 text-sm font-medium rounded-r-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-indigo-300"
              >
                {loading ? (
                  <ArrowPathIcon className="animate-spin h-5 w-5" />
                ) : (
                  'Cập nhật Cookie'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 