import { extractYoutubeId, isYoutubeLink, isPdfLink, isGoogleDriveLink } from '../components/utils';

export function useMediaHandlers({ setYoutubeModal, setPdfModal }) {
  // Hàm mở modal YouTube
  const openYoutubeModal = (url, title = '') => {
    const videoId = extractYoutubeId(url);
    if (videoId) {
      setYoutubeModal({ isOpen: true, videoId, title });
    } else {
      // Nếu không phải YouTube link, mở URL bình thường
      window.open(url, '_blank');
    }
  };
  
  // Hàm đóng modal YouTube
  const closeYoutubeModal = () => {
    setYoutubeModal({ isOpen: false, videoId: null, title: '' });
  };

  // Hàm mở modal PDF
  const openPdfModal = (url, title = '') => {
    setPdfModal({ isOpen: true, fileUrl: url, title });
  };

  // Hàm đóng modal PDF
  const closePdfModal = () => {
    setPdfModal({ isOpen: false, fileUrl: null, title: '' });
  };

  // Hàm xử lý click vào link
  const handleLinkClick = (url, title) => {
    if (isYoutubeLink(url)) {
      openYoutubeModal(url, title);
    } else if (isPdfLink(url) || isGoogleDriveLink(url)) {
      openPdfModal(url, title);
    } else {
      window.open(url, '_blank');
    }
  };
  
  // Hàm kiểm tra và lấy URL đã xử lý
  const getProcessedDriveFile = (course, originalUrl, rowIndex, cellIndex, sheetIndex) => {
    if (!course?.processedDriveFiles || !originalUrl) return null;
    
    // 1. Kiểm tra theo URL gốc trước
    const processedFile = course.processedDriveFiles.find(file => file.originalUrl === originalUrl);
    if (processedFile) return processedFile;
    
    // 2. Kiểm tra theo ID nếu là Google Drive
    if (originalUrl.includes('drive.google.com/file/d/')) {
      const match = originalUrl.match(/\/file\/d\/([^\/\?]+)/);
      const driveId = match ? match[1] : null;
      
      if (driveId) {
        const fileByDriveId = course.processedDriveFiles.find(file => {
          if (!file.originalUrl.includes('drive.google.com/file/d/')) return false;
          const fileMatch = file.originalUrl.match(/\/file\/d\/([^\/\?]+)/);
          const fileId = fileMatch ? fileMatch[1] : null;
          return fileId === driveId;
        });
        
        if (fileByDriveId) return fileByDriveId;
      }
    }
    
    // 3. Kiểm tra theo vị trí
    if (typeof rowIndex === 'number' && typeof cellIndex === 'number') {
      const sheetTitle = course?.originalData?.sheets?.[sheetIndex]?.properties?.title || `Sheet ${sheetIndex + 1}`;
      for (const file of course.processedDriveFiles) {
        if (file.position && 
            file.position.row === rowIndex && 
            file.position.col === cellIndex && 
            file.position.sheet === sheetTitle) {
          return file;
        }
      }
    }
    
    return null;
  };

  return {
    openYoutubeModal,
    closeYoutubeModal,
    openPdfModal,
    closePdfModal,
    handleLinkClick,
    getProcessedDriveFile
  };
} 