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

  // Tạo HTML cho srcdoc iframe với các tùy chỉnh để thay đổi tên kênh
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
            
            .youtube-container {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              z-index: 1;
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
              z-index: 5;
            }
            
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            
            /* Overlay để che phần tên kênh */
            .channel-overlay {
              position: absolute;
              bottom: 0;
              left: 0;
              width: 100%;
              height: 60px;
              background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.5) 70%, rgba(0,0,0,0) 100%);
              z-index: 10;
              pointer-events: none;
            }
            
            /* Phần tử che tên kênh gốc */
            .channel-blocker {
              position: absolute;
              bottom: 12px;
              left: 12px;
              width: 250px;
              height: 30px;
              background-color: rgba(0, 0, 0, 0.9);
              z-index: 15;
              pointer-events: none;
            }
            
            /* Tên kênh tùy chỉnh */
            .custom-channel-name {
              position: absolute;
              bottom: 17px;
              left: 60px;
              color: white;
              font-size: 14px;
              font-weight: bold;
              z-index: 20;
              text-shadow: 0px 0px 2px rgba(0,0,0,0.8);
              pointer-events: none;
            }
            
            /* Lớp phủ để chặn các phần tử khác */
            .corner-blocker {
              position: absolute;
              bottom: 12px;
              left: 12px;
              width: 40px;
              height: 30px;
              z-index: 15;
              pointer-events: none;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            
            /* Logo tùy chỉnh */
            .custom-logo {
              width: 24px;
              height: 24px;
              border-radius: 50%;
              background-color: #ff0000;
              display: flex;
              justify-content: center;
              align-items: center;
              color: white;
              font-weight: bold;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="player-container">
            <!-- Loading Spinner -->
            <div id="loading-spinner" class="loading-spinner"></div>
            
            <!-- YouTube Container -->
            <div class="youtube-container" id="youtube-container">
              <iframe 
                id="youtube-iframe"
                class="youtube-iframe"
                src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&color=white&fs=1&playsinline=1"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
              ></iframe>
            </div>
            
            <!-- Overlay để che phần tên kênh -->
            <div class="channel-overlay"></div>
            
            <!-- Phần tử che tên kênh gốc -->
            <div class="channel-blocker"></div>
            
            <!-- Phần tử che góc trái dưới -->
            <div class="corner-blocker">
              <div class="custom-logo">K</div>
            </div>
            
            <!-- Tên kênh tùy chỉnh -->
            <div class="custom-channel-name">Khóa học 6.0</div>
          </div>
          
          <script>
            // Khai báo các biến
            const youtubeIframe = document.getElementById('youtube-iframe');
            const loadingSpinner = document.getElementById('loading-spinner');
            
            // Ẩn spinner khi iframe đã tải xong
            youtubeIframe.onload = function() {
              loadingSpinner.style.display = 'none';
              
              // Thêm lớp che phủ sau khi video đã tải
              setTimeout(function() {
                // Đảm bảo các lớp overlay hiển thị đúng
                document.querySelector('.channel-overlay').style.opacity = '1';
                document.querySelector('.channel-blocker').style.opacity = '1';
                document.querySelector('.custom-channel-name').style.opacity = '1';
                document.querySelector('.corner-blocker').style.opacity = '1';
              }, 1000);
            };
            
            // Xử lý lỗi nếu có
            youtubeIframe.onerror = function() {
              console.log('Không thể tải iframe YouTube');
            };
            
            // Thiết lập CSS để ẩn các phần tử YouTube không mong muốn
            function injectCSS() {
              try {
                const iframeDoc = youtubeIframe.contentDocument || youtubeIframe.contentWindow.document;
                if (!iframeDoc) return;
                
                const style = iframeDoc.createElement('style');
                style.textContent = \`
                  .ytp-chrome-bottom {
                    z-index: 1 !important;
                  }
                  .ytp-title-channel {
                    display: none !important;
                  }
                  .ytp-title-text {
                    margin-bottom: 15px !important;
                  }
                \`;
                
                iframeDoc.head.appendChild(style);
              } catch (e) {
                console.log('Không thể inject CSS:', e);
              }
            }
            
            // Thử inject CSS sau khi iframe đã tải
            youtubeIframe.addEventListener('load', function() {
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
                border: 'none',
                overflow: 'hidden',
                width: '100%',
                height: '100%',
                position: 'absolute',
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