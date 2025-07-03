import { useState, useEffect, useCallback } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import YouTubeModal from './YouTubeModal';
import YouTubePlaylistModal from './YouTubePlaylistModal';
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
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [selectedPlaylistVideo, setSelectedPlaylistVideo] = useState(null);
  const [selectedPDF, setSelectedPDF] = useState(null);
  const [pdfTitle, setPdfTitle] = useState('');
  const [loadingLinks, setLoadingLinks] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [hoveredHeader, setHoveredHeader] = useState(null);
  const [processingSheet, setProcessingSheet] = useState(false);
  
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
  
  // Track changes to selectedVideo
  useEffect(() => {
    console.log('selectedVideo state changed:', selectedVideo);
  }, [selectedVideo]);
  
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
      
      // Log thông tin sheet hiện tại
      if (currentSheet) {
        console.log('📑 Thông tin sheet hiện tại:');
        console.log('Sheet ID:', currentSheet._id);
        console.log('Sheet Name:', currentSheet.name || currentSheet.detail?.name || 'Không có tên');
        
        // Kiểm tra và log cấu trúc dữ liệu chi tiết
        if (currentSheet.detail) {
          console.log('Cấu trúc dữ liệu chi tiết:', currentSheet.detail);
          
          // Kiểm tra cấu trúc dữ liệu và log phù hợp
          if (Array.isArray(currentSheet.detail.header) && Array.isArray(currentSheet.detail.rows)) {
            console.log('Header:', currentSheet.detail.header);
            console.log('Rows:', currentSheet.detail.rows);
            console.log('Total Rows:', currentSheet.detail.rows.length);
            console.log('Sheet Name from detail:', currentSheet.detail.name || 'Không có tên trong detail');
          } else if (Array.isArray(currentSheet.detail.values)) {
            console.log('Values:', currentSheet.detail.values);
            console.log('Total Rows:', currentSheet.detail.values.length - 1);
            console.log('Sheet Name from detail:', currentSheet.detail.name || 'Không có tên trong detail');
          }
        }
      }
      
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
    
    // Log để debug
    if (isRegularYoutube) {
      console.log(`Phát hiện YouTube link: ${url}`);
    }
    
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
    
    console.log('Extracting video ID from URL:', url);
    
    // Xử lý các định dạng URL YouTube khác nhau
    let videoId = null;
    
    // Format: https://www.youtube.com/watch?v=VIDEO_ID
    const watchMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/e\/|youtube\.com\/watch\?.*v=|youtube\.com\/attribution_link\?.*v%3D|youtube\.com\/attribution_link\?.*v=|youtube-nocookie\.com\/.*v=|youtube\.com\/shorts\/)([^&\n?#\/]+)/);
    
    if (watchMatch) {
      videoId = watchMatch[1];
      console.log('Found video ID from regex:', videoId);
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
    
    console.log('Extracting playlist ID from URL:', url);
    
    // Xử lý các định dạng URL playlist YouTube khác nhau
    let playlistId = null;
    
    // Format: youtube.com/playlist?list=PLAYLIST_ID
    // hoặc: youtube.com/watch?v=VIDEO_ID&list=PLAYLIST_ID
    const playlistMatch = url.match(/[&?]list=([^&]+)/);
    
    if (playlistMatch) {
      playlistId = playlistMatch[1];
      console.log('Found playlist ID:', playlistId);
    }
    
    return playlistId;
  };

  const handleYoutubeClick = (e, url) => {
    e.preventDefault();
    console.log('Xử lý YouTube click:', url);
    
    // Kiểm tra nếu là playlist
    if (isYoutubePlaylist(url)) {
      const playlistId = getYoutubePlaylistId(url);
      const videoId = getYoutubeVideoId(url);
      console.log('Detected playlist:', playlistId, 'with video:', videoId);
      
      if (playlistId) {
        setSelectedPlaylist(playlistId);
        setSelectedPlaylistVideo(videoId); // Có thể null nếu không có video cụ thể
        return;
      }
    }
    
    // Xử lý video đơn lẻ như cũ
    const videoId = getYoutubeVideoId(url);
    console.log('Extracted YouTube video ID:', videoId);
    
    if (videoId) {
      console.log('Đã tìm thấy video ID:', videoId);
      setSelectedVideo(videoId);
      console.log('Set selectedVideo state to:', videoId);
    } else {
      console.log('Không tìm thấy video ID, mở URL trong tab mới');
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
    console.log('Xử lý link click:', url, 'title:', title);
    
    // Đánh dấu link đang loading
    setLoadingLinks(prev => ({ ...prev, [url]: true }));
    
    // Kiểm tra nếu là YouTube link
    if (isYoutubeLink(url)) {
      console.log('Phát hiện YouTube link, xử lý với handleYoutubeClick');
      handleYoutubeClick(e, url);
      setTimeout(() => {
        setLoadingLinks(prev => ({ ...prev, [url]: false }));
      }, 500);
      return;
    }
    
    // Kiểm tra nếu là proxy link, giải mã để xác định loại
    if (url.startsWith('/api/proxy-link/')) {
      const originalUrl = decodeProxyLink(url);
      console.log('Decoded proxy link:', originalUrl);
      
      // Nếu giải mã thành công và là YouTube link
      if (originalUrl && isYoutubeLink(originalUrl)) {
        // Xử lý như YouTube link
        console.log('Phát hiện YouTube link từ proxy, xử lý với handleYoutubeClick');
        handleYoutubeClick(e, originalUrl);
        setTimeout(() => {
          setLoadingLinks(prev => ({ ...prev, [url]: false }));
        }, 500);
        return;
      }
      
      // Nếu giải mã thành công và là PDF
      if (originalUrl && isPdfLink(originalUrl)) {
        console.log('Phát hiện PDF link từ proxy');
        handlePdfClick(e, url, title || 'Xem tài liệu PDF');
        setTimeout(() => {
          setLoadingLinks(prev => ({ ...prev, [url]: false }));
        }, 500);
        return;
      }
      
      // Nếu giải mã thành công và là Google Drive
      if (originalUrl && isGoogleDriveLink(originalUrl)) {
        // Mở Google Drive trong tab mới
        console.log('Phát hiện Google Drive link từ proxy');
        window.open(originalUrl, '_blank');
        setTimeout(() => {
          setLoadingLinks(prev => ({ ...prev, [url]: false }));
        }, 500);
        return;
      }
      
      // Nếu không phải YouTube hoặc PDF, hiển thị trong PDF Modal
      console.log('Link không được nhận dạng, xử lý như tài liệu chung');
      handlePdfClick(e, url, title || 'Xem tài liệu');
      setTimeout(() => {
        setLoadingLinks(prev => ({ ...prev, [url]: false }));
      }, 500);
      return;
    }
    
    // Xử lý các loại link khác
    if (isPdfLink(url)) {
      console.log('Phát hiện PDF link');
      handlePdfClick(e, url, title);
    } else if (isGoogleDriveLink(url)) {
      console.log('Phát hiện Google Drive link');
      window.open(url, '_blank');
    } else {
      // Tạo proxy URL bằng base64 cho các link khác
      const proxyUrl = createProxyLink(url);
      if (proxyUrl) {
        console.log('Tạo proxy link thành công:', proxyUrl);
        handlePdfClick(e, proxyUrl, title || 'Xem tài liệu');
      } else {
        console.warn('Không thể tạo proxy link, mở URL gốc:', url);
        handlePdfClick(e, url, title || 'Xem tài liệu');
      }
    }
    
    // Đánh dấu link đã xong loading
    setTimeout(() => {
      setLoadingLinks(prev => ({ ...prev, [url]: false }));
    }, 500);
  };
  
  // Hàm lấy hyperlink từ dữ liệu
  const getHyperlink = (rowIndex, cellIndex, data) => {
    if (!data) return null;
    
    // Kiểm tra nếu có hyperlinks trong cấu trúc mới
    if (Array.isArray(data.hyperlinks)) {
      const hyperlink = data.hyperlinks.find(link => link.row === rowIndex && link.col === cellIndex);
      if (hyperlink) return hyperlink.url;
    }
    
    // Kiểm tra nếu có cấu trúc rows với _hyperlinks
    if (Array.isArray(data.rows) && rowIndex < data.rows.length) {
      const row = data.rows[rowIndex];
      if (row && row._hyperlinks && Array.isArray(data.header) && cellIndex < data.header.length) {
        const columnName = data.header[cellIndex];
        if (columnName && row._hyperlinks[columnName]) {
          return row._hyperlinks[columnName];
        }
      }
      
      // Kiểm tra nếu có processedData.urls
      if (row && row.processedData && Array.isArray(row.processedData.urls)) {
        const urlData = row.processedData.urls.find(url => url.colIndex === cellIndex);
        if (urlData && urlData.url) {
          return urlData.url;
        }
      }
    }
    
    // Kiểm tra nếu có htmlData (cho khả năng tương thích ngược)
    if (data.htmlData && Array.isArray(data.htmlData) && data.htmlData.length > rowIndex) {
      const htmlRow = data.htmlData[rowIndex];
      if (htmlRow && htmlRow.values && htmlRow.values.length > cellIndex) {
        const htmlCell = htmlRow.values[cellIndex];
        if (htmlCell && htmlCell.hyperlink) {
          return htmlCell.hyperlink;
        }
      }
    }
    
    return null;
  };

  // Trích xuất URL thực từ nội dung cell
  const extractRealUrl = (content) => {
    if (!content) return null;
    
    // Nếu content là chuỗi và chứa URL
    if (typeof content === 'string') {
      // Tìm các URL phổ biến
      const urlPattern = /(https?:\/\/[^\s]+)/gi;
      const matches = content.match(urlPattern);
      
      if (matches && matches.length > 0) {
        console.log('Trích xuất được URL từ nội dung:', matches[0]);
        return matches[0];
      }
      
      // Tìm ID YouTube từ các định dạng phổ biến
      const ytIdPatterns = [
        /youtube\.com.*[?&]v=([^&]+)/i,  // youtube.com?v=ID
        /youtu\.be\/([^?&]+)/i,          // youtu.be/ID
        /youtube\.com\/embed\/([^?&]+)/i // youtube.com/embed/ID
      ];
      
      for (const pattern of ytIdPatterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
          const videoId = match[1];
          console.log('Trích xuất được YouTube ID từ nội dung:', videoId);
          return `https://www.youtube.com/watch?v=${videoId}`;
        }
      }
      
      // Tìm số cột nếu có (có thể là số điện thoại hoặc mã số)
      // Nhưng chỉ nếu là cột CHƯƠNG
      const numberPattern = /(\d{5,})/g;
      const numberMatches = content.match(numberPattern);
      
      if (numberMatches && numberMatches.length > 0) {
        const number = numberMatches[0];
        console.log('Tìm thấy số có thể là mã video:', number);
        
        // Kiểm tra xem có phải là ID YouTube không (thường là 11 ký tự)
        if (number.length === 11) {
          console.log('Số có độ dài phù hợp với YouTube ID:', number);
          return `https://www.youtube.com/watch?v=${number}`;
        }
      }
    }
    
    return null;
  };

  // Hàm render cell có hyperlink
  const renderHyperlinkCell = (hyperlink, cellContent, rowIndex, cellIndex) => {
    // Nếu không có hyperlink, hiển thị text thông thường
    if (!hyperlink) {
      return <span>{cellContent || ''}</span>;
    }

    // Check if it's a YouTube link first
    if (isYoutubeLink(hyperlink)) {
      console.log('renderHyperlinkCell: Detected YouTube link', hyperlink);
      // Xác định loading state
      const isLoading = loadingLinks[hyperlink];
      
      return (
        <button
          onClick={(e) => handleYoutubeClick(e, hyperlink)}
          className={`text-red-600 hover:text-red-800 hover:underline focus:outline-none ${
            isLoading ? 'opacity-50 cursor-wait' : ''
          }`}
          disabled={isLoading}
        >
          <span className="flex items-center space-x-1">
            {isLoading ? (
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-4 w-4 mr-1 inline" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
              </svg>
            )}
            <span>{cellContent || 'Xem video'}</span>
          </span>
        </button>
      );
    }

    // Tạo proxy link nếu cần
    let linkToUse = hyperlink;
    if (isGoogleDriveLink(hyperlink) || isPdfLink(hyperlink)) {
      linkToUse = createProxyLink(hyperlink) || hyperlink;
    }

    // Xác định loading state
    const isLoading = loadingLinks[hyperlink] || loadingLinks[linkToUse];
    
    return (
      <button
        onClick={(e) => handleLinkClick(e, linkToUse, cellContent)}
        className={`text-blue-600 hover:text-blue-800 hover:underline focus:outline-none ${
          isLoading ? 'opacity-50 cursor-wait' : ''
        }`}
        disabled={isLoading}
      >
        <span className="flex items-center space-x-1">
          {isLoading ? (
            <ArrowPathIcon className="h-4 w-4 animate-spin" />
          ) : null}
          <span>{cellContent || hyperlink}</span>
        </span>
      </button>
    );
  };

  // Hàm format nội dung cell, đặc biệt xử lý cho các cột ngày tháng
  const formatCellContent = (content, column) => {
    // Nếu không có nội dung, trả về chuỗi rỗng
    if (content === null || content === undefined || content === '') {
      return '';
    }
    
    // Danh sách các cột chứa ngày tháng
    const dateCols = ['NGÀY HỌC', 'NGÀY', 'DATE', 'THỜI GIAN'];
    const isDateColumn = column && dateCols.some(dateCol => 
      column.toUpperCase().includes(dateCol)
    );
    
    // Xử lý đặc biệt cho cột chứa ngày tháng
    if (isDateColumn) {
      // Kiểm tra nếu là số Excel serial date (ví dụ: 45792)
      if (!isNaN(Number(content))) {
        // Excel serial date bắt đầu từ ngày 1/1/1900, và số 1 tương ứng với ngày 1/1/1900
        // Một số serial như 45792 là số ngày kể từ 1/1/1900
        // Nhưng JavaScript date bắt đầu từ 1/1/1970
        
        try {
          // Chuyển đổi Excel serial date sang JavaScript Date
          // Excel có lỗi với năm 1900 (coi nó như năm nhuận), nên trừ đi 1 nếu số > 60
          let excelSerialDate = Number(content);
          
          // Xử lý trường hợp Excel hiển thị số không có định dạng (ví dụ: 45792)
          // Tính toán ngày tương ứng với Excel serial date
          const millisecondsPerDay = 24 * 60 * 60 * 1000;
          
          // Điều chỉnh lỗi năm 1900 trong Excel
          if (excelSerialDate > 60) {
            excelSerialDate -= 1;
          }
          
          // Ngày gốc của Excel là 1/1/1900
          const excelStartDate = new Date(1900, 0, 1);
          
          // Tính toán ngày thực tế
          const targetDate = new Date(excelStartDate.getTime() + (excelSerialDate - 1) * millisecondsPerDay);
          
          // Định dạng ngày tháng theo dd/MM/yyyy
          const day = String(targetDate.getDate()).padStart(2, '0');
          const month = String(targetDate.getMonth() + 1).padStart(2, '0');
          const year = targetDate.getFullYear();
          
          return `${day}/${month}/${year}`;
        } catch (error) {
          console.error('Lỗi khi chuyển đổi Excel serial date:', error);
          return content; // Trả về giá trị gốc nếu có lỗi
        }
      }
      
      // Kiểm tra nếu là chuỗi ngày tháng hợp lệ
      try {
        const dateObj = new Date(content);
        if (!isNaN(dateObj.getTime())) {
          // Định dạng ngày tháng theo dd/MM/yyyy
          const day = String(dateObj.getDate()).padStart(2, '0');
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const year = dateObj.getFullYear();
          return `${day}/${month}/${year}`;
        }
      } catch (error) {
        console.error('Lỗi khi định dạng chuỗi ngày tháng:', error);
      }
    }
    
    // Trả về nội dung gốc nếu không cần xử lý đặc biệt
    return content;
  };

  // Render nội dung cell
  const renderCellContent = (content, rowIndex, cellIndex, sheetDetail) => {
    // Lấy hyperlink nếu có
    // Thử nhiều vị trí khác nhau để tìm hyperlink
    let hyperlink = null;
    
    // Thử vị trí chính xác trước
    hyperlink = getHyperlink(rowIndex, cellIndex, sheetDetail);
    
    // Nếu không tìm thấy, thử một số vị trí khác
    if (!hyperlink && rowIndex > 0) {
      // Thử với rowIndex - 1 (trường hợp htmlData không tính header)
      hyperlink = getHyperlink(rowIndex - 1, cellIndex, sheetDetail);
    }
    
    // Nếu vẫn không tìm thấy và có htmlData, thử tìm kiếm dựa trên nội dung
    if (!hyperlink && sheetDetail.htmlData && content) {
      // Tìm trong toàn bộ htmlData các ô có hyperlink và nội dung tương tự
      sheetDetail.htmlData.forEach((row, rIdx) => {
        if (row && row.values && Array.isArray(row.values)) {
          row.values.forEach((cell, cIdx) => {
            if (cell && cell.hyperlink && cell.formattedValue === content) {
              console.log(`🔍 Tìm thấy hyperlink dựa trên nội dung [${rIdx},${cIdx}]: ${cell.hyperlink}`);
              if (!hyperlink) hyperlink = cell.hyperlink;
            }
          });
        }
      });
    }
    
    // Thử trích xuất URL từ nội dung cell
    if (!hyperlink && content) {
      const columnName = sheetDetail.header?.[cellIndex];
      hyperlink = extractRealUrl(content);
      if (hyperlink) {
        console.log(`🔍 Trích xuất URL từ nội dung cell [${rowIndex},${cellIndex}] (${columnName}):`, hyperlink);
      }
    }
    
    // Debug để xác định vị trí
    if (hyperlink) {
      console.log(`✅ Tìm thấy hyperlink cho cell [${rowIndex},${cellIndex}]: ${hyperlink}`);
    }
    
    // Nếu có hyperlink, render cell với hyperlink
    if (hyperlink) {
      return renderHyperlinkCell(hyperlink, formatCellContent(content, sheetDetail.header?.[cellIndex]) || '', rowIndex, cellIndex);
    }
    
    // Nếu không có hyperlink, hiển thị nội dung thông thường
    return formatCellContent(content, sheetDetail.header?.[cellIndex]) || '';
  };

  // Hàm kiểm tra cell có bị gộp không
  const isMergedCell = (rowIndex, cellIndex, sheetDetail) => {
    if (!sheetDetail.merges) return false;
    
    // Kiểm tra xem cell có nằm trong vùng gộp nào không
    return sheetDetail.merges.some(merge => {
      const isInMergeRange = 
        rowIndex >= merge.startRowIndex &&
        rowIndex < merge.endRowIndex &&
        cellIndex >= merge.startColumnIndex &&
        cellIndex < merge.endColumnIndex;
      
      // Nếu là cell chính của vùng gộp, trả về false để render
      const isMainCell = 
        rowIndex === merge.startRowIndex &&
        cellIndex === merge.startColumnIndex;
      
      return isInMergeRange && !isMainCell;
    });
  };

  // Hàm lấy thông tin rowSpan và colSpan cho cell
  const getMergeInfo = (rowIndex, cellIndex, sheetDetail) => {
    if (!sheetDetail.merges) return null;
    
    // Tìm vùng gộp mà cell này là cell chính
    const merge = sheetDetail.merges.find(merge => 
      rowIndex === merge.startRowIndex &&
      cellIndex === merge.startColumnIndex
    );
    
    if (!merge) return null;
    
    return {
      rowSpan: merge.endRowIndex - merge.startRowIndex,
      colSpan: merge.endColumnIndex - merge.startColumnIndex
    };
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
    if (!sortConfig.key || !Array.isArray(data) || data.length === 0) return data;

    return [...data].sort((a, b) => {
      const columnName = header[sortConfig.key];
      if (!columnName) return 0;
      
      // Get values to compare
      let aValue = a[columnName];
      let bValue = b[columnName];
      
      // Handle undefined or null values
      if (aValue === undefined || aValue === null) aValue = '';
      if (bValue === undefined || bValue === null) bValue = '';

      // Try to detect value type and sort accordingly
      
      // Check if values are numbers
      const aNum = parseFloat(aValue);
      const bNum = parseFloat(bValue);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === 'ascending' ? aNum - bNum : bNum - aNum;
      }

      // Check if values are dates
      const aDate = new Date(aValue);
      const bDate = new Date(bValue);
      if (!isNaN(aDate) && !isNaN(bDate) && aValue && bValue) {
        return sortConfig.direction === 'ascending' ? aDate - bDate : bDate - aDate;
      }

      // Handle objects with text property
      if (typeof aValue === 'object' && aValue !== null) {
        aValue = aValue.text || aValue.formattedValue || '';
      }
      if (typeof bValue === 'object' && bValue !== null) {
        bValue = bValue.text || bValue.formattedValue || '';
      }

      // Convert to strings for comparison
      aValue = String(aValue || '').toLowerCase();
      bValue = String(bValue || '').toLowerCase();

      // Compare strings
      if (sortConfig.direction === 'ascending') {
        return aValue.localeCompare(bValue, 'vi');
      }
      return bValue.localeCompare(aValue, 'vi');
    });
  };

  // Hàm debug cấu trúc dữ liệu
  const debugSheetStructure = (sheetDetail) => {
    if (!sheetDetail) {
      console.log('❌ Không có dữ liệu sheet');
      return;
    }
    
    console.log('🔍 DEBUG SHEET STRUCTURE:');
    
    // Kiểm tra các thuộc tính chính
    const hasHeader = Array.isArray(sheetDetail.header);
    const hasRows = Array.isArray(sheetDetail.rows);
    const hasValues = Array.isArray(sheetDetail.values);
    const hasHtmlData = Array.isArray(sheetDetail.htmlData);
    const hasHyperlinks = Array.isArray(sheetDetail.hyperlinks);
    
    console.log(`- header: ${hasHeader ? `✅ (${sheetDetail.header?.length || 0} cột)` : '❌'}`);
    console.log(`- rows: ${hasRows ? `✅ (${sheetDetail.rows?.length || 0} hàng)` : '❌'}`);
    console.log(`- values: ${hasValues ? `✅ (${sheetDetail.values?.length || 0} hàng)` : '❌'}`);
    console.log(`- htmlData: ${hasHtmlData ? `✅ (${sheetDetail.htmlData?.length || 0} hàng)` : '❌'}`);
    console.log(`- hyperlinks: ${hasHyperlinks ? `✅ (${sheetDetail.hyperlinks?.length || 0} liên kết)` : '❌'}`);
    
    // Kiểm tra cấu trúc rows nếu có
    if (hasRows && sheetDetail.rows.length > 0) {
      const sampleRow = sheetDetail.rows[0];
      console.log('- Sample row structure:', sampleRow);
      
      // Kiểm tra _hyperlinks
      if (sampleRow._hyperlinks) {
        console.log('- _hyperlinks found in rows:', sampleRow._hyperlinks);
      }
      
      // Kiểm tra processedData.urls
      if (sampleRow.processedData && Array.isArray(sampleRow.processedData.urls)) {
        console.log('- processedData.urls found:', sampleRow.processedData.urls);
      }
    }
    
    // Kiểm tra cấu trúc values nếu có
    if (hasValues && sheetDetail.values.length > 0) {
      console.log('- First row in values (header):', sheetDetail.values[0]);
      if (sheetDetail.values.length > 1) {
        console.log('- Second row in values (first data row):', sheetDetail.values[1]);
      }
    }
    
    // Kiểm tra cấu trúc htmlData chi tiết
    if (hasHtmlData && sheetDetail.htmlData.length > 0) {
      console.log('- Analyzing htmlData structure:');
      
      // Lấy mẫu một số hàng
      const sampleRows = [0, 1, 2].filter(idx => idx < sheetDetail.htmlData.length);
      
      sampleRows.forEach(rowIdx => {
        const htmlRow = sheetDetail.htmlData[rowIdx];
        console.log(`  - Row ${rowIdx} type:`, Array.isArray(htmlRow) ? 'Array' : typeof htmlRow);
        
        // Kiểm tra cấu trúc của hàng
        if (Array.isArray(htmlRow)) {
          // Tìm các ô có hyperlink
          const hyperlinks = [];
          htmlRow.forEach((cell, cellIdx) => {
            if (cell && cell.hyperlink) {
              hyperlinks.push({ cellIdx, hyperlink: cell.hyperlink });
            }
          });
          
          if (hyperlinks.length > 0) {
            console.log(`  - Row ${rowIdx} has ${hyperlinks.length} hyperlinks:`, hyperlinks);
          } else {
            console.log(`  - Row ${rowIdx} has no hyperlinks`);
          }
        } else if (htmlRow && htmlRow.values && Array.isArray(htmlRow.values)) {
          // Tìm các ô có hyperlink
          const hyperlinks = [];
          htmlRow.values.forEach((cell, cellIdx) => {
            if (cell && cell.hyperlink) {
              hyperlinks.push({ cellIdx, hyperlink: cell.hyperlink });
            }
          });
          
          if (hyperlinks.length > 0) {
            console.log(`  - Row ${rowIdx} has ${hyperlinks.length} hyperlinks:`, hyperlinks);
          } else {
            console.log(`  - Row ${rowIdx} has no hyperlinks`);
          }
        }
      });
      
      // Đếm tổng số hyperlink trong htmlData
      let totalHyperlinks = 0;
      sheetDetail.htmlData.forEach((row, rowIdx) => {
        if (Array.isArray(row)) {
          row.forEach(cell => {
            if (cell && cell.hyperlink) totalHyperlinks++;
          });
        } else if (row && row.values && Array.isArray(row.values)) {
          row.values.forEach(cell => {
            if (cell && cell.hyperlink) totalHyperlinks++;
          });
        }
      });
      
      console.log(`- Total hyperlinks found in htmlData: ${totalHyperlinks}`);
    }
    
    // Kiểm tra cấu trúc hyperlinks nếu có
    if (hasHyperlinks && sheetDetail.hyperlinks.length > 0) {
      console.log('- Sample hyperlinks:', sheetDetail.hyperlinks.slice(0, 3));
    }
    
    // Kiểm tra tất cả các hàng để tìm hyperlinks
    if (hasRows) {
      let rowsWithUrls = 0;
      let totalUrls = 0;
      
      sheetDetail.rows.forEach((row, index) => {
        if (row.processedData && Array.isArray(row.processedData.urls) && row.processedData.urls.length > 0) {
          rowsWithUrls++;
          totalUrls += row.processedData.urls.length;
          
          // Log chi tiết về 2 hàng đầu tiên có URLs
          if (rowsWithUrls <= 2) {
            console.log(`- Row ${index} has ${row.processedData.urls.length} URLs:`, row.processedData.urls);
          }
        }
      });
      
      console.log(`- Found ${totalUrls} URLs in ${rowsWithUrls} rows`);
    }
  };

  // Render bảng dữ liệu
  const renderTable = (sheetDetail) => {
    if (!sheetDetail) {
      return <div>Không có dữ liệu</div>;
    }

    // Log toàn bộ cấu trúc dữ liệu
    console.log('🎯 Toàn bộ dữ liệu sheet:', sheetDetail);
    console.log('Sheet Name:', sheetDetail.name || 'Không có tên trong dữ liệu chi tiết');
    
    // Debug cấu trúc dữ liệu
    debugSheetStructure(sheetDetail);

    // Kiểm tra cấu trúc dữ liệu và lấy header/rows phù hợp
    let header = [];
    let rows = [];

    // Trường hợp 1: Cấu trúc mới với header và rows
    if (Array.isArray(sheetDetail.header) && Array.isArray(sheetDetail.rows)) {
      header = sheetDetail.header;
      rows = sheetDetail.rows;
      console.log('Sử dụng cấu trúc dữ liệu mới với header/rows');
    }
    // Trường hợp 2: Dữ liệu từ API với values
    else if (Array.isArray(sheetDetail.values) && sheetDetail.values.length > 0) {
      // Lấy header từ dòng đầu tiên của values
      const headerRow = sheetDetail.values[0] || [];
      header = headerRow.map(item => String(item || '').trim());
      
      // Chuyển đổi các dòng còn lại thành mảng các object
      rows = sheetDetail.values.slice(1).map((row, rowIndex) => {
        const rowData = {};
        header.forEach((col, idx) => {
          if (col && idx < row.length) {
            rowData[col] = row[idx];
          }
        });

        // Thêm _hyperlinks nếu tìm thấy
        rowData._hyperlinks = {};
        
        // Kiểm tra trong htmlData nếu có
        if (Array.isArray(sheetDetail.htmlData) && sheetDetail.htmlData.length > rowIndex + 1) {
          const htmlRow = sheetDetail.htmlData[rowIndex + 1]; // +1 vì htmlData có thể bao gồm header
          
          if (htmlRow && Array.isArray(htmlRow)) {
            htmlRow.forEach((cell, cellIndex) => {
              if (cell && cell.hyperlink && cellIndex < header.length) {
                const columnName = header[cellIndex];
                if (columnName) {
                  // Nếu là hyperlink thật từ htmlData, ưu tiên sử dụng
                  rowData._hyperlinks[columnName] = cell.hyperlink;
                  console.log(`Sử dụng hyperlink thật từ htmlData cho [${rowIndex},${cellIndex}] (${columnName}):`, cell.hyperlink);
                }
              }
            });
          }
        }
        
        return rowData;
      });
      
      console.log('Đã chuyển đổi từ cấu trúc values thành header/rows');
    }
    // Không có dữ liệu hợp lệ
    else {
      console.error('Không tìm thấy cấu trúc dữ liệu hợp lệ:', sheetDetail);
      return <div>Không tìm thấy dữ liệu hợp lệ</div>;
    }

    // Log thông tin về dữ liệu
    console.log('Header đã xử lý:', header);
    console.log('Số cột:', header.length);
    console.log('Rows đã xử lý:', rows.length > 10 ? `${rows.length} hàng` : rows);
    console.log('Tổng số hàng:', rows.length);

    const sortedData = getSortedData(rows, header);

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {header.map((column, index) => (
                <th
                  key={index}
                  scope="col"
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer relative ${
                    sortConfig.key === index ? 'bg-gray-100' : ''
                  }`}
                  onClick={() => requestSort(index)}
                  onMouseEnter={() => setHoveredHeader(index)}
                  onMouseLeave={() => setHoveredHeader(null)}
                >
                  {column}
                  {hoveredHeader === index && (
                    <span className="absolute inset-y-0 right-0 flex items-center pr-2">
                      <ArrowPathIcon className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedData.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {header.map((column, cellIndex) => {
                  const cellContent = row[column];
                  const hyperlink = row._hyperlinks?.[column] || getHyperlinkFromValues(
                    rowIndex, 
                    cellIndex, 
                    sheetDetail.values, 
                    sheetDetail.htmlData,
                    sheetDetail.rows,
                    sheetDetail.header,
                    sheetDetail.hyperlinks
                  );
                  
                  // Log thông tin cell nếu có hyperlink
                  if (hyperlink) {
                    console.log(`🔗 Cell [${rowIndex},${cellIndex}]:`, {
                      column,
                      content: cellContent,
                      hyperlink
                    });
                  }
                  
                  return (
                    <td key={cellIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {hyperlink ? (
                        renderHyperlinkCell(hyperlink, formatCellContent(cellContent, column) || '', rowIndex, cellIndex)
                      ) : (
                        <span>{formatCellContent(cellContent, column) || ''}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Hàm lấy hyperlink từ values và htmlData
  const getHyperlinkFromValues = (rowIndex, cellIndex, values, htmlData, rows, header, hyperlinks) => {
    // Kiểm tra trong cấu trúc hyperlinks mới
    if (Array.isArray(hyperlinks)) {
      const hyperlink = hyperlinks.find(link => link.row === rowIndex && link.col === cellIndex);
      if (hyperlink) {
        console.log(`Tìm thấy hyperlink trong hyperlinks [${rowIndex},${cellIndex}]:`, hyperlink.url);
        return hyperlink.url;
      }
    }
    
    // Kiểm tra trong rows với _hyperlinks
    if (Array.isArray(rows) && rowIndex < rows.length && Array.isArray(header) && cellIndex < header.length) {
      const row = rows[rowIndex];
      const columnName = header[cellIndex];
      
      if (row && row._hyperlinks && columnName && row._hyperlinks[columnName]) {
        console.log(`Tìm thấy hyperlink trong rows._hyperlinks [${rowIndex},${cellIndex}]:`, row._hyperlinks[columnName]);
        return row._hyperlinks[columnName];
      }
      
      // Kiểm tra trong processedData.urls nếu có
      if (row && row.processedData && Array.isArray(row.processedData.urls)) {
        const urlData = row.processedData.urls.find(url => url.colIndex === cellIndex);
        if (urlData && urlData.url) {
          console.log(`Tìm thấy hyperlink trong processedData.urls [${rowIndex},${cellIndex}]:`, urlData.url);
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
          console.log(`Tìm thấy hyperlink trong values [${rowIndex},${cellIndex}]:`, cellValue);
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
            console.log(`Tìm thấy hyperlink trong htmlData (array) [${rowIndex},${cellIndex}]:`, htmlCell.hyperlink);
            return htmlCell.hyperlink;
          }
        }
        // Kiểm tra nếu htmlRow có cấu trúc {values: [...]}
        else if (htmlRow && htmlRow.values && Array.isArray(htmlRow.values) && htmlRow.values.length > cellIndex) {
          const htmlCell = htmlRow.values[cellIndex];
          if (htmlCell && htmlCell.hyperlink) {
            console.log(`Tìm thấy hyperlink trong htmlData.values [${rowIndex},${cellIndex}]:`, htmlCell.hyperlink);
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
            console.log(`Kiểm tra cell [${rowIndex},${cellIndex}] (${columnName}): "${cellValue}"`);
            
            // Nếu là số và có độ dài 11 ký tự (có thể là YouTube ID)
            if (typeof cellValue === 'string' && /^\d+$/.test(cellValue) && cellValue.length === 11) {
              const youtubeUrl = `https://www.youtube.com/watch?v=${cellValue}`;
              console.log(`Phát hiện có thể là YouTube ID trong CHƯƠNG: ${cellValue} -> ${youtubeUrl}`);
              return youtubeUrl;
            }
            
            // Thử trích xuất URL từ nội dung
            const extractedUrl = extractRealUrl(cellValue);
            if (extractedUrl) {
              console.log(`Trích xuất được URL từ cột CHƯƠNG: ${extractedUrl}`);
              return extractedUrl;
            }
          }
        }
      }
    }
    
    return null;
  };

  // Hàm xử lý sheet lên database
  const handleProcessSheet = async () => {
    if (!apiSheetData || !apiSheetData.sheets || apiSheetData.sheets.length === 0) {
      return;
    }

    const currentSheet = apiSheetData.sheets[activeApiSheet];
    if (!currentSheet) return;

    setProcessingSheet(true);
    try {
      await processSheetToDb(currentSheet._id);
      console.log('✅ Đã xử lý sheet thành công');
    } catch (error) {
      console.error('❌ Lỗi khi xử lý sheet:', error);
    } finally {
      setProcessingSheet(false);
    }
  };

  // Hàm sửa lỗi hyperlink
  const handleFixHyperlinks = async () => {
    if (!apiSheetData?.sheets || !apiSheetData.sheets[activeApiSheet]) return;
    
    const currentSheet = apiSheetData.sheets[activeApiSheet];
    setProcessingSheet(true);
    
    try {
      // Gọi API xử lý sheet với tùy chọn đặc biệt để sửa hyperlink
      const response = await fetch(`/api/sheets/${currentSheet._id}/process-to-db`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          background: false,
          preserveHyperlinks: true,
          includeHtmlData: true,
          fixHyperlinks: true,  // Tùy chọn đặc biệt để sửa hyperlink
          forceReprocess: true  // Bắt buộc xử lý lại
        })
      });
      
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Kết quả sửa hyperlink:', result);
      
      // Sau khi xử lý thành công, tải lại dữ liệu sheet
      await fetchSheetDetail(currentSheet._id);
      
      alert('Đã sửa lỗi hyperlink thành công!');
    } catch (error) {
      console.error('Lỗi khi sửa hyperlink:', error);
      alert(`Lỗi khi sửa hyperlink: ${error.message}`);
    } finally {
      setProcessingSheet(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
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