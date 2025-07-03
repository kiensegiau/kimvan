import { useState, useEffect, useCallback } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import YouTubeModal from './YouTubeModal';
import YouTubePlaylistModal from './YouTubePlaylistModal';
import PDFModal from './PDFModal';

// Define animation styles
const toastAnimationStyles = `
  @keyframes fadeInDown {
    from {
      opacity: 0;
      transform: translate3d(0, -20px, 0);
    }
    to {
      opacity: 1;
      transform: translate3d(0, 0, 0);
    }
  }
  
  @keyframes fadeOutUp {
    from {
      opacity: 1;
      transform: translate3d(0, 0, 0);
    }
    to {
      opacity: 0;
      transform: translate3d(0, -20px, 0);
    }
  }
  
  .animate-fade-in-down {
    animation: fadeInDown 0.5s ease forwards;
  }
  
  .animate-fade-out-up {
    animation: fadeOutUp 0.5s ease forwards;
  }

  /* Table border styles */
  .table-bordered {
    border-collapse: separate;
    border-spacing: 0;
  }
  
  .table-bordered th, 
  .table-bordered td {
    border: 1px solid #e5e7eb;
    border-bottom-width: 0;
    border-left-width: 0;
  }
  
  .table-bordered th:last-child,
  .table-bordered td:last-child {
    border-right-width: 0;
  }
  
  .table-bordered tr:last-child td {
    border-bottom-width: 1px;
  }
  
  .table-bordered thead th {
    border-color: rgba(255, 255, 255, 0.2);
  }
`;

