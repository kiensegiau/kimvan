'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, ArrowPathIcon, ArrowDownTrayIcon, CloudArrowUpIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

const MediaProcessingModal = ({ 
  isOpen, 
  onClose, 
  courseData,
  courseId
}) => {
  const [activeTab, setActiveTab] = useState('videos');
  const [selectedMedia, setSelectedMedia] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(null);
  const [destination, setDestination] = useState('youtube');
  const [processingSummary, setProcessingSummary] = useState(null);
  const [mediaList, setMediaList] = useState({
    videos: [],
    pdfs: []
  });

  // Khởi tạo danh sách media từ dữ liệu khóa học
  useEffect(() => {
    if (courseData) {
      extractMediaFromCourse();
    }
  }, [courseData]);

  // Hàm trích xuất thông tin media từ khóa học
  const extractMediaFromCourse = () => {
    if (!courseData || !courseData.originalData || !courseData.originalData.sheets) return;
    
    const videos = [];
    const pdfs = [];
    
    // Duyệt qua tất cả các sheets
    courseData.originalData.sheets.forEach((sheet, sheetIndex) => {
      if (!sheet.data || !sheet.data[0] || !sheet.data[0].rowData) return;
      
      const sheetTitle = sheet.properties?.title || `Khóa ${sheetIndex + 1}`;
      
      // Duyệt qua từng dòng (bỏ qua header)
      sheet.data[0].rowData.slice(1).forEach((row, rowIndex) => {
        if (!row.values) return;
        
        // Duyệt qua từng ô trong dòng
        row.values.forEach((cell, cellIndex) => {
          const url = cell.userEnteredFormat?.textFormat?.link?.uri || cell.hyperlink;
          if (!url) return;
          
          const title = cell.formattedValue || `Tài liệu ${rowIndex + 1}`;
          const lesson = row.values[0]?.formattedValue || `Buổi ${rowIndex + 1}`;
          
          // Nhận dạng loại tài liệu
          if (url.includes('youtube.com') || url.includes('youtu.be')) {
            videos.push({
              id: `video-${sheetIndex}-${rowIndex}-${cellIndex}`,
              url,
              title,
              lesson,
              sheet: sheetTitle,
              type: 'youtube',
              status: 'pending',
              selected: false
            });
          } else if (url.toLowerCase().endsWith('.pdf') || url.includes('drive.google.com') && url.includes('.pdf')) {
            pdfs.push({
              id: `pdf-${sheetIndex}-${rowIndex}-${cellIndex}`,
              url,
              title,
              lesson,
              sheet: sheetTitle,
              type: 'pdf',
              status: 'pending',
              selected: false
            });
          }
        });
      });
    });
    
    setMediaList({
      videos,
      pdfs
    });
  };

  // Chọn hoặc bỏ chọn tất cả các mục
  const toggleSelectAll = () => {
    const currentList = [...mediaList[activeTab]];
    const allSelected = currentList.every(item => selectedMedia.includes(item.id));
    
    if (allSelected) {
      // Bỏ chọn tất cả
      setSelectedMedia(selectedMedia.filter(id => !currentList.some(item => item.id === id)));
    } else {
      // Chọn tất cả
      const newSelected = [...selectedMedia];
      currentList.forEach(item => {
        if (!newSelected.includes(item.id)) {
          newSelected.push(item.id);
        }
      });
      setSelectedMedia(newSelected);
    }
  };

  // Chọn/bỏ chọn một mục
  const toggleSelectItem = (id) => {
    if (selectedMedia.includes(id)) {
      setSelectedMedia(selectedMedia.filter(itemId => itemId !== id));
    } else {
      setSelectedMedia([...selectedMedia, id]);
    }
  };

  // Tải xuống media đã chọn
  const handleDownload = async () => {
    if (selectedMedia.length === 0) {
      setStatus({
        type: 'error',
        message: 'Vui lòng chọn ít nhất một tài liệu để tải xuống'
      });
      return;
    }
    
    try {
      setDownloading(true);
      setStatus({
        type: 'info',
        message: 'Đang chuẩn bị tải xuống tài liệu...'
      });
      
      // Lấy thông tin các media đã chọn
      const mediaToDownload = [
        ...mediaList.videos.filter(item => selectedMedia.includes(item.id)),
        ...mediaList.pdfs.filter(item => selectedMedia.includes(item.id))
      ];
      
      const response = await fetch('/api/courses/media/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseId,
          media: mediaToDownload
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Không thể tải xuống tài liệu');
      }
      
      setStatus({
        type: 'success',
        message: 'Tải xuống thành công!'
      });
      
      setProcessingSummary({
        total: mediaToDownload.length,
        success: data.success || 0,
        failed: data.failed || 0,
        details: data.details || []
      });
      
    } catch (error) {
      console.error('Lỗi khi tải xuống tài liệu:', error);
      setStatus({
        type: 'error',
        message: error.message || 'Đã xảy ra lỗi khi tải xuống tài liệu'
      });
    } finally {
      setDownloading(false);
    }
  };

  // Tải lên media đã chọn
  const handleUpload = async () => {
    if (selectedMedia.length === 0) {
      setStatus({
        type: 'error',
        message: 'Vui lòng chọn ít nhất một tài liệu để tải lên'
      });
      return;
    }
    
    try {
      setUploading(true);
      setStatus({
        type: 'info',
        message: `Đang chuẩn bị tải lên ${destination === 'youtube' ? 'YouTube' : 'Google Drive'}...`
      });
      
      // Lấy thông tin các media đã chọn
      const mediaToUpload = [
        ...mediaList.videos.filter(item => selectedMedia.includes(item.id)),
        ...mediaList.pdfs.filter(item => selectedMedia.includes(item.id))
      ];
      
      const response = await fetch('/api/courses/media/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseId,
          media: mediaToUpload,
          destination
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `Không thể tải lên ${destination === 'youtube' ? 'YouTube' : 'Google Drive'}`);
      }
      
      setStatus({
        type: 'success',
        message: `Tải lên ${destination === 'youtube' ? 'YouTube' : 'Google Drive'} thành công!`
      });
      
      setProcessingSummary({
        total: mediaToUpload.length,
        success: data.success || 0,
        failed: data.failed || 0,
        details: data.details || []
      });
      
    } catch (error) {
      console.error('Lỗi khi tải lên tài liệu:', error);
      setStatus({
        type: 'error',
        message: error.message || `Đã xảy ra lỗi khi tải lên ${destination === 'youtube' ? 'YouTube' : 'Google Drive'}`
      });
    } finally {
      setUploading(false);
    }
  };

  // Nếu modal không hiển thị, không render gì cả
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Quản lý và xử lý tài liệu khóa học</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        {/* Tab navigation */}
        <div className="px-4 sm:px-6 py-2 border-b border-gray-200 bg-gray-50">
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveTab('videos')}
              className={`px-3 py-2 text-sm font-medium rounded-md ${
                activeTab === 'videos' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              Video ({mediaList.videos.length})
            </button>
            <button
              onClick={() => setActiveTab('pdfs')}
              className={`px-3 py-2 text-sm font-medium rounded-md ${
                activeTab === 'pdfs' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              PDF ({mediaList.pdfs.length})
            </button>
          </div>
        </div>
        
        {/* Content area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Status message */}
          {status && (
            <div className={`
              m-4 p-3 rounded-md
              ${status.type === 'success' ? 'bg-green-50 text-green-800' : 
                status.type === 'error' ? 'bg-red-50 text-red-800' : 
                'bg-blue-50 text-blue-800'}
            `}>
              <div className="flex">
                <div className="flex-shrink-0">
                  {status.type === 'success' ? (
                    <CheckCircleIcon className="h-5 w-5 text-green-400" />
                  ) : status.type === 'error' ? (
                    <XMarkIcon className="h-5 w-5 text-red-400" />
                  ) : (
                    <ArrowPathIcon className={`h-5 w-5 text-blue-400 ${downloading || uploading ? 'animate-spin' : ''}`} />
                  )}
                </div>
                <div className="ml-3">
                  <p className="text-sm">{status.message}</p>
                </div>
                <div className="ml-auto pl-3">
                  <div className="-mx-1.5 -my-1.5">
                    <button
                      type="button"
                      onClick={() => setStatus(null)}
                      className="inline-flex rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Processing Summary */}
          {processingSummary && (
            <div className="mx-4 mb-4 p-3 rounded-md bg-gray-50 border border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Kết quả xử lý:</h4>
              <div className="text-sm text-gray-600">
                <p>Tổng số tài liệu: {processingSummary.total}</p>
                <p>Thành công: {processingSummary.success}</p>
                <p>Thất bại: {processingSummary.failed}</p>
                
                {processingSummary.details && processingSummary.details.length > 0 && (
                  <div className="mt-2 max-h-32 overflow-y-auto border-t border-gray-200 pt-2">
                    <p className="font-medium">Chi tiết:</p>
                    {processingSummary.details.map((detail, index) => (
                      <div key={index} className="flex items-center text-xs mt-1">
                        <span className={`w-2 h-2 rounded-full mr-2 ${detail.success ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        <span>{detail.title}: {detail.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Media list */}
          <div className="flex-1 overflow-y-auto p-4">
            {mediaList[activeTab].length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      checked={mediaList[activeTab].length > 0 && mediaList[activeTab].every(item => selectedMedia.includes(item.id))}
                      onChange={toggleSelectAll}
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">
                      Chọn tất cả ({mediaList[activeTab].length})
                    </span>
                  </div>
                  
                  {activeTab === 'videos' && (
                    <div className="text-sm text-gray-500">
                      Đang hiển thị {mediaList.videos.length} video
                    </div>
                  )}
                  
                  {activeTab === 'pdfs' && (
                    <div className="text-sm text-gray-500">
                      Đang hiển thị {mediaList.pdfs.length} PDF
                    </div>
                  )}
                </div>
                
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-6"></th>
                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Buổi</th>
                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tiêu đề</th>
                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Khóa</th>
                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {mediaList[activeTab].map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-3 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                              checked={selectedMedia.includes(item.id)}
                              onChange={() => toggleSelectItem(item.id)}
                            />
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {item.lesson}
                          </td>
                          <td className="px-3 py-4 text-sm text-gray-500 max-w-xs truncate">
                            {item.title}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.sheet}
                          </td>
                          <td className="px-3 py-4 text-sm text-gray-500 max-w-xs truncate">
                            <a 
                              href={item.url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-indigo-600 hover:text-indigo-900 truncate block"
                            >
                              {item.url}
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <div className="mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900">Không tìm thấy {activeTab === 'videos' ? 'video' : 'PDF'}</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {activeTab === 'videos' 
                      ? 'Không tìm thấy video nào trong khóa học này.' 
                      : 'Không tìm thấy tệp PDF nào trong khóa học này.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="w-full sm:w-auto">
              <label htmlFor="destination" className="text-sm font-medium text-gray-700 block mb-1">
                Đích đến tải lên
              </label>
              <select
                id="destination"
                name="destination"
                className="block w-full sm:w-48 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                disabled={uploading}
              >
                <option value="youtube">YouTube</option>
                <option value="drive">Google Drive</option>
              </select>
            </div>
            
            <div className="flex space-x-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleDownload}
                disabled={selectedMedia.length === 0 || downloading || uploading}
                className="flex-1 sm:flex-none inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {downloading ? (
                  <>
                    <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-5 w-5" />
                    Đang tải xuống...
                  </>
                ) : (
                  <>
                    <ArrowDownTrayIcon className="-ml-1 mr-2 h-5 w-5" />
                    Tải xuống
                  </>
                )}
              </button>
              
              <button
                type="button"
                onClick={handleUpload}
                disabled={selectedMedia.length === 0 || downloading || uploading}
                className="flex-1 sm:flex-none inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-5 w-5" />
                    Đang tải lên...
                  </>
                ) : (
                  <>
                    <CloudArrowUpIcon className="-ml-1 mr-2 h-5 w-5" />
                    Tải lên {destination === 'youtube' ? 'YouTube' : 'Drive'}
                  </>
                )}
              </button>
              
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaProcessingModal; 