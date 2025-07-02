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
  
  // Hàm lấy hyperlink từ dữ liệu HTML
  const getHyperlink = (rowIndex, cellIndex, sheetDetail) => {
    // Kiểm tra dữ liệu HTML tối ưu trước
    if (sheetDetail.optimizedHtmlData && sheetDetail.optimizedHtmlData.length > 0) {
      const optimizedRow = sheetDetail.optimizedHtmlData.find(row => row.rowIndex === rowIndex);
      if (optimizedRow && optimizedRow.hyperlinks) {
        const hyperlink = optimizedRow.hyperlinks.find(link => link.col === cellIndex);
        if (hyperlink) return hyperlink.url;
      }
    }
    
    // Nếu không có dữ liệu tối ưu, thử lấy từ dữ liệu HTML đầy đủ
    const htmlRow = sheetDetail.htmlData?.[rowIndex]?.values || [];
    const htmlCell = htmlRow[cellIndex];
    return htmlCell?.hyperlink;
  };

  // Hàm render cell có hyperlink
  const renderHyperlinkCell = (hyperlink, cellContent, rowIndex, cellIndex) => {
    if (!hyperlink) return cellContent;
    
    // Kiểm tra nếu là proxy link
    const isProxyLink = hyperlink.startsWith('/api/proxy-link/');
    const originalUrl = isProxyLink ? decodeProxyLink(hyperlink) : hyperlink;
    const finalUrl = isProxyLink ? hyperlink : createProxyLink(hyperlink);
    
    // Nếu không tạo được proxy link, hiển thị nội dung thông thường
    if (!finalUrl) return cellContent;
    
    // Kiểm tra loại link
    const isYoutube = originalUrl && isYoutubeLink(originalUrl);
    const isPdf = originalUrl && isPdfLink(originalUrl);
    const isGDrive = originalUrl && isGoogleDriveLink(originalUrl);
    
    // Tạo title cho link
    const linkTitle = cellContent || (isPdf ? 'Xem PDF' : (isYoutube ? 'Xem video' : 'Mở liên kết'));
    
    // Kiểm tra trạng thái loading
    const isLoading = loadingLinks[finalUrl];
    
    return (
      <button
        onClick={(e) => handleLinkClick(e, finalUrl, linkTitle)}
        className={`inline-flex items-center text-left ${
          isYoutube ? 'text-red-600 hover:text-red-700' :
          isPdf ? 'text-blue-600 hover:text-blue-700' :
          isGDrive ? 'text-green-600 hover:text-green-700' :
          'text-indigo-600 hover:text-indigo-700'
        } font-medium focus:outline-none focus:underline transition-colors duration-150 disabled:opacity-50`}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <ArrowPathIcon className="w-4 h-4 mr-1 animate-spin" />
            <span>Đang tải...</span>
          </>
        ) : (
          <>
            {/* Icon based on link type */}
            {isYoutube && (
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
              </svg>
            )}
            {isPdf && (
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
            )}
            {isGDrive && (
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 10L7 18h10l-5-8zM2 18l5-8-5-8h10l5 8-5 8H2z" />
              </svg>
            )}
            {!isYoutube && !isPdf && !isGDrive && (
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            )}
            <span className="truncate">{linkTitle}</span>
          </>
        )}
      </button>
    );
  };

  // Hàm xử lý nội dung cell để phát hiện và chuyển đổi URL thành liên kết
  const renderCellContent = (content, rowIndex, cellIndex, sheetDetail) => {
    // Kiểm tra hyperlink
    const hyperlink = getHyperlink(rowIndex, cellIndex, sheetDetail);
    
    // Nếu có hyperlink, render cell với hyperlink
    if (hyperlink) {
      return renderHyperlinkCell(hyperlink, content, rowIndex, cellIndex);
    }
    
    // Nếu không có hyperlink, render nội dung thông thường
    return content || '';
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