'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function TokenLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Hàm tải log
  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/token/log');
      const data = await response.json();
      
      if (data.success && data.logs) {
        setLogs(data.logs);
      } else {
        setError(data.message || 'Không thể tải log');
      }
    } catch (err) {
      setError(err.message || 'Đã xảy ra lỗi khi tải log');
    } finally {
      setLoading(false);
    }
  };
  
  // Hàm xóa tất cả log
  const clearLogs = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa tất cả log?')) {
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await fetch('/api/token/log?clear=true');
      const data = await response.json();
      
      if (data.success) {
        setLogs([]);
        alert('Đã xóa tất cả log thành công!');
      } else {
        setError(data.message || 'Không thể xóa log');
      }
    } catch (err) {
      setError(err.message || 'Đã xảy ra lỗi khi xóa log');
    } finally {
      setLoading(false);
    }
  };
  
  // Tải log khi component được mount
  useEffect(() => {
    fetchLogs();
  }, []);
  
  // Format thời gian
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };
  
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Quản lý Log Token</h1>
        <div className="space-x-2">
          <Link 
            href="/admin/kimvan-token"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Trang Token
          </Link>
          <button 
            onClick={fetchLogs} 
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
            disabled={loading}
          >
            {loading ? 'Đang tải...' : '🔄 Tải lại'}
          </button>
          <button 
            onClick={clearLogs} 
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
            disabled={loading}
          >
            🗑️ Xóa tất cả
          </button>
        </div>
      </div>
      
      {error && (
        <div className="p-4 mb-6 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {loading ? (
        <div className="text-center p-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500 border-r-2 border-blue-500 border-b-2 border-transparent"></div>
          <p className="mt-2">Đang tải dữ liệu...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center p-12 bg-gray-50 border border-gray-200 rounded">
          Không có log token nào.
        </div>
      ) : (
        <div className="space-y-6">
          {logs.map((log, index) => (
            <div key={index} className="p-4 border border-gray-200 rounded shadow-sm hover:shadow-md transition">
              <div className="flex justify-between mb-2">
                <span className="font-bold">
                  Thời gian: {formatDate(log.timestamp)}
                </span>
                <span className="text-gray-500">
                  IP: {log.ipAddress}
                </span>
              </div>
              
              <div className="text-sm mb-2">
                <strong>User Agent:</strong> {log.userAgent}
              </div>
              
              <div className="mt-4">
                <details className="cursor-pointer">
                  <summary className="font-medium text-blue-600 hover:text-blue-800">
                    Xem dữ liệu chi tiết
                  </summary>
                  <div className="mt-2 p-3 bg-gray-50 overflow-x-auto whitespace-pre text-xs font-mono">
                    {JSON.stringify(log.data, null, 2)}
                  </div>
                </details>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 