'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeftIcon, 
  CheckCircleIcon, 
  ExclamationCircleIcon, 
  ArrowPathIcon,
  VideoCameraIcon,
  CloudArrowUpIcon,
  PhotoIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';

export default function YouTubeUploadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [tokenStatus, setTokenStatus] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [visibility, setVisibility] = useState('unlisted');
  const [courseId, setCourseId] = useState('');
  const [courses, setCourses] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    checkTokenStatus();
    fetchCourses();
  }, []);

  // Kiểm tra trạng thái token hiện tại
  const checkTokenStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/youtube/chrome-token', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      setTokenStatus(data);

      if (!data.exists || !data.valid) {
        setError('Chưa cấu hình hoặc token đã hết hạn. Vui lòng cập nhật token Chrome trước.');
      }
    } catch (err) {
      console.error('Lỗi khi kiểm tra token YouTube:', err);
      setError('Không thể kết nối đến API để kiểm tra token');
    } finally {
      setLoading(false);
    }
  };

  // Lấy danh sách khóa học
  const fetchCourses = async () => {
    try {
      const response = await fetch('/api/admin/courses');
      if (response.ok) {
        const data = await response.json();
        setCourses(data.courses || []);
      } else {
        console.error('Lỗi khi lấy danh sách khóa học');
      }
    } catch (error) {
      console.error('Lỗi khi fetch khóa học:', error);
    }
  };

  // Xử lý khi người dùng upload video
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!videoFile) {
      setError('Vui lòng chọn file video để tải lên');
      return;
    }

    if (!title.trim()) {
      setError('Vui lòng nhập tiêu đề video');
      return;
    }

    if (!courseId) {
      setError('Vui lòng chọn khóa học');
      return;
    }

    try {
      setUploading(true);
      setProgress(10);
      setError(null);
      
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('videoFile', videoFile);
      formData.append('visibility', visibility);
      formData.append('courseId', courseId);
      
      if (thumbnailFile) {
        formData.append('thumbnailFile', thumbnailFile);
      }

      setProgress(30);
      
      const response = await fetch('/api/youtube/upload', {
        method: 'POST',
        body: formData
      });
      
      setProgress(90);
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccess({
          message: data.message || 'Video đã được tải lên thành công!',
          details: data.result
        });
        // Reset form
        setTitle('');
        setDescription('');
        setVideoFile(null);
        setThumbnailFile(null);
        setProgress(100);
      } else {
        throw new Error(data.error || 'Không thể tải video lên YouTube');
      }
    } catch (err) {
      console.error('Lỗi khi tải video lên:', err);
      setError(err.message || 'Đã xảy ra lỗi khi tải video lên YouTube');
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  // Xử lý chọn file video
  const handleVideoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2000 * 1024 * 1024) { // Giới hạn 2GB
        setError('File video quá lớn (giới hạn 2GB)');
        return;
      }
      setVideoFile(file);
    }
  };

  // Xử lý chọn file thumbnail
  const handleThumbnailChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // Giới hạn 2MB
        setError('File thumbnail quá lớn (giới hạn 2MB)');
        return;
      }
      setThumbnailFile(file);
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
          <h1 className="text-2xl font-semibold text-gray-900">Upload Video lên YouTube</h1>
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
          Kiểm tra token
        </button>
      </div>

      {success && (
        <div className="bg-green-50 p-4 rounded-md mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <CheckCircleIcon className="h-5 w-5 text-green-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">
                Upload thành công!
              </h3>
              <div className="mt-2 text-sm text-green-700">
                <p>{success.message}</p>
                {success.details?.videoId && (
                  <p className="mt-1">
                    Video ID: <span className="font-mono">{success.details.videoId}</span>
                  </p>
                )}
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

      {/* Token Status */}
      {tokenStatus && (
        <div className={`p-4 rounded-md ${tokenStatus.valid ? 'bg-green-50' : 'bg-yellow-50'}`}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {tokenStatus.valid ? (
                <CheckCircleIcon className="h-5 w-5 text-green-400" />
              ) : (
                <ExclamationCircleIcon className="h-5 w-5 text-yellow-400" />
              )}
            </div>
            <div className="ml-3">
              <h3 className={`text-sm font-medium ${tokenStatus.valid ? 'text-green-800' : 'text-yellow-800'}`}>
                {tokenStatus.valid ? 'Token hợp lệ' : 'Token không hợp lệ'}
              </h3>
              <div className={`mt-1 text-sm ${tokenStatus.valid ? 'text-green-700' : 'text-yellow-700'}`}>
                <p>Thời gian còn lại: {tokenStatus.timeRemaining || 'Đã hết hạn'}</p>
                {tokenStatus.channelInfo && tokenStatus.channelInfo.length > 0 && (
                  <p>Kênh: {tokenStatus.channelInfo[0].title}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Form */}
      <div className="bg-white shadow overflow-hidden rounded-lg">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label htmlFor="course" className="block text-sm font-medium text-gray-700">Khóa học</label>
            <select
              id="course"
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              required
            >
              <option value="">-- Chọn khóa học --</option>
              {courses.map((course) => (
                <option key={course._id} value={course._id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">Tiêu đề video</label>
            <input
              type="text"
              id="title"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Nhập tiêu đề video"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Mô tả video</label>
            <textarea
              id="description"
              rows={4}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Nhập mô tả video (tùy chọn)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            ></textarea>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">File video</label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                <VideoCameraIcon className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600">
                  <label
                    htmlFor="videoFile"
                    className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                  >
                    <span>Tải lên video</span>
                    <input
                      id="videoFile"
                      name="videoFile"
                      type="file"
                      className="sr-only"
                      accept="video/*"
                      onChange={handleVideoChange}
                      required
                    />
                  </label>
                  <p className="pl-1">hoặc kéo thả vào đây</p>
                </div>
                <p className="text-xs text-gray-500">MP4, MOV, WEBM tối đa 2GB</p>
                {videoFile && (
                  <p className="text-sm text-indigo-500 font-medium">{videoFile.name}</p>
                )}
              </div>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Thumbnail (tùy chọn)</label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600">
                  <label
                    htmlFor="thumbnailFile"
                    className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                  >
                    <span>Tải lên hình thu nhỏ</span>
                    <input
                      id="thumbnailFile"
                      name="thumbnailFile"
                      type="file"
                      className="sr-only"
                      accept="image/*"
                      onChange={handleThumbnailChange}
                    />
                  </label>
                  <p className="pl-1">hoặc kéo thả vào đây</p>
                </div>
                <p className="text-xs text-gray-500">PNG, JPG tối đa 2MB</p>
                {thumbnailFile && (
                  <p className="text-sm text-indigo-500 font-medium">{thumbnailFile.name}</p>
                )}
              </div>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Chế độ hiển thị</label>
            <div className="flex space-x-6">
              <div className="flex items-center">
                <input
                  id="public"
                  name="visibility"
                  type="radio"
                  className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                  value="public"
                  checked={visibility === 'public'}
                  onChange={(e) => setVisibility(e.target.value)}
                />
                <label htmlFor="public" className="ml-2 block text-sm text-gray-700 flex items-center">
                  <EyeIcon className="h-4 w-4 mr-1 text-gray-500" />
                  Công khai
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="unlisted"
                  name="visibility"
                  type="radio"
                  className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                  value="unlisted"
                  checked={visibility === 'unlisted'}
                  onChange={(e) => setVisibility(e.target.value)}
                />
                <label htmlFor="unlisted" className="ml-2 block text-sm text-gray-700 flex items-center">
                  <EyeIcon className="h-4 w-4 mr-1 text-gray-400" />
                  Không công khai
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="private"
                  name="visibility"
                  type="radio"
                  className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                  value="private"
                  checked={visibility === 'private'}
                  onChange={(e) => setVisibility(e.target.value)}
                />
                <label htmlFor="private" className="ml-2 block text-sm text-gray-700 flex items-center">
                  <EyeSlashIcon className="h-4 w-4 mr-1 text-gray-500" />
                  Riêng tư
                </label>
              </div>
            </div>
          </div>
          
          {uploading && (
            <div className="mt-4">
              <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-indigo-600 bg-indigo-200">
                      Đang tải lên
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold inline-block text-indigo-600">
                      {progress}%
                    </span>
                  </div>
                </div>
                <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-indigo-200">
                  <div
                    style={{ width: `${progress}%` }}
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-500 transition-all duration-500"
                  ></div>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              disabled={uploading || !tokenStatus?.valid}
            >
              {uploading ? (
                <>
                  <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-5 w-5" />
                  Đang tải lên...
                </>
              ) : (
                <>
                  <CloudArrowUpIcon className="-ml-1 mr-2 h-5 w-5" />
                  Tải lên YouTube
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Hướng dẫn */}
      <div className="bg-white shadow overflow-hidden rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Hướng dẫn tải video lên YouTube</h2>
        <div className="space-y-4">
          <p className="text-gray-600">
            Để tải video lên YouTube, bạn cần thực hiện các bước sau:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-gray-600">
            <li>Đảm bảo đã cập nhật token Chrome hợp lệ (kiểm tra ở phía trên)</li>
            <li>Chọn khóa học cần tải video lên</li>
            <li>Nhập tiêu đề và mô tả video (tuỳ chọn)</li>
            <li>Tải lên file video (hỗ trợ MP4, MOV, WEBM tối đa 2GB)</li>
            <li>Tải lên hình thu nhỏ (tuỳ chọn)</li>
            <li>Chọn chế độ hiển thị: Công khai, Không công khai hoặc Riêng tư</li>
            <li>Nhấn nút "Tải lên YouTube" và đợi quá trình hoàn tất</li>
          </ol>
          <p className="text-gray-600">
            <strong>Lưu ý:</strong> Quá trình tải lên có thể mất nhiều thời gian tùy thuộc vào kích thước file và tốc độ mạng.
          </p>
        </div>
      </div>
    </div>
  );
} 