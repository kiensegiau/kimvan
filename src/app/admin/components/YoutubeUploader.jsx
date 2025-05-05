'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function YoutubeUploader({ courseId, onSuccess }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info'); // info, success, error
  const [video, setVideo] = useState(null);

  const titleRef = useRef(null);
  const descriptionRef = useRef(null);
  const videoFileRef = useRef(null);
  const thumbnailFileRef = useRef(null);
  const visibilityRef = useRef(null);
  
  const router = useRouter();
  
  // Kiểm tra trạng thái đăng nhập khi component mount
  useEffect(() => {
    checkLoginStatus();
  }, []);
  
  // Hàm kiểm tra trạng thái đăng nhập
  async function checkLoginStatus() {
    try {
      const response = await fetch('/api/youtube/upload', {
        method: 'HEAD'
      });
      
      const data = await response.json();
      setIsLoggedIn(data.loggedIn);
      
      if (!data.loggedIn) {
        setMessage('Vui lòng đăng nhập YouTube trước khi tải lên video');
        setMessageType('info');
      }
    } catch (error) {
      console.error('Lỗi kiểm tra đăng nhập:', error);
      setIsLoggedIn(false);
      setMessage('Lỗi kiểm tra trạng thái đăng nhập');
      setMessageType('error');
    }
  }
  
  // Hàm yêu cầu đăng nhập
  async function requestLogin() {
    try {
      setMessage('Đang mở trình duyệt để đăng nhập YouTube...');
      setMessageType('info');
      
      const response = await fetch('/api/youtube/upload');
      const data = await response.json();
      
      if (data.success) {
        setIsLoggedIn(true);
        setMessage('Đăng nhập YouTube thành công!');
        setMessageType('success');
      } else {
        setMessage(data.message || 'Lỗi đăng nhập YouTube');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Lỗi yêu cầu đăng nhập:', error);
      setMessage('Lỗi kết nối đến máy chủ');
      setMessageType('error');
    }
  }
  
  // Hàm xử lý upload video
  async function handleUpload(e) {
    e.preventDefault();
    
    if (!isLoggedIn) {
      setMessage('Vui lòng đăng nhập YouTube trước');
      setMessageType('error');
      return;
    }
    
    const title = titleRef.current.value;
    const description = descriptionRef.current.value;
    const videoFile = videoFileRef.current.files[0];
    const thumbnailFile = thumbnailFileRef.current.files[0];
    const visibility = visibilityRef.current.value;
    
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
    
    setIsUploading(true);
    setMessage('Đang tải video lên YouTube...');
    setMessageType('info');
    
    try {
      const response = await fetch('/api/youtube/upload', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage('Tải lên video thành công!');
        setMessageType('success');
        setVideo(data.video);
        
        // Gọi callback nếu có
        if (onSuccess && typeof onSuccess === 'function') {
          onSuccess(data.video);
        }
        
        // Reset form
        titleRef.current.value = '';
        descriptionRef.current.value = '';
        videoFileRef.current.value = '';
        if (thumbnailFileRef.current) thumbnailFileRef.current.value = '';
      } else {
        if (data.needLogin) {
          setIsLoggedIn(false);
          setMessage('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        } else {
          setMessage(data.message || 'Lỗi khi tải lên video');
        }
        setMessageType('error');
      }
    } catch (error) {
      console.error('Lỗi upload video:', error);
      setMessage('Lỗi kết nối đến máy chủ');
      setMessageType('error');
    } finally {
      setIsUploading(false);
    }
  }
  
  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-6">
      <h2 className="text-xl font-bold mb-4">Upload Video Lên YouTube</h2>
      
      {/* Trạng thái đăng nhập */}
      <div className="mb-4">
        <p className="mb-2">
          Trạng thái đăng nhập: 
          <span className={`ml-2 font-medium ${isLoggedIn ? 'text-green-600' : 'text-red-600'}`}>
            {isLoggedIn ? 'Đã đăng nhập' : 'Chưa đăng nhập'}
          </span>
        </p>
        
        {!isLoggedIn && (
          <button
            type="button"
            onClick={requestLogin}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            disabled={isUploading}
          >
            Đăng nhập YouTube
          </button>
        )}
      </div>
      
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
      
      {/* Video đã upload */}
      {video && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium mb-2">Video đã tải lên:</h3>
          <p><strong>Tiêu đề:</strong> {video.title}</p>
          <p><strong>Link:</strong> <a href={video.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{video.url}</a></p>
          <p><strong>Trạng thái:</strong> {video.visibility}</p>
          
          <div className="mt-3">
            <iframe 
              width="100%" 
              height="315" 
              src={video.embedUrl} 
              title={video.title}
              frameBorder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen
              className="rounded"
            ></iframe>
          </div>
        </div>
      )}
      
      {/* Form upload */}
      <form onSubmit={handleUpload}>
        <div className="mb-4">
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
            disabled={isUploading}
          />
        </div>
        
        <div className="mb-4">
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Mô tả video
          </label>
          <textarea
            id="description"
            ref={descriptionRef}
            rows="4"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Nhập mô tả video"
            disabled={isUploading}
          ></textarea>
        </div>
        
        <div className="mb-4">
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
            disabled={isUploading}
          />
          <p className="text-xs text-gray-500 mt-1">Chấp nhận các định dạng video phổ biến (MP4, AVI, MOV, etc.)</p>
        </div>
        
        <div className="mb-4">
          <label htmlFor="thumbnailFile" className="block text-sm font-medium text-gray-700 mb-1">
            Ảnh thumbnail
          </label>
          <input
            type="file"
            id="thumbnailFile"
            ref={thumbnailFileRef}
            accept="image/*"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isUploading}
          />
          <p className="text-xs text-gray-500 mt-1">Chấp nhận các định dạng ảnh (JPG, PNG). Kích thước khuyến nghị: 1280x720</p>
        </div>
        
        <div className="mb-6">
          <label htmlFor="visibility" className="block text-sm font-medium text-gray-700 mb-1">
            Chế độ hiển thị
          </label>
          <select
            id="visibility"
            ref={visibilityRef}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isUploading}
            defaultValue="unlisted"
          >
            <option value="public">Công khai</option>
            <option value="unlisted">Không công khai</option>
            <option value="private">Riêng tư</option>
          </select>
        </div>
        
        <button
          type="submit"
          className={`w-full py-2 px-4 rounded-md font-medium text-white ${
            isLoggedIn && !isUploading
              ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
              : 'bg-gray-400 cursor-not-allowed'
          } focus:outline-none focus:ring-2 focus:ring-offset-2`}
          disabled={!isLoggedIn || isUploading}
        >
          {isUploading ? 'Đang tải lên...' : 'Tải video lên YouTube'}
        </button>
      </form>
    </div>
  );
} 