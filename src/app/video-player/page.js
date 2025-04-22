'use client';

import { useState, useRef, useEffect } from 'react';

export default function CustomVideoPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [playerState, setPlayerState] = useState(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  
  const playerContainerRef = useRef(null);
  const playerRef = useRef(null);
  const playerWrapperRef = useRef(null);
  const overlayRef = useRef(null);
  
  // ID video YouTube từ URL
  const videoId = 'rQp-pUVW0yI';
  
  useEffect(() => {
    // Tải YouTube API
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    
    // Định nghĩa hàm callback khi API sẵn sàng
    window.onYouTubeIframeAPIReady = initializePlayer;
    
    // Dọn dẹp
    return () => {
      window.onYouTubeIframeAPIReady = null;
    };
  }, []);
  
  // Khởi tạo player YouTube
  const initializePlayer = () => {
    if (!window.YT) {
      console.error("YouTube API chưa sẵn sàng");
      setLoadError(true);
      return;
    }
    
    try {
      playerRef.current = new window.YT.Player('youtube-player', {
        videoId: videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1, // Tự động phát để kiểm tra video đã hiển thị
          controls: 0,  // Tắt điều khiển của YouTube
          rel: 0,       // Tắt video liên quan
          showinfo: 0,  // Tắt thông tin video
          modestbranding: 1, // Giảm dấu hiệu thương hiệu
          iv_load_policy: 3, // Tắt chú thích
          fs: 0,        // Tắt nút toàn màn hình của YouTube
          enablejsapi: 1,
          disablekb: 1, // Tắt điều khiển bàn phím
          playsinline: 1,
          origin: window.location.origin
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
          onError: onPlayerError
        }
      });
      
      console.log("Đang khởi tạo trình phát YouTube...");
      
      // Thêm CSS tùy chỉnh vào iframe khi iframe đã tải
      setTimeout(() => {
        try {
          const iframe = document.getElementById('youtube-player');
          if (iframe) {
            const iframeDoc = iframe.contentWindow.document;
            const style = document.createElement('style');
            style.textContent = `
              .ytp-chrome-top { display: none !important; opacity: 0 !important; pointer-events: none !important; }
              .ytp-chrome-bottom { display: none !important; opacity: 0 !important; pointer-events: none !important; }
              .ytp-gradient-top { display: none !important; opacity: 0 !important; pointer-events: none !important; }
              .ytp-gradient-bottom { display: none !important; opacity: 0 !important; pointer-events: none !important; }
              .ytp-watermark { display: none !important; opacity: 0 !important; pointer-events: none !important; }
              .ytp-show-cards-title { display: none !important; opacity: 0 !important; pointer-events: none !important; }
              .ytp-pause-overlay { display: none !important; opacity: 0 !important; pointer-events: none !important; }
              .ytp-caption-window-container { display: none !important; opacity: 0 !important; pointer-events: none !important; }
              .ytp-title { display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }
              .ytp-title-text { display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }
              .ytp-title-link { display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }
              .ytp-title-channel { display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }
              .html5-video-player:hover .ytp-title { display: none !important; opacity: 0 !important; }
              .html5-video-player * { pointer-events: none !important; }
              .html5-video-player .html5-video-container { pointer-events: auto !important; }
              
              /* Ẩn mọi phần tử trên top */
              .ytp-chrome-top, 
              .ytp-title, 
              .ytp-title-channel, 
              .ytp-title-text {
                height: 0 !important;
                width: 0 !important;
                max-height: 0 !important;
                max-width: 0 !important;
                padding: 0 !important;
                margin: 0 !important;
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                overflow: hidden !important;
              }
              
              /* Loại bỏ top margin từ video */
              .html5-video-container {
                margin-top: 0 !important;
                top: 0 !important;
              }
            `;
            iframeDoc.head.appendChild(style);
            
            // Thêm một lớp lắng nghe sự kiện vào document của iframe
            const script = document.createElement('script');
            script.textContent = `
              document.addEventListener('mousemove', function(e) {
                var top = document.querySelector('.ytp-chrome-top');
                if (top) {
                  top.style.display = 'none';
                  top.style.opacity = '0';
                  top.style.visibility = 'hidden';
                }
              });
            `;
            iframeDoc.body.appendChild(script);
          }
        } catch (e) {
          console.log('Không thể tiêm CSS vào iframe do hạn chế CORS');
        }
      }, 1000);
    } catch (error) {
      console.error("Lỗi khi khởi tạo trình phát YouTube:", error);
      setLoadError(true);
    }
  };
  
  const onPlayerError = (event) => {
    console.error("Lỗi trình phát YouTube:", event.data);
    setLoadError(true);
  };
  
  // Xử lý khi player sẵn sàng
  const onPlayerReady = (event) => {
    console.log("Trình phát YouTube đã sẵn sàng");
    setIsReady(true);
    setDuration(event.target.getDuration());
    
    // Tạm dừng video sau khi tải để hiển thị thumbnail đầu tiên
    event.target.playVideo();
    setTimeout(() => {
      event.target.pauseVideo();
      setVideoLoaded(true);
      
      // Thêm lần nữa CSS sau khi video đã tải
      try {
        const iframe = document.getElementById('youtube-player');
        if (iframe && iframe.contentWindow && iframe.contentWindow.document) {
          const iframeDoc = iframe.contentWindow.document;
          const style = document.createElement('style');
          style.textContent = `
            .ytp-title { display: none !important; visibility: hidden !important; pointer-events: none !important; }
            .ytp-title-text { display: none !important; visibility: hidden !important; pointer-events: none !important; }
            .ytp-chrome-top { display: none !important; pointer-events: none !important; }
            .html5-video-player * { pointer-events: none !important; }
            .html5-video-player .html5-video-container { pointer-events: auto !important; }
          `;
          iframeDoc.head.appendChild(style);
          
          // Thêm MutationObserver để liên tục ẩn các phần tử khi chúng xuất hiện
          const script = document.createElement('script');
          script.textContent = `
            (function() {
              var observer = new MutationObserver(function(mutations) {
                var chromeTop = document.querySelector('.ytp-chrome-top');
                if (chromeTop) {
                  chromeTop.style.display = 'none';
                  chromeTop.style.visibility = 'hidden';
                }
                
                var title = document.querySelector('.ytp-title');
                if (title) {
                  title.style.display = 'none';
                  title.style.visibility = 'hidden';
                }
              });
              
              observer.observe(document.body, { 
                childList: true, 
                subtree: true 
              });
            })();
          `;
          iframeDoc.body.appendChild(script);
        }
      } catch (e) {
        console.log('Không thể tiêm CSS lần 2');
      }
    }, 500);
  };
  
  // Xử lý khi trạng thái player thay đổi
  const onPlayerStateChange = (event) => {
    setPlayerState(event.data);
    
    if (event.data === window.YT.PlayerState.PLAYING) {
      setIsPlaying(true);
      startProgressInterval();
      console.log("Video đang phát");
    } else if (event.data === window.YT.PlayerState.PAUSED) {
      setIsPlaying(false);
      stopProgressInterval();
      console.log("Video đã tạm dừng");
    } else if (event.data === window.YT.PlayerState.ENDED) {
      setIsPlaying(false);
      stopProgressInterval();
      console.log("Video đã kết thúc");
    } else if (event.data === window.YT.PlayerState.BUFFERING) {
      console.log("Video đang tải...");
    }
  };
  
  // Theo dõi tiến độ video
  const progressInterval = useRef(null);
  
  const startProgressInterval = () => {
    if (progressInterval.current) clearInterval(progressInterval.current);
    
    progressInterval.current = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        const currentTime = playerRef.current.getCurrentTime();
        const duration = playerRef.current.getDuration();
        setCurrentTime(currentTime);
        setProgress((currentTime / duration) * 100);
      }
    }, 1000);
  };
  
  const stopProgressInterval = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
  };
  
  // Dọn dẹp interval khi unmount
  useEffect(() => {
    return () => {
      stopProgressInterval();
    };
  }, []);
  
  // Khi video đã tải, thêm lớp phủ cứng
  useEffect(() => {
    if (videoLoaded && overlayRef.current) {
      // Thực hiện thao tác nếu cần sau khi video tải
    }
  }, [videoLoaded]);
  
  // Xử lý các sự kiện điều khiển
  const togglePlay = () => {
    if (!playerRef.current) return;
    
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };
  
  const handleVolumeChange = (e) => {
    const newVolume = e.target.value;
    setVolume(newVolume);
    
    if (playerRef.current) {
      playerRef.current.setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };
  
  const toggleMute = () => {
    if (!playerRef.current) return;
    
    if (isMuted) {
      playerRef.current.unMute();
      playerRef.current.setVolume(volume);
      setIsMuted(false);
    } else {
      playerRef.current.mute();
      setIsMuted(true);
    }
  };
  
  const toggleFullScreen = () => {
    if (!playerContainerRef.current) return;
    
    if (!isFullScreen) {
      if (playerContainerRef.current.requestFullscreen) {
        playerContainerRef.current.requestFullscreen();
      } else if (playerContainerRef.current.webkitRequestFullscreen) {
        playerContainerRef.current.webkitRequestFullscreen();
      } else if (playerContainerRef.current.msRequestFullscreen) {
        playerContainerRef.current.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  };
  
  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(
        document.fullscreenElement || 
        document.webkitFullscreenElement || 
        document.msFullscreenElement
      );
    };
    
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullScreenChange);
    document.addEventListener('msfullscreenchange', handleFullScreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullScreenChange);
      document.removeEventListener('msfullscreenchange', handleFullScreenChange);
    };
  }, []);
  
  const handleProgressBarClick = (e) => {
    if (!playerRef.current || !isReady) return;
    
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = offsetX / width;
    
    const newTime = percentage * duration;
    playerRef.current.seekTo(newTime, true);
    setProgress(percentage * 100);
  };
  
  // Format thời gian
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  // Thêm title trực tiếp trong document
  useEffect(() => {
    document.title = "Trình phát video";
  }, []);

  // Hiển thị/ẩn điều khiển khi di chuột
  const handleMouseEnter = () => {
    setShowControls(true);
  };

  const handleMouseLeave = () => {
    // Chỉ ẩn nếu đang phát
    if (isPlaying) {
      setShowControls(false);
    }
  };
  
  const retryLoading = () => {
    setLoadError(false);
    initializePlayer();
  };
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
      <div 
        ref={playerContainerRef}
        className="w-full max-w-4xl bg-black text-white rounded-lg overflow-hidden shadow-2xl"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div 
          ref={playerWrapperRef}
          className="relative w-full pt-[56.25%]"
        >
          {/* Container cho player YouTube với các lớp ẩn */}
          <div className="absolute inset-0 overflow-hidden">
            {/* Không cắt video nữa, để hiển thị toàn bộ */}
            <div className="absolute inset-0">
              <div 
                id="youtube-player" 
                className="absolute top-0 left-0 w-full h-full z-5"
              ></div>
            </div>
            
            {/* Lớp phủ trong suốt ngăn tương tác với các phần tử YouTube */}
            <div className="absolute inset-0 z-10 pointer-events-auto" style={{ backgroundColor: 'transparent' }}></div>
          </div>
          
          {/* Các overlay chỉ hiển thị khi video đã tải xong */}
          {videoLoaded && (
            <>
              {/* Lớp phủ trong suốt bắt sự kiện trên toàn bộ video */}
              <div 
                ref={overlayRef}
                className="absolute inset-0 z-7 pointer-events-auto" 
                onClick={togglePlay}
                style={{ 
                  background: 'transparent'
                }}
              ></div>
              
              {/* Chỉ che góc nhỏ có logo YouTube dưới bên phải */}
              <div className="absolute bottom-0 right-0 w-[40px] h-[40px] bg-black z-9"></div>
            </>
          )}
          
          {/* Lớp phủ hiển thị khi video đang tải */}
          {!videoLoaded && !loadError && (
            <div className="absolute inset-0 bg-black flex items-center justify-center z-20">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-t-red-600 border-gray-200 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-white">Đang tải video...</p>
              </div>
            </div>
          )}
          
          {/* Hiển thị nếu có lỗi tải */}
          {loadError && (
            <div className="absolute inset-0 bg-black bg-opacity-90 flex items-center justify-center z-20">
              <div className="text-center px-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-xl font-bold text-white mb-2">Không thể tải video</h2>
                <p className="text-gray-300 mb-4">Có lỗi xảy ra khi tải video từ YouTube</p>
                <button 
                  onClick={retryLoading} 
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Thử lại
                </button>
              </div>
            </div>
          )}
          
          {/* Lớp phủ overlay khi tạm dừng */}
          {!isPlaying && isReady && videoLoaded && (
            <div 
              className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-black bg-opacity-30 cursor-pointer z-20"
              onClick={togglePlay}
            >
              <button 
                className="w-20 h-20 rounded-full bg-white bg-opacity-20 flex items-center justify-center"
                aria-label="Phát video"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}
          
          {/* Thanh điều khiển - Hiển thị khi hover hoặc video đang tạm dừng */}
          <div 
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4 z-30 transition-opacity duration-300 ${(showControls || !isPlaying) ? 'opacity-100' : 'opacity-0'}`}
          >
            {/* Thanh tiến độ */}
            <div 
              className="h-1 bg-gray-700 rounded-full mb-2 cursor-pointer"
              onClick={handleProgressBarClick}
            >
              <div 
                className="h-full bg-red-600 rounded-full relative"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-1/2 w-3 h-3 bg-red-600 rounded-full"></div>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {/* Nút phát/tạm dừng */}
                <button 
                  onClick={togglePlay}
                  className="p-1"
                  aria-label={isPlaying ? "Tạm dừng" : "Phát"}
                >
                  {isPlaying ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </button>
                
                {/* Điều khiển âm lượng */}
                <div className="flex items-center space-x-1">
                  <button onClick={toggleMute} className="p-1" aria-label={isMuted ? "Bật tiếng" : "Tắt tiếng"}>
                    {isMuted || volume === 0 ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                      </svg>
                    ) : volume < 50 ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657a8 8 0 100-11.314" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 14.536a5 5 0 100-7.072" />
                      </svg>
                    )}
                  </button>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={isMuted ? 0 : volume} 
                    onChange={handleVolumeChange}
                    className="w-20 accent-red-600"
                    aria-label="Âm lượng"
                  />
                </div>
                
                {/* Hiển thị thời gian */}
                <div className="text-sm">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>
              
              <div>
                {/* Nút toàn màn hình */}
                <button 
                  onClick={toggleFullScreen} 
                  className="p-1"
                  aria-label={isFullScreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
                >
                  {isFullScreen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M15 9H19.5M15 9V4.5M15 15v4.5M15 15H4.5M15 15h4.5M9 15v4.5" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 3h6m0 0v6m0-6l-6 6M9 21H3m0 0v-6m0 6l6-6" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-8 text-white max-w-4xl text-center">
        <h1 className="text-2xl font-bold mb-2">Tiêu đề Video</h1>
        <p className="text-gray-300">
          Đây là mô tả video được hiển thị bên dưới trình phát. Bạn có thể thêm nội dung tùy ý ở đây mà không cần hiển thị thông tin nguồn YouTube.
        </p>
      </div>

      {/* Thêm CSS để ẩn hoàn toàn logo và tiêu đề YouTube */}
      <style jsx global>{`
        /* Ẩn tất cả các phần tử YouTube */
        .ytp-youtube-button, 
        .ytp-watermark, 
        .ytp-chrome-top, 
        .ytp-chrome-bottom,
        .ytp-gradient-top,
        .ytp-gradient-bottom,
        .ytp-title,
        .ytp-title-text,
        .ytp-title-link,
        .ytp-impression-link,
        .ytp-show-cards-title {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
          height: 0 !important;
          width: 0 !important;
          pointer-events: none !important;
          position: absolute !important;
          z-index: -9999 !important;
          transform: translateY(-9999px) !important;
        }
        
        /* Ẩn tooltip và phần tử nổi */
        .ytp-tooltip,
        .ytp-ce-element {
          display: none !important;
        }
        
        /* Chỉ cho phép tương tác với phần video */
        #youtube-player {
          pointer-events: auto !important;
          z-index: 1 !important;
        }

        /* Fix cho sự kiện chuột, cho phép click vào video */
        .html5-video-player .html5-video-container {
          pointer-events: auto !important;
          z-index: 1 !important;
        }
        
        /* Ẩn hoàn toàn các phần tử YouTube */
        .ytp-pause-overlay,
        .ytp-title,
        .ytp-chrome-top,
        .ytp-chrome-bottom,
        .ytp-gradient-top,
        .ytp-gradient-bottom,
        .ytp-watermark {
          display: none !important;
          pointer-events: none !important;
          height: 0 !important;
          width: 0 !important;
          opacity: 0 !important;
          visibility: hidden !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
          min-height: 0 !important;
          max-height: 0 !important;
          overflow: hidden !important;
          position: absolute !important;
          top: -9999px !important;
          left: -9999px !important;
        }
        
        /* Ngăn chặn mọi animation */
        .ytp-title-reveal {
          display: none !important;
          animation: none !important;
        }
        
        /* Chặn hiển thị văn bản khi hover */
        .ytp-tooltip {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
        }
      `}</style>
    </div>
  );
} 