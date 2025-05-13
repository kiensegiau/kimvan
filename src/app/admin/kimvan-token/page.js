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

export default function KimVanTokenPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [tokenStatus, setTokenStatus] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [tokenHelper, setTokenHelper] = useState(false);

  useEffect(() => {
    checkTokenStatus();
  }, []);

  // Kiểm tra trạng thái token hiện tại
  const checkTokenStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/youtube/kimvan-token', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      setTokenStatus(data);
    } catch (err) {
      console.error('Lỗi khi kiểm tra token KimVan:', err);
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
      
      const response = await fetch('/api/youtube/kimvan-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cookie: tokenInput })
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
      
      const response = await fetch('/api/youtube/kimvan-token', {
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

  // Phương pháp mới mở trang KimVan trong tab mới để giữ trang admin
  const openKimVanBrowser = async () => {
    try {
      setLoading(true);
      setError(null);
      
      setTokenHelper(true);
      
      // Log rõ ràng
      alert('Đang mở trang KimVan. Sau khi đăng nhập, hãy quay lại đây và nhấn nút "Kiểm tra token" màu xanh!');
      console.log('=== HƯỚNG DẪN KIMVAN TOKEN ===');
      console.log('1. Sau khi đăng nhập vào KimVan trong tab mới');
      console.log('2. Quay lại tab này và nhấn nút "Kiểm tra token" màu xanh');
      console.log('3. Nếu không tự động phát hiện, mở F12 để xem log');
      
      // Mở URL kimvan trong tab mới thay vì chuyển hướng hiện tại
      const kimvanWindow = window.open('https://kimvan.id.vn/', '_blank');
      
      if (!kimvanWindow) {
        throw new Error('Không thể mở trang KimVan. Vui lòng cho phép popup từ trang web này.');
      }
      
      console.log('Đã mở trang KimVan trong tab mới');
      
      // Hiển thị hướng dẫn chi tiết cho người dùng
      setSuccess(false);
      setError("BƯỚC TIẾP THEO: Sau khi đăng nhập vào KimVan ở tab mới, quay lại đây và nhấn nút 'Kiểm tra token' màu xanh ở trên!");
      
    } catch (err) {
      console.error('Lỗi khi mở trang KimVan:', err);
      setError(err.message || 'Đã xảy ra lỗi khi mở trang KimVan');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Kiểm tra token trong localstorage hoặc sessionstorage của trình duyệt và gửi lên server
   */
  const checkBrowserToken = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    
    // Tạo div hiển thị kết quả kiểm tra
    const resultDiv = document.createElement('div');
    resultDiv.style.position = 'fixed';
    resultDiv.style.top = '60px';
    resultDiv.style.right = '20px';
    resultDiv.style.width = '400px';
    resultDiv.style.maxHeight = '80vh';
    resultDiv.style.overflowY = 'auto';
    resultDiv.style.backgroundColor = 'white';
    resultDiv.style.border = '1px solid #ddd';
    resultDiv.style.borderRadius = '5px';
    resultDiv.style.padding = '15px';
    resultDiv.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
    resultDiv.style.zIndex = '1000';
    resultDiv.style.fontSize = '14px';
    resultDiv.innerHTML = '<h3 style="margin-top: 0">Kiểm tra token KimVan</h3><p>Đang kiểm tra...</p>';
    document.body.appendChild(resultDiv);
    
    try {
      // Kiểm tra localStorage
      console.log('KIỂM TRA LOCAL STORAGE...');
      resultDiv.innerHTML += `<hr><p>Kiểm tra localStorage...</p>`;
      
      // Định nghĩa các key cần kiểm tra
      const keysToCheck = [
        'accessToken',
        'refreshToken',
        'tokenExpiryTime',
        'auth_email'
      ];
      
      // Đọc tất cả key từ localStorage
      const localStorageItems = { ...localStorage };
      console.log('Nội dung localStorage đầy đủ:', localStorageItems);
      
      // Tạo đối tượng lưu trữ dữ liệu token tìm thấy
      const foundTokens = {};
      
      if (Object.keys(localStorageItems).length > 0) {
        // Tạo bảng chi tiết các giá trị trong localStorage
        resultDiv.innerHTML += `<div style="max-height: 150px; overflow-y: auto; margin-bottom: 10px; border: 1px solid #ddd; padding: 5px; background-color: #f5f5f5;">
          <h4 style="margin: 0 0 5px 0; font-size: 14px;">Giá trị trong localStorage:</h4>
          <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
            <tr>
              <th style="text-align: left; padding: 4px; border-bottom: 1px solid #ddd;">Key</th>
              <th style="text-align: left; padding: 4px; border-bottom: 1px solid #ddd;">Value (đầu)</th>
              <th style="text-align: center; padding: 4px; border-bottom: 1px solid #ddd;">Độ dài</th>
            </tr>
            ${Object.entries(localStorageItems).map(([key, value]) => {
              // Đánh dấu các key liên quan đến token
              const isTokenKey = keysToCheck.includes(key);
              const style = isTokenKey ? 'background-color: #e6f7ff;' : '';
              
              // Lưu giá trị nếu là key cần kiểm tra
              if (isTokenKey) {
                foundTokens[key] = value;
              }
              
              return `
                <tr style="${style}">
                  <td style="padding: 4px; border-bottom: 1px solid #eee;">${key}</td>
                  <td style="padding: 4px; border-bottom: 1px solid #eee; word-break: break-all; max-width: 150px; overflow: hidden; text-overflow: ellipsis;">${value ? (value.substring(0, 30) + '...') : ''}</td>
                  <td style="padding: 4px; border-bottom: 1px solid #eee; text-align: center;">${value ? value.length : 0}</td>
                </tr>
              `;
            }).join('')}
          </table>
        </div>`;
      } else {
        resultDiv.innerHTML += `<p>Không tìm thấy dữ liệu trong localStorage</p>`;
      }
      
      // Tổng hợp thông tin từ các key đã tìm thấy
      if (Object.keys(foundTokens).length > 0) {
        resultDiv.innerHTML += `<p style="color:green">✓ Đã tìm thấy thông tin token trong localStorage</p>`;
        
        // Hiển thị thông tin các key đã tìm thấy
        for (const [key, value] of Object.entries(foundTokens)) {
          console.log(`Key tìm thấy: ${key} (${value.length} ký tự)`);
          resultDiv.innerHTML += `<p>Key tìm thấy: ${key} (${value.length} ký tự)</p>`;
          
          // Nếu là accessToken, hiển thị ở form
          if (key === 'accessToken') {
            setTokenInput(value);
          }
        }
        
        // Gửi token lên server
        const tokenResponse = await fetch('/api/youtube/kimvan-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(foundTokens)
        });
        
        const tokenResult = await tokenResponse.json();
        console.log('Kết quả API với localStorage token:', tokenResult);
        
        if (tokenResponse.ok) {
          console.log('Token localStorage hoạt động!');
          resultDiv.innerHTML += `<p style="color:green; font-weight:bold">✓ Token đã được cập nhật thành công từ localStorage!</p>`;
          
          setSuccess(true);
          setError(null);
          setLoading(false);
          checkTokenStatus();
          
          // Đóng kết quả sau 3 giây
          setTimeout(() => {
            if (document.body.contains(resultDiv)) {
              document.body.removeChild(resultDiv);
            }
          }, 3000);
          
          return;
        } else {
          resultDiv.innerHTML += `<p style="color:orange">⚠️ Không thể xác thực token từ localStorage: ${tokenResult.error || 'Lỗi không xác định'}</p>`;
        }
      } else {
        resultDiv.innerHTML += `<p style="color:orange">⚠️ Không tìm thấy token trong localStorage</p>`;
      }
      
      // Kiểm tra sessionStorage
      console.log('KIỂM TRA SESSION STORAGE...');
      resultDiv.innerHTML += `<hr><p>Kiểm tra sessionStorage...</p>`;
      
      try {
        const sessionItems = { ...sessionStorage };
        console.log('Nội dung sessionStorage đầy đủ:', sessionItems);
        
        if (Object.keys(sessionItems).length > 0) {
          // Tạo bảng chi tiết các giá trị trong sessionStorage
          resultDiv.innerHTML += `<div style="max-height: 150px; overflow-y: auto; margin-bottom: 10px; border: 1px solid #ddd; padding: 5px; background-color: #f5f5f5;">
            <h4 style="margin: 0 0 5px 0; font-size: 14px;">Giá trị trong sessionStorage:</h4>
            <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
              <tr>
                <th style="text-align: left; padding: 4px; border-bottom: 1px solid #ddd;">Key</th>
                <th style="text-align: left; padding: 4px; border-bottom: 1px solid #ddd;">Value (đầu)</th>
                <th style="text-align: center; padding: 4px; border-bottom: 1px solid #ddd;">Hành động</th>
              </tr>
              ${Object.entries(sessionItems).map(([key, value]) => `
                <tr>
                  <td style="padding: 4px; border-bottom: 1px solid #eee;">${key}</td>
                  <td style="padding: 4px; border-bottom: 1px solid #eee; word-break: break-all; max-width: 150px; overflow: hidden; text-overflow: ellipsis;">${value ? (value.substring(0, 30) + '...') : 'null'}</td>
                  <td style="padding: 4px; border-bottom: 1px solid #eee; text-align: center;">
                    <button onclick="navigator.clipboard.writeText('${value ? value.replace(/'/g, "\\'") : ''}'); alert('Đã sao chép giá trị của ${key}');" style="background: #4f46e5; color: white; padding: 2px 6px; border-radius: 3px; border: none; font-size: 11px; cursor: pointer;">Sao chép</button>
                  </td>
                </tr>
              `).join('')}
            </table>
          </div>`;
          
          // In ra console toàn bộ sessionStorage trong bảng rõ ràng
          console.table(Object.entries(sessionItems).map(([key, value]) => ({
            key,
            value: value ? (value.substring(0, 30) + '...') : 'null',
            length: value ? value.length : 0,
            isToken: (typeof value === 'string' && value.startsWith('eyJ')) ? 'Có thể' : 'Không'
          })));
          
          // Kiểm tra các key liên quan đến token
          const potentialSessionKeys = ['accessToken', 'token', 'auth', 'kimvan', 'session'];
          for (const key of Object.keys(sessionItems)) {
            const value = sessionItems[key];
            const isPotentialToken = 
              potentialSessionKeys.some(tokenKey => key.toLowerCase().includes(tokenKey.toLowerCase())) ||
              (typeof value === 'string' && value.startsWith('eyJ'));
              
            if (isPotentialToken) {
              console.log(`Key trong sessionStorage: ${key}`);
              console.log(`Value: ${value ? value.substring(0, 50) + '...' : 'null'}`);
              
              // Hiển thị trong UI
              resultDiv.innerHTML += `<p><strong>Key tìm thấy trong sessionStorage:</strong> ${key}</p>`;
              
              // Thử sử dụng token từ sessionStorage
              try {
                const sessionResponse = await fetch('/api/youtube/kimvan-token', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ cookie: value })
                });
                
                const sessionResult = await sessionResponse.json();
                console.log(`Kết quả API với ${key} từ sessionStorage:`, sessionResult);
                
                if (sessionResponse.ok) {
                  console.log(`${key} từ sessionStorage hoạt động!`);
                  resultDiv.innerHTML += `<p style="color:green; font-weight:bold">✓ Token đã được cập nhật thành công từ ${key}!</p>`;
                  
                  setTokenInput(value);
                  setSuccess(true);
                  setError(null);
                  setLoading(false);
                  checkTokenStatus();
                  
                  // Đóng kết quả sau 5 giây
                  setTimeout(() => {
                    if (document.body.contains(resultDiv)) {
                      document.body.removeChild(resultDiv);
                    }
                  }, 5000);
                  
                  return;
                }
              } catch (err) {
                console.error(`Lỗi khi gửi ${key} từ sessionStorage:`, err);
              }
            }
          }
        } else {
          console.log('SessionStorage trống');
          resultDiv.innerHTML += `<p>SessionStorage trống</p>`;
        }
      } catch (sessionError) {
        console.error('Lỗi khi kiểm tra sessionStorage:', sessionError);
      }
      
      // Kiểm tra các thuộc tính window có thể chứa token
      console.log('KIỂM TRA THUỘC TÍNH WINDOW...');
      resultDiv.innerHTML += `<hr><p>Kiểm tra thuộc tính window...</p>`;
      
      try {
        // Kiểm tra các thuộc tính phổ biến
        const potentialWindowProps = ['user', 'auth', 'kimvan', 'token', 'session', 'client'];
        const foundProps = [];
        
        // Tìm kiếm trong window toàn cục
        for (const prop of potentialWindowProps) {
          if (window[prop]) {
            console.log(`Tìm thấy window.${prop}:`, window[prop]);
            foundProps.push(prop);
          }
        }
        
        if (foundProps.length > 0) {
          resultDiv.innerHTML += `<p>Tìm thấy thuộc tính window: ${foundProps.join(', ')}</p>`;
        } else {
          resultDiv.innerHTML += `<p>Không tìm thấy thuộc tính window liên quan đến token</p>`;
        }
      } catch (windowError) {
        console.error('Lỗi khi kiểm tra thuộc tính window:', windowError);
      }
      
      // 4. Kiểm tra với API server
      console.log('Không tìm thấy token hợp lệ trên client. Kiểm tra trên server...');
      resultDiv.innerHTML += `<hr><p>Kiểm tra token trên server...</p>`;
      
      const response = await fetch('/api/youtube/kimvan-token', {
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
        setTokenStatus(data);
        console.log('Token đã tồn tại và còn hiệu lực trên server');
        resultDiv.innerHTML += `<p style="color:green; font-weight:bold">✓ Token đã tồn tại trên server và còn hiệu lực!</p>`;
      } else {
        resultDiv.innerHTML += `<p style="color:red">Không tìm thấy token hợp lệ.</p>`;
        resultDiv.innerHTML += `<div class="mt-4">
          <p style="font-weight:bold">Hướng dẫn thủ công:</p>
          <ol style="margin-left: 20px; margin-top: 10px;">
            <li>Mở tab KimVan và đảm bảo đã đăng nhập</li>
            <li>Nhấn F12 để mở Developer Tools</li>
            <li>Chuyển đến tab Application > Storage > Local Storage</li>
            <li>Tìm key có tên <strong>accessToken</strong> và sao chép giá trị của nó</li>
            <li>Dán vào ô nhập token bên dưới</li>
          </ol>
        </div>`;
        
        setError('Không tìm thấy token KimVan. Vui lòng nhập thủ công.');
      }
    } catch (error) {
      console.error('Lỗi khi kiểm tra token:', error);
      setError(`Lỗi: ${error.message}`);
      setLoading(false);
      
      if (document.body.contains(resultDiv)) {
        resultDiv.innerHTML += `<p style="color:red">❌ Lỗi: ${error.message}</p>`;
        
        // Đóng kết quả sau 5 giây
        setTimeout(() => {
          if (document.body.contains(resultDiv)) {
            document.body.removeChild(resultDiv);
          }
        }, 5000);
      }
    }
  };

  // Xử lý khi tự động gửi token đã phát hiện
  const handleSubmitTokenAuto = async (tokenValue) => {
    if (!tokenValue || !tokenValue.trim()) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/youtube/kimvan-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cookie: tokenValue })
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
          <h1 className="text-2xl font-semibold text-gray-900">Cập nhật Token KimVan</h1>
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

      {error && (
        <div className="rounded-md bg-yellow-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <ExclamationCircleIcon className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-yellow-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <CheckCircleIcon className="h-5 w-5 text-green-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">
                Thao tác thành công
              </h3>
              <div className="mt-2 text-sm text-green-700">
                <p>Token KimVan đã được cập nhật thành công.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="mb-6 border-b pb-5">
            <h2 className="text-lg font-medium text-gray-900 mb-1">Cập nhật Token KimVan</h2>
            <p className="text-sm text-gray-500 mb-2">
              Token KimVan cho phép kết nối với hệ thống KimVan mà không cần đăng nhập lại mỗi lần.
              Token được lưu trữ trong file JSON bền vững trên máy chủ.
            </p>
          </div>

          {/* Hiển thị trạng thái token hiện tại */}
          <div className="mb-6">
            <h3 className="text-md font-medium text-gray-900 mb-4">Trạng thái Token hiện tại</h3>
            
            {loading ? (
              <div className="flex justify-center py-4">
                <ArrowPathIcon className="animate-spin h-6 w-6 text-gray-500" />
              </div>
            ) : tokenStatus && tokenStatus.exists ? (
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="flex">
                  <div className={`flex-shrink-0 ${tokenStatus.valid ? 'text-green-500' : 'text-yellow-500'}`}>
                    {tokenStatus.valid ? (
                      <CheckCircleIcon className="h-5 w-5" />
                    ) : (
                      <ExclamationCircleIcon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="ml-3 flex-grow">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className="text-sm font-medium text-gray-900">
                        {tokenStatus.valid ? 'Token hợp lệ' : 'Token không hợp lệ hoặc đã hết hạn'}
                      </h4>
                      
                      {tokenStatus.timeRemaining && tokenStatus.valid && (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                          Còn lại: {tokenStatus.timeRemaining}
                        </span>
                      )}
                    </div>
                    
                    {tokenStatus.expiryDate && (
                      <p className="text-xs text-gray-600 mt-1">
                        Hết hạn: {new Date(tokenStatus.expiryDate).toLocaleString()}
                      </p>
                    )}
                    
                    <div className="mt-3">
                      <button
                        onClick={handleDeleteToken}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Xóa token hiện tại
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                Chưa có token KimVan nào được lưu trữ
              </div>
            )}
          </div>

          {/* Form nhập token thủ công */}
          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-md font-medium text-gray-900">Cập nhật Token KimVan</h3>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={checkBrowserToken}
                  disabled={loading}
                  className="text-sm text-white hover:bg-blue-700 flex items-center bg-blue-600 px-4 py-2 rounded-md mr-2 font-medium shadow-sm"
                >
                  <ArrowPathIcon className="h-5 w-5 mr-1" />
                  Kiểm tra token
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
                {tokenInput ? 'Token KimVan đã được tự động phát hiện!' : 'Hướng dẫn lấy token KimVan'}
              </h4>
              
              {tokenInput ? (
                <div>
                  <p className="text-sm text-blue-700">
                    Token đã được tự động phát hiện và đang được lưu lại. Vui lòng đợi trong giây lát...
                  </p>
                  <div className="mt-2 bg-white p-2 rounded border border-blue-100">
                    <span className="text-xs font-mono bg-gray-50 px-2 py-1 rounded">
                      {tokenInput.substring(0, 20)}...{tokenInput.substring(tokenInput.length - 20)}
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-blue-700 font-medium">
                    Quy trình lấy token KimVan (2 bước đơn giản):
                  </p>
                  <ol className="list-decimal list-inside text-sm text-blue-700 mt-2 space-y-2">
                    <li>
                      <strong>Bước 1:</strong> Nhấn nút <span className="bg-green-600 text-white px-2 py-1 rounded text-xs">Mở trang KimVan</span> để mở trang KimVan trong tab mới
                      <div className="ml-6 mt-1 text-xs">Đăng nhập vào tài khoản KimVan của bạn nếu chưa đăng nhập</div>
                    </li>
                    <li>
                      <strong>Bước 2:</strong> Quay lại tab này và nhấn nút <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs">Kiểm tra token</span> màu xanh
                      <div className="ml-6 mt-1 text-xs">Hệ thống sẽ tự động lấy và lưu token của bạn</div>
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
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full rounded-none rounded-l-md pl-10 sm:text-sm border-gray-300"
                  placeholder="Dán token KimVan vào đây"
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