export default function ApiSheetData({ 
  apiSheetData, 
  loadingApiSheet, 
  apiSheetError,
  activeApiSheet,
  setActiveApiSheet,
  fetchApiSheetData,
  fetchSheetDetail
}) {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [selectedPlaylistVideo, setSelectedPlaylistVideo] = useState(null);
  const [selectedPDF, setSelectedPDF] = useState(null);
  const [pdfTitle, setPdfTitle] = useState('');
  const [loadingLinks, setLoadingLinks] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [hoveredHeader, setHoveredHeader] = useState(null);
  const [processingSheet, setProcessingSheet] = useState(false);
  const [showToast, setShowToast] = useState(false);
  
  // Tạo proxy link từ URL thông qua Base64 encoding
  const createProxyLink = useCallback((url) => {
    try {
      // Mã hóa URL sử dụng base64 URL-safe
      const base64Url = Buffer.from(url).toString('base64')
        .replace(/\+/g, '-')  // Thay thế + thành -
        .replace(/\//g, '_')  // Thay thế / thành _
        .replace(/=+$/, '');  // Loại bỏ padding '='
      
      return `/api/proxy-link/${base64Url}`;
    } catch (error) {
      // Xử lý lỗi im lặng
      return null;
    }
  }, []);
  
  // Giải mã proxy link để lấy URL gốc
  const decodeProxyLink = useCallback((proxyUrl) => {
    try {
      if (!proxyUrl || !proxyUrl.startsWith('/api/proxy-link/')) {
        return null;
      }
      
      // Lấy phần base64 từ URL
      const base64Part = proxyUrl.replace('/api/proxy-link/', '');
      
      // Chuyển lại các ký tự đặc biệt
      const normalizedBase64 = base64Part
        .replace(/-/g, '+')  // Thay thế - thành +
        .replace(/_/g, '/'); // Thay thế _ thành /
      
      // Giải mã base64
      const decodedUrl = Buffer.from(normalizedBase64, 'base64').toString('utf-8');
      return decodedUrl;
    } catch (error) {
      // Xử lý lỗi im lặng
      return null;
    }
  }, []);

  // Giải mã và xử lý proxy link
  const handleProxyLink = useCallback((proxyUrl) => {
    const decodedUrl = decodeProxyLink(proxyUrl);
    
    if (!decodedUrl) return null;
    
    // Kiểm tra nếu là YouTube link
    if (decodedUrl.includes('youtube.com') || decodedUrl.includes('youtu.be')) {
      // Xử lý trường hợp link qua Google redirector
      if (decodedUrl.includes('google.com/url?q=')) {
        const match = decodedUrl.match(/[?&]q=([^&]+)/);
        if (match && match[1]) {
          const actualYoutubeUrl = decodeURIComponent(match[1]);
          return {
            type: 'youtube',
            url: actualYoutubeUrl
          };
        }
      }
      
      // Trường hợp link YouTube trực tiếp
      return {
        type: 'youtube',
        url: decodedUrl
      };
    }
    
    // Kiểm tra nếu là Google Drive
    if (decodedUrl.includes('drive.google.com')) {
      return {
        type: 'drive',
        url: decodedUrl
      };
    }
    
    // Các loại link khác
    return {
      type: 'other',
      url: decodedUrl
    };
  }, [decodeProxyLink]);

  // State to track animation class
  const [toastAnimation, setToastAnimation] = useState('animate-fade-in-down');

  // Show toast notification when component mounts
  useEffect(() => {
    setShowToast(true);
    
    // Hide toast after 5 seconds
    const timer = setTimeout(() => {
      // Start fade-out animation
      setToastAnimation('animate-fade-out-up');
      
      // Actually hide the component after animation completes
      setTimeout(() => {
        setShowToast(false);
      }, 500); // Match animation duration
    }, 5000);
    
    return () => clearTimeout(timer);
  }, []);

  // Kiểm tra và tải chi tiết sheet nếu cần
  useEffect(() => {
    if (apiSheetData && apiSheetData.sheets && apiSheetData.sheets.length > 0) {
      const currentSheet = apiSheetData.sheets[activeApiSheet];
      
      // Nếu có sheet nhưng không có chi tiết, tải chi tiết
      if (currentSheet && !currentSheet.detail && !loadingApiSheet) {
        fetchSheetDetail(currentSheet._id);
      }
    }
  }, [apiSheetData, activeApiSheet, loadingApiSheet, fetchSheetDetail]);

  const isYoutubeLink = (url) => {
    if (!url) return false;
    
    // Kiểm tra URL YouTube thông thường
    const isRegularYoutube = url.includes('youtube.com') || 
                            url.includes('youtu.be') || 
                            url.includes('youtube-nocookie.com') ||
                            url.includes('youtube.googleapis.com');
    
    return isRegularYoutube;
  };
  
  const isPdfLink = (url) => {
    if (!url) return false;
    return url.toLowerCase().endsWith('.pdf');
  };
  
  const isGoogleDriveLink = (url) => {
    if (!url) return false;
    return url.includes('drive.google.com') || url.includes('docs.google.com');
  };

  // Hàm lấy video ID từ URL YouTube
  const getYoutubeVideoId = (url) => {
    if (!url) return null;
    
    // Xử lý các định dạng URL YouTube khác nhau
    let videoId = null;
    
    // Format: https://www.youtube.com/watch?v=VIDEO_ID
    const watchMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/e\/|youtube\.com\/watch\?.*v=|youtube\.com\/attribution_link\?.*v%3D|youtube\.com\/attribution_link\?.*v=|youtube-nocookie\.com\/.*v=|youtube\.com\/shorts\/)([^&\n?#\/]+)/);
    
    if (watchMatch) {
      videoId = watchMatch[1];
    }
    
    return videoId;
  };

  const isYoutubePlaylist = (url) => {
    if (!url) return false;
    
    // Kiểm tra các định dạng URL playlist YouTube
    return url.includes('youtube.com/playlist') || 
           url.includes('youtube.com/watch') && url.includes('list=');
  };

  const getYoutubePlaylistId = (url) => {
    if (!url) return null;
    
    // Xử lý các định dạng URL playlist YouTube khác nhau
    let playlistId = null;
    
    // Format: https://www.youtube.com/playlist?list=PLAYLIST_ID
    const playlistMatch = url.match(/(?:youtube\.com\/playlist\?list=|youtube\.com\/watch\?.*list=|youtu\.be\/.*[?&]list=)([^&\n?#\/]+)/);
    
    if (playlistMatch) {
      playlistId = playlistMatch[1];
    }
    
    return playlistId;
  };

  const handleYoutubeClick = (e, url) => {
    e.preventDefault();
    
    // Kiểm tra nếu là playlist
    if (isYoutubePlaylist(url)) {
      const playlistId = getYoutubePlaylistId(url);
      const videoId = getYoutubeVideoId(url);
      
      if (playlistId) {
        setSelectedPlaylist({
          playlistId,
          videoId
        });
        return;
      }
    }
    
    // Xử lý video đơn lẻ như cũ
    const videoId = getYoutubeVideoId(url);
    
    if (videoId) {
      setSelectedVideo(videoId);
    } else {
      window.open(url, '_blank');
    }
  };

  const handlePdfClick = (e, url, title = '') => {
    e.preventDefault();
    // Mở PDF trực tiếp trong tab mới
    window.open(url, '_blank');
    // Xóa trạng thái loading
    setTimeout(() => {
      setLoadingLinks(prev => ({ ...prev, [url]: false }));
    }, 500);
  };

  // Xử lý click vào proxy link
  const handleProxyLinkClick = (e, proxyUrl, title = '') => {
    e.preventDefault();
    
    // Đánh dấu link đang loading
    setLoadingLinks(prev => ({ ...prev, [proxyUrl]: true }));
    
    const linkInfo = handleProxyLink(proxyUrl);
    
    if (!linkInfo) {
      setLoadingLinks(prev => ({ ...prev, [proxyUrl]: false }));
      return;
    }
    
    switch (linkInfo.type) {
      case 'youtube':
        handleYoutubeClick(e, linkInfo.url);
        break;
      
      case 'drive':
        // Mở tất cả các link Google Drive trong tab mới mà không thay đổi URL
        window.open(linkInfo.url, '_blank');
        break;
      
      default:
        // Mở tất cả các link không phải YouTube trong tab mới
        window.open(linkInfo.url, '_blank');
        break;
    }
    
    // Xóa trạng thái loading
    setLoadingLinks(prev => ({ ...prev, [proxyUrl]: false }));
  };

  // Handle general link click with proxy link creation
  const handleLinkClick = (e, url, title = '') => {
    e.preventDefault();
    
    // Đánh dấu link đang loading
    setLoadingLinks(prev => ({ ...prev, [url]: true }));
    
    // Kiểm tra nếu là proxy link
    if (url && url.startsWith('/api/proxy-link/')) {
      handleProxyLinkClick(e, url, title);
      return;
    }
    
    // Kiểm tra nếu là YouTube link
    if (isYoutubeLink(url)) {
      handleYoutubeClick(e, url);
      setTimeout(() => {
        setLoadingLinks(prev => ({ ...prev, [url]: false }));
      }, 500);
      return;
    }
    
    // Kiểm tra nếu là PDF link
    if (isPdfLink(url)) {
      handlePdfClick(e, url, title);
      setTimeout(() => {
        setLoadingLinks(prev => ({ ...prev, [url]: false }));
      }, 500);
      return;
    }
    
    // Mở tất cả các link khác trong tab mới
    window.open(url, '_blank');
    
    // Xóa trạng thái loading
    setTimeout(() => {
      setLoadingLinks(prev => ({ ...prev, [url]: false }));
    }, 500);
  };
  
  // Hàm lấy hyperlink từ dữ liệu
  const getHyperlink = (rowIndex, cellIndex, data) => {
    // Kiểm tra nếu có hyperlink trong mảng hyperlinks
    if (data.hyperlinks && Array.isArray(data.hyperlinks)) {
      const hyperlink = data.hyperlinks.find(link => 
        link.row === rowIndex && link.col === cellIndex
      );
      if (hyperlink && hyperlink.url) {
        return hyperlink.url;
      }
    }
    
    // Kiểm tra nếu có dữ liệu HTML
    if (data.htmlData && Array.isArray(data.htmlData) && data.htmlData.length > rowIndex) {
      const htmlRow = data.htmlData[rowIndex];
      if (htmlRow && htmlRow.values && Array.isArray(htmlRow.values)) {
        const htmlCell = htmlRow.values[cellIndex];
        if (htmlCell && htmlCell.hyperlink) {
          return htmlCell.hyperlink;
        }
      }
    }
    
    return null;
  };

  // Trích xuất URL từ nội dung
  const extractRealUrl = (content) => {
    if (!content || typeof content !== 'string') return null;
    
    // 1. Kiểm tra xem nội dung có phải là URL đầy đủ không
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = content.match(urlRegex);
    
    if (matches && matches.length > 0) {
      return matches[0];
    }
    
    // 2. Kiểm tra xem có ID YouTube không
    // Format: "YouTube: ABC123XYZ"
    const youtubeRegex = /YouTube:\s*([a-zA-Z0-9_-]{11})/i;
    const youtubeMatch = content.match(youtubeRegex);
    
    if (youtubeMatch && youtubeMatch[1]) {
      const videoId = youtubeMatch[1];
      return `https://www.youtube.com/watch?v=${videoId}`;
    }
    
    // 3. Kiểm tra xem có chỉ là ID YouTube không (11 ký tự)
    // Chỉ áp dụng nếu là chuỗi 11 ký tự chỉ chứa chữ và số
    if (/^[a-zA-Z0-9_-]{11}$/.test(content)) {
      return `https://www.youtube.com/watch?v=${content}`;
    }
    
    // 4. Kiểm tra nếu là số (có thể là mã video)
    const numberRegex = /^\d+$/;
    const numberMatches = content.match(numberRegex);
    
    if (numberMatches && numberMatches.length > 0) {
      const number = numberMatches[0];
      
      // Kiểm tra xem có phải là ID YouTube không (thường là 11 ký tự)
      if (number.length === 11) {
        return `https://www.youtube.com/watch?v=${number}`;
      }
    }
    
    return null;
  };

  // Hàm render cell có hyperlink
  const renderHyperlinkCell = (hyperlink, cellContent, rowIndex, cellIndex) => {
    // Check if it's a YouTube link first
    if (isYoutubeLink(hyperlink)) {
      // Xác định loading state
      const isLoading = loadingLinks[hyperlink];
      
      return (
        <a
          href={hyperlink}
          onClick={(e) => handleYoutubeClick(e, hyperlink)}
          className="flex items-start text-blue-600 hover:text-blue-800 hover:underline break-words"
          title={cellContent || 'YouTube Video'}
        >
          {isLoading ? (
            <span className="mr-1 inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent flex-shrink-0 mt-1"></span>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="mr-1 h-4 w-4 text-red-600 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
            </svg>
          )}
          <span className="break-words">{cellContent || 'YouTube Video'}</span>
        </a>
      );
    }
    
    // Check for PDF links
    if (isPdfLink(hyperlink)) {
      // Xác định loading state
      const isLoading = loadingLinks[hyperlink];
      
      return (
        <a
          href={hyperlink}
          onClick={(e) => handlePdfClick(e, hyperlink, cellContent)}
          className="flex items-start text-blue-600 hover:text-blue-800 hover:underline break-words"
          title={cellContent || 'PDF Document'}
        >
          {isLoading ? (
            <span className="mr-1 inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent flex-shrink-0 mt-1"></span>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="mr-1 h-4 w-4 text-red-600 flex-shrink-0 mt-1" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 11.5v-6.5h10v6.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"></path>
              <path d="M12 13.5V21" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"></path>
              <path d="M9.5 16L12 13.5L14.5 16" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"></path>
              <path d="M4 21.4V2.6C4 2.26863 4.26863 2 4.6 2H19.4C19.7314 2 20 2.26863 20 2.6V21.4C20 21.7314 19.7314 22 19.4 22H4.6C4.26863 22 4 21.7314 4 21.4Z" stroke="currentColor" strokeWidth="1.5" fill="none"></path>
            </svg>
          )}
          <span className="break-words">{cellContent || 'PDF Document'}</span>
        </a>
      );
    }
    
    // Google Drive or Docs links
    if (isGoogleDriveLink(hyperlink)) {
      // Xác định loading state
      const isLoading = loadingLinks[hyperlink];
      
      return (
        <a
          href={hyperlink}
          onClick={(e) => handleLinkClick(e, hyperlink, cellContent)}
          className="flex items-start text-blue-600 hover:text-blue-800 hover:underline break-words"
          title={cellContent || 'Google Drive Document'}
        >
          {isLoading ? (
            <span className="mr-1 inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent flex-shrink-0 mt-1"></span>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="mr-1 h-4 w-4 text-green-600 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
          <span className="break-words">{cellContent || 'Google Drive Document'}</span>
        </a>
      );
    }
    
    // Proxy links
    if (hyperlink && hyperlink.startsWith('/api/proxy-link/')) {
      // Xác định loading state
      const isLoading = loadingLinks[hyperlink];
      
      return (
        <a
          href={hyperlink}
          onClick={(e) => handleProxyLinkClick(e, hyperlink, cellContent)}
          className="flex items-start text-blue-600 hover:text-blue-800 hover:underline break-words"
          title={cellContent || 'Link'}
        >
          {isLoading ? (
            <span className="mr-1 inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent flex-shrink-0 mt-1"></span>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="mr-1 h-4 w-4 text-blue-600 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          )}
          <span className="break-words">{cellContent || 'Link'}</span>
        </a>
      );
    }
    
    // Default for all other hyperlinks
    return (
      <a
        href={hyperlink}
        onClick={(e) => handleLinkClick(e, hyperlink, cellContent)}
        className="text-blue-600 hover:text-blue-800 hover:underline break-words block"
        target="_blank"
        rel="noopener noreferrer"
        title={cellContent || hyperlink}
      >
        {cellContent || hyperlink}
      </a>
    );
  };

  // Hàm format nội dung cell, đặc biệt xử lý cho các cột ngày tháng
  const formatCellContent = (content, column) => {
    if (content === undefined || content === null) return '';
    
    // Xử lý các loại dữ liệu
    if (typeof content === 'number') {
      // Xử lý số Excel date (số ngày kể từ 1/1/1900)
      if (column && (column.includes('NGÀY') || column.includes('DATE'))) {
        try {
          // Chuyển đổi Excel serial date sang JavaScript Date
          // Excel: ngày 1/1/1900 = 1, JavaScript: ngày 1/1/1900 = ngày 0 + sự khác biệt 1 ngày
          const excelEpoch = new Date(1900, 0, 1);
          const daysSinceExcelEpoch = content - 1; // Trừ 1 vì Excel tính 1/1/1900 là ngày 1
          const millisecondsSinceExcelEpoch = daysSinceExcelEpoch * 24 * 60 * 60 * 1000;
          const date = new Date(excelEpoch.getTime() + millisecondsSinceExcelEpoch);
          
          // Định dạng ngày theo dd/mm/yyyy
          const day = date.getDate().toString().padStart(2, '0');
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const year = date.getFullYear();
          
          return `${day}/${month}/${year}`;
        } catch (error) {
          return content; // Trả về giá trị gốc nếu có lỗi
        }
      }
      
      return content.toString();
    }
    
    // Xử lý chuỗi có thể là ngày tháng
    if (typeof content === 'string' && (column && (column.includes('NGÀY') || column.includes('DATE')))) {
      try {
        // Kiểm tra định dạng dd/mm/yyyy hoặc yyyy-mm-dd
        const dateRegex1 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
        const dateRegex2 = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
        
        if (dateRegex1.test(content)) {
          // Đã đúng định dạng dd/mm/yyyy
          return content;
        } else if (dateRegex2.test(content)) {
          // Chuyển từ yyyy-mm-dd sang dd/mm/yyyy
          const parts = content.split('-');
          return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
        }
      } catch (error) {
        // Xử lý lỗi im lặng
      }
    }
    
    // Trả về nội dung gốc nếu không cần xử lý đặc biệt
    return content.toString();
  };

  // Render nội dung cell
  const renderCellContent = (content, rowIndex, cellIndex, sheetDetail) => {
    // Xử lý trường hợp dữ liệu null hoặc undefined
    if (content === undefined || content === null) {
      return <span className="text-gray-400">-</span>;
    }
    
    // Tìm hyperlink từ dữ liệu HTML nếu có
    let hyperlink = null;
    if (sheetDetail && sheetDetail.htmlData) {
      const htmlRow = sheetDetail.htmlData[rowIndex];
      if (htmlRow) {
        // Xử lý cả trường hợp htmlRow là mảng và là đối tượng với thuộc tính values
        if (Array.isArray(htmlRow) && htmlRow[cellIndex] && htmlRow[cellIndex].hyperlink) {
          hyperlink = htmlRow[cellIndex].hyperlink;
        } else if (htmlRow.values && Array.isArray(htmlRow.values) && 
                htmlRow.values[cellIndex] && htmlRow.values[cellIndex].hyperlink) {
          hyperlink = htmlRow.values[cellIndex].hyperlink;
        }
      }
    }
    
    // Tìm hyperlink từ mảng hyperlinks nếu không tìm thấy từ HTML
    if (!hyperlink && sheetDetail && Array.isArray(sheetDetail.hyperlinks)) {
      const hyperlinkData = sheetDetail.hyperlinks.find(
        link => link.row === rowIndex && link.col === cellIndex
      );
      if (hyperlinkData && hyperlinkData.url) {
        hyperlink = hyperlinkData.url;
      }
    }
    
    // Thử trích xuất URL từ nội dung nếu vẫn không tìm thấy hyperlink
    if (!hyperlink && typeof content === 'string') {
      const columnName = sheetDetail.header?.[cellIndex];
      hyperlink = extractRealUrl(content);
    }
    
    // Định dạng nội dung cell trước khi render
    const formattedContent = formatCellContent(content, sheetDetail?.header?.[cellIndex]);
    
    // Render cell với hyperlink nếu có
    if (hyperlink) {
      return renderHyperlinkCell(hyperlink, formattedContent, rowIndex, cellIndex);
    }
    
    // Render cell thông thường với nội dung bị cắt nếu quá dài
    return <span className="break-words" title={formattedContent}>{formattedContent}</span>;
  };

  // Hàm kiểm tra cell có bị gộp không
  const isMergedCell = (rowIndex, cellIndex, sheetDetail) => {
    if (!sheetDetail || !sheetDetail.merges) return false;
    
    // Kiểm tra xem cell hiện tại có nằm trong bất kỳ vùng merge nào không
    for (const merge of sheetDetail.merges) {
      if (rowIndex >= merge.s.r && rowIndex <= merge.e.r &&
          cellIndex >= merge.s.c && cellIndex <= merge.e.c) {
        return true;
      }
    }
    
    return false;
  };

  // Hàm lấy thông tin rowSpan và colSpan cho cell
  const getMergeInfo = (rowIndex, cellIndex, sheetDetail) => {
    if (!sheetDetail || !sheetDetail.merges) return null;
    
    // Tìm vùng merge chứa cell hiện tại
    for (const merge of sheetDetail.merges) {
      if (rowIndex >= merge.s.r && rowIndex <= merge.e.r &&
          cellIndex >= merge.s.c && cellIndex <= merge.e.c) {
        return {
          isMainCell: rowIndex === merge.s.r && cellIndex === merge.s.c,
          rowSpan: merge.e.r - merge.s.r + 1,
          colSpan: merge.e.c - merge.s.c + 1
        };
      }
    }
    
    return null;
  };
  
  // Sorting function
  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  // Get sorted data
  const getSortedData = (data, header) => {
    if (!sortConfig.key || !data || !Array.isArray(data)) return data;
    
    const sortableData = [...data];
    const columnIndex = header.indexOf(sortConfig.key);
    
    if (columnIndex === -1) return sortableData;
    
    sortableData.sort((a, b) => {
      let aValue, bValue;
      
      // Xử lý khi dữ liệu có cấu trúc rows với processedData
      if (a.processedData && b.processedData) {
        aValue = a.processedData[`col${columnIndex}`];
        bValue = b.processedData[`col${columnIndex}`];
      } 
      // Xử lý khi dữ liệu là mảng (values)
      else if (Array.isArray(a) && Array.isArray(b)) {
        aValue = a[columnIndex];
        bValue = b[columnIndex];
      } 
      // Trường hợp khác, sử dụng thuộc tính trực tiếp
      else {
        aValue = a[sortConfig.key];
        bValue = b[sortConfig.key];
      }
      
      // Xử lý null/undefined
      if (aValue === undefined || aValue === null) return sortConfig.direction === 'ascending' ? -1 : 1;
      if (bValue === undefined || bValue === null) return sortConfig.direction === 'ascending' ? 1 : -1;
      
      // Xử lý dữ liệu số
      if (!isNaN(aValue) && !isNaN(bValue)) {
        aValue = parseFloat(aValue);
        bValue = parseFloat(bValue);
      }
      
      // Xử lý chuỗi
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'ascending' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }
      
      // So sánh chung
      if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
      return 0;
    });
    
    return sortableData;
  };

  // Hàm debug cấu trúc sheet
  const debugSheetStructure = (sheetDetail) => {
    if (!sheetDetail) {
      return;
    }
    
    // Kiểm tra các thuộc tính chính
    const hasHeader = Array.isArray(sheetDetail.header);
    const hasRows = Array.isArray(sheetDetail.rows);
    const hasValues = Array.isArray(sheetDetail.values);
    const hasHtmlData = Array.isArray(sheetDetail.htmlData);
    const hasHyperlinks = Array.isArray(sheetDetail.hyperlinks);
    
    // Kiểm tra cấu trúc rows nếu có
    if (hasRows && sheetDetail.rows.length > 0) {
      const sampleRow = sheetDetail.rows[0];
    }
  };

  // Hàm xử lý sheet để đưa vào database
  const handleProcessSheet = async () => {
    if (!apiSheetData || !apiSheetData.sheets || apiSheetData.sheets.length === 0) {
      return;
    }
    
    setProcessingSheet(true);
    
    try {
      // Lấy sheet hiện tại
      const currentSheet = apiSheetData.sheets[activeApiSheet];
      if (!currentSheet || !currentSheet._id) {
        setProcessingSheet(false);
        return;
      }
      
      // Gọi API để xử lý sheet
      await processSheetToDb(currentSheet._id);
      
      // Tải lại dữ liệu chi tiết sheet
      await fetchSheetDetail(currentSheet._id);
    } catch (error) {
      // Xử lý lỗi
    } finally {
      setProcessingSheet(false);
    }
  };
  
  // Hàm sửa hyperlinks trong sheet
  const handleFixHyperlinks = async () => {
    if (!apiSheetData || !apiSheetData.sheets || apiSheetData.sheets.length === 0) {
      return;
    }
    
    setProcessingSheet(true);
    
    try {
      // Lấy sheet hiện tại
      const currentSheet = apiSheetData.sheets[activeApiSheet];
      if (!currentSheet || !currentSheet._id) {
        setProcessingSheet(false);
        return;
      }
      
      // Gọi API để sửa hyperlinks
      const response = await fetch(`/api/sheets/${currentSheet._id}/process-all-links`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ preserveHyperlinks: true })
      });
      
      const result = await response.json();
      
      // Sau khi xử lý thành công, tải lại dữ liệu sheet
      await fetchSheetDetail(currentSheet._id);
    } catch (error) {
      // Xử lý lỗi
    } finally {
      setProcessingSheet(false);
    }
  };

  // Render bảng dữ liệu sheet
  const renderTable = (sheetDetail) => {
    if (!sheetDetail) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">Không có dữ liệu sheet</p>
        </div>
      );
    }
    
    // Debug thông tin cấu trúc sheet
    debugSheetStructure(sheetDetail);
    
    // Xử lý dữ liệu và định dạng
    let rows = [];
    let header = [];
    
    // Trường hợp 1: Dữ liệu từ database với header và rows
    if (Array.isArray(sheetDetail.header) && Array.isArray(sheetDetail.rows)) {
      header = sheetDetail.header;
      rows = sheetDetail.rows;
    }
    // Trường hợp 2: Dữ liệu từ API với values
    else if (Array.isArray(sheetDetail.values) && sheetDetail.values.length > 0) {
      // Trích xuất header và rows từ values
      header = sheetDetail.values[0] || [];
      
      // Chuyển đổi các hàng còn lại thành định dạng row
      rows = sheetDetail.values.slice(1).map((row, rowIndex) => {
        const rowData = {
          processedData: {},
          _hyperlinks: {}
        };
        
        // Lưu trữ dữ liệu từng cột
        row.forEach((cellValue, cellIndex) => {
          // Lưu dữ liệu vào processedData
          rowData.processedData[`col${cellIndex}`] = cellValue;
          
          // Lưu trữ columnName để tiện truy cập
          const columnName = header[cellIndex];
          rowData[columnName] = cellValue;
          
          // Kiểm tra nếu có htmlData, tìm hyperlink
          if (sheetDetail.htmlData && sheetDetail.htmlData[rowIndex + 1]) { // +1 vì row 0 là header
            const htmlRow = sheetDetail.htmlData[rowIndex + 1];
            
            // Xử lý cả trường hợp htmlRow là mảng và là đối tượng với thuộc tính values
            if (Array.isArray(htmlRow) && htmlRow[cellIndex] && htmlRow[cellIndex].hyperlink) {
              // Nếu là hyperlink thật từ htmlData, ưu tiên sử dụng
              rowData._hyperlinks[columnName] = htmlRow[cellIndex].hyperlink;
            } else if (htmlRow.values && Array.isArray(htmlRow.values) && 
                     htmlRow.values[cellIndex] && htmlRow.values[cellIndex].hyperlink) {
              // Nếu là hyperlink thật từ htmlData, ưu tiên sử dụng
              rowData._hyperlinks[columnName] = htmlRow.values[cellIndex].hyperlink;
            }
          }
        });
        
        return rowData;
      });
    }
    // Không có dữ liệu hợp lệ
    else {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">Dữ liệu sheet không đúng định dạng</p>
        </div>
      );
    }
    
    // Xử lý sắp xếp dữ liệu nếu cần
    const sortedRows = getSortedData(rows, header);
    
    // Display all columns including the first one
    return (
      <div>
        <div className="bg-gray-50 p-3 mb-2 rounded-md flex items-center border border-gray-200 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-gray-700">Kéo sang phải để xem đầy đủ dữ liệu nếu bảng quá rộng</p>
        </div>
        
        <div className="overflow-x-auto border border-indigo-100 rounded-lg shadow-md">
          <table className="min-w-full table-bordered">
            <thead className="bg-indigo-700">
              <tr>
                {header.map((column, index) => (
                  <th
                    key={`header-${index}`}
                    scope="col"
                    className={`px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer relative min-w-[120px] max-w-[250px] ${
                      sortConfig.key === index + 1 ? 'bg-indigo-800' : ''
                    }`}
                  onClick={() => requestSort(index + 1)}
                  onMouseEnter={() => setHoveredHeader(index + 1)}
                  onMouseLeave={() => setHoveredHeader(null)}
                >
                  <div className="flex items-center space-x-1">
                    <span className="break-words" title={column}>{column}</span>
                    {sortConfig.key === index + 1 && (
                      <span>
                        {sortConfig.direction === 'ascending' ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                  {hoveredHeader === index + 1 && (
                    <div className="absolute right-0 top-0 h-full flex items-center pr-2">
                      <button
                        className="text-white hover:text-gray-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          requestSort(index + 1);
                        }}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                      </button>
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedRows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`} className={`hover:bg-indigo-50 ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-100'}`}>
                {header.map((column, cellIndex) => {
                  // Use the direct cellIndex since we're not skipping the first column
                  const actualCellIndex = cellIndex;
                  
                  // Kiểm tra nếu là cell được merge và không phải cell chính
                  const mergeInfo = getMergeInfo(rowIndex, actualCellIndex, sheetDetail);
                  
                  if (mergeInfo && !mergeInfo.isMainCell) {
                    return null; // Không render các cell bị merge không phải cell chính
                  }
                  
                  // Lấy nội dung cell
                  let cellContent;
                  
                  // Trường hợp rows có processedData
                  if (row.processedData && `col${actualCellIndex}` in row.processedData) {
                    cellContent = row.processedData[`col${actualCellIndex}`];
                  } 
                  // Trường hợp row là đối tượng và có thuộc tính đúng với tên cột
                  else if (column in row) {
                    cellContent = row[column];
                  } 
                  // Trường hợp row là mảng (tương thích với dữ liệu cũ)
                  else if (Array.isArray(row) && actualCellIndex < row.length) {
                    cellContent = row[actualCellIndex];
                  }
                  
                  // Lấy hyperlink từ nhiều nguồn dữ liệu khác nhau
                  const hyperlink = getHyperlinkFromValues(
                    rowIndex, 
                    actualCellIndex, 
                    sheetDetail.values, 
                    sheetDetail.htmlData, 
                    sheetDetail.rows, 
                    sheetDetail.header, 
                    sheetDetail.hyperlinks
                  );
                  
                  return (
                    <td
                      key={`cell-${rowIndex}-${cellIndex}`}
                      className="px-4 py-4 text-sm text-gray-500 min-w-[120px] max-w-[250px]"
                      {...(mergeInfo ? {
                        rowSpan: mergeInfo.rowSpan,
                        colSpan: mergeInfo.colSpan
                      } : {})}
                    >
                      <div className="break-words" title={typeof cellContent === 'string' ? cellContent : ''}>
                        {renderCellContent(cellContent, rowIndex, actualCellIndex, sheetDetail)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    );
  };

  // Hàm lấy hyperlink từ values và htmlData
  const getHyperlinkFromValues = (rowIndex, cellIndex, values, htmlData, rows, header, hyperlinks) => {
    // Kiểm tra trong cấu trúc hyperlinks mới
    if (Array.isArray(hyperlinks)) {
      const hyperlink = hyperlinks.find(link => link.row === rowIndex && link.col === cellIndex);
      if (hyperlink) {
        return hyperlink.url;
      }
    }
    
    // Kiểm tra trong rows với _hyperlinks
    if (Array.isArray(rows) && rowIndex < rows.length && Array.isArray(header) && cellIndex < header.length) {
      const row = rows[rowIndex];
      const columnName = header[cellIndex];
      
      if (row && row._hyperlinks && columnName && row._hyperlinks[columnName]) {
        return row._hyperlinks[columnName];
      }
      
      // Kiểm tra trong processedData.urls nếu có
      if (row && row.processedData && Array.isArray(row.processedData.urls)) {
        const urlData = row.processedData.urls.find(url => url.colIndex === cellIndex);
        if (urlData && urlData.url) {
          return urlData.url;
        }
      }
    }
    
    // Kiểm tra trong values
    if (Array.isArray(values) && values.length > rowIndex + 1) {
      // +1 vì dòng đầu tiên là header
      const row = values[rowIndex + 1];
      if (row && row.length > cellIndex) {
        const cellValue = row[cellIndex];
        
        // Kiểm tra nếu cell có dạng URL
        if (typeof cellValue === 'string' && (
          cellValue.startsWith('http') || 
          cellValue.startsWith('www.') ||
          cellValue.includes('youtube.com') ||
          cellValue.includes('youtu.be') ||
          cellValue.includes('drive.google.com')
        )) {
          return cellValue;
        }
      }
    }
    
    // Kiểm tra trong htmlData nếu có
    if (Array.isArray(htmlData)) {
      // Kiểm tra cả hai cấu trúc có thể có của htmlData
      
      // Cấu trúc 1: htmlData là mảng các mảng
      if (htmlData.length > rowIndex + 1) {  // +1 vì có thể bao gồm header
        const htmlRow = htmlData[rowIndex + 1];
        
        // Kiểm tra nếu htmlRow là mảng trực tiếp
        if (Array.isArray(htmlRow) && htmlRow.length > cellIndex) {
          const htmlCell = htmlRow[cellIndex];
          if (htmlCell && htmlCell.hyperlink) {
            return htmlCell.hyperlink;
          }
        }
        // Kiểm tra nếu htmlRow có cấu trúc {values: [...]}
        else if (htmlRow && htmlRow.values && Array.isArray(htmlRow.values) && htmlRow.values.length > cellIndex) {
          const htmlCell = htmlRow.values[cellIndex];
          if (htmlCell && htmlCell.hyperlink) {
            return htmlCell.hyperlink;
          }
        }
      }
    }
    
    // Trích xuất URL từ nội dung cell (nếu có)
    if (Array.isArray(values) && values.length > rowIndex + 1) {
      const row = values[rowIndex + 1];
      if (row && row.length > cellIndex) {
        const cellValue = row[cellIndex];
        
        // Nếu có nội dung, thử trích xuất URL hoặc YouTube ID
        if (cellValue) {
          // Kiểm tra nếu là cột CHƯƠNG và có thể là ID video
          const columnName = header?.[cellIndex];
          if (columnName === "CHƯƠNG") {
            // Nếu là số và có độ dài 11 ký tự (có thể là YouTube ID)
            if (typeof cellValue === 'string' && /^\d+$/.test(cellValue) && cellValue.length === 11) {
              const youtubeUrl = `https://www.youtube.com/watch?v=${cellValue}`;
              return youtubeUrl;
            }
            
            // Thử trích xuất URL từ nội dung
            const extractedUrl = extractRealUrl(cellValue);
            if (extractedUrl) {
              return extractedUrl;
            }
          }
        }
      }
    }
    
    return null;
  };

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden relative">
      {/* Add styles for animation */}
      <style dangerouslySetInnerHTML={{ __html: toastAnimationStyles }} />
      
      {/* Toast notification */}
      {showToast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center p-4 mb-4 text-gray-800 bg-white rounded-lg shadow-lg border-l-4 border-indigo-600 ${toastAnimation} max-w-md`}>
          <div className="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 text-indigo-500 bg-indigo-100 rounded-lg">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path>
            </svg>
          </div>
          <div className="ml-3 text-sm font-medium">
            Bạn có thể kéo sang phải để xem đầy đủ dữ liệu. Nhấn vào tiêu đề cột để sắp xếp dữ liệu.
          </div>
          <button 
            type="button" 
            onClick={() => {
              setToastAnimation('animate-fade-out-up');
              setTimeout(() => setShowToast(false), 500);
            }}
            className="ml-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex h-8 w-8"
          >
            <span className="sr-only">Đóng</span>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
            </svg>
          </button>
        </div>
      )}
      
      {/* Sheet selector */}
      {apiSheetData?.sheets && apiSheetData.sheets.length > 0 && (
        <div className="border-b border-gray-200">
          <div className="px-4 sm:px-6 py-4">
        <div className="flex flex-wrap gap-2">
            {apiSheetData.sheets.map((sheet, index) => (
              <button
                  key={sheet._id}
                onClick={() => setActiveApiSheet(index)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                    index === activeApiSheet
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {sheet.name || `Sheet ${index + 1}`}
              </button>
            ))}
            </div>
          </div>
        </div>
      )}

      {/* Sheet content */}
      <div className="px-4 sm:px-6 py-4">
        {loadingApiSheet ? (
          <div className="flex justify-center items-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600 mb-2 mr-3"></div>
            <p className="text-gray-600">Đang tải dữ liệu sheet...</p>
          </div>
        ) : apiSheetError ? (
          <div className="bg-red-50 p-4 rounded-md">
            <p className="text-red-700 font-medium mb-2">Lỗi khi tải dữ liệu</p>
            <p className="text-red-600 mb-4">{apiSheetError}</p>
            <button 
              onClick={() => fetchApiSheetData()}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
            >
              <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Thử lại
            </button>
                  </div>
        ) : (
          <>
            {/* Sheet data */}
            {apiSheetData?.sheets && apiSheetData.sheets[activeApiSheet]?.detail ? (
              <>
                {/* Sheet title and actions */}
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {apiSheetData.sheets[activeApiSheet].name || apiSheetData.sheets[activeApiSheet].detail?.name || `Sheet ${activeApiSheet + 1}`}
                  </h3>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => fetchSheetDetail(apiSheetData.sheets[activeApiSheet]._id)}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Làm mới
                    </button>
                  </div>
                </div>

                {/* Sheet data table */}
                {renderTable(apiSheetData.sheets[activeApiSheet].detail)}

                {/* Modals */}
                {selectedVideo && (
                  <YouTubeModal
                    isOpen={true}
                    videoId={selectedVideo}
                    onClose={() => setSelectedVideo(null)}
                  />
                )}
                {selectedPlaylist && (
                  <YouTubePlaylistModal
                    isOpen={true}
                    playlistId={selectedPlaylist}
                    videoId={selectedPlaylistVideo}
                    onClose={() => {
                      setSelectedPlaylist(null);
                      setSelectedPlaylistVideo(null);
                    }}
                    title="Danh sách phát YouTube"
                  />
                )}
                {selectedPDF && (
                  <PDFModal
                    isOpen={true}
                    url={selectedPDF}
                    title={pdfTitle}
                    onClose={() => setSelectedPDF(null)}
                  />
                )}
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Không có dữ liệu để hiển thị
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 