import { useState, useEffect, useCallback } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import YouTubeModal from './YouTubeModal';
import PDFModal from './PDFModal';

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
  const [selectedPDF, setSelectedPDF] = useState(null);
  const [pdfTitle, setPdfTitle] = useState('');
  const [loadingLinks, setLoadingLinks] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [hoveredHeader, setHoveredHeader] = useState(null);
  
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
      console.error('Lỗi khi tạo proxy link:', error);
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
      console.error('Lỗi khi giải mã proxy link:', error);
      return null;
    }
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
    return url.includes('youtube.com') || url.includes('youtu.be');
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
    const watchMatch = url.match(/(?:\?v=|&v=|youtu\.be\/|\/v\/|\/embed\/)([^&\n?#]+)/);
    if (watchMatch) {
      videoId = watchMatch[1];
    }
    
    return videoId;
  };

  const handleYoutubeClick = (e, url) => {
    e.preventDefault();
    const videoId = getYoutubeVideoId(url);
    if (videoId) {
      setSelectedVideo(videoId);
    } else {
      // Nếu không lấy được video ID, mở link trong tab mới
      window.open(url, '_blank');
    }
  };

  const handlePdfClick = (e, url, title = '') => {
    e.preventDefault();
    setSelectedPDF(url);
    setPdfTitle(title);
  };

  // Handle general link click with proxy link creation
  const handleLinkClick = (e, url, title = '') => {
    e.preventDefault();
    
    // Đánh dấu link đang loading
    setLoadingLinks(prev => ({ ...prev, [url]: true }));
    
    // Kiểm tra nếu là proxy link, giải mã để xác định loại
    if (url.startsWith('/api/proxy-link/')) {
      const originalUrl = decodeProxyLink(url);
      
      // Nếu giải mã thành công và là YouTube link
      if (originalUrl && isYoutubeLink(originalUrl)) {
        // Xử lý như YouTube link
        const videoId = getYoutubeVideoId(originalUrl);
        if (videoId) {
          setSelectedVideo(videoId);
          setTimeout(() => {
            setLoadingLinks(prev => ({ ...prev, [url]: false }));
          }, 500);
          return;
        }
      }
      
      // Nếu giải mã thành công và là PDF
      if (originalUrl && isPdfLink(originalUrl)) {
        handlePdfClick(e, url, title || 'Xem tài liệu PDF');
        setTimeout(() => {
          setLoadingLinks(prev => ({ ...prev, [url]: false }));
        }, 500);
        return;
      }
      
      // Nếu giải mã thành công và là Google Drive
      if (originalUrl && isGoogleDriveLink(originalUrl)) {
        // Mở Google Drive trong tab mới
        window.open(originalUrl, '_blank');
        setTimeout(() => {
          setLoadingLinks(prev => ({ ...prev, [url]: false }));
        }, 500);
        return;
      }
      
      // Nếu không phải YouTube hoặc PDF, hiển thị trong PDF Modal
      handlePdfClick(e, url, title || 'Xem tài liệu');
      setTimeout(() => {
        setLoadingLinks(prev => ({ ...prev, [url]: false }));
      }, 500);
      return;
    }
    
    // Handle special links directly
    if (isYoutubeLink(url)) {
      // Xử lý YouTube thông thường
      handleYoutubeClick(e, url);
      
      // Đánh dấu link đã xong loading
      setTimeout(() => {
        setLoadingLinks(prev => ({ ...prev, [url]: false }));
      }, 500);
      return;
    } 
    
    if (isPdfLink(url)) {
      handlePdfClick(e, url, title);
      // Đánh dấu link đã xong loading
      setTimeout(() => {
        setLoadingLinks(prev => ({ ...prev, [url]: false }));
      }, 500);
      return;
    }
    
    if (isGoogleDriveLink(url)) {
      // Mở Google Drive trong tab mới
      window.open(url, '_blank');
      // Đánh dấu link đã xong loading
      setTimeout(() => {
        setLoadingLinks(prev => ({ ...prev, [url]: false }));
      }, 500);
      return;
    }
    
    // Tạo proxy URL bằng base64 cho các link khác
    const proxyUrl = createProxyLink(url);
    if (proxyUrl) {
      // Hiển thị trong PDF Modal thay vì mở tab mới
      handlePdfClick(e, proxyUrl, title || 'Xem tài liệu');
    } else {
      // Fallback to original URL if proxy creation failed
      console.warn('Không thể tạo proxy link, mở URL gốc:', url);
      handlePdfClick(e, url, title || 'Xem tài liệu');
    }
    
    // Đánh dấu link đã xong loading
    setTimeout(() => {
      setLoadingLinks(prev => ({ ...prev, [url]: false }));
    }, 500);
  };
  
  // Hàm xử lý hyperlink trong table rendering
  const renderHyperlinkCell = (hyperlink, cellContent, rowIndex, cellIndex) => {
    const key = `${rowIndex}-${cellIndex}`;
    const content = cellContent || hyperlink;
    const isLoading = loadingLinks[hyperlink];
    
    // Hiển thị domain hoặc text thay vì URL đầy đủ
    let displayText = content;
    if (displayText === hyperlink) {
      // Kiểm tra xem đã là proxy URL hoặc domain chưa
      if (hyperlink.startsWith('/api/proxy-link/') || hyperlink.includes('/...')) {
        displayText = 'Secure Link';
      } else {
        try {
          const urlObj = new URL(hyperlink);
          displayText = urlObj.hostname + (hyperlink.length > 30 ? '...' : '');
        } catch (e) {
          displayText = displayText.substring(0, 30) + (displayText.length > 30 ? '...' : '');
        }
      }
    }
    
    // Determine link type for icon
    let linkIcon = null;
    if (isYoutubeLink(hyperlink) || (hyperlink.startsWith('/api/proxy-link/') && isYoutubeLink(decodeProxyLink(hyperlink)))) {
      linkIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
        </svg>
      );
    } else if (isPdfLink(hyperlink) || (hyperlink.startsWith('/api/proxy-link/') && isPdfLink(decodeProxyLink(hyperlink)))) {
      linkIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8.267 14.68c-.184 0-.308.018-.372.036v1.178c.076.018.171.023.302.023.479 0 .774-.242.774-.651 0-.366-.254-.586-.704-.586zm3.487.012c-.2 0-.33.018-.407.036v2.61c.077.018.201.018.313.018.817.006 1.349-.444 1.349-1.396.006-.83-.479-1.268-1.255-1.268z"/>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM9.498 16.19c-.309.29-.765.42-1.296.42a2.23 2.23 0 0 1-.308-.018v1.426H7v-3.936A7.558 7.558 0 0 1 8.219 14c.557 0 .953.106 1.22.319.254.202.426.533.426.923-.001.392-.131.723-.367.948zm3.807 1.355c-.42.349-1.059.515-1.84.515-.468 0-.799-.03-1.024-.06v-3.917A7.947 7.947 0 0 1 11.66 14c.757 0 1.249.136 1.633.426.415.308.675.799.675 1.504 0 .763-.279 1.29-.663 1.615zM17 14.77h-1.532v.911H16.9v.734h-1.432v1.604h-.906V14.03H17v.74zM14 9h-1V4l5 5h-4z"/>
        </svg>
      );
    } else if (isGoogleDriveLink(hyperlink) || (hyperlink.startsWith('/api/proxy-link/') && isGoogleDriveLink(decodeProxyLink(hyperlink)))) {
      linkIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M4.433 22l-2.933-5h17l2.933 5z"/>
          <path fill="#0F9D58" d="M15.5 7l-8 14h16l-8-14z"/>
          <path fill="#FFCD32" d="M8.5 2l-6.5 10 6.5 10 6.5-10z"/>
        </svg>
      );
    } else {
      linkIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      );
    }
    
    // For Google Drive links, open in new tab
    if (isGoogleDriveLink(hyperlink) || (hyperlink.startsWith('/api/proxy-link/') && isGoogleDriveLink(decodeProxyLink(hyperlink)))) {
      const finalUrl = hyperlink.startsWith('/api/proxy-link/') ? decodeProxyLink(hyperlink) : hyperlink;
      
      return (
        <td key={cellIndex} className="px-6 py-4 whitespace-normal break-words border-b border-gray-50 border-r-2 border-gray-400 last:border-r-0 group-hover:bg-blue-50/80 transition-colors duration-150">
          <div className="flex items-center">
            <div className="flex-shrink-0 mr-2">
              {linkIcon}
            </div>
            <div>
              <a 
                href={finalUrl}
                className="text-blue-600 hover:text-blue-800 text-base font-medium transition-colors duration-200"
                onClick={(e) => {
                  e.preventDefault();
                  window.open(finalUrl, '_blank');
                  // Đánh dấu link đã xong loading
                  setTimeout(() => {
                    setLoadingLinks(prev => ({ ...prev, [hyperlink]: false }));
                  }, 500);
                }}
                target="_blank"
                rel="noopener noreferrer"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <span>{displayText}</span>
                    <span className="inline-block ml-2">
                      <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </span>
                  </div>
                ) : (
                  <div className="relative group">
                    <span className="group-hover:border-b border-blue-600">{displayText}</span>
                    <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300"></span>
                  </div>
                )}
              </a>
            </div>
          </div>
        </td>
      );
    }
    
    return (
      <td key={cellIndex} className="px-6 py-4 whitespace-normal break-words border-b border-gray-50 border-r-2 border-gray-400 last:border-r-0 group-hover:bg-blue-50/80 transition-colors duration-150">
        <div className="flex items-center">
          <div className="flex-shrink-0 mr-2">
            {linkIcon}
          </div>
          <div>
            <a 
              href="#" 
              className={`text-blue-600 hover:text-blue-800 text-base font-medium transition-colors duration-200 ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
              onClick={(e) => handleLinkClick(e, hyperlink, content)}
            >
              {isLoading ? (
                <div className="flex items-center">
                  <span>{displayText}</span>
                  <span className="inline-block ml-2">
                    <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </span>
                </div>
              ) : (
                <div className="relative group">
                  <span className="group-hover:border-b border-blue-600">{displayText}</span>
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300"></span>
                </div>
              )}
            </a>
          </div>
        </div>
      </td>
    );
  };

  // Hàm xử lý nội dung cell để phát hiện và chuyển đổi URL thành liên kết
  const renderCellContent = (content) => {
    if (!content) return '';
    
    // Kiểm tra công thức HYPERLINK từ Google Sheets
    const hyperlinkRegex = /=HYPERLINK\("([^"]+)"(?:,\s*"([^"]+)")?\)/i;
    const hyperlinkMatch = typeof content === 'string' ? content.match(hyperlinkRegex) : null;
    
    if (hyperlinkMatch) {
      let url = hyperlinkMatch[1];
      const displayText = hyperlinkMatch[2] || url;
      
      // Determine link type for icon
      let linkIcon = null;
      if (isYoutubeLink(url)) {
        linkIcon = (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
          </svg>
        );
      } else if (isPdfLink(url)) {
        linkIcon = (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8.267 14.68c-.184 0-.308.018-.372.036v1.178c.076.018.171.023.302.023.479 0 .774-.242.774-.651 0-.366-.254-.586-.704-.586zm3.487.012c-.2 0-.33.018-.407.036v2.61c.077.018.201.018.313.018.817.006 1.349-.444 1.349-1.396.006-.83-.479-1.268-1.255-1.268z"/>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM9.498 16.19c-.309.29-.765.42-1.296.42a2.23 2.23 0 0 1-.308-.018v1.426H7v-3.936A7.558 7.558 0 0 1 8.219 14c.557 0 .953.106 1.22.319.254.202.426.533.426.923-.001.392-.131.723-.367.948zm3.807 1.355c-.42.349-1.059.515-1.84.515-.468 0-.799-.03-1.024-.06v-3.917A7.947 7.947 0 0 1 11.66 14c.757 0 1.249.136 1.633.426.415.308.675.799.675 1.504 0 .763-.279 1.29-.663 1.615zM17 14.77h-1.532v.911H16.9v.734h-1.432v1.604h-.906V14.03H17v.74zM14 9h-1V4l5 5h-4z"/>
          </svg>
        );
      } else {
        linkIcon = (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        );
      }
      
      // For Google Drive links, use window.open directly
      if (isGoogleDriveLink(url)) {
        return (
          <div className="flex items-center">
            {linkIcon}
            <a 
              href={url}
              onClick={(e) => {
                e.preventDefault();
                window.open(url, '_blank');
              }}
              className="text-blue-600 hover:text-blue-800 text-base font-medium transition-colors duration-200"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="relative group">
                <span className="group-hover:border-b border-blue-600">{displayText}</span>
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300"></span>
              </div>
            </a>
          </div>
        );
      }
      
      return (
        <div className="flex items-center">
          {linkIcon}
          <a 
            href="#" 
            onClick={(e) => handleLinkClick(e, url, displayText)}
            className="text-blue-600 hover:text-blue-800 text-base font-medium transition-colors duration-200"
          >
            <div className="relative group">
              <span className="group-hover:border-b border-blue-600">{displayText}</span>
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300"></span>
            </div>
          </a>
        </div>
      );
    }
    
    // Kiểm tra xem nội dung có phải là URL không
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    // Nếu nội dung chỉ chứa URL
    if (typeof content === 'string' && urlRegex.test(content) && content.trim().match(urlRegex)[0] === content.trim()) {
      // Hiển thị domain thay vì URL đầy đủ
      let displayUrl = '';
      try {
        const urlObj = new URL(content);
        displayUrl = urlObj.hostname + (content.length > 30 ? '...' : '');
      } catch (e) {
        displayUrl = content.substring(0, 30) + (content.length > 30 ? '...' : '');
      }
      
      // Determine link type for icon
      let linkIcon = null;
      if (isYoutubeLink(content)) {
        linkIcon = (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
          </svg>
        );
      } else if (isPdfLink(content)) {
        linkIcon = (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8.267 14.68c-.184 0-.308.018-.372.036v1.178c.076.018.171.023.302.023.479 0 .774-.242.774-.651 0-.366-.254-.586-.704-.586zm3.487.012c-.2 0-.33.018-.407.036v2.61c.077.018.201.018.313.018.817.006 1.349-.444 1.349-1.396.006-.83-.479-1.268-1.255-1.268z"/>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM9.498 16.19c-.309.29-.765.42-1.296.42a2.23 2.23 0 0 1-.308-.018v1.426H7v-3.936A7.558 7.558 0 0 1 8.219 14c.557 0 .953.106 1.22.319.254.202.426.533.426.923-.001.392-.131.723-.367.948zm3.807 1.355c-.42.349-1.059.515-1.84.515-.468 0-.799-.03-1.024-.06v-3.917A7.947 7.947 0 0 1 11.66 14c.757 0 1.249.136 1.633.426.415.308.675.799.675 1.504 0 .763-.279 1.29-.663 1.615zM17 14.77h-1.532v.911H16.9v.734h-1.432v1.604h-.906V14.03H17v.74zM14 9h-1V4l5 5h-4z"/>
          </svg>
        );
      } else {
        linkIcon = (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        );
      }
      
      // For Google Drive links, use window.open directly
      if (isGoogleDriveLink(content)) {
        return (
          <div className="flex items-center">
            {linkIcon}
            <a 
              href={content}
              onClick={(e) => {
                e.preventDefault();
                window.open(content, '_blank');
              }}
              className="text-blue-600 hover:text-blue-800 text-base font-medium transition-colors duration-200"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="relative group">
                <span className="group-hover:border-b border-blue-600">{displayUrl}</span>
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300"></span>
              </div>
            </a>
          </div>
        );
      }
      
      return (
        <div className="flex items-center">
          {linkIcon}
          <a 
            href="#" 
            onClick={(e) => handleLinkClick(e, content)}
            className="text-blue-600 hover:text-blue-800 text-base font-medium transition-colors duration-200"
          >
            <div className="relative group">
              <span className="group-hover:border-b border-blue-600">{displayUrl}</span>
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300"></span>
            </div>
          </a>
        </div>
      );
    }
    
    // Format numbers with commas if it's a number
    if (typeof content === 'string' && !isNaN(content) && content.trim() !== '') {
      try {
        const num = parseFloat(content);
        if (!isNaN(num)) {
          // If it's a whole number
          if (Number.isInteger(num)) {
            return <span className="text-base font-medium">{num.toLocaleString()}</span>;
          } else {
            // If it has decimal places
            return <span className="text-base font-medium">{num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
          }
        }
      } catch (e) {
        // If parsing fails, just return the content
      }
    }
    
    // Check if content might be a date
    if (typeof content === 'string' && content.match(/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/)) {
      return <span className="text-base font-medium text-purple-700">{content}</span>;
    }
    
    // For percentage values
    if (typeof content === 'string' && content.endsWith('%')) {
      return <span className="text-base font-medium text-green-700">{content}</span>;
    }
    
    // For regular text content
    return <span className="text-base">{content}</span>;
  };

  // Không cần kiểm tra lỗi và trạng thái loading vì đã được xử lý ở component cha
  if (!apiSheetData || !apiSheetData.sheets || apiSheetData.sheets.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-medium text-gray-900">Dữ liệu khóa học</h3>
        </div>
        <div className="text-center p-8">
          <div className="inline-block p-4 rounded-full bg-gray-100 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Không có dữ liệu khóa học</h3>
          <p className="text-gray-600 max-w-md mx-auto mb-4">
            Khóa học này chưa có sheets nào được liên kết.
          </p>
          <button
            onClick={fetchApiSheetData}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Làm mới dữ liệu
          </button>
        </div>
      </div>
    );
  }

  // Lấy sheet đang active
  const currentSheet = apiSheetData.sheets[activeApiSheet];
  
  // Kiểm tra xem currentSheet có tồn tại không
  if (!currentSheet) {
    return (
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-medium text-gray-900">Dữ liệu khóa học</h3>
        </div>
        <div className="p-6 text-center">
          <div className="bg-yellow-50 p-4 rounded-lg inline-block">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-yellow-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-yellow-800 mb-2 font-medium">Không tìm thấy dữ liệu</p>
            <p className="text-yellow-700 mb-4">Không tìm thấy sheet đang chọn (index: {activeApiSheet})</p>
            <button
              onClick={fetchApiSheetData}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700"
            >
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              Làm mới dữ liệu
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  const sheetDetail = currentSheet?.detail;
  
  // Sorting function
  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  // Get sorted data
  const getSortedData = (data) => {
    if (!data || !sortConfig.key) {
      return data;
    }
    
    const sortableData = [...data];
    const headerRow = sortableData[0]; // Save header row
    const dataRows = sortableData.slice(1); // Get only data rows
    
    const sortedDataRows = dataRows.sort((a, b) => {
      const columnIndex = headerRow.findIndex((col, idx) => idx === sortConfig.key);
      if (columnIndex === -1) return 0;
      
      const aValue = a[columnIndex];
      const bValue = b[columnIndex];
      
      // Check if values are numbers
      const aNum = parseFloat(aValue);
      const bNum = parseFloat(bValue);
      
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === 'ascending' ? aNum - bNum : bNum - aNum;
      }
      
      // Otherwise sort as strings
      if (aValue < bValue) {
        return sortConfig.direction === 'ascending' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'ascending' ? 1 : -1;
      }
      return 0;
    });
    
    return [headerRow, ...sortedDataRows];
  };

  // Kiểm tra chi tiết sheet
  if (!sheetDetail) {
    return (
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h3 className="text-lg font-medium text-gray-900">Dữ liệu khóa học</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => fetchSheetDetail(currentSheet._id)}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200"
            >
              <ArrowPathIcon className="h-4 w-4 mr-1" />
              Tải dữ liệu
            </button>
          </div>
        </div>
        
        <div className="p-8 text-center">
          <div className="inline-block p-4 rounded-full bg-yellow-100 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có dữ liệu chi tiết</h3>
          <p className="text-gray-600 max-w-md mx-auto mb-4">
            Đã tìm thấy sheet <strong>{currentSheet.name}</strong> nhưng chưa tải được dữ liệu chi tiết.
          </p>
          <button
            onClick={() => fetchSheetDetail(currentSheet._id)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-500 hover:bg-yellow-600"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Tải dữ liệu chi tiết
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      {/* YouTube Modal */}
      <YouTubeModal
        isOpen={!!selectedVideo}
        videoId={selectedVideo}
        onClose={() => setSelectedVideo(null)}
      />
      
      {/* PDF Modal */}
      <PDFModal
        isOpen={!!selectedPDF}
        fileUrl={selectedPDF}
        title={pdfTitle}
        onClose={() => setSelectedPDF(null)}
      />
      
      <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h3 className="text-lg font-medium text-gray-900">Dữ liệu khóa học</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={fetchApiSheetData}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200"
          >
            <ArrowPathIcon className="h-4 w-4 mr-1" />
            Làm mới dữ liệu
          </button>
        </div>
      </div>

      {/* Chọn khóa học khi có nhiều sheet */}
      {apiSheetData.sheets.length > 1 && (
        <div className="border-b border-gray-200 px-4 sm:px-6 py-4 bg-gray-50">
          <h3 className="text-base font-medium text-gray-800 mb-3">Chọn sheet:</h3>
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-2">
            {apiSheetData.sheets.map((sheet, index) => (
              <button
                key={index}
                onClick={() => setActiveApiSheet(index)}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap
                  ${activeApiSheet === index 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                <div className="flex items-center">
                  <span>{sheet.name}</span>
                  {sheet.detail?.data?.values && (
                    <span className={`text-xs ml-2 px-2 py-0.5 rounded-full ${
                      activeApiSheet === index ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {(sheet.detail.data.values.length - 1) || 0}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hiển thị thông tin sheet hiện tại */}
      <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2">
        <div className="font-medium text-gray-800 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {currentSheet.name}
        </div>
        <div className="flex items-center gap-2">
          {sheetDetail?.data?.values && (
            <div className="text-sm text-gray-600">
              {sheetDetail.data.values.length - 1} dòng dữ liệu
            </div>
          )}
        </div>
      </div>

      {/* Hiển thị dữ liệu sheet */}
      <div className="px-4 sm:px-6 py-4">
        {sheetDetail?.data?.values && sheetDetail.data.values.length > 0 ? (
          <div className="overflow-x-auto max-w-full -mx-4 sm:mx-0 px-4 sm:px-0">
                          <div className="inline-block min-w-full align-middle rounded-lg shadow-md">
                <div className="overflow-hidden border-2 border-gray-300 sm:rounded-lg bg-white shadow-md" style={{ boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.05), 0 2px 8px 0 rgba(0, 0, 0, 0.1)' }}>
                                  <table className="min-w-full divide-y divide-gray-200 table-fixed border-collapse border-x border-gray-300" style={{ borderSpacing: 0 }}>
                  <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-gray-300">
                    <tr>
                      {sheetDetail.data.values[0].map((header, index) => (
                        <th 
                          key={index} 
                          className={`group px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider whitespace-normal break-words border-b-2 border-r-2 border-gray-400 last:border-r-0 transition-all duration-200 ${
                            sortConfig.key === index 
                              ? 'text-indigo-900 border-b-indigo-500 bg-indigo-50' 
                              : 'text-indigo-800 border-b-indigo-100 hover:bg-indigo-50/50'
                          }`}
                          style={{ minWidth: '120px' }}
                          onClick={() => requestSort(index)}
                          onMouseEnter={() => setHoveredHeader(index)}
                          onMouseLeave={() => setHoveredHeader(null)}
                        >
                          <div className="flex items-center justify-between cursor-pointer">
                            <span>{header}</span>
                            <div className="flex items-center">
                              {sortConfig.key === index ? (
                                <svg 
                                  xmlns="http://www.w3.org/2000/svg" 
                                  className={`h-4 w-4 text-indigo-800 transition-transform duration-200 ${
                                    sortConfig.direction === 'ascending' ? 'transform rotate-180' : ''
                                  }`} 
                                  fill="none" 
                                  viewBox="0 0 24 24" 
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              ) : (
                                <svg 
                                  xmlns="http://www.w3.org/2000/svg" 
                                  className={`h-4 w-4 text-indigo-300 opacity-0 ${hoveredHeader === index ? 'opacity-100' : ''} transition-opacity duration-200`} 
                                  fill="none" 
                                  viewBox="0 0 24 24" 
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                                </svg>
                              )}
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getSortedData(sheetDetail.data.values).slice(1).map((row, rowIndex) => {
                      // Lấy dữ liệu HTML tương ứng nếu có
                      const htmlRow = sheetDetail.data.htmlData?.[rowIndex + 1]?.values || [];
                      const isEvenRow = rowIndex % 2 === 0;
                      
                      return (
                        <tr 
                          key={rowIndex} 
                          className={`${isEvenRow ? 'bg-white' : 'bg-blue-50/30'} hover:bg-blue-50 hover:shadow-sm transition-all duration-150 ease-in-out group`}
                        >
                          {row.map((cell, cellIndex) => {
                            // Kiểm tra xem có dữ liệu HTML không
                            const htmlCell = htmlRow[cellIndex];
                            const hyperlink = htmlCell?.hyperlink;
                            
                            // Nếu có hyperlink trong dữ liệu HTML
                            if (hyperlink) {
                              return renderHyperlinkCell(hyperlink, cell, rowIndex, cellIndex);
                            }
                            
                            // Xử lý các cell thông thường
                            const key = `${rowIndex}-${cellIndex}`;
                            const cellContent = cell || '';
                            
                            return (
                              <td 
                                key={cellIndex} 
                                className="px-6 py-4 whitespace-normal break-words text-base border-b border-gray-50 border-r-2 border-gray-400 last:border-r-0 group-hover:bg-blue-50/80 transition-colors duration-150"
                              >
                                <div className="text-gray-700 font-medium">
                                  {renderCellContent(cellContent)}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t-2 border-gray-300 sm:px-6">
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Hiển thị <span className="font-medium">{sheetDetail.data.values.length - 1}</span> dòng dữ liệu
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button 
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                      disabled={sortConfig.key === null}
                      onClick={() => setSortConfig({ key: null, direction: 'ascending' })}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Xóa sắp xếp
                    </button>
                    <div className="border-l border-gray-200 h-6"></div>
                    <div className="flex items-center space-x-1">
                      <button className="inline-flex items-center justify-center w-8 h-8 border border-gray-300 rounded-md bg-white text-gray-500 hover:bg-gray-50 transition-colors duration-200">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <span className="px-3 py-1 text-sm text-gray-700">1</span>
                      <button className="inline-flex items-center justify-center w-8 h-8 border border-gray-300 rounded-md bg-white text-gray-500 hover:bg-gray-50 transition-colors duration-200">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-center text-xs text-gray-500 sm:hidden">
                  Vuốt sang trái/phải để xem thêm dữ liệu
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center bg-gray-50 rounded-lg">
            <p className="text-gray-500">Không có dữ liệu để hiển thị.</p>
          </div>
        )}
      </div>
    </div>
  );
} 