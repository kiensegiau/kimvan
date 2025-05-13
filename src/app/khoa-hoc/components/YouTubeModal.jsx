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
            
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            
            .hidden {
              display: none;
            }
            
            /* CSS để ẩn các phần tử YouTube không mong muốn */
            .overlay-protection {
              position: absolute;
              z-index: 10;
              pointer-events: auto;
              background: transparent;
            }
            
            .top-overlay {
              top: 0;
              left: 0;
              width: 100%;
              height: 40px;
            }
            
            .logo-overlay {
              bottom: 0;
              right: 0;
              width: 120px;
              height: 60px;
            }
            
            .title-overlay {
              top: 0;
              left: 0;
              width: 75%;
              height: 40px;
            }
            
            /* Lớp phủ mới chặn tương tác với các nút phía trên */
            .controls-blocker {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              /* Chỉ che phần trên cùng của video */
              height: 60px;
              z-index: 15; /* Cao hơn các overlay khác */
              pointer-events: auto;
              background: transparent;
              cursor: default;
            }
            
            /* Đảm bảo thanh điều khiển luôn hiển thị và có thể tương tác */
            @media (max-width: 768px) {
              .controls-blocker {
                height: 70px; /* Cao hơn một chút trên mobile */
              }
            }
            
            .endscreen-overlay {
              bottom: 80px; /* Để lộ thanh tua */
              left: 0;
              width: 100%;
              height: calc(25% - 80px);
            }
          </style>
        </head>
        <body>
          <div class="player-container">
            <!-- Loading Spinner -->
            <div id="loading-spinner" class="loading-spinner"></div>
            
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
              
              <!-- Overlays to block interaction with YouTube elements -->
              <div class="overlay-protection top-overlay"></div>
              <div class="overlay-protection logo-overlay"></div>
              <div class="overlay-protection title-overlay"></div>
              
              <!-- Lớp phủ mới chặn tương tác với toàn bộ video trừ thanh tua -->
              <div class="controls-blocker" id="controls-blocker"></div>
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
              
              // Thiết lập iframe với tham số để ngăn chặn chuyển hướng và ẩn các phần tử không mong muốn
              youtubeIframe.src = 'https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&fs=1&color=white&iv_load_policy=3&playlist=${videoId}&controls=1&showinfo=0&disablekb=0&version=3&origin=' + window.location.origin + '&enablejsapi=1&nologo=1&cc_load_policy=0&iv_load_policy=3&referrer=no-referrer&autohide=0';
              
              // Lắng nghe sự kiện khi iframe đã tải xong
              youtubeIframe.onload = function() {
                // Ẩn loading spinner và thumbnail container
                loadingSpinner.classList.add('hidden');
                thumbnailContainer.style.opacity = '0';
                setTimeout(() => {
                  thumbnailContainer.style.display = 'none';
                }, 300);
                
                // Hiển thị iframe container
                iframeContainer.classList.add('iframe-active');
                
                try {
                  // Ngăn chặn mở tab mới từ iframe YouTube
                  preventRedirects();
                } catch (e) {
                  console.error('Không thể ngăn chặn việc chuyển hướng:', e);
                }
              };
            }
            
            function preventRedirects() {
              // Ngăn chặn trình duyệt rời khỏi trang
              window.addEventListener('beforeunload', function(e) {
                if (!e.target.activeElement || e.target.activeElement.tagName !== 'IFRAME') {
                  e.preventDefault();
                  e.returnValue = '';
                }
              });
              
              // Ngăn chặn mở tab mới 
              window.open = function() { 
                console.log('Đã chặn window.open');
                return null;
              };
              
              // Giả lập focus liên tục cho iframe để tránh mất focus khi click vào link
              setInterval(function() {
                if (document.activeElement.tagName !== 'IFRAME') {
                  youtubeIframe.focus();
                }
              }, 100);
              
              // Khởi tạo YouTube Player API để kiểm soát video
              try {
                // Đăng ký sự kiện khi video kết thúc để tự động phát lại, tránh hiển thị màn hình gợi ý
                let tag = document.createElement('script');
                tag.src = "https://www.youtube.com/iframe_api";
                let firstScriptTag = document.getElementsByTagName('script')[0];
                firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
                
                let player;
                window.onYouTubeIframeAPIReady = function() {
                  player = new YT.Player(youtubeIframe, {
                    events: {
                      'onStateChange': onPlayerStateChange,
                      'onReady': onPlayerReady
                    }
                  });
                };
                
                // Khi player đã sẵn sàng
                function onPlayerReady(event) {
                  // Xử lý lớp phủ
                  const controlsBlocker = document.getElementById('controls-blocker');
                  
                  // Điều chỉnh chiều cao để chỉ che phần trên cùng
                  controlsBlocker.style.height = '60px';
                  
                  // Điều chỉnh kích thước dựa vào kích thước màn hình
                  if (window.innerWidth <= 768) {
                    controlsBlocker.style.height = '70px';
                  }
                  
                  // Bỏ xử lý sự kiện click để play/pause vì không cần thiết nữa
                }
                
                function onPlayerStateChange(event) {
                  // Khi video kết thúc (state = 0)
                  if (event.data === 0) {
                    // Chờ một chút rồi phát lại từ đầu để ngăn màn hình gợi ý
                    setTimeout(function() {
                      event.target.seekTo(0);
                      event.target.playVideo();
                    }, 300);
                  }
                }
              } catch (e) {
                console.log('Không thể khởi tạo YouTube API:', e);
              }
              
              // Thêm CSS để ẩn các phần tử YouTube không mong muốn
              try {
                const iframeWindow = youtubeIframe.contentWindow;
                const iframeDocument = iframeWindow.document;
                
                if (iframeDocument) {
                  const style = iframeDocument.createElement('style');
                  style.textContent = \`
                    .ytp-chrome-top,
                    .ytp-youtube-button,
                    .ytp-watermark,
                    .ytp-show-cards-title,
                    .ytp-share-button,
                    .ytp-embed-button,
                    .ytp-watch-later-button,
                    a.ytp-title-link,
                    .ytp-endscreen-content,
                    .ytp-ce-element,
                    .ytp-ce-covering-overlay,
                    .ytp-ce-element-shadow,
                    .ytp-ce-covering-image,
                    .ytp-ce-expanding-image,
                    .ytp-ce-element.ytp-ce-channel,
                    .ytp-ce-element.ytp-ce-channel-this,
                    .ytp-ce-element.ytp-ce-video,
                    .ytp-ce-element.ytp-ce-playlist {
                      display: none !important;
                      opacity: 0 !important;
                      pointer-events: none !important;
                      visibility: hidden !important;
                    }
                    
                    /* Đảm bảo thanh điều khiển luôn hiển thị */
                    .ytp-chrome-bottom {
                      opacity: 1 !important;
                      display: block !important;
                      visibility: visible !important;
                      pointer-events: auto !important;
                    }
                    
                    /* Vô hiệu hóa các liên kết khác */
                    a, button:not(.ytp-play-button):not(.ytp-mute-button):not(.ytp-volume-panel):not(.ytp-progress-bar-container) {
                      pointer-events: none !important;
                    }
                  \`;
                  iframeDocument.head.appendChild(style);
                  
                  // Bắt sự kiện click để ngăn chặn các tác vụ mặc định
                  iframeDocument.addEventListener('click', function(e) {
                    const target = e.target;
                    // Nếu click vào liên kết hoặc nút không phải thanh điều khiển
                    if (target.tagName === 'A' || 
                        (target.tagName === 'BUTTON' && 
                         !target.classList.contains('ytp-play-button') && 
                         !target.classList.contains('ytp-mute-button') &&
                         !target.classList.contains('ytp-fullscreen-button'))) {
                      e.preventDefault();
                      e.stopPropagation();
                      return false;
                    }
                  }, true);
                }
              } catch (e) {
                console.log('Không thể chèn CSS vào iframe do hạn chế CORS');
              }
            }
            
            // Tạo MutationObserver để phát hiện và xử lý các thay đổi trong iframe
            // Có thể áp dụng thêm nếu được phép bởi CORS
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
        className="relative w-[80%] rounded-lg overflow-hidden shadow-2xl"
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