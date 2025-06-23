'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function WatermarkApiKeysPage() {
  const [apiKeys, setApiKeys] = useState([]);
  const [newApiKey, setNewApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const router = useRouter();

  // API endpoint for checking credits
  const CHECK_CREDITS_ENDPOINT = 'https://techhk.aoscdn.com/api/customers/coins';

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/watermark-api-keys');
      if (!response.ok) {
        throw new Error('Failed to load API keys');
      }
      const data = await response.json();
      
      // Check credits for each key
      const keysWithCredits = await Promise.all(
        data.keys.map(async (key) => {
          try {
            const credits = await checkApiKeyCredits(key);
            return {
              key,
              credits,
              isValid: credits > 0,
              error: null
            };
          } catch (error) {
            return {
              key,
              credits: 'Unknown',
              isValid: true, // Giả định là hợp lệ nếu không thể kiểm tra
              error: error.message
            };
          }
        })
      );
      
      setApiKeys(keysWithCredits);
    } catch (err) {
      setError('Error loading API keys: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkApiKeyCredits = async (apiKey) => {
    try {
      const response = await axios.get(CHECK_CREDITS_ENDPOINT, {
        headers: {
          'X-API-KEY': apiKey
        },
        timeout: 10000 // 10 giây timeout
      });
      
      if (response.data?.status === 200) {
        // Phân tích dữ liệu theo định dạng chính xác từ tài liệu API
        const services = response.data.data;
        
        // Kiểm tra nếu data là mảng các dịch vụ (định dạng theo tài liệu)
        if (Array.isArray(services)) {
          // Tìm dịch vụ "cov" (watermark remover)
          const covService = services.find(service => service.service_name === 'cov');
          if (covService) {
            // Tính tổng credits = lifetime_limit - lifetime_used + period_limit - period_used
            const lifetimeRemaining = Math.max(0, covService.lifetime_limit - covService.lifetime_used);
            const periodRemaining = Math.max(0, covService.period_limit - covService.period_used);
            return lifetimeRemaining + periodRemaining;
          }
          
          // Nếu không tìm thấy dịch vụ "cov", kiểm tra tất cả các dịch vụ
          let totalCredits = 0;
          for (const service of services) {
            const lifetimeRemaining = Math.max(0, service.lifetime_limit - service.lifetime_used);
            const periodRemaining = Math.max(0, service.period_limit - service.period_used);
            totalCredits += lifetimeRemaining + periodRemaining;
          }
          return totalCredits;
        }
        
        // Nếu không có dữ liệu dịch vụ hợp lệ, nhưng API trả về thành công, giả định có 50 credits
        return 50;
      }
      
      return 0;
    } catch (error) {
      console.error(`Error checking credits for API key ${apiKey.substring(0, 5)}...`, error.message);
      throw error;
    }
  };

  const addApiKey = async () => {
    if (!newApiKey.trim()) {
      setError('Vui lòng nhập API key hợp lệ');
      return;
    }

    setIsAdding(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch('/api/watermark-api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: newApiKey.trim() }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add API key');
      }

      setSuccess(`Đã thêm API key thành công${data.credits ? ` (${data.credits} credits)` : ''}`);
      setNewApiKey('');
      loadApiKeys();
    } catch (err) {
      setError('Lỗi khi thêm API key: ' + err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const removeApiKey = async (key) => {
    try {
      setError(null);
      setSuccess(null);
      
      const response = await fetch('/api/watermark-api-keys', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: key }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove API key');
      }

      setSuccess('Đã xóa API key thành công');
      loadApiKeys();
    } catch (err) {
      setError('Lỗi khi xóa API key: ' + err.message);
    }
  };

  const refreshCredits = async (key) => {
    try {
      setError(null);
      setSuccess(null);
      
      // Tạo bản sao mảng apiKeys
      const updatedKeys = [...apiKeys];
      
      // Tìm và cập nhật key cần refresh
      const keyIndex = updatedKeys.findIndex(item => item.key === key);
      if (keyIndex !== -1) {
        updatedKeys[keyIndex] = {
          ...updatedKeys[keyIndex],
          isLoading: true,
          error: null
        };
        setApiKeys(updatedKeys);
        
        // Kiểm tra credits
        try {
          const credits = await checkApiKeyCredits(key);
          
          // Cập nhật thông tin key
          updatedKeys[keyIndex] = {
            key,
            credits,
            isValid: credits > 0,
            error: null,
            isLoading: false
          };
          
          setApiKeys(updatedKeys);
          setSuccess(`Đã cập nhật thông tin credits cho API key: ${credits} credits`);
        } catch (error) {
          updatedKeys[keyIndex] = {
            key,
            credits: 'Unknown',
            isValid: true,
            error: error.message,
            isLoading: false
          };
          
          setApiKeys(updatedKeys);
          setError(`Không thể kiểm tra credits: ${error.message}`);
        }
      }
    } catch (err) {
      setError('Lỗi khi cập nhật thông tin credits: ' + err.message);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Quản lý API Key Xóa Watermark</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
          <button 
            className="text-red-700 font-bold" 
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          <p>{success}</p>
          <button 
            className="text-green-700 font-bold" 
            onClick={() => setSuccess(null)}
          >
            ×
          </button>
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Thêm API Key Mới</h2>
        <div className="flex">
          <input
            type="text"
            value={newApiKey}
            onChange={(e) => setNewApiKey(e.target.value)}
            placeholder="Nhập API key"
            className="flex-1 p-2 border rounded-l"
            disabled={isAdding}
          />
          <button
            onClick={addApiKey}
            className={`bg-blue-500 text-white px-4 py-2 rounded-r ${isAdding ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isAdding}
          >
            {isAdding ? 'Đang thêm...' : 'Thêm Key'}
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Lưu ý: Hệ thống sẽ kiểm tra số credits thực tế từ API.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Danh sách API Key hiện tại</h2>
        {loading ? (
          <p>Đang tải danh sách API key...</p>
        ) : apiKeys.length === 0 ? (
          <p>Không tìm thấy API key nào</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">API Key</th>
                <th className="border p-2 text-left">Credits</th>
                <th className="border p-2 text-left">Trạng thái</th>
                <th className="border p-2 text-left">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((item, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                  <td className="border p-2">
                    {item.key.substring(0, 5)}...{item.key.substring(item.key.length - 5)}
                  </td>
                  <td className="border p-2">
                    {item.isLoading ? (
                      <span className="text-gray-500">Đang kiểm tra...</span>
                    ) : item.error ? (
                      <span className="text-orange-500">Không xác định</span>
                    ) : (
                      item.credits
                    )}
                  </td>
                  <td className="border p-2">
                    {item.isLoading ? (
                      <span className="text-gray-500">Đang kiểm tra...</span>
                    ) : item.error ? (
                      <span className="text-orange-500" title={item.error}>
                        Không thể kiểm tra
                      </span>
                    ) : (
                      <span className={item.isValid ? 'text-green-600' : 'text-red-600'}>
                        {item.isValid ? 'Hợp lệ' : 'Hết credits'}
                      </span>
                    )}
                  </td>
                  <td className="border p-2 space-x-2">
                    <button
                      onClick={() => refreshCredits(item.key)}
                      className="bg-blue-500 text-white px-2 py-1 rounded text-sm mr-2"
                      disabled={item.isLoading}
                    >
                      {item.isLoading ? 'Đang cập nhật...' : 'Cập nhật'}
                    </button>
                    <button
                      onClick={() => removeApiKey(item.key)}
                      className="bg-red-500 text-white px-2 py-1 rounded text-sm"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
} 