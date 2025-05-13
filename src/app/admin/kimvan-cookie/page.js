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
import Script from 'next/script';

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

  // Phương pháp mới mở trang KimVan trong tab mới để giữ trang admin
  const openKimVanBrowser = async () => {
    try {
      setLoading(true);
      setError(null);
      
      setCookieHelper(true);
      
      // Log rõ ràng
      alert('Đang mở trang KimVan. Sau khi đăng nhập, hãy quay lại đây và nhấn nút "Kiểm tra cookie" màu xanh!');
      console.log('=== HƯỚNG DẪN KIMVAN COOKIE ===');
      console.log('1. Sau khi đăng nhập vào KimVan trong tab mới');
      console.log('2. Quay lại tab này và nhấn nút "Kiểm tra cookie" màu xanh');
      console.log('3. Nếu không tự động phát hiện, mở F12 để xem log');
      
      // Mở URL kimvan trong tab mới thay vì chuyển hướng hiện tại
      const kimvanWindow = window.open('https://kimvan.id.vn/', '_blank');
      
      if (!kimvanWindow) {
        throw new Error('Không thể mở trang KimVan. Vui lòng cho phép popup từ trang web này.');
      }
      
      console.log('Đã mở trang KimVan trong tab mới');
      
      // Hiển thị hướng dẫn chi tiết cho người dùng
      setSuccess(false);
      setError("BƯỚC TIẾP THEO: Sau khi đăng nhập vào KimVan ở tab mới, quay lại đây và nhấn nút 'Kiểm tra cookie' màu xanh ở trên!");
      
    } catch (err) {
      console.error('Lỗi khi mở trang KimVan:', err);
      setError(err.message || 'Đã xảy ra lỗi khi mở trang KimVan');
    } finally {
      setLoading(false);
    }
  };

  // Kiểm tra cookie KimVan từ trình duyệt
  const checkBrowserCookie = async () => {
    try {
      setLoading(true);
      setError("Đang kiểm tra cookie, vui lòng đợi...");
      
      // Log rõ ràng với cờ hiệu
      console.log('==========================================');
      console.log('=== BẮT ĐẦU KIỂM TRA COOKIE KIMVAN ===');
      console.log('==========================================');
      
      // Tạo div hiển thị kết quả tìm kiếm
      const resultDiv = document.createElement('div');
      resultDiv.style.position = 'fixed';
      resultDiv.style.top = '10px';
      resultDiv.style.right = '10px';
      resultDiv.style.width = '400px';
      resultDiv.style.padding = '10px';
      resultDiv.style.backgroundColor = '#f8f9fa';
      resultDiv.style.border = '1px solid #ddd';
      resultDiv.style.borderRadius = '5px';
      resultDiv.style.zIndex = '9999';
      resultDiv.style.maxHeight = '80vh';
      resultDiv.style.overflow = 'auto';
      resultDiv.innerHTML = '<h3>Kết quả kiểm tra cookie</h3><hr>';
      document.body.appendChild(resultDiv);
      
      // 1. Ưu tiên kiểm tra accessToken từ localStorage
      console.log('KIỂM TRA accessToken TRONG LOCALSTORAGE...');
      resultDiv.innerHTML += `<p>Kiểm tra localStorage cho accessToken...</p>`;
      
      try {
        const accessToken = localStorage.getItem('accessToken');
        
        if (accessToken) {
          console.log('Đã tìm thấy accessToken trong localStorage!');
          console.log('Token value (một phần):', accessToken.substring(0, 30) + '...');
          resultDiv.innerHTML += `<p style="color:green">✓ Đã tìm thấy accessToken trong localStorage!</p>`;
          
          // Gửi token lên server
          const response = await fetch('/api/youtube/kimvan-cookie', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ cookie: accessToken })
          });
          
          const data = await response.json();
          console.log('Kết quả:', data);
          
          if (response.ok) {
            console.log('accessToken từ localStorage hoạt động!');
            resultDiv.innerHTML += `<p style="color:green; font-weight:bold">✓ Token đã được cập nhật thành công từ accessToken!</p>`;
            
            setCookieInput(accessToken);
            setSuccess(true);
            setError(null);
            setLoading(false);
            checkCookieStatus();
            
            // Đóng kết quả sau 5 giây
            setTimeout(() => {
              if (document.body.contains(resultDiv)) {
                document.body.removeChild(resultDiv);
              }
            }, 5000);
            
            return;
          }
        }
      } catch (error) {
        console.error('Lỗi khi truy cập accessToken:', error);
      }
      
      // 2. Tiếp tục kiểm tra cookie __Secure-authjs.session-token trực tiếp
      console.log('KIỂM TRA COOKIE __Secure-authjs.session-token...');
      resultDiv.innerHTML += `<p>Kiểm tra cookie __Secure-authjs.session-token...</p>`;
      
      // Lấy tất cả cookie
      console.log('Tất cả cookie trong trình duyệt:', document.cookie);
      const cookies = document.cookie.split(';');
      let secureAuthCookie = null;
      
      // Tìm cookie cụ thể
      for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.startsWith('__Secure-authjs.session-token=')) {
          secureAuthCookie = cookie.substring('__Secure-authjs.session-token='.length);
          console.log('Đã tìm thấy cookie __Secure-authjs.session-token!');
          resultDiv.innerHTML += `<p style="color:green">✓ Đã tìm thấy cookie __Secure-authjs.session-token!</p>`;
          break;
        }
      }
      
      if (secureAuthCookie) {
        console.log('Cookie value (một phần):', secureAuthCookie.substring(0, 20) + '...');
        resultDiv.innerHTML += `<p style="color:green; font-weight:bold">✓ ĐÃ TÌM THẤY COOKIE! Đang xử lý...</p>`;
        
        // Sử dụng cookie
        setCookieInput(secureAuthCookie);
        handleSubmitCookieAuto(secureAuthCookie);
        
        // Đóng kết quả sau 5 giây
        setTimeout(() => {
          if (document.body.contains(resultDiv)) {
            document.body.removeChild(resultDiv);
          }
        }, 5000);
        
        return;
      } else {
        console.log('Không tìm thấy cookie __Secure-authjs.session-token trực tiếp');
        resultDiv.innerHTML += `<p style="color:orange">⚠️ Không tìm thấy cookie __Secure-authjs.session-token trực tiếp</p>`;
      }
      
      // 2. Kiểm tra document.cookie với các cách khác
      console.log('-----------------------------------');
      console.log('THỬ CÁC PHƯƠNG PHÁP TRÍCH XUẤT COOKIE KHÁC...');
      resultDiv.innerHTML += `<hr><p>Thử các phương pháp trích xuất cookie khác...</p>`;
      
      // Tạo một chức năng để lấy cookie theo tên
      function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
      }
      
      // Thử lấy cookie theo tên cụ thể
      const authCookie = getCookie('__Secure-authjs.session-token');
      
      if (authCookie) {
        console.log('Đã tìm thấy cookie qua hàm getCookie!');
        resultDiv.innerHTML += `<p style="color:green">✓ Đã tìm thấy cookie qua hàm getCookie</p>`;
        console.log('Cookie value (một phần):', authCookie.substring(0, 20) + '...');
        
        // Sử dụng cookie
        setCookieInput(authCookie);
        handleSubmitCookieAuto(authCookie);
        
        // Đóng kết quả sau 5 giây
        setTimeout(() => {
          if (document.body.contains(resultDiv)) {
            document.body.removeChild(resultDiv);
          }
        }, 5000);
        
        return;
      }
      
      // 3. Nếu không tìm thấy cookie, thử các phương pháp khác
      
      // Kiểm tra localStorage để tìm các key liên quan
      console.log('-----------------------------------');
      console.log('THỬ LẤY COOKIE TRỰC TIẾP TỪ LOCAL STORAGE...');
      resultDiv.innerHTML += `<hr><p>Đang tìm trong localStorage...</p>`;
      
      try {
        const localStorageItems = { ...localStorage };
        console.log('Nội dung localStorage:', localStorageItems);
        
        // Ưu tiên kiểm tra key tokenExpiryTime
        if (localStorageItems.tokenExpiryTime) {
          console.log('Tìm thấy tokenExpiryTime trong localStorage');
          resultDiv.innerHTML += `<p style="color:green">✓ Tìm thấy tokenExpiryTime</p>`;
          
          const token = localStorageItems.tokenExpiryTime;
          
          // Thử gửi lên server
          const testResponse = await fetch('/api/youtube/kimvan-cookie', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ cookie: token })
          });
          
          const testResult = await testResponse.json();
          console.log('Kết quả thử nghiệm:', testResult);
          
          if (testResponse.ok) {
            console.log('Giá trị tokenExpiryTime hoạt động!');
            resultDiv.innerHTML += `<p style="color:green; font-weight:bold">✓ Cookie đã được cập nhật thành công từ tokenExpiryTime!</p>`;
            
            setCookieInput(token);
            setSuccess(true);
            setError(null);
            setLoading(false);
            checkCookieStatus();
            
            // Đóng kết quả sau 5 giây
            setTimeout(() => {
              if (document.body.contains(resultDiv)) {
                document.body.removeChild(resultDiv);
              }
            }, 5000);
            
            return;
          }
        }
        
        // 4. Kiểm tra với API server
        console.log('Không tìm thấy cookie hợp lệ trên client. Kiểm tra trên server...');
        resultDiv.innerHTML += `<hr><p>Kiểm tra cookie trên server...</p>`;
        
        const response = await fetch('/api/youtube/kimvan-cookie', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        const data = await response.json();
        console.log('Kết quả API:', data);
        
        if (data && data.exists && data.valid) {
          setSuccess(true);
          setError(null);
          setCookieStatus(data);
          console.log('Cookie đã tồn tại và còn hiệu lực trên server');
          resultDiv.innerHTML += `<p style="color:green; font-weight:bold">✓ Cookie đã tồn tại trên server và còn hiệu lực!</p>`;
        } else {
          resultDiv.innerHTML += `<p style="color:red">Không tìm thấy cookie hợp lệ.</p>`;
          resultDiv.innerHTML += `<div class="mt-4">
            <p style="font-weight:bold">Hướng dẫn thủ công:</p>
            <ol style="margin-left: 20px; margin-top: 10px;">
              <li>Mở tab KimVan và đảm bảo đã đăng nhập</li>
              <li>Nhấn F12 để mở Developer Tools</li>
              <li>Chuyển đến tab Application</li>
              <li>Xem phần Cookies > https://kimvan.id.vn</li>
              <li>Tìm cookie có tên <strong>__Secure-authjs.session-token</strong> và sao chép giá trị của nó</li>
              <li>Dán vào ô nhập cookie bên dưới</li>
            </ol>
          </div>`;
          
          setError('Không tìm thấy cookie KimVan. Vui lòng nhập thủ công.');
        }
      } catch (error) {
        console.error('Lỗi khi kiểm tra:', error);
        resultDiv.innerHTML += `<p style="color:red">Lỗi: ${error.message}</p>`;
        setError(`Lỗi khi kiểm tra: ${error.message}`);
      }
      
      // Đóng kết quả sau 20 giây
      setTimeout(() => {
        if (document.body.contains(resultDiv)) {
          document.body.removeChild(resultDiv);
        }
      }, 20000);
      
    } catch (err) {
      console.error('Lỗi khi kiểm tra cookie:', err);
      setError(err.message || 'Đã xảy ra lỗi khi kiểm tra cookie');
    } finally {
      setLoading(false);
    }
  };

  // Xử lý khi tự động gửi cookie đã phát hiện
  const handleSubmitCookieAuto = async (cookieValue) => {
    if (!cookieValue || !cookieValue.trim()) {
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
        body: JSON.stringify({ cookie: cookieValue })
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
                  onClick={checkBrowserCookie}
                  disabled={loading}
                  className="text-sm text-white hover:bg-blue-700 flex items-center bg-blue-600 px-4 py-2 rounded-md mr-2 font-medium shadow-sm"
                >
                  <ArrowPathIcon className="h-5 w-5 mr-1" />
                  Kiểm tra cookie
                </button>
                <button
                  type="button"
                  onClick={openKimVanBrowser}
                  disabled={loading}
                  className="text-sm text-white hover:bg-green-700 flex items-center bg-green-600 px-4 py-2 rounded-md font-medium shadow-sm"
                >
                  <GlobeAltIcon className="h-5 w-5 mr-1" />
                  Mở trang KimVan
                </button>
              </div>
            </div>

            {/* Hướng dẫn thủ công */}
            <div className="bg-blue-50 p-4 rounded-md border border-blue-200 mb-4">
              <h4 className="font-medium text-blue-800 mb-2">
                {cookieInput ? 'Cookie KimVan đã được tự động phát hiện!' : 'Hướng dẫn lấy cookie KimVan'}
              </h4>
              
              {cookieInput ? (
                <div>
                  <p className="text-sm text-blue-700">
                    Cookie đã được tự động phát hiện và đang được lưu lại. Vui lòng đợi trong giây lát...
                  </p>
                  <div className="mt-2 bg-white p-2 rounded border border-blue-100">
                    <span className="text-xs font-mono bg-gray-50 px-2 py-1 rounded">
                      {cookieInput.substring(0, 20)}...{cookieInput.substring(cookieInput.length - 20)}
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-blue-700 font-medium">
                    Quy trình lấy cookie KimVan (2 bước đơn giản):
                  </p>
                  <ol className="list-decimal list-inside text-sm text-blue-700 mt-2 space-y-2">
                    <li>
                      <strong>Bước 1:</strong> Nhấn nút <span className="bg-green-600 text-white px-2 py-1 rounded text-xs">Mở trang KimVan</span> để mở trang KimVan trong tab mới
                      <div className="ml-6 mt-1 text-xs">Đăng nhập vào tài khoản KimVan của bạn nếu chưa đăng nhập</div>
                    </li>
                    <li>
                      <strong>Bước 2:</strong> Quay lại tab này và nhấn nút <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs">Kiểm tra cookie</span> màu xanh
                      <div className="ml-6 mt-1 text-xs">Hệ thống sẽ tự động lấy và lưu cookie của bạn</div>
                    </li>
                  </ol>
                  
                  <div className="bg-yellow-50 p-3 rounded mt-4 border border-yellow-200">
                    <h5 className="text-yellow-800 font-medium flex items-center">
                      <InformationCircleIcon className="h-5 w-5 mr-1" /> Phương pháp được xác nhận
                    </h5>
                    <p className="text-xs text-yellow-700 mt-1">
                      Hệ thống sẽ ưu tiên tìm và sử dụng <strong>accessToken</strong> từ localStorage 
                      của trình duyệt sau khi bạn đăng nhập vào KimVan.
                    </p>
                  </div>
                </div>
              )}
            </div>

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