'use client';

import { useState, useRef, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import dynamic from 'next/dynamic';
import Script from 'next/script';

// Import CSS cho Plyr (cần được import động trong component)
const PlyrCSS = () => (
  <>
    <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css" />
    <style jsx global>{`
      /* Ngăn chặn tương tác trực tiếp với iframe YouTube */
      .youtube-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 5; /* Cao hơn iframe nhưng thấp hơn điều khiển Plyr */
        background: transparent;
      }
      
      /* Đảm bảo điều khiển Plyr nằm trên lớp phủ */
      .plyr__controls {
        z-index: 10 !important;
      }
      
      .plyr__control {
        z-index: 10 !important;
      }
      
      /* Giữ biểu tượng play lớn bên trên lớp phủ */
      .plyr__control--overlaid {
        z-index: 10 !important;
      }
      
      /* Giúp người dùng biết họ không thể click trực tiếp vào video */
      .youtube-overlay:hover {
        cursor: default;
      }
    `}</style>
  </>
);

/**
 * Modal hiển thị video YouTube với Plyr player
 * @param {Object} props - Properties
 * @param {boolean} props.isOpen - Trạng thái hiển thị của modal
 * @param {string} props.videoId - ID của video YouTube
 * @param {string} props.title - Tiêu đề hiển thị trong modal
 * @param {Function} props.onClose - Hàm gọi khi đóng modal
 * @returns {JSX.Element|null}
 */
export default function YouTubeModal({ isOpen, videoId, title, onClose }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [playerReady, setPlayerReady] = useState(false);
  
  // Khởi tạo Plyr khi component được mount
  useEffect(() => {
    if (!isOpen || !videoId) return;
    
    let isComponentMounted = true;
    let initializeAttempts = 0;
    const maxAttempts = 3;
    
    const initializePlayer = () => {
      // Đảm bảo Plyr đã được load
      import('plyr').then(({ default: Plyr }) => {
        if (!isComponentMounted) return;
        
        // Nếu đã có player, destroy nó trước khi tạo mới
        if (playerRef.current) {
          try {
            playerRef.current.destroy();
          } catch (error) {
            console.warn('Không thể hủy player cũ:', error);
          }
          playerRef.current = null;
        }
        
        // Khởi tạo player mới
        if (videoRef.current) {
          try {
            const player = new Plyr(videoRef.current, {
              fullscreen: { enabled: true, iosNative: true },
              controls: [
                'play-large', // Nút play lớn ở giữa
                'play', // Nút play/pause
                'progress', // Thanh tiến trình
                'current-time', // Thời gian hiện tại
                'duration', // Tổng thời lượng
                'mute', // Nút tắt tiếng
                'volume', // Thanh âm lượng
                'captions', // Phụ đề
                'settings', // Cài đặt
                'pip', // Picture-in-picture
                'airplay', // AirPlay
                'fullscreen', // Toàn màn hình
              ],
              settings: ['captions', 'quality', 'speed'],
              resetOnEnd: true,
              youtube: {
                noCookie: true, // Sử dụng youtube-nocookie.com để tăng cường bảo mật
                rel: 0, // Không hiển thị video liên quan
                showinfo: 0, // Không hiển thị thông tin video
                iv_load_policy: 3, // Không hiển thị annotation
                modestbranding: 1, // Hiển thị logo YouTube tối thiểu
                playsinline: 1, // Cho phép phát trong iframe
              },
              clickToPlay: true, // Cho phép nhấp để phát
              keyboard: { focused: true, global: false }, // Cho phép điều khiển bàn phím
            });
            
            // Tự động phát khi modal mở
            player.on('ready', () => {
              try {
                if (player && isComponentMounted) {
                  const playPromise = player.play();
                  if (playPromise !== undefined && typeof playPromise.catch === 'function') {
                    playPromise.catch(err => console.warn('Không thể tự động phát video:', err));
                  }
                }
                if (isComponentMounted) {
                  setPlayerReady(true);
                }
              } catch (error) {
                console.error('Lỗi khi phát video:', error);
              }
            });
            
            // Xử lý lỗi
            player.on('error', (error) => {
              console.error('Lỗi Plyr:', error);
              if (initializeAttempts < maxAttempts && isComponentMounted) {
                initializeAttempts++;
                setTimeout(initializePlayer, 1000); // Thử lại sau 1 giây
              }
            });
            
            // Lưu tham chiếu đến player
            if (isComponentMounted) {
              playerRef.current = player;
            } else {
              // Nếu component đã unmount trong quá trình khởi tạo
              try {
                player.destroy();
              } catch (e) {
                console.warn('Không thể hủy player khi component đã unmount:', e);
              }
            }
          } catch (error) {
            console.error('Lỗi khi khởi tạo Plyr:', error);
            if (initializeAttempts < maxAttempts && isComponentMounted) {
              initializeAttempts++;
              setTimeout(initializePlayer, 1000); // Thử lại sau 1 giây
            }
          }
        }
      }).catch(error => {
        console.error('Không thể import Plyr:', error);
        if (initializeAttempts < maxAttempts && isComponentMounted) {
          initializeAttempts++;
          setTimeout(initializePlayer, 1000); // Thử lại sau 1 giây
        }
      });
    };
    
    // Bắt đầu quá trình khởi tạo
    initializePlayer();
    
    // Dọn dẹp khi component unmount
    return () => {
      isComponentMounted = false;
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (error) {
          console.warn('Không thể hủy player khi unmount:', error);
        }
        playerRef.current = null;
      }
      setPlayerReady(false);
    };
  }, [isOpen, videoId]);
  
  // Ngăn chặn các sự kiện click truyền xuống iframe YouTube
  const handleOverlayClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Cho phép chơi/dừng khi nhấp vào overlay
    if (playerRef.current && typeof playerRef.current.paused !== 'undefined') {
      try {
        if (playerRef.current.paused) {
          const playPromise = playerRef.current.play();
          if (playPromise !== undefined && typeof playPromise.catch === 'function') {
            playPromise.catch(err => console.warn('Không thể phát video:', err));
          }
        } else {
          playerRef.current.pause();
        }
      } catch (error) {
        console.error('Lỗi khi điều khiển phát/dừng video:', error);
      }
    }
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Import CSS của Plyr */}
        <PlyrCSS />
        
        {/* Script Plyr từ CDN */}
        <Script
          src="https://cdn.plyr.io/3.7.8/plyr.polyfilled.js"
          strategy="afterInteractive"
        />

        {/* Giảm thiểu lỗi CORS từ YouTube bằng cách làm cho script YouTube chỉ load sau khi component đã mount */}
        <Script
          id="youtube-api-ignore-cors"
          strategy="lazyOnload"
        >
          {`
            // Ghi đè phương thức fetch để ngăn lỗi CORS được hiển thị trong console
            const originalFetch = window.fetch;
            window.fetch = function(...args) {
              // Kiểm tra nếu request đến YouTube API
              if (args[0] && typeof args[0] === 'string' && 
                 (args[0].includes('youtube.com/sw.js_data') || 
                  args[0].includes('youtube.com/iframe_api'))) {
                // Thêm tùy chọn mode: 'no-cors' để tránh lỗi CORS
                if (args[1] && typeof args[1] === 'object') {
                  args[1] = {...args[1], mode: 'no-cors'};
                } else {
                  args[1] = {mode: 'no-cors'};
                }
              }
              return originalFetch.apply(this, args);
            };
          `}
        </Script>
        
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 truncate">
            {title || 'Video YouTube'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        <div className="w-full relative plyr__video-wrapper">
          {/* Player container */}
          <div 
            ref={videoRef} 
            className="plyr__video-embed" 
            style={{ aspectRatio: '16/9' }}
          >
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}?origin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}&amp;iv_load_policy=3&amp;modestbranding=1&amp;playsinline=1&amp;showinfo=0&amp;rel=0&amp;enablejsapi=1&amp;widget_referrer=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`}
              allowFullScreen
              allowTransparency
              allow="autoplay; encrypted-media"
              referrerPolicy="origin"
            ></iframe>
            
            {/* Lớp phủ trên iframe để ngăn tương tác trực tiếp */}
            <div 
              className="youtube-overlay"
              onClick={handleOverlayClick}
              onDoubleClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
        </div>
        
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
} 