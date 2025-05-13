'use client';

import { useState } from 'react';
import ReactPlayerTest from '../components/ReactPlayerTest';
import SandboxedPlayerTest from '../components/SandboxedPlayerTest';
import YouTubeNoLinkPlayer from '../components/YouTubeNoLinkPlayer';

const TestPlayersPage = () => {
  const [videoId, setVideoId] = useState('dQw4w9WgXcQ'); // Video mặc định
  const [showReactPlayer, setShowReactPlayer] = useState(false);
  const [showSandboxedPlayer, setShowSandboxedPlayer] = useState(false);
  const [showNoLinkPlayer, setShowNoLinkPlayer] = useState(false);
  const [customVideoId, setCustomVideoId] = useState('');

  const handleInputChange = (e) => {
    setCustomVideoId(e.target.value);
  };

  const handleVideoIdSubmit = (e) => {
    e.preventDefault();
    if (customVideoId.trim()) {
      // Trích xuất videoId từ URL YouTube nếu người dùng nhập URL đầy đủ
      const urlPattern = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
      const match = customVideoId.match(urlPattern);
      
      if (match && match[1]) {
        setVideoId(match[1]);
      } else if (/^[a-zA-Z0-9_-]{11}$/.test(customVideoId)) {
        // Nếu là video ID 11 ký tự
        setVideoId(customVideoId);
      } else {
        alert('Vui lòng nhập URL YouTube hợp lệ hoặc ID video');
        return;
      }
      
      setCustomVideoId('');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-center">Thử nghiệm các trình phát YouTube</h1>
      
      <div className="bg-gray-100 p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">Thay đổi video</h2>
        <form onSubmit={handleVideoIdSubmit} className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Nhập URL YouTube hoặc ID video"
            value={customVideoId}
            onChange={handleInputChange}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Áp dụng
          </button>
        </form>
        <p className="mt-2 text-sm text-gray-600">
          Video ID hiện tại: <span className="font-mono bg-gray-200 px-2 py-1 rounded">{videoId}</span>
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* ReactPlayer */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">ReactPlayer</h2>
          <p className="text-gray-600 mb-4">
            Sử dụng thư viện react-player với JavaScript để ghi đè các phương thức chuyển hướng và chèn CSS vào iframe.
          </p>
          <div className="aspect-video bg-gray-200 mb-4 rounded overflow-hidden">
            <img 
              src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
              alt="Thumbnail"
              className="w-full h-full object-cover"
            />
          </div>
          <button
            onClick={() => setShowReactPlayer(true)}
            className="w-full py-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center justify-center"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-6 w-6 mr-2" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" 
              />
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
            Phát với ReactPlayer
          </button>
        </div>
        
        {/* SandboxedPlayerTest */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Sandboxed Player</h2>
          <p className="text-gray-600 mb-4">
            Sử dụng kỹ thuật srcdoc iframe đơn giản với thumbnail và chặn chuyển hướng cơ bản.
          </p>
          <div className="aspect-video bg-gray-200 mb-4 rounded overflow-hidden">
            <img 
              src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
              alt="Thumbnail"
              className="w-full h-full object-cover"
            />
          </div>
          <button
            onClick={() => setShowSandboxedPlayer(true)}
            className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-6 w-6 mr-2" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" 
              />
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
            Phát với Sandboxed Player
          </button>
        </div>
        
        {/* YouTubeNoLinkPlayer */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">No-Link Player</h2>
          <p className="text-gray-600 mb-4">
            Phiên bản nâng cao với giao diện tùy chỉnh đẹp mắt và nhiều lớp bảo vệ chống chuyển hướng.
          </p>
          <div className="aspect-video bg-gray-200 mb-4 rounded overflow-hidden relative group">
            <img 
              src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
              alt="Thumbnail"
              className="w-full h-full object-cover transition-opacity group-hover:opacity-80"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="bg-black bg-opacity-50 rounded-full p-4">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-12 w-12 text-white" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" 
                  />
                </svg>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowNoLinkPlayer(true)}
            className="w-full py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center justify-center"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-6 w-6 mr-2" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" 
              />
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
            Phát với No-Link Player
          </button>
        </div>
      </div>
      
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">So sánh các giải pháp</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-md">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tính năng</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ReactPlayer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sandboxed Player</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No-Link Player</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-4 whitespace-nowrap">Phát được video YouTube</td>
                <td className="px-6 py-4 whitespace-nowrap text-green-600">✓</td>
                <td className="px-6 py-4 whitespace-nowrap text-green-600">✓</td>
                <td className="px-6 py-4 whitespace-nowrap text-green-600">✓</td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap">Ngăn chặn chuyển hướng đến YouTube</td>
                <td className="px-6 py-4 whitespace-nowrap text-yellow-600">△ Cơ bản</td>
                <td className="px-6 py-4 whitespace-nowrap text-yellow-600">△ Cơ bản</td>
                <td className="px-6 py-4 whitespace-nowrap text-green-600">✓ Nâng cao</td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap">Ẩn logo YouTube và các nút liên quan</td>
                <td className="px-6 py-4 whitespace-nowrap text-yellow-600">△ Cơ bản</td>
                <td className="px-6 py-4 whitespace-nowrap text-yellow-600">△ Cơ bản</td>
                <td className="px-6 py-4 whitespace-nowrap text-green-600">✓ Nâng cao</td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap">Đầy đủ tính năng điều khiển video</td>
                <td className="px-6 py-4 whitespace-nowrap text-green-600">✓</td>
                <td className="px-6 py-4 whitespace-nowrap text-green-600">✓</td>
                <td className="px-6 py-4 whitespace-nowrap text-green-600">✓</td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap">Giao diện trải nghiệm người dùng</td>
                <td className="px-6 py-4 whitespace-nowrap text-yellow-600">Tiêu chuẩn</td>
                <td className="px-6 py-4 whitespace-nowrap text-yellow-600">Cơ bản</td>
                <td className="px-6 py-4 whitespace-nowrap text-green-600">Tùy chỉnh đẹp</td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap">Độ phức tạp triển khai</td>
                <td className="px-6 py-4 whitespace-nowrap text-yellow-600">Trung bình</td>
                <td className="px-6 py-4 whitespace-nowrap text-green-600">Thấp</td>
                <td className="px-6 py-4 whitespace-nowrap text-red-600">Cao</td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap">Sử dụng thư viện bên ngoài</td>
                <td className="px-6 py-4 whitespace-nowrap text-red-600">Có</td>
                <td className="px-6 py-4 whitespace-nowrap text-green-600">Không</td>
                <td className="px-6 py-4 whitespace-nowrap text-green-600">Không</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Players */}
      <ReactPlayerTest 
        isOpen={showReactPlayer} 
        videoId={videoId} 
        onClose={() => setShowReactPlayer(false)} 
      />
      
      <SandboxedPlayerTest 
        isOpen={showSandboxedPlayer} 
        videoId={videoId} 
        onClose={() => setShowSandboxedPlayer(false)} 
      />
      
      <YouTubeNoLinkPlayer 
        isOpen={showNoLinkPlayer} 
        videoId={videoId} 
        onClose={() => setShowNoLinkPlayer(false)} 
      />
    </div>
  );
};

export default TestPlayersPage; 