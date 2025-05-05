'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import YoutubeUploader from './YoutubeUploader';

export default function YoutubeUploaderPage() {
  const [course, setCourse] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadedVideos, setUploadedVideos] = useState([]);
  
  const params = useParams();
  const router = useRouter();
  const courseId = params?.id;
  
  // Lấy thông tin khóa học khi component mount
  useEffect(() => {
    if (!courseId) {
      setError('Không tìm thấy ID khóa học');
      setIsLoading(false);
      return;
    }
    
    fetchCourseData();
    fetchCourseVideos();
  }, [courseId]);
  
  // Lấy thông tin khóa học
  async function fetchCourseData() {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/courses/${courseId}`);
      
      if (!response.ok) {
        throw new Error('Không thể lấy thông tin khóa học');
      }
      
      const data = await response.json();
      setCourse(data);
    } catch (error) {
      console.error('Lỗi khi lấy thông tin khóa học:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }
  
  // Lấy danh sách video đã upload
  async function fetchCourseVideos() {
    try {
      const response = await fetch(`/api/courses/media?courseId=${courseId}`);
      
      if (!response.ok) {
        throw new Error('Không thể lấy danh sách video');
      }
      
      const data = await response.json();
      
      if (data.videos && Array.isArray(data.videos)) {
        // Lọc ra các video đã upload lên YouTube
        const youtubeVideos = data.videos.filter(video => video.youtubeId);
        setUploadedVideos(youtubeVideos);
      }
    } catch (error) {
      console.error('Lỗi khi lấy danh sách video:', error);
    }
  }
  
  // Xử lý khi upload thành công
  function handleUploadSuccess(videoData) {
    // Thêm video mới vào danh sách
    setUploadedVideos(prevVideos => [videoData, ...prevVideos]);
  }
  
  // Xóa video
  async function handleDeleteVideo(videoId, dbId) {
    if (!confirm('Bạn có chắc chắn muốn xóa video này khỏi danh sách?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/youtube/upload?videoId=${videoId}&dbVideoId=${dbId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Xóa video khỏi danh sách
        setUploadedVideos(prevVideos => 
          prevVideos.filter(v => v.id !== videoId && v._id !== dbId)
        );
        alert('Đã xóa video thành công');
      } else {
        alert('Lỗi khi xóa video: ' + data.message);
      }
    } catch (error) {
      console.error('Lỗi khi xóa video:', error);
      alert('Đã xảy ra lỗi khi xóa video');
    }
  }
  
  if (isLoading) {
    return <div className="p-6">Đang tải...</div>;
  }
  
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-100 text-red-800 p-4 rounded mb-4">
          Lỗi: {error}
        </div>
        <button
          onClick={() => router.push('/admin/courses')}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Quay lại danh sách khóa học
        </button>
      </div>
    );
  }
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Upload Video YouTube cho Khóa học</h1>
        <button
          onClick={() => router.push(`/admin/courses/${courseId}`)}
          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
        >
          Quay lại khóa học
        </button>
      </div>
      
      {course && (
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <h2 className="font-medium text-lg mb-2">Thông tin khóa học</h2>
          <p><strong>Tên khóa học:</strong> {course.name}</p>
          <p><strong>Mô tả:</strong> {course.description}</p>
        </div>
      )}
      
      {/* Component upload */}
      <YoutubeUploader 
        courseId={courseId} 
        onSuccess={handleUploadSuccess}
      />
      
      {/* Danh sách video đã upload */}
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Video đã tải lên YouTube</h2>
        
        {uploadedVideos.length === 0 ? (
          <p className="text-gray-500 italic">Chưa có video nào được tải lên</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {uploadedVideos.map((video) => (
              <div key={video.id || video._id} className="bg-white shadow-md rounded-lg overflow-hidden">
                <div className="aspect-w-16 aspect-h-9">
                  <iframe 
                    src={`https://www.youtube.com/embed/${video.youtubeId}`}
                    title={video.title}
                    className="w-full h-full"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
                <div className="p-4">
                  <h3 className="font-medium mb-2 line-clamp-2">{video.title}</h3>
                  <p className="text-sm text-gray-500 mb-2">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      video.visibility === 'public' ? 'bg-green-100 text-green-800' :
                      video.visibility === 'unlisted' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {video.visibility === 'public' ? 'Công khai' :
                       video.visibility === 'unlisted' ? 'Không công khai' :
                       'Riêng tư'}
                    </span>
                  </p>
                  
                  <div className="mt-3 flex space-x-2">
                    <a 
                      href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-3 py-1 rounded"
                    >
                      Xem trên YouTube
                    </a>
                    <button
                      onClick={() => handleDeleteVideo(video.youtubeId, video._id)}
                      className="bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1 rounded"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 