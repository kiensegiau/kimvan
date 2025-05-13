'use client';

import { useState, useRef, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import dynamic from 'next/dynamic';

// Import ReactPlayer động để tránh lỗi SSR
const ReactPlayer = dynamic(() => import('react-player/youtube'), { ssr: false });

const ReactPlayerTest = ({ isOpen, videoId, onClose }) => {
  const modalRef = useRef(null);
  const playerRef = useRef(null);
  const playerContainerRef = useRef(null);
  const [loaded, setLoaded] = useState(false);

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

  // Ngăn chặn chuyển hướng khi component được mount
  useEffect(() => {
    if (!isOpen) return;

    // Lưu các hàm gốc trước khi ghi đè
    const originalWindowOpen = window.open;
    const originalCreateElement = document.createElement.bind(document);
    const originalSetAttribute = Element.prototype.setAttribute;

    // Ghi đè window.open để ngăn mở cửa sổ mới
    window.open = function() {
      console.log('Đã chặn window.open');
      return null;
    };

    // Ghi đè createElement để chặn các thẻ a có target="_blank"
    document.createElement = function(tagName) {
      const element = originalCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') {
        const originalSetAttribute = element.setAttribute;
        element.setAttribute = function(name, value) {
          if (name.toLowerCase() === 'target' && value === '_blank') {
            console.log('Đã chặn tạo liên kết mở tab mới');
            return element;
          }
          return originalSetAttribute.call(this, name, value);
        };
      }
      return element;
    };

    // Ngăn chặn thay đổi thuộc tính target="_blank"
    Element.prototype.setAttribute = function(name, value) {
      if (name.toLowerCase() === 'target' && value === '_blank') {
        console.log('Đã chặn setAttribute target=_blank');
        return;
      }
      return originalSetAttribute.call(this, name, value);
    };

    // Trả về các hàm gốc khi unmount
    return () => {
      window.open = originalWindowOpen;
      document.createElement = originalCreateElement;
      Element.prototype.setAttribute = originalSetAttribute;
    };
  }, [isOpen]);

  // Chèn CSS để ẩn logo và các nút YouTube
  useEffect(() => {
    if (!isOpen || !loaded || !playerContainerRef.current) return;

    // Tìm iframe trong container
    const playerContainer = playerContainerRef.current;
    const iframe = playerContainer.querySelector('iframe');
    
    if (!iframe) return;

    try {
      // Tạo và chèn CSS vào iframe
      const injectCSS = () => {
        if (!iframe.contentWindow || !iframe.contentDocument) return;
        
        const style = document.createElement('style');
        style.textContent = `
          .ytp-chrome-top,
          .ytp-youtube-button,
          .ytp-watermark,
          .ytp-show-cards-title,
          .ytp-share-button,
          .ytp-embed,
          .ytp-embed-button,
          .ytp-watch-later-button,
          a.ytp-title-link {
            display: none !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }
        `;
        
        if (iframe.contentDocument.head) {
          iframe.contentDocument.head.appendChild(style);
        }
      };

      // Tạo một MutationObserver để theo dõi thay đổi trong iframe
      const observer = new MutationObserver(() => {
        injectCSS();
      });

      // Bắt đầu quan sát
      if (iframe.contentDocument) {
        observer.observe(iframe.contentDocument, { 
          childList: true, 
          subtree: true 
        });
        injectCSS();
      }

      // Khi iframe tải xong
      iframe.addEventListener('load', injectCSS);

      return () => {
        observer.disconnect();
        iframe.removeEventListener('load', injectCSS);
      };
    } catch (error) {
      console.error('Lỗi khi chèn CSS vào iframe:', error);
    }
  }, [isOpen, loaded]);

  // Layer phủ để chặn các click trên toàn bộ player
  useEffect(() => {
    if (!isOpen || !loaded || !playerContainerRef.current) return;
    
    const playerContainer = playerContainerRef.current;
    
    // Tạo lớp phủ
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 60px; /* Chiều cao của phần header YouTube */
      z-index: 10;
      background: transparent;
      pointer-events: auto;
    `;
    
    // Tạo lớp phủ ở các góc để chặn các nút
    const cornerOverlay = document.createElement('div');
    cornerOverlay.style.cssText = `
      position: absolute;
      bottom: 0;
      right: 0;
      width: 120px; 
      height: 60px;
      z-index: 10;
      background: transparent;
      pointer-events: auto;
    `;
    
    playerContainer.appendChild(overlay);
    playerContainer.appendChild(cornerOverlay);
    
    return () => {
      playerContainer.removeChild(overlay);
      playerContainer.removeChild(cornerOverlay);
    };
  }, [isOpen, loaded]);

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
          <div 
            ref={playerContainerRef}
            className="relative w-full h-full"
          >
            <ReactPlayer
              ref={playerRef}
              url={`https://www.youtube.com/watch?v=${videoId}`}
              width="100%"
              height="100%"
              playing={true}
              controls={true}
              onReady={() => setLoaded(true)}
              config={{
                youtube: {
                  playerVars: {
                    modestbranding: 1,
                    rel: 0,
                    showinfo: 0,
                    iv_load_policy: 3,
                    fs: 1
                  }
                }
              }}
              style={{
                pointerEvents: 'auto',
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

export default ReactPlayerTest; 