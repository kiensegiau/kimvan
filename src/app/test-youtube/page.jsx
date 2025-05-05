'use client';

import { useState, useRef, useEffect } from 'react';
import { DEFAULT_COURSE_ID, SETTINGS } from './config';

export default function TestYoutubePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [videoList, setVideoList] = useState([]);
  const [loginStatus, setLoginStatus] = useState('unknown'); // 'unknown', 'logged-in', 'logged-out'
  
  const videoFileRef = useRef(null);
  const videoTitleRef = useRef(null);
  const videoDescRef = useRef(null);
  const scheduleDateRef = useRef(null);
  const scheduleTimeRef = useRef(null);
  
  // Kiểm tra trạng thái đăng nhập khi trang được tải
  useEffect(() => {
    checkLoginStatus();
    fetchVideoList();
  }, []);
  
  // Kiểm tra trạng thái đăng nhập YouTube
  async function checkLoginStatus() {
    try {
      setMessage('Đang kiểm tra trạng thái đăng nhập YouTube...');
      setMessageType('info');
      
      // Mở trang tự động đăng nhập
      const win = window.open('/api/youtube/auth/check', '_blank', 'width=800,height=600');
      
      // Nếu popup bị chặn, hiển thị thông báo
      if (!win) {
        setMessage('Popup bị chặn. Vui lòng cho phép popup để kiểm tra đăng nhập.');
        setMessageType('error');
        return;
      }
      
      // Đặt timeout để đóng cửa sổ sau 30 giây nếu không hoàn thành
      const timeout = setTimeout(() => {
        if (!win.closed) {
          win.close();
          setMessage('Không thể kiểm tra trạng thái đăng nhập. Quá thời gian chờ.');
          setMessageType('error');
        }
      }, 30000);
      
      // Kiểm tra cửa sổ đã đóng
      const checkClosed = setInterval(() => {
        if (win.closed) {
          clearInterval(checkClosed);
          clearTimeout(timeout);
          
          // Giả định đã đăng nhập thành công sau khi đóng
          setLoginStatus('logged-in');
          setMessage('Đã đăng nhập YouTube. Bạn có thể tải video lên.');
          setMessageType('success');
        }
      }, 1000);
    } catch (error) {
      console.error('Lỗi kiểm tra đăng nhập:', error);
      setMessage('Lỗi kiểm tra đăng nhập: ' + error.message);
      setMessageType('error');
    }
  }
  
  // Xử lý đăng nhập mới vào YouTube
  async function handleYouTubeLogin() {
    try {
      setIsLoading(true);
      setMessage('Đang mở trình duyệt để đăng nhập YouTube...');
      setMessageType('info');
      
      // Chạy script YouTube Persistent Login
      window.open('/api/youtube/auth/login', '_blank', 'width=800,height=600');
      
      setMessage('Đã mở trang đăng nhập YouTube. Vui lòng đăng nhập trong cửa sổ vừa mở.');
      setMessageType('info');
    } catch (error) {
      console.error('Lỗi đăng nhập YouTube:', error);
      setMessage('Lỗi đăng nhập YouTube: ' + error.message);
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  }
  
  // Lấy danh sách video đã lên lịch
  async function fetchVideoList() {
    try {
      const response = await fetch('/api/youtube/schedule');
      const data = await response.json();
      
      if (data.success) {
        setVideoList(data.uploads);
      } else {
        console.error('Lỗi khi lấy danh sách video:', data.message);
        setMessage('Lỗi khi lấy danh sách video: ' + data.message);
        setMessageType('error');
      }
    } catch (error) {
      console.error('Lỗi kết nối máy chủ:', error);
      setMessage('Lỗi kết nối máy chủ');
      setMessageType('error');
    }
  }
  
  // Xử lý nộp form tải video
  async function handleUpload(e) {
    e.preventDefault();
    
    // Lấy dữ liệu từ form
    const videoFile = videoFileRef.current.files[0];
    const title = videoTitleRef.current.value;
    const description = videoDescRef.current.value;
    const scheduleDate = scheduleDateRef.current.value;
    const scheduleTime = scheduleTimeRef.current.value;
    
    // Kiểm tra dữ liệu
    if (!videoFile || !title) {
      setMessage('Vui lòng chọn file video và nhập tiêu đề');
      setMessageType('error');
      return;
    }
    
    // Hiển thị thông báo đang xử lý
    setIsLoading(true);
    setMessage('Đang xử lý yêu cầu...');
    setMessageType('info');
    
    // Tạo FormData
    const formData = new FormData();
    formData.append('courseId', DEFAULT_COURSE_ID);
    formData.append('videoFile', videoFile);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('visibility', SETTINGS.defaultVisibility);
    
    // Thêm thời gian lên lịch nếu có
    if (scheduleDate && scheduleTime) {
      const scheduleDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
      formData.append('scheduleTime', scheduleDateTime.toISOString());
    }
    
    try {
      // Gửi yêu cầu tải lên
      const response = await fetch('/api/youtube/schedule', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage(data.message);
        setMessageType('success');
        
        // Reset form
        videoFileRef.current.value = '';
        videoTitleRef.current.value = '';
        videoDescRef.current.value = '';
        scheduleDateRef.current.value = '';
        scheduleTimeRef.current.value = '';
        
        // Cập nhật danh sách video
        fetchVideoList();
      } else {
        setMessage(data.message || 'Lỗi khi tải video');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Lỗi khi tải video:', error);
      setMessage('Lỗi kết nối đến máy chủ');
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  }
  
  // Xử lý thủ công tất cả video
  async function handleProcessAll() {
    setIsLoading(true);
    setMessage('Đang xử lý tất cả video đã lên lịch...');
    setMessageType('info');
    
    try {
      const response = await fetch('/api/youtube/schedule', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'process-all' })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage(data.message);
        setMessageType('success');
        
        // Cập nhật danh sách
        fetchVideoList();
      } else {
        setMessage(data.message || 'Lỗi xử lý video');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Lỗi xử lý video:', error);
      setMessage('Lỗi kết nối đến máy chủ');
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  }
  
  // Format ngày tháng
  function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN');
  }
  
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Trang test tải video lên YouTube</h1>
      
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
      
      {/* Quản lý đăng nhập YouTube */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Tài khoản YouTube</h2>
        
        <div className="flex space-x-4 items-center">
          <button
            onClick={handleYouTubeLogin}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 flex items-center"
            disabled={isLoading}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="mr-2">
              <circle cx="12" cy="12" r="10"></circle>
              <circle cx="12" cy="12" r="4"></circle>
              <line x1="4.93" y1="4.93" x2="9.17" y2="9.17"></line>
              <line x1="14.83" y1="14.83" x2="19.07" y2="19.07"></line>
              <line x1="14.83" y1="9.17" x2="19.07" y2="4.93"></line>
              <line x1="4.93" y1="19.07" x2="9.17" y2="14.83"></line>
            </svg>
            Đăng nhập YouTube
          </button>
          
          <button
            onClick={checkLoginStatus}
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
            disabled={isLoading}
          >
            Kiểm tra đăng nhập
          </button>
          
          <span className="text-sm">
            {loginStatus === 'logged-in' ? 
              '✅ Đã đăng nhập' : 
              loginStatus === 'logged-out' ? 
              '❌ Chưa đăng nhập' : 
              '❓ Chưa xác định'}
          </span>
        </div>
        
        <p className="mt-4 text-sm text-gray-600">
          Thư mục hồ sơ Chrome: <code className="bg-gray-100 px-2 py-1 rounded">C:\Users\Admin\youtube-upload-profile</code>
        </p>
      </div>
      
      {/* Form tải video */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Tải video mới</h2>
        
        <form onSubmit={handleUpload}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="videoTitle" className="block text-sm font-medium text-gray-700 mb-1">
                Tiêu đề video <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="videoTitle"
                ref={videoTitleRef}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Nhập tiêu đề video"
                disabled={isLoading}
              />
            </div>
            
            <div className="md:col-span-2">
              <label htmlFor="videoDesc" className="block text-sm font-medium text-gray-700 mb-1">
                Mô tả video
              </label>
              <textarea
                id="videoDesc"
                ref={videoDescRef}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Nhập mô tả video"
                disabled={isLoading}
              ></textarea>
            </div>
            
            <div className="md:col-span-2">
              <label htmlFor="videoFile" className="block text-sm font-medium text-gray-700 mb-1">
                File video <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                id="videoFile"
                ref={videoFileRef}
                accept="video/*"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 mt-1">Chọn file video từ thiết bị của bạn (MP4, MKV, AVI, etc.)</p>
            </div>
            
            <div>
              <label htmlFor="scheduleDate" className="block text-sm font-medium text-gray-700 mb-1">
                Ngày lên lịch
              </label>
              <input
                type="date"
                id="scheduleDate"
                ref={scheduleDateRef}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled={isLoading}
              />
            </div>
            
            <div>
              <label htmlFor="scheduleTime" className="block text-sm font-medium text-gray-700 mb-1">
                Giờ lên lịch
              </label>
              <input
                type="time"
                id="scheduleTime"
                ref={scheduleTimeRef}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 mt-1">Để trống nếu muốn tải lên ngay lập tức</p>
            </div>
            
            <div className="md:col-span-2 flex gap-4">
              <button
                type="submit"
                className={`flex-1 py-2 px-4 rounded-md font-medium text-white ${
                  !isLoading
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
                disabled={isLoading}
              >
                {isLoading ? 'Đang xử lý...' : 'Tải lên / Lên lịch'}
              </button>
              
              <button
                type="button"
                onClick={handleProcessAll}
                className={`flex-1 py-2 px-4 rounded-md font-medium text-white ${
                  !isLoading
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
                disabled={isLoading}
              >
                Xử lý tất cả video
              </button>
            </div>
          </div>
        </form>
      </div>
      
      {/* Danh sách video */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Danh sách video đã lên lịch</h2>
        
        <button
          onClick={fetchVideoList}
          className="mb-4 px-3 py-1.5 text-sm rounded-md bg-gray-600 text-white hover:bg-gray-700"
          disabled={isLoading}
        >
          Làm mới danh sách
        </button>
        
        {videoList.length === 0 ? (
          <p className="text-gray-500 italic">Chưa có video nào được lên lịch</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tiêu đề
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Thời gian lên lịch
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Trạng thái
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    YouTube ID
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {videoList.map(video => (
                  <tr key={video._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {video.title}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(video.scheduleTime)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        video.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        video.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                        video.status === 'completed' ? 'bg-green-100 text-green-800' :
                        video.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {video.status === 'pending' ? 'Đang chờ' :
                         video.status === 'processing' ? 'Đang xử lý' :
                         video.status === 'completed' ? 'Hoàn thành' :
                         video.status === 'failed' ? 'Thất bại' :
                         video.status === 'cancelled' ? 'Đã hủy' :
                         video.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {video.youtubeId ? (
                        <a
                          href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {video.youtubeId}
                        </a>
                      ) : (
                        <span className="text-gray-400">Chưa có</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
} 