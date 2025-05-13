'use client';

import { useState, useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';

// Danh sách các instance Invidious hoạt động
const INVIDIOUS_INSTANCES = [
  'https://id.420129.xyz',
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://invidious.flokinet.to',
  'https://yewtu.be'
];

const TIMEOUT_DURATION = 8000; // 8 giây cho mỗi lần thử

const YouTubeModal = ({ isOpen, videoId, onClose }) => {
  const modalRef = useRef(null);
  const iframeRef = useRef(null);
  const [apiUrl, setApiUrl] = useState('');
  const [fallbackCount, setFallbackCount] = useState(0);
  const [loadState, setLoadState] = useState('loading'); // 'loading', 'success', 'error', 'all-failed'
  const timeoutRef = useRef(null);

  // Chọn instance Invidious
  const getInvidiousUrl = (index = 0) => {
    // Đảm bảo index nằm trong phạm vi của mảng
    const instanceIndex = index % INVIDIOUS_INSTANCES.length;
    // Thêm tham số để tắt theo dõi và quảng cáo
    return `${INVIDIOUS_INSTANCES[instanceIndex]}/embed/${videoId}?autoplay=1&related=0&local=true&nojs=1`;
  };

  // Thiết lập timeout để chuyển sang instance khác nếu không tải được
  const setupLoadingTimeout = () => {
    clearTimeout(timeoutRef.current);
    
    timeoutRef.current = setTimeout(() => {
      if (loadState === 'loading') {
        tryNextInstance();
      }
    }, TIMEOUT_DURATION);
  };

  // Thử instance tiếp theo
  const tryNextInstance = () => {
    const nextFallbackCount = fallbackCount + 1;
    
    if (nextFallbackCount < INVIDIOUS_INSTANCES.length) {
      setFallbackCount(nextFallbackCount);
      setApiUrl(getInvidiousUrl(nextFallbackCount));
      setLoadState('loading');
    } else {
      setLoadState('all-failed');
      console.error('Tất cả các Invidious instance đều không hoạt động.');
    }
  };

  // Xử lý khi trang được tải thành công
  const handleIframeLoad = () => {
    clearTimeout(timeoutRef.current);
    setLoadState('success');
  };

  // Xử lý khi iframe gặp lỗi
  const handleIframeError = () => {
    clearTimeout(timeoutRef.current);
    tryNextInstance();
  };

  // Thử lại tất cả các instance
  const handleRetry = () => {
    setFallbackCount(0);
    setApiUrl(getInvidiousUrl(0));
    setLoadState('loading');
  };

  // Khởi tạo video khi mở modal hoặc thay đổi videoId
  useEffect(() => {
    if (isOpen && videoId) {
      setApiUrl(getInvidiousUrl(0));
      setFallbackCount(0);
      setLoadState('loading');
    }
  }, [isOpen, videoId]);

  // Thiết lập timeout khi đang tải
  useEffect(() => {
    if (loadState === 'loading') {
      setupLoadingTimeout();
    }

    return () => {
      clearTimeout(timeoutRef.current);
    };
  }, [loadState, apiUrl]);

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
      clearTimeout(timeoutRef.current);
    };
  }, [isOpen, onClose]);

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
          <>
            {/* Hiển thị trạng thái tải */}
            {loadState === 'loading' && (
              <div className="absolute inset-0 z-20 bg-black bg-opacity-70 flex flex-col items-center justify-center text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mb-4"></div>
                <p>Đang tải video từ instance {fallbackCount + 1}...</p>
              </div>
            )}

            {/* Hiển thị thông báo khi tất cả instance đều thất bại */}
            {loadState === 'all-failed' && (
              <div className="absolute inset-0 z-20 bg-black bg-opacity-90 flex flex-col items-center justify-center text-white p-8">
                <ExclamationTriangleIcon className="h-16 w-16 text-yellow-500 mb-4" />
                <h3 className="text-xl font-bold mb-2">Không thể tải video</h3>
                <p className="text-center mb-4">Tất cả các máy chủ đều không phản hồi hoặc bị chặn.</p>
                <button 
                  onClick={handleRetry}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                >
                  Thử lại
                </button>
              </div>
            )}

            {/* Iframe hiển thị video */}
            {apiUrl && (
              <iframe
                ref={iframeRef}
                className="w-full h-full"
                src={apiUrl}
                frameBorder="0"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                loading="lazy"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
              ></iframe>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default YouTubeModal; 