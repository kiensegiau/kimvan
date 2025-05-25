'use client';

import { useState, useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';

const YouTubeModal = ({ isOpen, videoId, onClose }) => {
  const modalRef = useRef(null);
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
              src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&color=white"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
            ></iframe>
            
            <!-- Tên kênh tùy chỉnh -->
            <div class="custom-channel-name">Khóa học 6.0</div>
          </div>
          
          <script>
            // Khai báo biến
            const youtubeIframe = document.getElementById('youtube-iframe');
            
            // Hàm inject CSS để ẩn tên kênh
            function injectCSS() {
              try {
                // Truy cập vào iframe content
                const iframeDoc = youtubeIframe.contentDocument || youtubeIframe.contentWindow.document;
                
                if (!iframeDoc) return;
                
                // Tạo style element
                const style = document.createElement('style');
                style.textContent = \`
                  .ytp-title-channel {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
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
            
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-30">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
                <p className="text-white ml-3 font-medium">Đang tải...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default YouTubeModal; 