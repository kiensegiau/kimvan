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
  
  // Hàm lấy hyperlink từ dữ liệu HTML
  const getHyperlink = (rowIndex, cellIndex, sheetDetail) => {
    // Kiểm tra dữ liệu HTML tối ưu trước
    if (sheetDetail.optimizedHtmlData && sheetDetail.optimizedHtmlData.length > 0) {
      const optimizedRow = sheetDetail.optimizedHtmlData.find(row => row.rowIndex === rowIndex);
      if (optimizedRow && optimizedRow.hyperlinks) {
        const hyperlink = optimizedRow.hyperlinks.find(link => link.col === cellIndex);
        if (hyperlink) {
          console.log(`🔍 Tìm thấy hyperlink tối ưu [${rowIndex},${cellIndex}]: ${hyperlink.url}`);
          return hyperlink.url;
        }
      }
    }
    
    // Nếu không có dữ liệu tối ưu, thử lấy từ dữ liệu HTML đầy đủ
    if (sheetDetail.htmlData && sheetDetail.htmlData[rowIndex]) {
      const htmlRow = sheetDetail.htmlData[rowIndex];
      if (htmlRow && htmlRow.values && htmlRow.values[cellIndex]) {
        const htmlCell = htmlRow.values[cellIndex];
        if (htmlCell && htmlCell.hyperlink) {
          console.log(`🔍 Tìm thấy hyperlink đầy đủ [${rowIndex},${cellIndex}]: ${htmlCell.hyperlink}`);
          return htmlCell.hyperlink;
        }
      }
    }
    
    return null;
  };

  // Hàm render cell có hyperlink
  const renderHyperlinkCell = (hyperlink, cellContent, rowIndex, cellIndex) => {
    if (!hyperlink) return cellContent;
    
    console.log(`🔗 Render hyperlink [${rowIndex},${cellIndex}]: ${hyperlink}`);
    
    // Kiểm tra nếu là proxy link
    const isProxyLink = hyperlink.startsWith('/api/proxy-link/');
    const originalUrl = isProxyLink ? decodeProxyLink(hyperlink) : hyperlink;
    const finalUrl = hyperlink; // Sử dụng hyperlink gốc
    
    // Nếu không tạo được proxy link, hiển thị nội dung thông thường
    if (!finalUrl) return cellContent;
    
    // Kiểm tra loại link
    const isYoutube = isYoutubeLink(originalUrl || hyperlink);
    const isPdf = isPdfLink(originalUrl || hyperlink);
    const isDrive = isGoogleDriveLink(originalUrl || hyperlink);
    
    // Xác định icon và class dựa trên loại link
    let icon = null;
    let linkClass = "text-blue-600 hover:text-blue-800 hover:underline cursor-pointer";
    
    if (isYoutube) {
      icon = (
        <svg className="w-4 h-4 inline-block mr-1" fill="red" viewBox="0 0 24 24">
          <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
        </svg>
      );
      linkClass += " text-red-600 hover:text-red-800";
    } else if (isPdf) {
      icon = (
        <svg className="w-4 h-4 inline-block mr-1" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/>
        </svg>
      );
      linkClass += " text-orange-600 hover:text-orange-800";
    } else if (isDrive) {
      icon = (
        <svg className="w-4 h-4 inline-block mr-1" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 10l-3 5h6l3-5h-6zm-1-9v6.5l3 5 4-6.5-7-5zm-7 14l3 5 4-6.5-7-5v6.5z"/>
        </svg>
      );
      linkClass += " text-green-600 hover:text-green-800";
    } else {
      icon = (
        <svg className="w-4 h-4 inline-block mr-1" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
        </svg>
      );
    }
    
    // Xác định hàm xử lý click dựa trên loại link
    const handleClick = (e) => {
      e.preventDefault();
      
      // Đánh dấu link đang loading
      setLoadingLinks(prev => ({ ...prev, [hyperlink]: true }));
      
      if (isYoutube) {
        handleYoutubeClick(e, originalUrl || hyperlink);
      } else if (isPdf) {
        handlePdfClick(e, finalUrl, cellContent || 'Xem tài liệu PDF');
      } else if (isDrive) {
        window.open(originalUrl || hyperlink, '_blank');
      } else {
        handleLinkClick(e, finalUrl, cellContent || 'Xem tài liệu');
      }
      
      // Đánh dấu link đã xong loading
      setTimeout(() => {
        setLoadingLinks(prev => ({ ...prev, [hyperlink]: false }));
      }, 500);
    };
    
    // Hiển thị icon loading nếu đang tải
    const isLoading = loadingLinks[hyperlink];
    
    return (
      <span 
        className={linkClass}
        onClick={handleClick}
        title={originalUrl || hyperlink}
      >
        {isLoading ? (
          <span className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-600 mr-1"></span>
        ) : icon}
        {cellContent || hyperlink}
      </span>
    );
  };

  // Render nội dung cell
  const renderCellContent = (content, rowIndex, cellIndex, sheetDetail) => {
    // Lấy hyperlink nếu có
    const hyperlink = getHyperlink(rowIndex, cellIndex, sheetDetail);
    
    // Nếu có hyperlink, render cell với hyperlink
    if (hyperlink) {
      return renderHyperlinkCell(hyperlink, content, rowIndex, cellIndex);
    }
    
    // Nếu không có hyperlink, hiển thị nội dung thông thường
    return content;
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
      
      // Check if values are dates
      const aDate = new Date(aValue);
      const bDate = new Date(bValue);
      if (!isNaN(aDate) && !isNaN(bDate)) {
        return sortConfig.direction === 'ascending' ? aDate - bDate : bDate - aDate;
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

  // Render bảng dữ liệu
  const renderTable = (sheetDetail) => {
    if (!sheetDetail || !sheetDetail.values || sheetDetail.values.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          Không có dữ liệu
        </div>
      );
    }
    
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {sheetDetail.values[0].map((header, index) => (
                <th
                  key={index}
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-normal border-r border-gray-200 last:border-r-0 hover:bg-gray-100 transition-colors duration-150 cursor-pointer relative"
                  onClick={() => requestSort(index)}
                  onMouseEnter={() => setHoveredHeader(index)}
                  onMouseLeave={() => setHoveredHeader(null)}
                >
                  <div className="flex items-center">
                    <span className="flex-grow">{header}</span>
                    {hoveredHeader === index && (
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                      </svg>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sheetDetail.values.slice(1).map((row, rowIndex) => (
              <tr key={rowIndex} className="group">
                {row.map((cell, cellIndex) => {
                  // Kiểm tra xem cell có bị gộp không
                  if (isMergedCell(rowIndex + 1, cellIndex, sheetDetail)) {
                    return null;
                  }
                  
                  // Lấy thông tin gộp cell nếu có
                  const mergeInfo = getMergeInfo(rowIndex + 1, cellIndex, sheetDetail);
                  
                  return (
                    <td
                      key={cellIndex}
                      className="px-6 py-4 whitespace-normal break-words border-r border-gray-100 last:border-r-0 group-hover:bg-blue-50/80 transition-colors duration-150"
                      rowSpan={mergeInfo?.rowSpan}
                      colSpan={mergeInfo?.colSpan}
                    >
                      {renderCellContent(cell, rowIndex + 1, cellIndex, sheetDetail)}
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

  // Hàm xử lý sheet lên database
  const handleProcessSheet = async () => {
    if (!apiSheetData?.sheets || !apiSheetData.sheets[activeApiSheet]) return;
    
    const currentSheet = apiSheetData.sheets[activeApiSheet];
    setProcessingSheet(true);
    
    try {
      // Gọi API xử lý sheet
      const response = await fetch(`/api/sheets/${currentSheet._id}/process-to-db`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          background: false,
          preserveHyperlinks: true,
          includeHtmlData: true
        })
      });
      
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Kết quả xử lý sheet:', result);
      
      // Sau khi xử lý thành công, tải lại dữ liệu sheet
      await fetchSheetDetail(currentSheet._id);
      
      alert('Đã xử lý và cập nhật sheet thành công!');
    } catch (error) {
      console.error('Lỗi khi xử lý sheet:', error);
      alert(`Lỗi khi xử lý sheet: ${error.message}`);
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
                  {sheet.title || `Sheet ${index + 1}`}
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
                    {apiSheetData.sheets[activeApiSheet].title || `Sheet ${activeApiSheet + 1}`}
                  </h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleProcessSheet()}
                      disabled={processingSheet}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processingSheet ? (
                        <>
                          <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Đang xử lý...
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                          </svg>
                          Cập nhật vào DB
                        </>
                      )}
                    </button>
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
                    videoId={selectedVideo}
                    onClose={() => setSelectedVideo(null)}
                  />
                )}
                {selectedPDF && (
                  <PDFModal
                    url={selectedPDF}
                    title={pdfTitle}
                    onClose={() => {
                      setSelectedPDF(null);
                      setPdfTitle('');
                    }}
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