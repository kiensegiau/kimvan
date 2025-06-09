'use client';

import { useState, useEffect, useRef } from 'react';
import { XMarkIcon, ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { ExclamationTriangleIcon, ListBulletIcon, ArrowsUpDownIcon } from '@heroicons/react/24/solid';

const YouTubePlaylistModal = ({ isOpen, playlistId, videoId, onClose, title }) => {
  const modalRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [playlistItems, setPlaylistItems] = useState([]);
  const [originalPlaylistItems, setOriginalPlaylistItems] = useState([]);
  const [currentVideoId, setCurrentVideoId] = useState(videoId);
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(true);
  const [error, setError] = useState(null);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const autoCloseTimerRef = useRef(null);
  const [sortOrder, setSortOrder] = useState('asc'); // Mặc định sắp xếp theo A-Z
  const [showTooltip, setShowTooltip] = useState(false);

  // Xử lý click ngoài modal
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, onClose]);

  // Tự động mở và đóng danh sách phát khi mở modal
  useEffect(() => {
    if (isOpen && !isLoadingPlaylist && playlistItems.length > 0) {
      // Tự động mở danh sách phát
      setShowPlaylist(true);
      
      // Tự động đóng sau 3 giây
      autoCloseTimerRef.current = setTimeout(() => {
        setShowPlaylist(false);
        
        // Hiển thị tooltip hướng dẫn sau khi đóng danh sách phát
        setShowTooltip(true);
        // Ẩn tooltip sau 3 giây
        setTimeout(() => {
          setShowTooltip(false);
        }, 3000);
      }, 3000);
    }
    
    return () => {
      // Xóa timer khi component unmount hoặc re-render
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, [isOpen, isLoadingPlaylist, playlistItems.length]);

  // Hủy timer khi người dùng tương tác với danh sách phát
  const handlePlaylistToggle = () => {
    // Xóa timer tự động đóng nếu đang có
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    
    // Đảo trạng thái hiển thị danh sách phát
    setShowPlaylist(!showPlaylist);
  };

  // Sắp xếp danh sách theo thứ tự hiện tại
  const sortPlaylist = (items, order) => {
    if (order === 'default') {
      return [...items];
    } else if (order === 'asc') {
      return [...items].sort((a, b) => 
        a.snippet.title.localeCompare(b.snippet.title, 'vi')
      );
    } else {
      return [...items].sort((a, b) => 
        b.snippet.title.localeCompare(a.snippet.title, 'vi')
      );
    }
  };

  // Lấy dữ liệu playlist từ API
  useEffect(() => {
    if (!playlistId) return;

    const fetchPlaylistData = async () => {
      setIsLoadingPlaylist(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/youtube/playlist?id=${playlistId}`);
        
        if (!response.ok) {
          throw new Error('Không thể tải dữ liệu playlist');
        }
        
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
          // Lưu trữ danh sách gốc
          setOriginalPlaylistItems(data.items);
          
          // Sắp xếp danh sách theo thứ tự hiện tại (mặc định là A-Z)
          const sortedItems = sortPlaylist(data.items, sortOrder);
          setPlaylistItems(sortedItems);
          
          // Nếu không có videoId ban đầu, sử dụng video đầu tiên từ playlist
          if (!currentVideoId && sortedItems[0].snippet.resourceId.videoId) {
            setCurrentVideoId(sortedItems[0].snippet.resourceId.videoId);
          }
          
          // Tìm index của video hiện tại trong playlist
          if (currentVideoId) {
            const index = sortedItems.findIndex(
              item => item.snippet.resourceId.videoId === currentVideoId
            );
            if (index !== -1) {
              setCurrentIndex(index);
            }
          }
        } else {
          setError('Playlist không có video nào');
        }
      } catch (error) {
        console.error('Lỗi khi tải playlist:', error);
        setError(`Lỗi khi tải playlist: ${error.message}`);
      } finally {
        setIsLoadingPlaylist(false);
      }
    };

    fetchPlaylistData();
  }, [playlistId, videoId, sortOrder]);

  // Sắp xếp danh sách phát
  const handleSortPlaylist = () => {
    // Xóa timer tự động đóng nếu đang có
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    
    // Xác định thứ tự sắp xếp tiếp theo
    let newSortOrder;
    if (sortOrder === 'default') {
      newSortOrder = 'asc';
    } else if (sortOrder === 'asc') {
      newSortOrder = 'desc';
    } else {
      newSortOrder = 'default';
    }
    
    // Sắp xếp danh sách theo thứ tự mới
    const sortedItems = sortPlaylist(originalPlaylistItems, newSortOrder);
    
    // Cập nhật state
    setSortOrder(newSortOrder);
    setPlaylistItems(sortedItems);
    
    // Cập nhật lại chỉ số của video hiện tại
    if (currentVideoId) {
      const newIndex = sortedItems.findIndex(
        item => item.snippet.resourceId.videoId === currentVideoId
      );
      if (newIndex !== -1) {
        setCurrentIndex(newIndex);
      }
    }
  };

  // Xử lý chuyển đến video tiếp theo
  const handleNextVideo = () => {
    if (playlistItems.length > 0 && currentIndex < playlistItems.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextVideoId = playlistItems[nextIndex].snippet.resourceId.videoId;
      setCurrentVideoId(nextVideoId);
      setCurrentIndex(nextIndex);
      setLoading(true);
    }
  };

  // Xử lý chuyển đến video trước
  const handlePrevVideo = () => {
    if (playlistItems.length > 0 && currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      const prevVideoId = playlistItems[prevIndex].snippet.resourceId.videoId;
      setCurrentVideoId(prevVideoId);
      setCurrentIndex(prevIndex);
      setLoading(true);
    }
  };

  // Xử lý khi chọn video từ danh sách
  const handleVideoSelect = (videoId, index) => {
    // Xóa timer tự động đóng nếu đang có
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    
    setCurrentVideoId(videoId);
    setCurrentIndex(index);
    setLoading(true);
    setShowPlaylist(false);
  };

  // Tạo HTML cho srcdoc iframe với CSS đơn giản để ẩn tên kênh
  const generateSrcdocContent = () => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            
            body, html {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
              overflow: hidden;
              background-color: #000;
            }
            
            .youtube-container {
              position: relative;
              width: 100%;
              height: 100%;
            }
            
            .youtube-iframe {
              width: 100%;
              height: 100%;
              border: none;
            }
            
            /* Phần tử chứa tên kênh tùy chỉnh */
            .custom-channel-name {
              position: absolute;
              bottom: 17px;
              left: 60px;
              color: white;
              font-size: 14px;
              font-weight: bold;
              z-index: 9999;
              text-shadow: 0px 0px 2px rgba(0,0,0,0.8);
              pointer-events: none;
              background-color: rgba(0, 0, 0, 0.7);
              padding: 3px 8px;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="youtube-container">
            <iframe 
              id="youtube-iframe"
              class="youtube-iframe"
              src="https://www.youtube.com/embed/${currentVideoId}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&color=white&showinfo=0&controls=1"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
            ></iframe>
            
            <!-- Lớp phủ để che phần tiêu đề -->
            <div class="title-overlay" style="
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 60px;
              background-color: transparent;
              z-index: 9999;
              pointer-events: auto;
            "></div>
          </div>
          
          <script>
            // Khai báo biến
            const youtubeIframe = document.getElementById('youtube-iframe');
            
            // Hàm inject CSS để ẩn tất cả các phần tử liên quan đến kênh và tiêu đề
            function injectCSS() {
              try {
                // Truy cập vào iframe content
                const iframeDoc = youtubeIframe.contentDocument || youtubeIframe.contentWindow.document;
                
                if (!iframeDoc) return;
                
                // Tạo style element
                const style = document.createElement('style');
                style.textContent = \`
                  /* Ẩn tất cả các phần tử liên quan đến kênh và tiêu đề */
                  .ytp-title-channel, 
                  .ytp-title-channel-logo, 
                  .ytp-title-text,
                  ytd-video-owner-renderer,
                  #owner,
                  #upload-info,
                  .ytp-ce-channel-title,
                  .ytp-title-link,
                  .ytp-title {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                    padding-left: 1000px !important;
                  }
                  
                  /* Selector riêng cho ytp-title-text */
                  .ytp-title-text {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    width: 0 !important;
                    height: 0 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    position: absolute !important;
                    left: -9999px !important;
                  }
                  
                  /* Đảm bảo ẩn cả container chứa */
                  .ytp-chrome-top {
                    height: 0 !important;
                    overflow: hidden !important;
                    padding-left: 1000px !important;
                  }
                \`;
                
                // Thêm style vào head của iframe
                if (iframeDoc.head) {
                  iframeDoc.head.appendChild(style);
                }
              } catch (error) {
                console.log("Không thể inject CSS:", error);
              }
            }
            
            // Thử inject CSS sau khi iframe đã tải
            youtubeIframe.addEventListener('load', function() {
              // Thử nhiều lần để đảm bảo CSS được áp dụng
              setTimeout(injectCSS, 1000);
              setTimeout(injectCSS, 2000);
              setTimeout(injectCSS, 3000);
            });
          </script>
        </body>
      </html>
    `;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-90"
      style={{
        height: '100vh',
        width: '100vw',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      }}>
      <div 
        ref={modalRef} 
        className="relative w-[80%] flex flex-col rounded-lg overflow-hidden shadow-2xl bg-black"
      >
        {/* Thanh tiêu đề */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2 px-3 flex items-center justify-between">
          <div className="flex-1 truncate text-sm md:text-base font-medium">
            {title || 'Danh sách phát YouTube'}
            {playlistItems.length > 0 && (
              <span className="ml-2 text-xs bg-white bg-opacity-20 rounded px-2 py-0.5">
                {currentIndex + 1}/{playlistItems.length}
              </span>
            )}
            <span className="ml-2 text-xs bg-yellow-500 text-black px-1.5 py-0.5 rounded">
              {sortOrder === 'asc' ? 'A-Z' : sortOrder === 'desc' ? 'Z-A' : 'Gốc'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSortPlaylist}
              className={`p-1.5 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-all relative ${sortOrder !== 'default' ? 'text-yellow-300' : ''}`}
              title={
                sortOrder === 'default' 
                  ? "Sắp xếp A-Z" 
                  : sortOrder === 'asc' 
                    ? "Sắp xếp Z-A" 
                    : "Trở về thứ tự ban đầu"
              }
            >
              <ArrowsUpDownIcon className="h-5 w-5" />
            </button>
            <button
              onClick={handlePlaylistToggle}
              className={`p-1.5 rounded-full ${showPlaylist ? 'bg-white text-indigo-600' : 'bg-white bg-opacity-20 hover:bg-opacity-30'} transition-all relative`}
              title={showPlaylist ? "Ẩn danh sách phát" : "Xem danh sách phát"}
            >
              <ListBulletIcon className="h-5 w-5" />
              {!showPlaylist && playlistItems.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full">
                  {playlistItems.length}
                </span>
              )}
              
              {/* Tooltip hướng dẫn */}
              {showTooltip && !showPlaylist && (
                <div className="absolute top-full mt-2 right-0 bg-white text-gray-800 rounded-lg shadow-xl px-3 py-2 text-sm whitespace-nowrap z-50 animate-pulse">
                  <div className="absolute -top-2 right-2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-white"></div>
                  Nhấn vào đây để xem danh sách phát
                </div>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-all"
              aria-label="Đóng"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Container chính */}
        <div className="relative flex flex-1" style={{ aspectRatio: '16/9' }}>
          {/* Video player */}
          <div className="flex-1 relative bg-black">
            {currentVideoId && (
              <iframe
                className="w-full h-full"
                sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
                srcDoc={generateSrcdocContent()}
                loading="lazy"
                onLoad={() => setLoading(false)}
                style={{
                  border: 'none',
                  overflow: 'hidden',
                  width: '100%',
                  height: '100%',
                  position: 'absolute',
                  top: 0,
                  left: 0
                }}
              />
            )}
            
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-30">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
                <p className="text-white ml-3 font-medium">Đang tải...</p>
              </div>
            )}
            
            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-90 z-30 p-8">
                <ExclamationTriangleIcon className="h-16 w-16 text-yellow-500 mb-4" />
                <h3 className="text-white text-xl font-bold mb-2">Lỗi khi tải playlist</h3>
                <p className="text-gray-300 text-center">{error}</p>
              </div>
            )}
            
            {/* Nút điều hướng */}
            {playlistItems.length > 1 && (
              <>
                <button
                  onClick={handlePrevVideo}
                  disabled={currentIndex === 0}
                  className={`absolute left-4 top-1/2 transform -translate-y-1/2 p-3 rounded-full bg-black bg-opacity-50 text-white z-40 transition-all ${
                    currentIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-opacity-70'
                  }`}
                >
                  <ArrowLeftIcon className="h-6 w-6" />
                </button>
                <button
                  onClick={handleNextVideo}
                  disabled={currentIndex === playlistItems.length - 1}
                  className={`absolute right-4 top-1/2 transform -translate-y-1/2 p-3 rounded-full bg-black bg-opacity-50 text-white z-40 transition-all ${
                    currentIndex === playlistItems.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-opacity-70'
                  }`}
                >
                  <ArrowRightIcon className="h-6 w-6" />
                </button>
              </>
            )}
          </div>
          
          {/* Danh sách phát (hiển thị khi showPlaylist = true) */}
          {showPlaylist && (
            <div className="absolute top-0 right-0 bottom-0 w-full md:w-2/3 lg:w-1/2 bg-black bg-opacity-95 z-50 overflow-y-auto border-l border-gray-800 shadow-2xl animate-slideIn">
              <div className="p-3 sticky top-0 bg-gradient-to-r from-gray-900 to-black border-b border-gray-800 flex justify-between items-center">
                <h3 className="text-white font-medium">
                  Danh sách phát
                  {sortOrder !== 'default' && (
                    <span className="ml-2 text-xs bg-yellow-500 text-black px-1.5 py-0.5 rounded">
                      {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
                    </span>
                  )}
                </h3>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={handleSortPlaylist}
                    className={`p-1 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors ${sortOrder !== 'default' ? 'text-yellow-300' : ''}`}
                    title={
                      sortOrder === 'default' 
                        ? "Sắp xếp A-Z" 
                        : sortOrder === 'asc' 
                          ? "Sắp xếp Z-A" 
                          : "Trở về thứ tự ban đầu"
                    }
                  >
                    <ArrowsUpDownIcon className="h-5 w-5" />
                  </button>
                  <button 
                    onClick={handlePlaylistToggle} 
                    className="p-1 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              {isLoadingPlaylist ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
                  <p className="text-white ml-3 text-sm">Đang tải...</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-800">
                  {playlistItems.map((item, index) => (
                    <li 
                      key={item.id || index}
                      className={`${
                        currentIndex === index 
                          ? 'bg-gradient-to-r from-indigo-900 to-indigo-800' 
                          : 'hover:bg-gray-800'
                      } transition-colors cursor-pointer`}
                      onClick={() => handleVideoSelect(item.snippet.resourceId.videoId, index)}
                    >
                      <div className="p-3 flex">
                        <div className="flex-shrink-0 relative w-28 h-16 bg-gray-800 mr-3">
                          {item.snippet.thumbnails?.default?.url && (
                            <img 
                              src={item.snippet.thumbnails.default.url} 
                              alt={item.snippet.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          )}
                          <div className="absolute bottom-1 right-1 bg-black bg-opacity-70 text-white text-xs px-1.5 py-0.5 rounded">
                            {index + 1}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm line-clamp-3">{item.snippet.title}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              
              {playlistItems.length === 0 && !isLoadingPlaylist && !error && (
                <div className="text-center p-6">
                  <p className="text-gray-400">Không có video nào trong danh sách phát</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <style jsx>{`
        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        
        .animate-slideIn {
          animation: slideIn 0.3s ease-out forwards;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        
        .animate-pulse {
          animation: pulse 1.5s infinite;
        }
      `}</style>
    </div>
  );
};

export default YouTubePlaylistModal; 