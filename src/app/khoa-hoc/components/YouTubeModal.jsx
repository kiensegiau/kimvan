'use client';

import { useState, useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';

const YouTubeModal = ({ isOpen, videoId, onClose }) => {
  const modalRef = useRef(null);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [fallbackThumbnail, setFallbackThumbnail] = useState(false);
  const [loading, setLoading] = useState(true);

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

  // Tạo thumbnail URL từ videoId
  useEffect(() => {
    if (videoId) {
      // Thử sử dụng hình ảnh chất lượng cao từ YouTube
      setThumbnailUrl(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`);
      
      // Kiểm tra nếu thumbnail chất lượng cao không tồn tại
      const img = new Image();
      img.onload = () => {
        // Nếu ảnh quá nhỏ hoặc là ảnh mặc định, sử dụng hình ảnh độ phân giải thấp hơn
        if (img.naturalWidth < 1000 || img.naturalHeight < 500) {
          setFallbackThumbnail(true);
        }
      };
      img.onerror = () => {
        setFallbackThumbnail(true);
      };
      img.src = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
    }
  }, [videoId]);

  // Tạo HTML cho srcdoc iframe với playlist=0 và version=3 và các tùy chọn mới nhất
  const generateSrcdocContent = () => {
    // Sử dụng thumbnail chất lượng cao hoặc thấp hơn tùy thuộc vào sự có sẵn
    const actualThumbnailUrl = fallbackThumbnail 
      ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` 
      : `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;

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
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
            }
            
            .player-container {
              position: relative;
              width: 100%;
              height: 100%;
              display: flex;
              justify-content: center;
              align-items: center;
              background-color: #000;
            }
            
            .thumbnail-container {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              z-index: 2;
              cursor: pointer;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              background-color: #000;
              transition: opacity 0.3s ease;
            }
            
            .thumbnail {
              width: 100%;
              height: 100%;
              object-fit: contain;
              max-height: 100%;
              position: absolute;
              top: 0;
              left: 0;
            }
            
            .thumbnail-overlay {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: rgba(0, 0, 0, 0.4);
              z-index: 1;
            }
            
            .play-button {
              position: relative;
              width: 80px;
              height: 80px;
              border-radius: 50%;
              background-color: rgba(0, 0, 0, 0.7);
              display: flex;
              justify-content: center;
              align-items: center;
              cursor: pointer;
              z-index: 3;
              border: 2px solid white;
              box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
              transition: transform 0.2s ease, background-color 0.2s ease;
              transform: scale(1);
            }
            
            .play-button:hover {
              transform: scale(1.1);
              background-color: rgba(200, 0, 0, 0.8);
            }
            
            .play-icon {
              width: 0;
              height: 0;
              border-style: solid;
              border-width: 15px 0 15px 30px;
              border-color: transparent transparent transparent white;
              margin-left: 7px;
            }
            
            .video-title {
              position: relative;
              z-index: 3;
              color: white;
              font-size: 18px;
              font-weight: bold;
              text-align: center;
              margin-top: 20px;
              max-width: 80%;
              text-shadow: 0 0 5px rgba(0, 0, 0, 0.8);
            }
            
            .iframe-container {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              opacity: 0;
              z-index: 1;
              transition: opacity 0.3s ease;
            }
            
            .iframe-active {
              opacity: 1;
              z-index: 4;
            }
            
            .youtube-iframe {
              width: 100%;
              height: 100%;
              border: none;
            }
            
            .loading-spinner {
              border: 5px solid rgba(255, 255, 255, 0.3);
              border-radius: 50%;
              border-top: 5px solid #ffffff;
              width: 50px;
              height: 50px;
              animation: spin 1s linear infinite;
              position: absolute;
              top: 50%;
              left: 50%;
              margin-top: -25px;
              margin-left: -25px;
              z-index: 1;
            }
            
            .loading-text {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, 40px);
              color: white;
              font-weight: bold;
              z-index: 1;
              text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.8);
            }
            
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            
            .hidden {
              display: none;
            }
          </style>
        </head>
        <body>
          <div class="player-container">
            <!-- Loading Spinner -->
            <div id="loading-spinner" class="loading-spinner hidden"></div>
            <div id="loading-text" class="loading-text hidden">Đang tải</div>
            
            <!-- Thumbnail Container -->
            <div class="thumbnail-container" id="thumbnail-container">
              <div class="thumbnail-overlay"></div>
              <img 
                class="thumbnail" 
                src="${actualThumbnailUrl}" 
                alt="Video Thumbnail"
                id="thumbnail"
                onerror="this.onerror=null; this.src='https://i.ytimg.com/vi/${videoId}/hqdefault.jpg';"
              />
              <div class="play-button" id="play-button">
                <div class="play-icon"></div>
              </div>
            </div>
            
            <!-- YouTube Iframe Container -->
            <div class="iframe-container" id="iframe-container">
              <iframe 
                id="youtube-iframe"
                class="youtube-iframe"
                title="YouTube Video Player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
              ></iframe>
            </div>
          </div>
          
          <script>
            // Khai báo các biến
            const thumbnailContainer = document.getElementById('thumbnail-container');
            const playButton = document.getElementById('play-button');
            const thumbnail = document.getElementById('thumbnail');
            const iframeContainer = document.getElementById('iframe-container');
            const youtubeIframe = document.getElementById('youtube-iframe');
            const loadingSpinner = document.getElementById('loading-spinner');
            const loadingText = document.getElementById('loading-text');
            
            // Ẩn spinner ban đầu khi thumbnail đã tải
            thumbnail.onload = function() {
              loadingSpinner.classList.add('hidden');
            };
            
            // Hiện spinner lại nếu thumbnail không tải được
            thumbnail.onerror = function() {
              this.onerror = null;
              this.src = 'https://i.ytimg.com/vi/${videoId}/hqdefault.jpg';
            };
            
            // Xử lý click vào nút play hoặc thumbnail
            thumbnailContainer.addEventListener('click', loadYouTubeVideo);
            
            function loadYouTubeVideo() {
              // Hiển thị loading spinner
              loadingSpinner.classList.remove('hidden');
              loadingText.classList.remove('hidden');
              
              // Thiết lập iframe với tham số đơn giản hơn
              const videoSrc = "https://www.youtube.com/embed/" + "${videoId}" + "?autoplay=1&rel=0";
              youtubeIframe.src = videoSrc;
              
              // Lắng nghe sự kiện khi iframe đã tải xong
              youtubeIframe.onload = function() {
                // Ẩn loading spinner và thumbnail container
                loadingSpinner.classList.add('hidden');
                loadingText.classList.add('hidden');
                thumbnailContainer.style.opacity = '0';
                setTimeout(() => {
                  thumbnailContainer.style.display = 'none';
                }, 300);
                
                // Hiển thị iframe container
                iframeContainer.classList.add('iframe-active');
              };
            }

            // Tự động phát video khi trang được tải
            // Thay đổi cách tự động phát để đảm bảo hoạt động đúng
            window.addEventListener('load', function() {
              // Đợi một chút trước khi kích hoạt để đảm bảo trang đã tải hoàn toàn
              setTimeout(loadYouTubeVideo, 300);
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
        className="relative w-[90%] md:w-[80%] rounded-lg overflow-hidden shadow-2xl"
        style={{
          aspectRatio: '16/9'
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black bg-opacity-50 text-white hover:bg-opacity-70 transition-all"
          aria-label="Đóng"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
        
        {videoId && (
          <div className="w-full h-full bg-black">
            <iframe
              className="w-full h-full"
              sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
              srcDoc={generateSrcdocContent()}
              loading="lazy"
              onLoad={() => setLoading(false)}
              style={{
                border: 'none !important',
                overflow: 'hidden !important',
                width: '100% !important',
                height: '100% !important',
                position: 'absolute !important',
                top: 0,
                left: 0
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default YouTubeModal; 