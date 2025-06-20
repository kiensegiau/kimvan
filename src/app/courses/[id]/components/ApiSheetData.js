import { useState, useEffect } from 'react';
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

  // Hàm xử lý nội dung cell để phát hiện và chuyển đổi URL thành liên kết
  const renderCellContent = (content) => {
    if (!content) return '';
    
    // Kiểm tra công thức HYPERLINK từ Google Sheets
    const hyperlinkRegex = /=HYPERLINK\("([^"]+)"(?:,\s*"([^"]+)")?\)/i;
    const hyperlinkMatch = typeof content === 'string' ? content.match(hyperlinkRegex) : null;
    
    if (hyperlinkMatch) {
      let url = hyperlinkMatch[1];
      const displayText = hyperlinkMatch[2] || url;
      
      // Kiểm tra loại link để hiển thị icon phù hợp
      let icon = null;
      if (isYoutubeLink(url)) {
        icon = <span className="text-red-500 mr-1" title="YouTube Video">🎬</span>;
      } else if (isGoogleDriveLink(url)) {
        icon = <span className="text-blue-500 mr-1" title="Google Drive">📄</span>;
      } else if (url.includes('docs.google.com/document')) {
        icon = <span className="text-green-500 mr-1" title="Google Docs">📝</span>;
      } else if (isPdfLink(url)) {
        icon = <span className="text-red-500 mr-1" title="PDF">📕</span>;
      }
      
      return (
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-blue-600 hover:underline"
        >
          {icon}{displayText}
        </a>
      );
    }
    
    // Kiểm tra xem nội dung có phải là URL không
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    // Nếu nội dung chỉ chứa URL
    if (typeof content === 'string' && urlRegex.test(content) && content.trim().match(urlRegex)[0] === content.trim()) {
      // Xác định loại URL để hiển thị icon phù hợp
      let icon = null;
      if (isYoutubeLink(content)) {
        icon = <span className="text-red-500 mr-1" title="YouTube Video">🎬</span>;
      } else if (isGoogleDriveLink(content)) {
        icon = <span className="text-blue-500 mr-1" title="Google Drive">📄</span>;
      } else if (content.includes('docs.google.com/document')) {
        icon = <span className="text-green-500 mr-1" title="Google Docs">📝</span>;
      } else if (isPdfLink(content)) {
        icon = <span className="text-red-500 mr-1" title="PDF">📕</span>;
      }
      
      return (
        <a 
          href={content} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-blue-600 hover:underline"
        >
          {icon}{content}
        </a>
      );
    }
    
    return content;
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
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  {sheetDetail.data.values[0].map((header, index) => (
                    <th 
                      key={index} 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 last:border-r-0"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sheetDetail.data.values.slice(1).map((row, rowIndex) => {
                  // Lấy dữ liệu HTML tương ứng nếu có
                  const htmlRow = sheetDetail.data.htmlData?.[rowIndex + 1]?.values || [];
                  
                  return (
                    <tr key={rowIndex} className="hover:bg-gray-50">
                      {row.map((cell, cellIndex) => {
                        // Kiểm tra xem có dữ liệu HTML không
                        const htmlCell = htmlRow[cellIndex];
                        const hyperlink = htmlCell?.hyperlink;
                        
                        // Nếu có hyperlink trong dữ liệu HTML
                        if (hyperlink) {
                          // Xác định loại liên kết để hiển thị icon phù hợp
                          let icon = null;
                          if (isYoutubeLink(hyperlink)) {
                            icon = <span className="text-red-500 mr-1" title="YouTube Video">🎬</span>;
                          } else if (isGoogleDriveLink(hyperlink)) {
                            icon = <span className="text-blue-500 mr-1" title="Google Drive">📄</span>;
                          } else if (hyperlink.includes('docs.google.com/document')) {
                            icon = <span className="text-green-500 mr-1" title="Google Docs">📝</span>;
                          } else if (isPdfLink(hyperlink)) {
                            icon = <span className="text-red-500 mr-1" title="PDF">📕</span>;
                          }
                          
                          const key = `${rowIndex}-${cellIndex}`;
                          const cellContent = cell || hyperlink;
                          
                          return (
                            <td key={cellIndex} className="px-6 py-4 border-r border-gray-200 last:border-r-0">
                              <div>
                                <a 
                                  href={hyperlink} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-blue-600 hover:underline"
                                  onClick={(e) => {
                                    if (isYoutubeLink(hyperlink)) {
                                      handleYoutubeClick(e, hyperlink);
                                    } else if (isPdfLink(hyperlink)) {
                                      handlePdfClick(e, hyperlink, cellContent);
                                    }
                                  }}
                                >
                                  {icon}{cellContent}
                                </a>
                              </div>
                            </td>
                          );
                        }
                        
                        // Xử lý các cell thông thường
                        const key = `${rowIndex}-${cellIndex}`;
                        const cellContent = cell || '';
                        
                        return (
                          <td key={cellIndex} className="px-6 py-4 border-r border-gray-200 last:border-r-0">
                            <div>
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
        ) : (
          <div className="p-6 text-center bg-gray-50 rounded-lg">
            <p className="text-gray-500">Không có dữ liệu để hiển thị.</p>
          </div>
        )}
      </div>
    </div>
  );
} 