'use client';

import { useState, useEffect } from 'react';

export default function YoutubeCronPage() {
  const [status, setStatus] = useState('unknown');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info'); // info, success, error
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  
  // Lấy thông tin trạng thái cron job khi component mount
  useEffect(() => {
    fetchStatus();
  }, []);
  
  // Tự động cập nhật logs theo khoảng thời gian
  useEffect(() => {
    let interval;
    
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchLogs();
      }, 10000); // 10 giây
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);
  
  // Lấy thông tin trạng thái cron job
  async function fetchStatus() {
    try {
      const response = await fetch('/api/youtube/init');
      const data = await response.json();
      
      if (data.success) {
        setStatus(data.status);
      } else {
        console.error('Lỗi lấy trạng thái cron job:', data.message);
      }
    } catch (error) {
      console.error('Lỗi kết nối đến máy chủ:', error);
    }
  }
  
  // Lấy logs của cron job
  async function fetchLogs() {
    setIsLoadingLogs(true);
    
    try {
      const response = await fetch('/api/youtube/init?logs=true');
      const data = await response.json();
      
      if (data.success) {
        setLogs(data.logs || []);
      } else {
        console.error('Lỗi lấy logs cron job:', data.message);
      }
    } catch (error) {
      console.error('Lỗi kết nối đến máy chủ:', error);
    } finally {
      setIsLoadingLogs(false);
    }
  }
  
  // Xử lý hành động với cron job
  async function handleAction(action) {
    setIsLoading(true);
    setMessage('Đang xử lý...');
    setMessageType('info');
    
    try {
      const response = await fetch('/api/youtube/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage(data.message);
        setMessageType('success');
        
        // Cập nhật trạng thái
        if (data.status) {
          setStatus(data.status);
        } else {
          fetchStatus();
        }
        
        // Cập nhật logs nếu là hành động xử lý video
        if (action === 'process') {
          fetchLogs();
        }
      } else {
        setMessage(data.message || 'Lỗi khi thực hiện tác vụ');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Lỗi xử lý tác vụ:', error);
      setMessage('Lỗi kết nối đến máy chủ');
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  }
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Quản lý tự động tải video lên YouTube</h1>
      
      {/* Thông báo */}
      {message && (
        <div className={`mb-6 p-4 rounded ${
          messageType === 'success' ? 'bg-green-100 text-green-800' :
          messageType === 'error' ? 'bg-red-100 text-red-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          {message}
        </div>
      )}
      
      {/* Trạng thái và điều khiển */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Trạng thái và điều khiển</h2>
        
        <div className="mb-6">
          <p className="mb-2">
            Trạng thái cron job: 
            <span className={`ml-2 font-medium ${
              status === 'running' ? 'text-green-600' :
              status === 'stopped' ? 'text-red-600' :
              'text-gray-600'
            }`}>
              {status === 'running' ? 'Đang chạy' :
               status === 'stopped' ? 'Đã dừng' :
               'Không xác định'}
            </span>
          </p>
          
          <p className="text-sm text-gray-600 mb-4">
            {status === 'running' 
              ? 'Cron job đang tự động xử lý các video đã lên lịch theo định kỳ.'
              : 'Cron job không hoạt động. Hãy khởi động để tự động xử lý các video đã lên lịch.'}
          </p>
          
          <div className="flex space-x-3">
            <button
              onClick={() => handleAction('start')}
              className={`px-4 py-2 rounded ${
                !isLoading && status !== 'running'
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-300 text-gray-700 cursor-not-allowed'
              }`}
              disabled={isLoading || status === 'running'}
            >
              Khởi động
            </button>
            
            <button
              onClick={() => handleAction('stop')}
              className={`px-4 py-2 rounded ${
                !isLoading && status === 'running'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-300 text-gray-700 cursor-not-allowed'
              }`}
              disabled={isLoading || status !== 'running'}
            >
              Dừng lại
            </button>
            
            <button
              onClick={() => handleAction('process')}
              className={`px-4 py-2 rounded ${
                !isLoading
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-700 cursor-not-allowed'
              }`}
              disabled={isLoading}
            >
              Xử lý video ngay
            </button>
          </div>
        </div>
      </div>
      
      {/* Logs */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Logs hoạt động</h2>
          
          <div className="flex items-center space-x-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={() => setAutoRefresh(!autoRefresh)}
                className="mr-2"
              />
              <span className="text-sm">Tự động cập nhật</span>
            </label>
            
            <button
              onClick={fetchLogs}
              className={`px-3 py-1.5 text-sm rounded ${
                !isLoadingLogs
                  ? 'bg-gray-600 text-white hover:bg-gray-700'
                  : 'bg-gray-300 text-gray-700 cursor-not-allowed'
              }`}
              disabled={isLoadingLogs}
            >
              {isLoadingLogs ? 'Đang tải...' : 'Cập nhật logs'}
            </button>
          </div>
        </div>
        
        <div className="bg-gray-100 p-4 rounded h-96 overflow-y-auto font-mono text-sm">
          {logs.length === 0 ? (
            <div className="text-gray-500 italic">Không có logs nào để hiển thị</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className={`mb-1 ${
                log.includes('Lỗi') ? 'text-red-600' :
                log.includes('thành công') ? 'text-green-600' :
                log.includes('Bắt đầu') ? 'text-blue-600' :
                'text-gray-800'
              }`}>
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
} 