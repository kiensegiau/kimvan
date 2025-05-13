'use client';

import { useState, useRef, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

const SandboxedPlayerTest = ({ isOpen, videoId, onClose }) => {
  const modalRef = useRef(null);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [playing, setPlaying] = useState(false);

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
      // Sử dụng hình ảnh chất lượng cao từ YouTube
      setThumbnailUrl(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`);
    }
  }, [videoId]);

  // Tạo HTML cho srcdoc iframe
  const generateSrcdocContent = () => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body, html {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
              overflow: hidden;
              background-color: #000;
            }
            .container {
              position: relative;
              width: 100%;
              height: 100%;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .thumbnail {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              object-fit: cover;
              cursor: pointer;
              z-index: 1;
              background-color: #000;
            }
            .play-button {
              position: absolute;
              width: 68px;
              height: 48px;
              z-index: 2;
              background-color: rgba(0, 0, 0, 0.7);
              border-radius: 8px;
              cursor: pointer;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .play-button svg {
              width: 100%;
              height: 100%;
            }
            iframe {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              border: none;
              z-index: 0;
            }
            .iframe-active {
              z-index: 3;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <img 
              class="thumbnail" 
              src="${thumbnailUrl}" 
              alt="Video Thumbnail"
              id="thumbnail"
            />
            <div class="play-button" id="play-button">
              <svg viewBox="0 0 68 48">
                <path d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z" fill="#f00"></path>
                <path d="M 45,24 27,14 27,34" fill="#fff"></path>
              </svg>
            </div>
            <iframe 
              id="youtube-iframe"
              width="100%" 
              height="100%" 
              src="" 
              frameborder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
              allowfullscreen
            ></iframe>
          </div>
          <script>
            document.getElementById('thumbnail').addEventListener('click', playVideo);
            document.getElementById('play-button').addEventListener('click', playVideo);
            
            function playVideo() {
              const iframe = document.getElementById('youtube-iframe');
              iframe.src = 'https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&fs=1';
              iframe.classList.add('iframe-active');
              document.getElementById('thumbnail').style.display = 'none';
              document.getElementById('play-button').style.display = 'none';
              
              // Ngăn chặn mở link YouTube
              window.addEventListener('blur', preventRedirect);
              checkIframeClick();
            }
            
            function preventRedirect() {
              window.focus();
            }
            
            function checkIframeClick() {
              const iframe = document.getElementById('youtube-iframe');
              const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
              
              // Override window.open
              iframe.contentWindow.open = function() {
                console.log('Blocked window.open');
                return null;
              };
              
              // Thêm CSS để ẩn các phần tử không mong muốn
              const style = document.createElement('style');
              style.textContent = \`
                .ytp-chrome-top,
                .ytp-youtube-button,
                .ytp-watermark,
                .ytp-show-cards-title,
                .ytp-share-button,
                .ytp-embed-button,
                .ytp-watch-later-button,
                a.ytp-title-link {
                  display: none !important;
                  opacity: 0 !important;
                  pointer-events: none !important;
                }
              \`;
              
              try {
                if (iframeDoc && iframeDoc.head) {
                  iframeDoc.head.appendChild(style);
                }
              } catch (e) {
                console.log('Cross-origin restriction prevented style injection');
              }
            }
          </script>
        </body>
      </html>
    `;
  };

  // Xử lý click vào nút play để phát video
  const handlePlayClick = () => {
    setPlaying(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div 
        ref={modalRef} 
        className="relative w-full max-w-4xl h-[80vh] max-h-[80vh] rounded-lg overflow-hidden shadow-xl"
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
              sandbox="allow-scripts allow-same-origin allow-presentation"
              srcDoc={generateSrcdocContent()}
              loading="lazy"
              style={{
                border: 'none',
                overflow: 'hidden'
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default SandboxedPlayerTest; 