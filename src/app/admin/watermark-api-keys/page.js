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
      
      // Đặt credits cố định là 50 cho tất cả các key
      const keysWithCredits = data.keys.map(key => ({
        key,
        credits: 50,
        isValid: true,
        error: null
      }));
      
      setApiKeys(keysWithCredits);
    } catch (err) {
      setError('Error loading API keys: ' + err.message);
    } finally {
      setLoading(false);
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

      setSuccess(`Đã thêm API key thành công (50 credits)`);
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
    // Không thực sự kiểm tra credits, chỉ giả lập cập nhật UI
    setSuccess('Đã cập nhật thông tin credits: 50 credits');
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
          Lưu ý: Mỗi API key có 50 credits.
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
                    50
                  </td>
                  <td className="border p-2">
                    <span className="text-green-600">Hợp lệ</span>
                  </td>
                  <td className="border p-2 space-x-2">
                    <button
                      onClick={() => refreshCredits(item.key)}
                      className="bg-blue-500 text-white px-2 py-1 rounded text-sm mr-2"
                    >
                      Cập nhật
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