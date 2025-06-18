import { useState } from 'react';

export function useMediaHandlers() {
  const [youtubeModal, setYoutubeModal] = useState({ isOpen: false, videoId: null, title: '' });
  const [youtubePlaylistModal, setYoutubePlaylistModal] = useState({ 
    isOpen: false, 
    playlistId: null, 
    videoId: null, 
    title: '' 
  });
  const [pdfModal, setPdfModal] = useState({ isOpen: false, fileUrl: null, title: '' });
  const [processingLink, setProcessingLink] = useState(false);
  
  // Hàm trích xuất YouTube ID
  const extractYoutubeId = (url) => {
    if (!url) return null;
    
    // Hỗ trợ nhiều định dạng URL YouTube
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
  };
  
  // Hàm trích xuất YouTube Playlist ID
  const extractYoutubePlaylistId = (url) => {
    if (!url) return null;
    
    // Trích xuất playlist ID từ URL
    let playlistId = null;
    
    // Định dạng 1: ?list=PLAYLIST_ID
    const listMatch = url.match(/[&?]list=([^&]+)/i);
    if (listMatch) {
      playlistId = listMatch[1];
    }
    
    return playlistId;
  };
  
  // Hàm trích xuất video ID từ URL playlist
  const extractVideoIdFromPlaylist = (url) => {
    if (!url) return null;
    
    // Trích xuất video ID từ URL playlist
    let videoId = null;
    
    // Định dạng: ?v=VIDEO_ID&list=PLAYLIST_ID
    const videoMatch = url.match(/[&?]v=([^&]+)/i);
    if (videoMatch) {
      videoId = videoMatch[1];
    }
    
    return videoId;
  };
  
  // Kiểm tra xem URL có phải là link YouTube không
  const isYoutubeLink = (url) => {
    if (!url) return false;
    return url.includes('youtube.com') || url.includes('youtu.be');
  };
  
  // Kiểm tra xem URL có phải là playlist YouTube không
  const isYoutubePlaylist = (url) => {
    if (!url) return false;
    
    // Kiểm tra nếu URL chứa tham số list
    const hasPlaylistParam = url.includes('list=');
    
    // Kiểm tra nếu URL chứa đường dẫn playlist
    const hasPlaylistPath = url.includes('youtube.com/playlist');
    
    // Trả về true nếu URL chứa tham số list hoặc đường dẫn playlist
    return hasPlaylistParam || hasPlaylistPath;
  };
  
  // Kiểm tra xem URL có phải là link PDF không
  const isPdfLink = (url) => {
    if (!url) return false;
    return url.toLowerCase().endsWith('.pdf');
  };
  
  // Kiểm tra xem URL có phải là link Google Drive không
  const isGoogleDriveLink = (url) => {
    if (!url) return false;
    return url.includes('drive.google.com') || url.includes('docs.google.com');
  };
  
  // Kiểm tra xem URL có phải là thư mục Google Drive không
  const isGoogleDriveFolder = (url) => {
    if (!url) return false;
    return url.includes('drive.google.com/drive/folders') || url.includes('drive.google.com/folders');
  };
  
  // Mở modal YouTube
  const openYoutubeModal = (url, title = '') => {
    const videoId = extractYoutubeId(url);
    
    if (videoId) {
      // Kiểm tra xem URL có chứa playlist không
      const playlistId = extractYoutubePlaylistId(url);
      
      if (playlistId) {
        // Nếu có cả video ID và playlist ID, mở modal playlist
        setYoutubePlaylistModal({
          isOpen: true,
          playlistId,
          videoId,
          title: title || 'Video YouTube'
        });
      } else {
        // Nếu chỉ có video ID, mở modal video đơn
        setYoutubeModal({
          isOpen: true,
          videoId,
          title: title || 'Video YouTube'
        });
      }
    }
  };
  
  // Đóng modal YouTube
  const closeYoutubeModal = () => {
    setYoutubeModal({ isOpen: false, videoId: null, title: '' });
  };
  
  // Đóng modal YouTube Playlist
  const closeYoutubePlaylistModal = () => {
    setYoutubePlaylistModal({ 
      isOpen: false, 
      playlistId: null, 
      videoId: null, 
      title: '' 
    });
  };
  
  // Mở modal PDF
  const openPdfModal = (url, title = '') => {
    setPdfModal({ isOpen: true, fileUrl: url, title: title || 'Tài liệu PDF' });
  };
  
  // Đóng modal PDF
  const closePdfModal = () => {
    setPdfModal({ isOpen: false, fileUrl: null, title: '' });
  };
  
  // Xử lý khi click vào link
  const handleLinkClick = async (url, title) => {
    if (!url) return;
    
    // Ngăn chặn xử lý nếu đang trong quá trình xử lý
    if (processingLink) return;
    
    setProcessingLink(true);
    
    try {
      // Cập nhật URL nếu cần
      const updatedUrl = getUpdatedUrl(url);
      
      // Xử lý các loại link khác nhau
      if (isYoutubeLink(updatedUrl)) {
        // Kiểm tra xem có phải là playlist không
        if (isYoutubePlaylist(updatedUrl)) {
          const playlistId = extractYoutubePlaylistId(updatedUrl);
          const videoId = extractVideoIdFromPlaylist(updatedUrl);
          
          if (playlistId) {
            setYoutubePlaylistModal({
              isOpen: true,
              playlistId,
              videoId: videoId || null,
              title: title || 'Danh sách phát YouTube'
            });
          }
        } else {
          // Xử lý video YouTube thông thường
          openYoutubeModal(updatedUrl, title);
        }
      } else if (isPdfLink(updatedUrl)) {
        // Xử lý file PDF
        openPdfModal(updatedUrl, title);
      } else if (isGoogleDriveLink(updatedUrl)) {
        // Xử lý link Google Drive
        if (isGoogleDriveFolder(updatedUrl)) {
          // Mở thư mục Google Drive trong tab mới
          window.open(updatedUrl, '_blank');
        } else {
          // Xử lý file Google Drive
          const processedUrl = await getProcessedDriveFile(updatedUrl);
          if (processedUrl) {
            // Nếu là PDF, mở modal PDF
            if (processedUrl.endsWith('.pdf')) {
              openPdfModal(processedUrl, title);
            } else {
              // Mở link khác trong tab mới
              window.open(processedUrl, '_blank');
            }
          } else {
            // Mở link gốc nếu không xử lý được
            window.open(updatedUrl, '_blank');
          }
        }
      } else {
        // Mở các loại link khác trong tab mới
        window.open(updatedUrl, '_blank');
      }
    } catch (error) {
      console.error('Lỗi khi xử lý link:', error);
    } finally {
      setProcessingLink(false);
    }
  };
  
  // Hàm cập nhật URL
  const getUpdatedUrl = (originalUrl) => {
    if (!originalUrl) return '';
    
    try {
      let url = originalUrl;
      
      // Xử lý URL Google Drive
      if (url.includes('drive.google.com/file/d/')) {
        // Chuyển đổi URL xem sang URL tải xuống
        const fileIdMatch = url.match(/\/file\/d\/([^/]+)/);
        if (fileIdMatch && fileIdMatch[1]) {
          const fileId = fileIdMatch[1];
          url = `https://drive.google.com/uc?export=download&id=${fileId}`;
        }
      }
      
      return url;
    } catch (error) {
      console.error('Lỗi khi cập nhật URL:', error);
      return originalUrl;
    }
  };
  
  // Hàm lấy file Google Drive đã xử lý
  const getProcessedDriveFile = async (url) => {
    try {
      // Trích xuất ID file từ URL
      let fileId = null;
      
      if (url.includes('/file/d/')) {
        const match = url.match(/\/file\/d\/([^/]+)/);
        if (match && match[1]) {
          fileId = match[1];
        }
      } else if (url.includes('id=')) {
        const match = url.match(/id=([^&]+)/);
        if (match && match[1]) {
          fileId = match[1];
        }
      }
      
      if (!fileId) {
        return null;
      }
      
      // Tạo URL xem trước hoặc tải xuống tùy thuộc vào loại file
      return `https://drive.google.com/uc?export=view&id=${fileId}`;
    } catch (error) {
      console.error('Lỗi khi xử lý file Google Drive:', error);
      return null;
    }
  };

  return {
    youtubeModal,
    youtubePlaylistModal,
    pdfModal,
    processingLink,
    openYoutubeModal,
    closeYoutubeModal,
    openPdfModal,
    closePdfModal,
    closeYoutubePlaylistModal,
    handleLinkClick,
    getProcessedDriveFile,
    getUpdatedUrl,
    isYoutubeLink,
    isPdfLink,
    isGoogleDriveLink,
    isYoutubePlaylist
  };
} 