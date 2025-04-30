'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, CheckCircleIcon, ExclamationCircleIcon, ArrowPathIcon, PlusCircleIcon, CloudArrowUpIcon, CloudArrowDownIcon, CheckBadgeIcon } from '@heroicons/react/24/outline';

export default function DriveSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState(null);
  const [authUrl, setAuthUrl] = useState('');
  const [setupSuccess, setSetupSuccess] = useState(false);
  const [currentAccountIndex, setCurrentAccountIndex] = useState(0);

  // Thông tin vai trò của từng tài khoản
  const accountRoles = [
    { 
      name: "Tài khoản tải lên", 
      description: "Tài khoản này được sử dụng để tải lên các tệp đến Google Drive.", 
      icon: <CloudArrowUpIcon className="h-5 w-5 text-green-500" />
    },
    { 
      name: "Tài khoản tải xuống", 
      description: "Tài khoản này được sử dụng để tải xuống các tệp từ Google Drive.", 
      icon: <CloudArrowDownIcon className="h-5 w-5 text-blue-500" /> 
    }
  ];

  useEffect(() => {
    checkAccountsStatus();
  }, []);

  // Kiểm tra URL để xem có code xác thực từ Google không
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state'); // Get state parameter for account index
    const accountIndex = state ? parseInt(state) : currentAccountIndex;
    
    if (code) {
      handleAuthCode(code, accountIndex);
    }
  }, []);

  // Hàm kiểm tra trạng thái tài khoản
  const checkAccountsStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/drive/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setAccounts(data.accounts || []);
      } else {
        throw new Error(data.error || 'Đã xảy ra lỗi khi kiểm tra trạng thái tài khoản');
      }
    } catch (err) {
      console.error('Lỗi khi kiểm tra tài khoản:', err);
      setError(err.message || 'Không thể kết nối đến API để kiểm tra tài khoản');
    } finally {
      setLoading(false);
    }
  };

  // Lấy URL xác thực từ Google
  const getAuthUrl = async (accountIndex) => {
    try {
      setLoading(true);
      setError(null);
      setCurrentAccountIndex(accountIndex);
      
      const response = await fetch(`/api/drive/setup?account=${accountIndex}`);
      const data = await response.json();
      
      if (response.ok && data.authUrl) {
        setAuthUrl(data.authUrl);
        return data.authUrl;
      } else {
        throw new Error(data.error || 'Không thể lấy URL xác thực');
      }
    } catch (err) {
      console.error('Lỗi khi lấy URL xác thực:', err);
      setError(err.message || 'Không thể kết nối đến API để lấy URL xác thực');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Xử lý code xác thực nhận từ Google
  const handleAuthCode = async (code, accountIndex) => {
    try {
      setLoading(true);
      setError(null);
      
      // Xóa code khỏi URL để tránh lỗi khi refresh trang
      window.history.replaceState({}, document.title, '/admin/youtube-setup');
      
      const response = await fetch(`/api/drive/setup?code=${code}&account=${accountIndex}`);
      const data = await response.json();
      
      if (response.ok) {
        setSetupSuccess(true);
        checkAccountsStatus(); // Cập nhật trạng thái tài khoản
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

  // Xử lý xóa token của tài khoản
  const deleteAccount = async (accountIndex) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/drive/setup?account=${accountIndex}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setSetupSuccess(false);
        // Refetch để cập nhật trạng thái
        checkAccountsStatus();
      } else {
        throw new Error(data.error || 'Không thể xóa tài khoản');
      }
    } catch (err) {
      console.error('Lỗi khi xóa tài khoản:', err);
      setError(err.message || 'Đã xảy ra lỗi khi xóa tài khoản');
    } finally {
      setLoading(false);
    }
  };

  // Bắt đầu quá trình xác thực mới
  const startAuthentication = async (accountIndex) => {
    const url = await getAuthUrl(accountIndex);
    if (url) {
      window.location.href = url; // No need to append account, it's in state param
    }
  };

  // Thêm tài khoản mới
  const addNewAccount = () => {
    if (accounts.length < 2) {
      startAuthentication(accounts.length);
    } else {
      setError('Chỉ được phép thêm tối đa 2 tài khoản Google Drive');
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
          <h1 className="text-2xl font-semibold text-gray-900">Thiết lập Google Drive</h1>
        </div>
        
        <button
          onClick={checkAccountsStatus}
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
                <p>Tài khoản Google Drive đã được liên kết thành công.</p>
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
            <h2 className="text-lg font-medium text-gray-900 mb-1">Thiết lập hai tài khoản Google Drive</h2>
            <p className="text-sm text-gray-500">
              Hệ thống sử dụng hai tài khoản Google Drive khác nhau để tải lên và tải xuống, giúp bạn phân tách quyền truy cập và quản lý dữ liệu hiệu quả hơn.
            </p>
          </div>
          
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-medium text-gray-900">Trạng thái tài khoản</h3>
            
            {accounts.length < 2 && (
              <button 
                onClick={addNewAccount}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <PlusCircleIcon className="h-5 w-5 mr-1" />
                Thêm tài khoản ({accounts.length}/2)
              </button>
            )}
          </div>
          
          {loading ? (
            <div className="flex justify-center items-center py-6">
              <ArrowPathIcon className="animate-spin h-8 w-8 text-indigo-500" />
              <span className="ml-2 text-gray-500">Đang kiểm tra...</span>
            </div>
          ) : accounts.length > 0 ? (
            <div className="space-y-4">
              {[0, 1].map((index) => {
                const account = accounts.find(acc => acc.index === index);
                return (
                  <div key={index} className={`rounded-md border ${account ? 'bg-white' : 'bg-gray-50'} ${index === 0 ? 'border-green-200' : 'border-blue-200'}`}>
                    <div className="p-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 p-2 rounded-full bg-gray-50">
                          {index === 0 ? (
                            <CloudArrowUpIcon className="h-6 w-6 text-green-500" />
                          ) : (
                            <CloudArrowDownIcon className="h-6 w-6 text-blue-500" />
                          )}
                        </div>
                        <div className="ml-3 flex-grow">
                          <div className="flex justify-between items-center">
                            <h3 className="text-lg font-medium text-gray-900">
                              {accountRoles[index].name}
                            </h3>
                            {account && account.valid && (
                              <CheckBadgeIcon className="h-5 w-5 text-green-500" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{accountRoles[index].description}</p>
                        </div>
                      </div>
                      
                      {account ? (
                        <div className="mt-4 border-t pt-4">
                          <div className="flex items-start">
                            <div className={`flex-shrink-0 ${account.valid ? 'text-green-500' : 'text-red-500'}`}>
                              {account.valid ? (
                                <CheckCircleIcon className="h-5 w-5" />
                              ) : (
                                <ExclamationCircleIcon className="h-5 w-5" />
                              )}
                            </div>
                            <div className="ml-3 flex-grow">
                              <div className="flex flex-col">
                                <div className="flex items-center">
                                  <h4 className="text-sm font-medium text-gray-900">
                                    {account.valid ? 'Đã xác thực' : 'Chưa xác thực'}
                                  </h4>
                                  {account.email && (
                                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800">
                                      {account.email}
                                    </span>
                                  )}
                                </div>
                                
                                {account.expiryDate && (
                                  <p className="text-xs text-gray-600 mt-1">
                                    Hết hạn: {new Date(account.expiryDate).toLocaleString()}
                                  </p>
                                )}
                              </div>
                              
                              {!account.valid && account.error && (
                                <p className="text-sm text-red-600 mt-2">
                                  Lỗi: {account.error}
                                </p>
                              )}
                              
                              <div className="mt-3 flex space-x-3">
                                <button
                                  onClick={() => startAuthentication(index)}
                                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                  {account.valid ? 'Cấp lại quyền truy cập' : 'Xác thực tài khoản'}
                                </button>
                                
                                <button
                                  onClick={() => deleteAccount(index)}
                                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                >
                                  Xóa tài khoản
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 flex justify-center">
                          <button
                            onClick={() => startAuthentication(index)}
                            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${index === 0 ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 ${index === 0 ? 'focus:ring-green-500' : 'focus:ring-blue-500'}`}
                          >
                            <PlusCircleIcon className="h-5 w-5 mr-1" />
                            Thêm {accountRoles[index].name}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
              <div className="space-y-4 mt-8">
                <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                  <h3 className="font-medium text-blue-800 mb-2">Làm mới token tự động</h3>
                  <p className="text-sm text-blue-700 mb-2">
                    Hệ thống tự động làm mới token Google Drive mỗi 30 phút để đảm bảo token không bị hết hạn.
                    Service chạy trực tiếp trên server và không cần cron job bên ngoài.
                  </p>
                  <div className="bg-white p-3 rounded-md border border-gray-200">
                    <p className="text-xs text-gray-700">Service làm mới token tự động:</p>
                    <code className="text-xs bg-gray-100 p-1 rounded block mt-1 text-blue-800">Kiểm tra token mỗi 30 phút và làm mới nếu sắp hết hạn (5 phút)</code>
                  </div>
                  <div className="mt-3 flex items-center">
                    <button
                      onClick={async () => {
                        try {
                          setLoading(true);
                          const res = await fetch('/api/drive/refresh-tokens');
                          const data = await res.json();
                          if (data.success) {
                            setSetupSuccess(true);
                            checkAccountsStatus(); // Cập nhật trạng thái
                            setError(null);
                          } else {
                            setError('Không thể làm mới token: ' + (data.error || 'Lỗi không xác định'));
                          }
                        } catch (err) {
                          setError('Lỗi khi làm mới token: ' + err.message);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      disabled={loading}
                    >
                      {loading ? (
                        <ArrowPathIcon className="animate-spin h-4 w-4 mr-1" />
                      ) : (
                        <ArrowPathIcon className="h-4 w-4 mr-1" />
                      )}
                      Làm mới token ngay bây giờ
                    </button>
                    <span className="ml-2 text-xs text-gray-500">
                      Dùng khi bạn muốn làm mới token thủ công
                    </span>
                  </div>
                </div>
                
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
                    Google Drive API có giới hạn số lượng request mỗi ngày. Quá trình tải lên và tải xuống sẽ tiêu tốn quota theo giới hạn của Google.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 p-6 rounded-md border border-yellow-200 text-center">
              <ExclamationCircleIcon className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa thiết lập Google Drive</h3>
              <p className="text-gray-600 mb-6">
                Để sử dụng tính năng tải lên và tải xuống từ Google Drive, bạn cần thiết lập hai tài khoản Drive riêng biệt.
              </p>
              <div className="bg-white p-3 rounded-md border border-gray-200 mb-4 text-left">
                <p className="text-sm font-medium text-gray-700 mb-2">Hai tài khoản với hai vai trò:</p>
                <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
                  <li><span className="font-medium text-green-600">Tài khoản tải lên</span>: Được sử dụng để tải các tệp lên Google Drive</li>
                  <li><span className="font-medium text-blue-600">Tài khoản tải xuống</span>: Được sử dụng để tải xuống các tệp từ Google Drive</li>
                </ul>
              </div>
              <button
                onClick={() => startAuthentication(0)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <CloudArrowUpIcon className="h-5 w-5 mr-1" />
                Thiết lập tài khoản tải lên
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 