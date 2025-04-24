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
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [currentQuality, setCurrentQuality] = useState('auto');
  const [availableQualities, setAvailableQualities] = useState([]);
  const [videoDetails, setVideoDetails] = useState(null);
  const [isLooping, setIsLooping] = useState(false);
  const [showCaptions, setShowCaptions] = useState(false);
  const [availableCaptions, setAvailableCaptions] = useState([]);
  const [selectedCaption, setSelectedCaption] = useState('off');
  const [showCaptionsMenu, setShowCaptionsMenu] = useState(false);
  
  const playerContainerRef = useRef(null);
  const playerRef = useRef(null);
  const playerWrapperRef = useRef(null);
  const overlayRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  
  // ID video YouTube từ URL
  const videoId = 'rQp-pUVW0yI';
  
  // API key của YouTube Data API 
  const API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
  
  // Danh sách tất cả các chất lượng có thể có
  const allQualities = [
    { value: 'highres', label: '4K' },
    { value: 'hd2880', label: '2880p' },
    { value: 'hd2160', label: '2160p' },
    { value: 'hd1440', label: '1440p' },
    { value: 'hd1080', label: '1080p HD' },
    { value: 'hd720', label: '720p HD' },
    { value: 'large', label: '480p' },
    { value: 'medium', label: '360p' },
    { value: 'small', label: '240p' },
    { value: 'tiny', label: '144p' }
  ];
  
  // Hàm lấy thông tin video từ YouTube API
  const fetchVideoDetails = async (videoId) => {
    if (!API_KEY) {
      console.error('API key chưa được cấu hình');
      return;
    }

    console.log('Đang lấy thông tin video...', videoId);
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet,status&id=${videoId}&key=${API_KEY}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Kết quả API:', data);
      
      if (data.error) {
        console.error('Lỗi API YouTube:', data.error.message);
        return;
      }
      
      if (data.items && data.items.length > 0) {
        setVideoDetails(data.items[0]);
        console.log("Chi tiết video:", data.items[0]);
        
        // Lấy danh sách chất lượng từ fileDetails nếu có
        if (data.items[0].contentDetails) {
          const definition = data.items[0].contentDetails.definition;
          console.log('Định dạng video:', definition);
          
          const availableFormats = [];
          
          if (definition === 'hd') {
            availableFormats.push(
              { value: 'hd1080', label: '1080p HD' },
              { value: 'hd720', label: '720p HD' }
            );
          }
          
          availableFormats.push(
            { value: 'large', label: '480p' },
            { value: 'medium', label: '360p' },
            { value: 'small', label: '240p' }
          );
          
          console.log('Chất lượng có sẵn:', availableFormats);
          
          setAvailableQualities([
            { value: 'auto', label: 'Tự động' },
            ...availableFormats
          ]);
        }
      } else {
        console.error('Không tìm thấy video với ID:', videoId);
      }
    } catch (error) {
      console.error("Lỗi khi lấy thông tin video:", error);
    }
  };
  
  useEffect(() => {
    // Log để kiểm tra API key
    console.log('API Key configured:', API_KEY ? 'Yes' : 'No');
    if (!API_KEY) {
      console.error('YouTube API key chưa được cấu hình trong .env.local');
    }
    
    // Tải YouTube API
    const loadYouTubeAPI = () => {
      return new Promise((resolve, reject) => {
        if (window.YT) {
          resolve(window.YT);
          return;
        }

        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        window.onYouTubeIframeAPIReady = () => {
          resolve(window.YT);
        };

        tag.onerror = (error) => {
          reject('Lỗi khi tải YouTube API: ' + error);
        };
      });
    };

    const setupPlayer = async () => {
      try {
        await loadYouTubeAPI();
        initializePlayer();
      } catch (error) {
        console.error(error);
        setLoadError(true);
      }
    };

    setupPlayer();
    fetchVideoDetails(videoId);

    return () => {
      window.onYouTubeIframeAPIReady = null;
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (error) {
          console.error("Lỗi khi dọn dẹp player:", error);
        }
      }
    };
  }, [videoId]);
  
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
        host: 'https://www.youtube.com',
        playerVars: {
          autoplay: 1,
          controls: 0,
          rel: 0,
          showinfo: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          fs: 0,
          enablejsapi: 1,
          disablekb: 1,
          playsinline: 1,
          origin: window.location.origin,
          widget_referrer: window.location.origin
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
          onError: onPlayerError,
          onPlaybackQualityChange: (event) => {
            const newQuality = event.data;
            console.log("Chất lượng video đã thay đổi:", newQuality);
            if (currentQuality !== 'auto') {
              setCurrentQuality(newQuality);
            }
          }
        }
      });
      
      console.log("Đang khởi tạo trình phát YouTube...");
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
    
    try {
      // Lưu player instance
      playerRef.current = event.target;
      
      // Lấy danh sách chất lượng có sẵn
      const qualities = event.target.getAvailableQualityLevels();
      console.log("Chất lượng có sẵn:", qualities);
      
      // Định dạng lại danh sách chất lượng
      const formattedQualities = [
        { value: 'auto', label: 'Tự động' },
        ...qualities.map(quality => {
          switch(quality) {
            case 'highres': return { value: quality, label: '4K' };
            case 'hd2880': return { value: quality, label: '2880p' };
            case 'hd2160': return { value: quality, label: '2160p' };
            case 'hd1440': return { value: quality, label: '1440p' };
            case 'hd1080': return { value: quality, label: '1080p HD' };
            case 'hd720': return { value: quality, label: '720p HD' };
            case 'large': return { value: quality, label: '480p' };
            case 'medium': return { value: quality, label: '360p' };
            case 'small': return { value: quality, label: '240p' };
            case 'tiny': return { value: quality, label: '144p' };
            default: return { value: quality, label: quality };
          }
        })
      ];
      
      setAvailableQualities(formattedQualities);
      
      // Lấy chất lượng hiện tại
      const currentQuality = event.target.getPlaybackQuality();
      console.log("Chất lượng hiện tại:", currentQuality);
      setCurrentQuality(currentQuality || 'auto');

      // Phát video và tạm dừng để hiển thị thumbnail
      event.target.playVideo();
      setTimeout(() => {
        if (playerRef.current) {
          playerRef.current.pauseVideo();
          setVideoLoaded(true);
        }
      }, 500);
    } catch (error) {
      console.error("Lỗi khi khởi tạo player:", error);
    }
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
    if (videoDetails?.snippet) {
      document.title = videoDetails.snippet.title;
    }
  }, [videoDetails]);

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
  
  // Thêm xử lý phím tắt
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!isReady) return;

      switch(e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
          e.preventDefault();
          toggleFullScreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'arrowleft':
          e.preventDefault();
          if (playerRef.current) {
            const newTime = Math.max(currentTime - 5, 0);
            playerRef.current.seekTo(newTime, true);
          }
          break;
        case 'arrowright':
          e.preventDefault();
          if (playerRef.current) {
            const newTime = Math.min(currentTime + 5, duration);
            playerRef.current.seekTo(newTime, true);
          }
          break;
        case 'arrowup':
          e.preventDefault();
          const newVolumeUp = Math.min(volume + 5, 100);
          setVolume(newVolumeUp);
          if (playerRef.current) {
            playerRef.current.setVolume(newVolumeUp);
          }
          break;
        case 'arrowdown':
          e.preventDefault();
          const newVolumeDown = Math.max(volume - 5, 0);
          setVolume(newVolumeDown);
          if (playerRef.current) {
            playerRef.current.setVolume(newVolumeDown);
          }
          break;
        case 'l':
          e.preventDefault();
          setIsLooping(!isLooping);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.addEventListener('keydown', handleKeyPress);
  }, [isReady, isPlaying, volume, currentTime, duration, isLooping]);

  // Xử lý tốc độ phát
  const handleSpeedChange = (speed) => {
    if (playerRef.current) {
      playerRef.current.setPlaybackRate(speed);
      setPlaybackSpeed(speed);
      setShowSpeedMenu(false);
    }
  };

  // Thêm hàm chuyển đổi chất lượng sang định dạng dễ đọc
  const formatQuality = (quality) => {
    const found = allQualities.find(q => q.value === quality);
    return found ? found.label : quality;
  };

  // Thêm hàm lấy chất lượng hiện tại của video
  const getCurrentQualityLabel = () => {
    if (!playerRef.current) return 'Tự động';
    
    try {
      if (currentQuality === 'auto') {
        return 'Tự động';
      }
      
      const quality = availableQualities.find(q => q.value === currentQuality);
      return quality ? quality.label : 'Tự động';
    } catch (error) {
      console.error("Lỗi khi lấy nhãn chất lượng:", error);
      return 'Tự động';
    }
  };

  // Cập nhật hàm xử lý thay đổi chất lượng
  const handleQualityChange = (quality) => {
    console.log("Đang thay đổi chất lượng sang:", quality);
    
    if (!playerRef.current) {
      console.error("Player chưa sẵn sàng");
      return;
    }

    try {
      const currentTime = playerRef.current.getCurrentTime();
      const wasPlaying = playerRef.current.getPlayerState() === 1;

      if (quality === 'auto') {
        playerRef.current.setPlaybackQuality('default');
      } else {
        playerRef.current.setPlaybackQuality(quality);
      }

      setCurrentQuality(quality);
      setShowQualityMenu(false);

      // Đảm bảo video tiếp tục phát từ vị trí cũ
      playerRef.current.seekTo(currentTime);
      if (wasPlaying) {
        playerRef.current.playVideo();
      }
    } catch (error) {
      console.error("Lỗi khi thay đổi chất lượng:", error);
    }
  };

  // Thêm hàm kiểm tra chất lượng thực tế
  const checkActualQuality = () => {
    if (!playerRef.current) return;

    try {
      const actualQuality = playerRef.current.getPlaybackQuality();
      const availableQualities = playerRef.current.getAvailableQualityLevels();
      console.log("Kiểm tra chất lượng:", {
        thựcTế: actualQuality,
        đãChọn: currentQuality,
        cóSẵn: availableQualities
      });
    } catch (error) {
      console.error("Lỗi khi kiểm tra chất lượng:", error);
    }
  };

  // Thêm effect để theo dõi thay đổi chất lượng
  useEffect(() => {
    if (isReady && playerRef.current) {
      const qualityCheckInterval = setInterval(checkActualQuality, 2000);
      return () => clearInterval(qualityCheckInterval);
    }
  }, [isReady, currentQuality]);

  // Xử lý phụ đề
  const handleCaptionChange = (lang) => {
    if (playerRef.current) {
      if (lang === 'off') {
        playerRef.current.unloadModule('captions');
        setShowCaptions(false);
      } else {
        playerRef.current.loadModule('captions');
        playerRef.current.setOption('captions', 'track', {languageCode: lang});
        setShowCaptions(true);
      }
      setSelectedCaption(lang);
      setShowCaptionsMenu(false);
    }
  };
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
      <div 
        ref={playerContainerRef}
        className="w-full max-w-4xl bg-black text-white rounded-lg overflow-hidden shadow-2xl relative group"
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
          
          {/* Thanh điều khiển mới */}
          <div 
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4 z-30 transition-all duration-300 ${(showControls || !isPlaying) ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-2'}`}
          >
            {/* Thanh tiến độ */}
            <div 
              className="h-1 bg-gray-700 rounded-full mb-4 cursor-pointer group/progress"
              onClick={handleProgressBarClick}
            >
              <div 
                className="h-full bg-red-600 rounded-full relative group-hover/progress:h-2 transition-all"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-1/2 w-3 h-3 bg-red-600 rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity"></div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {/* Nút phát/tạm dừng */}
                <button 
                  onClick={togglePlay}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
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
                <div className="flex items-center space-x-2 group/volume">
                  <button 
                    onClick={toggleMute}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    aria-label={isMuted ? "Bật tiếng" : "Tắt tiếng"}
                  >
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
                    className="w-0 group-hover/volume:w-20 transition-all duration-300 accent-red-600"
                    aria-label="Âm lượng"
                  />
                </div>

                {/* Hiển thị thời gian */}
                <div className="text-sm font-medium">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>

                {/* Nút lặp lại */}
                <button
                  onClick={() => setIsLooping(!isLooping)}
                  className={`p-2 hover:bg-white/10 rounded-full transition-colors ${isLooping ? 'text-red-500' : ''}`}
                  aria-label="Lặp lại"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center space-x-4">
                {/* Tốc độ phát */}
                <div className="relative">
                  <button
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    aria-label="Tốc độ phát"
                  >
                    <span className="text-sm font-medium">{playbackSpeed}x</span>
                  </button>
                  
                  {showSpeedMenu && (
                    <div className="absolute bottom-full right-0 mb-2 bg-black/90 rounded-lg py-2 min-w-[120px]">
                      {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((speed) => (
                        <button
                          key={speed}
                          onClick={() => handleSpeedChange(speed)}
                          className={`w-full px-4 py-2 text-left hover:bg-white/10 ${playbackSpeed === speed ? 'text-red-500' : ''}`}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Chất lượng video */}
                <div className="relative">
                  <button
                    onClick={() => setShowQualityMenu(!showQualityMenu)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors flex items-center space-x-1"
                    aria-label="Chất lượng"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm hidden md:inline">{getCurrentQualityLabel()}</span>
                  </button>

                  {showQualityMenu && (
                    <div className="absolute bottom-full right-0 mb-2 bg-black/90 rounded-lg py-2 min-w-[200px] shadow-xl">
                      <div className="px-4 py-2 text-sm text-gray-400 border-b border-gray-700">Chất lượng</div>
                      {availableQualities.map((quality) => (
                        <button
                          key={quality.value}
                          onClick={() => handleQualityChange(quality.value)}
                          className={`w-full px-4 py-2 text-left hover:bg-white/10 flex items-center justify-between ${currentQuality === quality.value ? 'text-red-500' : ''}`}
                        >
                          <span>{quality.label}</span>
                          {currentQuality === quality.value && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Phụ đề */}
                <div className="relative">
                  <button
                    onClick={() => setShowCaptionsMenu(!showCaptionsMenu)}
                    className={`p-2 hover:bg-white/10 rounded-full transition-colors ${showCaptions ? 'text-red-500' : ''}`}
                    aria-label="Phụ đề"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                  </button>

                  {showCaptionsMenu && (
                    <div className="absolute bottom-full right-0 mb-2 bg-black/90 rounded-lg py-2 min-w-[150px]">
                      {availableCaptions.map((caption) => (
                        <button
                          key={caption.languageCode}
                          onClick={() => handleCaptionChange(caption.languageCode)}
                          className={`w-full px-4 py-2 text-left hover:bg-white/10 ${selectedCaption === caption.languageCode ? 'text-red-500' : ''}`}
                        >
                          {caption.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Nút toàn màn hình */}
                <button 
                  onClick={toggleFullScreen} 
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
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
        <h1 className="text-2xl font-bold mb-2">
          {videoDetails?.snippet?.title || 'Đang tải...'}
        </h1>
        <p className="text-gray-300">
          {videoDetails?.snippet?.description || 'Đang tải thông tin video...'}
        </p>
      </div>

      {/* Thông tin phím tắt */}
      <div className="mt-8 text-white max-w-4xl text-center">
        <h2 className="text-xl font-bold mb-4">Phím tắt</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <kbd className="px-2 py-1 bg-gray-700 rounded">Space</kbd> hoặc <kbd className="px-2 py-1 bg-gray-700 rounded">K</kbd> - Phát/Tạm dừng
          </div>
          <div>
            <kbd className="px-2 py-1 bg-gray-700 rounded">M</kbd> - Tắt/Bật tiếng
          </div>
          <div>
            <kbd className="px-2 py-1 bg-gray-700 rounded">F</kbd> - Toàn màn hình
          </div>
          <div>
            <kbd className="px-2 py-1 bg-gray-700 rounded">←</kbd> - Lùi 5 giây
          </div>
          <div>
            <kbd className="px-2 py-1 bg-gray-700 rounded">→</kbd> - Tiến 5 giây
          </div>
          <div>
            <kbd className="px-2 py-1 bg-gray-700 rounded">↑</kbd><kbd className="px-2 py-1 bg-gray-700 rounded">↓</kbd> - Điều chỉnh âm lượng
          </div>
          <div>
            <kbd className="px-2 py-1 bg-gray-700 rounded">L</kbd> - Bật/tắt lặp lại
          </div>
        </div>
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