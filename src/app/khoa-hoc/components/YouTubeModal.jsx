'use client';

import { useState, useRef, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import dynamic from 'next/dynamic';

// Import LiteYouTubeEmbed động để tránh lỗi SSR
const LiteYouTubeEmbed = dynamic(() => import('react-lite-youtube-embed'), { ssr: false });

// Style cho LiteYouTubeEmbed
const LiteYouTubeStyle = () => (
  <style jsx global>{`
    .yt-lite {
      background-color: #000;
      position: relative;
      display: block;
      contain: content;
      background-position: center center;
      background-size: cover;
      cursor: pointer;
    }

    /* gradient */
    .yt-lite::before {
      content: '';
      display: block;
      position: absolute;
      top: 0;
      background-position: top;
      background-repeat: repeat-x;
      height: 60px;
      padding-bottom: 50px;
      width: 100%;
      transition: all 0.2s cubic-bezier(0, 0, 0.2, 1);
    }

    /* responsive iframe with a 16:9 aspect ratio */
    .yt-lite::after {
      content: "";
      display: block;
      padding-bottom: calc(100% / (16 / 9));
    }
    
    /* Thay đổi ở đây: KHÔNG vô hiệu hóa sự kiện chuột trên toàn bộ iframe */
    .yt-lite > iframe {
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
    }

    /* play button */
    .yt-lite > .lty-playbtn {
      width: 65px;
      height: 46px;
      z-index: 1;
      opacity: 0.8;
      border: none;
      background: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%20version%3D%221.1%22%20id%3D%22YouTube_Icon%22%20x%3D%220px%22%20y%3D%220px%22%20viewBox%3D%220%200%201024%20721%22%20enable-background%3D%22new%200%200%201024%20721%22%20xml%3Aspace%3D%22preserve%22%3E%3Cpath%20id%3D%22Triangle%22%20fill%3D%22%23FFFFFF%22%20d%3D%22M407%2C493l276-143L407%2C206V493z%22%2F%3E%3Cpath%20id%3D%22The_Sharpness%22%20opacity%3D%220.12%22%20fill%3D%22%23420000%22%20d%3D%22M407%2C206l242%2C161.6l34-17.6L407%2C206z%22%2F%3E%3Cg%20id%3D%22Lozenge%22%3E%3Cg%3E%3ClinearGradient%20id%3D%22SVGID_1_%22%20gradientUnits%3D%22userSpaceOnUse%22%20x1%3D%22512.5%22%20y1%3D%22719.7%22%20x2%3D%22512.5%22%20y2%3D%221.2%22%20gradientTransform%3D%22matrix(1%200%200%20-1%200%20721)%22%3E%3Cstop%20offset%3D%220%22%20style%3D%22stop-color%3A%23E52D27%22%2F%3E%3Cstop%20offset%3D%221%22%20style%3D%22stop-color%3A%23BF171D%22%2F%3E%3C%2FlinearGradient%3E%3Cpath%20fill%3D%22url(%23SVGID_1_)%22%20d%3D%22M1013%2C156.3c0%2C0-10-70.4-40.6-101.4C933.6%2C14.2%2C890%2C14%2C870.1%2C11.6C727.1%2C1.3%2C512.7%2C1.3%2C512.7%2C1.3%20%20%20%20h-0.4c0%2C0-214.4%2C0-357.4%2C10.3C135%2C14%2C91.4%2C14.2%2C52.6%2C54.9C22%2C85.9%2C12%2C156.3%2C12%2C156.3S1.8%2C238.9%2C1.8%2C321.6v77.5%20%20%20%20C1.8%2C481.8%2C12%2C564.4%2C12%2C564.4s10%2C70.4%2C40.6%2C101.4c38.9%2C40.7%2C89.9%2C39.4%2C112.6%2C43.7c81.7%2C7.8%2C347.3%2C10.3%2C347.3%2C10.3%20%20%20%20s214.6-0.3%2C357.6-10.7c20-2.4%2C63.5-2.6%2C102.3-43.3c30.6-31%2C40.6-101.4%2C40.6-101.4s10.2-82.7%2C10.2-165.3v-77.5%20%20%20%20C1023.2%2C238.9%2C1013%2C156.3%2C1013%2C156.3z%20M407%2C493V206l276%2C144L407%2C493z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E");
      transition: all 0.2s cubic-bezier(0, 0, 0.2, 1);
    }
    .yt-lite:hover > .lty-playbtn {
      opacity: 1;
    }

    .yt-lite > .lty-playbtn,
    .yt-lite > .lty-playbtn:before {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate3d(-50%, -50%, 0);
    }

    /* Post-click styles */
    .yt-lite.lyt-activated {
      cursor: unset;
    }
    .yt-lite.lyt-activated::before,
    .yt-lite.lyt-activated > .lty-playbtn {
      opacity: 0;
      pointer-events: none;
    }
    
    /* Tùy chỉnh cho modal */
    .youtube-modal-container {
      width: 100%;
      height: 100%;
      max-width: 100%;
      border-radius: 0;
      overflow: hidden;
      position: relative;
    }

    /* Chỉ tạo các vùng chặn cụ thể, không phủ toàn bộ */
    /* Vùng chặn logo YouTube ở góc dưới */
    .youtube-logo-blocker {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 90px;
      height: 60px;
      z-index: 9999;
      pointer-events: auto;
      background: transparent;
      cursor: default;
    }

    /* Vùng chặn nút menu ở góc trên */
    .youtube-menu-blocker {
      position: absolute;
      top: 0; 
      right: 0;
      width: 40px;
      height: 40px;
      z-index: 9999;
      pointer-events: auto;
      background: transparent;
      cursor: default;
    }

    /* Vùng chặn tiêu đề ở trên */
    .youtube-title-blocker {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 40px;
      z-index: 9999;
      pointer-events: auto;
      background: transparent;
      cursor: default;
    }
  `}</style>
);

/**
 * Modal hiển thị video YouTube sử dụng LiteYouTubeEmbed
 * @param {Object} props - Properties
 * @param {boolean} props.isOpen - Trạng thái hiển thị của modal
 * @param {string} props.videoId - ID của video YouTube
 * @param {string} props.title - Tiêu đề hiển thị trong modal
 * @param {Function} props.onClose - Hàm gọi khi đóng modal
 * @returns {JSX.Element|null}
 */
export default function YouTubeModal({ isOpen, videoId, title, onClose }) {
  const modalRef = useRef(null);
  const iframeRef = useRef(null);
  const [playerLoaded, setPlayerLoaded] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  
  // Xử lý sự kiện khi iframe được thêm vào
  const handleIframeAdded = () => {
    setPlayerLoaded(true);
    
    // Đợi một chút để iframe được tải xong rồi hiển thị overlay
    setTimeout(() => {
      setShowOverlay(true);
      
      // Lưu tham chiếu đến iframe
      const iframe = document.querySelector('.yt-lite iframe');
      if (iframe) {
        iframeRef.current = iframe;
      }
    }, 500);
  };
  
  // Ngăn chặn mở YouTube trong tab mới khi click vào logo
  const handleBlockClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Đã chặn việc mở YouTube trong tab mới');
  };
  
  // Đóng modal khi click bên ngoài
  const handleBackdropClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose();
    }
  };

  // Thêm sự kiện để chặn việc mở YouTube trong tab mới
  useEffect(() => {
    if (!isOpen) return;

    // Lắng nghe các click trên toàn bộ document
    const preventYouTubeRedirect = (e) => {
      // Kiểm tra xem click có phải trên liên kết YouTube không
      let target = e.target;
      
      // Tìm phần tử cha là thẻ <a> nếu click vào phần tử con
      while (target && target.tagName !== 'A') {
        target = target.parentElement;
      }
      
      // Nếu tìm thấy thẻ a và là link Youtube
      if (target && target.tagName === 'A' && 
          (target.href.includes('youtube.com') || 
           target.href.includes('youtu.be'))) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Đã chặn chuyển hướng đến YouTube:', target.href);
        return false;
      }
    };

    // Ngăn chặn click chuột phải
    const preventContextMenu = (e) => {
      // Chỉ chặn menu chuột phải trong phạm vi iframe
      const iframe = document.querySelector('.yt-lite iframe');
      if (iframe && iframe.contains(e.target)) {
        e.preventDefault();
        return false;
      }
    };
    
    // Đăng ký sự kiện
    document.addEventListener('click', preventYouTubeRedirect, true);
    document.addEventListener('contextmenu', preventContextMenu, true);
    
    return () => {
      document.removeEventListener('click', preventYouTubeRedirect, true);
      document.removeEventListener('contextmenu', preventContextMenu, true);
    };
  }, [isOpen]);
  
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Import CSS cho LiteYouTubeEmbed */}
        <LiteYouTubeStyle />
        
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 truncate">
            {title || 'Video YouTube'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
            aria-label="Đóng"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        <div className="w-full relative youtube-modal-container" style={{ aspectRatio: '16/9' }}>
          {videoId && (
            <>
              <LiteYouTubeEmbed
                id={videoId}
                title={title || 'Video YouTube'}
                adNetwork={false}        // Không kết nối với mạng quảng cáo
                cookie={false}           // Sử dụng chế độ tăng cường quyền riêng tư (youtube-nocookie.com)
                poster="hqdefault"       // Chất lượng thumbnail cao
                webp={true}              // Sử dụng định dạng WebP cho thumbnail (nếu hỗ trợ)
                wrapperClass="yt-lite"   // CSS class mặc định
                iframeClass=""           // CSS class cho iframe
                playerClass="lty-playbtn" // CSS class cho nút play
                onIframeAdded={handleIframeAdded} // Callback khi iframe được thêm vào
                params="modestbranding=1&rel=0&showinfo=0&iv_load_policy=3" // Các tham số bổ sung
              />
              
              {/* Các vùng chặn cụ thể chỉ hiển thị sau khi video đã tải */}
              {showOverlay && (
                <>
                  {/* Vùng chặn click vào logo YouTube ở góc phải dưới */}
                  <div 
                    className="youtube-logo-blocker" 
                    onClick={handleBlockClick}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      return false;
                    }}
                  ></div>
                  
                  {/* Vùng chặn click vào menu 3 chấm ở góc phải trên */}
                  <div 
                    className="youtube-menu-blocker"
                    onClick={handleBlockClick}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      return false;
                    }}
                  ></div>
                  
                  {/* Vùng chặn click vào tiêu đề ở trên cùng */}
                  <div 
                    className="youtube-title-blocker"
                    onClick={handleBlockClick}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      return false;
                    }}
                  ></div>
                </>
              )}
            </>
          )}
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