'use client';

import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

export default function YoutubeScheduler({ courseId, onSuccess }) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info'); // info, success, error
  const [scheduledUploads, setScheduledUploads] = useState([]);
  const [isLoadingUploads, setIsLoadingUploads] = useState(true);
  
  const titleRef = useRef(null);
  const descriptionRef = useRef(null);
  const videoFileRef = useRef(null);
  const thumbnailFileRef = useRef(null);
  const visibilityRef = useRef(null);
  const scheduleTimeRef = useRef(null);
  
  // Tải danh sách video đã lên lịch khi component mount
  useEffect(() => {
    if (courseId) {
      fetchScheduledUploads();
    }
  }, [courseId]);
  
  // Lấy danh sách video đã lên lịch
  async function fetchScheduledUploads() {
    setIsLoadingUploads(true);
    
    try {
      const response = await fetch(`/api/youtube/schedule?courseId=${courseId}`);
      const data = await response.json();
      
      if (data.success) {
        setScheduledUploads(data.uploads);
      } else {
        console.error('Lỗi lấy danh sách video đã lên lịch:', data.message);
      }
    } catch (error) {
      console.error('Lỗi kết nối đến máy chủ:', error);
    } finally {
      setIsLoadingUploads(false);
    }
  }
  
  // Xử lý khi gửi form lên lịch
  async function handleSubmit(e) {
    e.preventDefault();
    
    const title = titleRef.current.value;
    const description = descriptionRef.current.value;
    const videoFile = videoFileRef.current.files[0];
    const thumbnailFile = thumbnailFileRef.current.files[0];
    const visibility = visibilityRef.current.value;
    const scheduleTime = scheduleTimeRef.current.value;
    
    if (!title || !videoFile) {
      setMessage('Vui lòng nhập tiêu đề và chọn file video');
      setMessageType('error');
      return;
    }
    
    if (!courseId) {
      setMessage('Không có thông tin khóa học');
      setMessageType('error');
      return;
    }
    
    // Tạo FormData
    const formData = new FormData();
    formData.append('courseId', courseId);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('videoFile', videoFile);
    formData.append('visibility', visibility);
    
    if (thumbnailFile) {
      formData.append('thumbnailFile', thumbnailFile);
    }
    
    if (scheduleTime) {
      formData.append('scheduleTime', scheduleTime);
    }
    
    setIsLoading(true);
    setMessage('Đang xử lý yêu cầu...');
    setMessageType('info');
    
    try {
      const response = await fetch('/api/youtube/schedule', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage(data.message);
        setMessageType('success');
        
        // Reset form
        titleRef.current.value = '';
        descriptionRef.current.value = '';
        videoFileRef.current.value = '';
        if (thumbnailFileRef.current) thumbnailFileRef.current.value = '';
        scheduleTimeRef.current.value = '';
        
        // Cập nhật danh sách
        fetchScheduledUploads();
        
        // Gọi callback nếu có
        if (onSuccess && typeof onSuccess === 'function') {
          onSuccess(data.result);
        }
      } else {
        setMessage(data.message || 'Lỗi khi lên lịch tải video');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Lỗi lên lịch tải video:', error);
      setMessage('Lỗi kết nối đến máy chủ');
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  }
  
  // Xử lý hành động với video đã lên lịch
  async function handleUploadAction(action, uploadId) {
    if (action === 'cancel' || action === 'delete') {
      if (!confirm(action === 'cancel' 
        ? 'Bạn có chắc chắn muốn hủy việc tải video này lên YouTube?' 
        : 'Bạn có chắc chắn muốn xóa video này khỏi danh sách lên lịch?'
      )) {
        return;
      }
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/youtube/schedule', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action, uploadId })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage(data.message);
        setMessageType('success');
        
        // Cập nhật danh sách
        fetchScheduledUploads();
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
  
  // Xử lý tác vụ xử lý ngay tất cả video
  async function handleProcessAll() {
    if (!confirm('Bạn có chắc chắn muốn xử lý tất cả video đã lên lịch ngay bây giờ?')) {
      return;
    }
    
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
        fetchScheduledUploads();
      } else {
        setMessage(data.message || 'Lỗi khi xử lý tác vụ');
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
  
  // Format lại thời gian hiển thị
  function formatDateTime(dateString) {
    try {
      const date = new Date(dateString);
      return format(date, 'HH:mm - dd/MM/yyyy', { locale: vi });
    } catch (error) {
      return 'Không hợp lệ';
    }
  }
  
  // Hiển thị trạng thái video
  function getStatusBadge(status) {
    switch (status) {
      case 'pending':
        return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-medium">Đang chờ</span>;
      case 'processing':
        return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">Đang xử lý</span>;
      case 'completed':
        return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">Hoàn thành</span>;
      case 'failed':
        return <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium">Thất bại</span>;
      case 'cancelled':
        return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-medium">Đã hủy</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-medium">{status}</span>;
    }
  }
  
  // Lấy giá trị min cho trường lên lịch (thời gian hiện tại + 5 phút)
  const getMinScheduleTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    return now.toISOString().slice(0, 16);
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Lên lịch tải video lên YouTube</h2>
        
        {/* Thông báo */}
        {message && (
          <div className={`mb-4 p-3 rounded ${
            messageType === 'success' ? 'bg-green-100 text-green-800' :
            messageType === 'error' ? 'bg-red-100 text-red-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {message}
          </div>
        )}
        
        {/* Form upload */}
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Tiêu đề video <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                ref={titleRef}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nhập tiêu đề video"
                disabled={isLoading}
              />
            </div>
            
            <div className="md:col-span-2">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Mô tả video
              </label>
              <textarea
                id="description"
                ref={descriptionRef}
                rows="4"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nhập mô tả video"
                disabled={isLoading}
              ></textarea>
            </div>
            
            <div>
              <label htmlFor="videoFile" className="block text-sm font-medium text-gray-700 mb-1">
                File video <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                id="videoFile"
                ref={videoFileRef}
                accept="video/*"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 mt-1">Chấp nhận các định dạng video phổ biến (MP4, AVI, MOV, etc.)</p>
            </div>
            
            <div>
              <label htmlFor="thumbnailFile" className="block text-sm font-medium text-gray-700 mb-1">
                Ảnh thumbnail
              </label>
              <input
                type="file"
                id="thumbnailFile"
                ref={thumbnailFileRef}
                accept="image/*"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 mt-1">Chấp nhận các định dạng ảnh (JPG, PNG). Kích thước khuyến nghị: 1280x720</p>
            </div>
            
            <div>
              <label htmlFor="visibility" className="block text-sm font-medium text-gray-700 mb-1">
                Chế độ hiển thị
              </label>
              <select
                id="visibility"
                ref={visibilityRef}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
                defaultValue="unlisted"
              >
                <option value="public">Công khai</option>
                <option value="unlisted">Không công khai</option>
                <option value="private">Riêng tư</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="scheduleTime" className="block text-sm font-medium text-gray-700 mb-1">
                Thời gian lên lịch
              </label>
              <input
                type="datetime-local"
                id="scheduleTime"
                ref={scheduleTimeRef}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
                min={getMinScheduleTime()}
              />
              <p className="text-xs text-gray-500 mt-1">Để trống nếu muốn upload ngay lập tức</p>
            </div>
            
            <div className="md:col-span-2">
              <button
                type="submit"
                className={`w-full py-2 px-4 rounded-md font-medium text-white ${
                  !isLoading
                    ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                    : 'bg-gray-400 cursor-not-allowed'
                } focus:outline-none focus:ring-2 focus:ring-offset-2`}
                disabled={isLoading}
              >
                {isLoading ? 'Đang xử lý...' : 'Tải lên / Lên lịch'}
              </button>
            </div>
          </div>
        </form>
      </div>
      
      {/* Danh sách video đã lên lịch */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Video đã lên lịch</h2>
          
          <button
            onClick={handleProcessAll}
            className={`px-3 py-1.5 text-sm rounded-md font-medium text-white ${
              !isLoading && scheduledUploads.some(u => u.status === 'pending')
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
            disabled={isLoading || !scheduledUploads.some(u => u.status === 'pending')}
          >
            Xử lý tất cả ngay
          </button>
        </div>
        
        {isLoadingUploads ? (
          <div className="py-4 text-center">Đang tải...</div>
        ) : scheduledUploads.length === 0 ? (
          <div className="py-4 text-center text-gray-500 italic">Chưa có video nào được lên lịch</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tiêu đề
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Thời gian lên lịch
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trạng thái
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Chế độ hiển thị
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {scheduledUploads.map((upload) => (
                  <tr key={upload._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                        {upload.youtubeUrl ? (
                          <a 
                            href={upload.youtubeUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:underline text-blue-600"
                          >
                            {upload.title}
                          </a>
                        ) : (
                          upload.title
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(upload.scheduleTime)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getStatusBadge(upload.status)}
                      {upload.status === 'failed' && upload.error && (
                        <span className="block mt-1 text-xs text-red-600 truncate max-w-xs" title={upload.error}>
                          {upload.error}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {upload.visibility === 'public' ? 'Công khai' :
                       upload.visibility === 'unlisted' ? 'Không công khai' :
                       'Riêng tư'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                      {upload.status === 'pending' && (
                        <button
                          onClick={() => handleUploadAction('cancel', upload._id)}
                          className="text-red-600 hover:text-red-900 mr-3"
                          disabled={isLoading}
                        >
                          Hủy
                        </button>
                      )}
                      
                      {['completed', 'failed', 'cancelled'].includes(upload.status) && (
                        <button
                          onClick={() => handleUploadAction('delete', upload._id)}
                          className="text-red-600 hover:text-red-900"
                          disabled={isLoading}
                        >
                          Xóa
                        </button>
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