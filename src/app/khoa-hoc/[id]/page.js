'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, CloudArrowDownIcon, ExclamationCircleIcon, XMarkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { use } from 'react';
import YouTubeModal from '../components/YouTubeModal';
import PDFModal from '../components/PDFModal';
import LoadingOverlay from '../components/LoadingOverlay';
import CryptoJS from 'crypto-js';

// Khóa mã hóa - phải giống với khóa ở phía server
const ENCRYPTION_KEY = 'kimvan-secure-key-2024';
// Thời gian cache - 12 giờ tính bằng milliseconds
const CACHE_DURATION = 12 * 60 * 60 * 1000;

export default function CourseDetailPage({ params }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [youtubeModal, setYoutubeModal] = useState({ isOpen: false, videoId: null, title: '' });
  const [pdfModal, setPdfModal] = useState({ isOpen: false, fileUrl: null, title: '' });
  const [isLoaded, setIsLoaded] = useState(false);
  const [processingLink, setProcessingLink] = useState(false);
  const [viewMode, setViewMode] = useState('table');
  const [cacheStatus, setCacheStatus] = useState('');
  
  // Hàm giải mã dữ liệu với xử lý lỗi tốt hơn
  const decryptData = (encryptedData) => {
    try {
      if (!encryptedData) {
        throw new Error("Không có dữ liệu được mã hóa");
      }
      
      // Giải mã dữ liệu
      const decryptedBytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
      if (!decryptedBytes) {
        throw new Error("Giải mã không thành công");
      }
      
      const decryptedText = decryptedBytes.toString(CryptoJS.enc.Utf8);
      if (!decryptedText || decryptedText.length === 0) {
        throw new Error("Dữ liệu giải mã không hợp lệ");
      }
      
      return JSON.parse(decryptedText);
    } catch (error) {
      // Xử lý lỗi im lặng
      throw new Error(`Không thể giải mã: ${error.message}`);
    }
  };

  // Hàm lưu dữ liệu vào localStorage
  const saveToCache = (data) => {
    try {
      const cacheItem = {
        data: data,
        timestamp: Date.now()
      };
      localStorage.setItem(`course-${id}`, JSON.stringify(cacheItem));
      setCacheStatus('saved');
    } catch (error) {
      // Xử lý lỗi im lặng
    }
  };

  // Hàm lấy dữ liệu từ localStorage
  const getFromCache = () => {
    try {
      const cachedData = localStorage.getItem(`course-${id}`);
      if (!cachedData) return null;
      
      const cacheItem = JSON.parse(cachedData);
      const now = Date.now();
      
      // Kiểm tra xem cache có còn hiệu lực không (12 giờ)
      if (now - cacheItem.timestamp > CACHE_DURATION) {
        localStorage.removeItem(`course-${id}`);
        setCacheStatus('expired');
        return null;
      }
      
      setCacheStatus('hit');
      return cacheItem.data;
    } catch (error) {
      // Xử lý lỗi im lặng
      return null;
    }
  };

  // Hàm lấy tiêu đề của sheet
  const getSheetTitle = (index, sheets) => {
    if (!sheets || !sheets[index]) return `Khóa ${index + 1}`;
    const sheet = sheets[index];
    return sheet?.properties?.title || `Khóa ${index + 1}`;
  };

  // Hàm xử lý và thay thế link drive cũ bằng link mới từ processedDriveFiles
  const getUpdatedUrl = (originalUrl) => {
    if (!originalUrl) {
      return { url: originalUrl, isProcessed: false };
    }
    
    // Kiểm tra xem processedDriveFiles ở đâu trong cấu trúc dữ liệu
    const processedFiles = course?.processedDriveFiles || [];
    
    if (processedFiles.length === 0) {
      return { url: originalUrl, isProcessed: false };
    }

    // Tìm trong danh sách các file đã xử lý
    const processedFile = processedFiles.find(file => 
      file.originalUrl === originalUrl && file.processedUrl
    );

    if (processedFile) {
      return { url: processedFile.processedUrl, isProcessed: true };
    }

    return { url: originalUrl, isProcessed: false };
  };

  // Lấy thông tin chi tiết của khóa học
  const fetchCourseDetail = async () => {
    setLoading(true);
    setError(null); // Reset error trước khi fetch
    
    try {
      // Kiểm tra cache trước
      const cachedCourse = getFromCache();
      if (cachedCourse) {
        setCourse(cachedCourse);
        setLoading(false);
        
        // Hiệu ứng fade-in
        setTimeout(() => {
          setIsLoaded(true);
        }, 100);
        
        return;
      }
      
      // Nếu không có cache hoặc cache hết hạn, fetch từ API
      // Sử dụng tham số secure=true để nhận dữ liệu được mã hóa hoàn toàn
      const response = await fetch(`/api/courses/${id}?type=auto&secure=true`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Lỗi ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }
      
      const encryptedResponse = await response.json();
      let fullCourseData;
      
      // Kiểm tra nếu nhận được dữ liệu được mã hóa hoàn toàn
      if (encryptedResponse._secureData) {
        try {
          // Giải mã toàn bộ đối tượng
          fullCourseData = decryptData(encryptedResponse._secureData);
          setCourse(fullCourseData);
          // Lưu vào cache
          saveToCache(fullCourseData);
        } catch (decryptError) {
          setError(`Không thể giải mã dữ liệu khóa học: ${decryptError.message}. Vui lòng liên hệ quản trị viên.`);
          setLoading(false);
          return;
        }
      } else if (encryptedResponse._encryptedData) {
        // Xử lý trường hợp chỉ mã hóa dữ liệu nhạy cảm
        try {
          // Giải mã dữ liệu nhạy cảm
          const decryptedData = decryptData(encryptedResponse._encryptedData);
          
          // Khôi phục dữ liệu gốc
          fullCourseData = {
            ...encryptedResponse,
            originalData: decryptedData
          };
          delete fullCourseData._encryptedData;
          
          setCourse(fullCourseData);
          // Lưu vào cache
          saveToCache(fullCourseData);
        } catch (decryptError) {
          setError(`Không thể giải mã dữ liệu khóa học: ${decryptError.message}. Vui lòng liên hệ quản trị viên.`);
          setLoading(false);
          return;
        }
      } else if (!encryptedResponse.originalData) {
        // Kiểm tra nếu không có dữ liệu gốc
        setError("Khóa học không có dữ liệu. Vui lòng liên hệ quản trị viên.");
        setLoading(false);
        return;
      } else {
        // Trường hợp dữ liệu không được mã hóa
        fullCourseData = encryptedResponse;
        setCourse(fullCourseData);
        // Lưu vào cache
        saveToCache(fullCourseData);
      }
      
      // Hiệu ứng fade-in
      setTimeout(() => {
        setIsLoaded(true);
      }, 100);
      
      setLoading(false);
    } catch (error) {
      setError(`Không thể lấy thông tin khóa học: ${error.message}`);
      setLoading(false);
    }
  };

  // Thử lại khi gặp lỗi
  const handleRetry = () => {
    // Xóa cache khi thử lại để đảm bảo lấy dữ liệu mới
    try {
      localStorage.removeItem(`course-${id}`);
      setCacheStatus('cleared');
    } catch (error) {
      // Xử lý lỗi im lặng
    }
    fetchCourseDetail();
  };

  // Hàm trích xuất YouTube video ID từ URL
  const extractYoutubeId = (url) => {
    if (!url) return null;
    
    // Hỗ trợ nhiều định dạng URL YouTube
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    
    return (match && match[2].length === 11) ? match[2] : null;
  };
  
  // Hàm kiểm tra xem URL có phải là YouTube link không
  const isYoutubeLink = (url) => {
    if (!url) return false;
    return url.includes('youtube.com') || url.includes('youtu.be');
  };
  
  // Hàm kiểm tra xem URL có phải là PDF không
  const isPdfLink = (url) => {
    if (!url) return false;
    return url.toLowerCase().endsWith('.pdf');
  };
  
  // Hàm kiểm tra xem URL có phải là Google Drive link không
  const isGoogleDriveLink = (url) => {
    if (!url) return false;
    return url.includes('drive.google.com') || url.includes('docs.google.com');
  };

  // Hàm kiểm tra xem URL có phải là thư mục Google Drive không
  const isGoogleDriveFolder = (url) => {
    if (!url) return false;
    return url.includes('/folders/') || 
           url.includes('/drive/folders/') || 
           url.includes('/drive/u/0/folders/');
  };
  
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
  const handleLinkClick = async (url, title) => {
    if (!url) return;
    
    // Kiểm tra xem link đã được xử lý chưa
    const processedUrlInfo = getUpdatedUrl(url);
    
    // Kiểm tra nếu là thư mục Google Drive thì mở link trực tiếp
    if (isGoogleDriveFolder(processedUrlInfo.url)) {
      window.open(processedUrlInfo.url, '_blank');
      return;
    }
    
    try {
      // Hiển thị loading
      setProcessingLink(true);

      // Nếu là link Google Drive và chưa có URL mới
      if (isGoogleDriveLink(url) && !processedUrlInfo.isProcessed && !isGoogleDriveFolder(url)) {
        // Hiển thị modal thông báo đang cập nhật tài liệu
        setPdfModal({ 
          isOpen: true, 
          fileUrl: null, 
          title: title,
          isUpdating: true
        });
        setProcessingLink(false);
        return;
      }
      
      // Gọi API để xử lý link
      const response = await fetch('/api/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: processedUrlInfo.url, // Sử dụng URL đã được xử lý nếu có
          type: isYoutubeLink(processedUrlInfo.url) ? 'youtube' : 
                isPdfLink(processedUrlInfo.url) ? 'pdf' : 
                isGoogleDriveLink(processedUrlInfo.url) ? 'drive' : 'external'
        }),
      });

      if (!response.ok) {
        throw new Error('Không thể xử lý link');
      }

      const data = await response.json();
      const processedUrl = data.processedUrl;
      const encryptedOriginalUrl = data.originalUrl; // Lưu URL đã mã hóa
      
      // Ẩn loading
      setProcessingLink(false);
      
      // Mở link đã xử lý theo loại
      if (isYoutubeLink(processedUrl)) {
        openYoutubeModal(processedUrl, title);
      } else if ((isPdfLink(processedUrl) || isGoogleDriveLink(processedUrl)) && !isGoogleDriveFolder(processedUrl)) {
        setPdfModal({ 
          isOpen: true, 
          fileUrl: processedUrl, 
          title: title,
          isUpdating: false
        });
      } else {
        // Sử dụng API để chuyển hướng thay vì mở link trực tiếp
        window.open(`/api/links?url=${encodeURIComponent(encryptedOriginalUrl)}`, '_blank');
      }
    } catch (error) {
      console.error('Lỗi khi xử lý link:', error);
      // Ẩn loading
      setProcessingLink(false);
      
      // Mở URL với thông tin đã xử lý
      if (isYoutubeLink(processedUrlInfo.url)) {
        openYoutubeModal(processedUrlInfo.url, title);
      } else if (isGoogleDriveFolder(processedUrlInfo.url)) {
        window.open(processedUrlInfo.url, '_blank');
      } else if (isPdfLink(processedUrlInfo.url) || isGoogleDriveLink(processedUrlInfo.url)) {
        // Nếu là Google Drive và chưa có URL đã xử lý, hiển thị thông báo đang cập nhật
        if (isGoogleDriveLink(processedUrlInfo.url) && !processedUrlInfo.isProcessed) {
          setPdfModal({ 
            isOpen: true, 
            fileUrl: null, 
            title: title,
            isUpdating: true
          });
        } else {
          setPdfModal({ 
            isOpen: true, 
            fileUrl: processedUrlInfo.url, 
            title: title,
            isUpdating: false
          });
        }
      } else {
        window.open(processedUrlInfo.url, '_blank');
      }
    }
  };

  // Tải thông tin khóa học khi component được tạo
  useEffect(() => {
    fetchCourseDetail();
  }, [id]);

  // Set sheet đầu tiên nếu có dữ liệu sheets
  useEffect(() => {
    if (course?.originalData?.sheets && course.originalData.sheets.length > 0) {
      setActiveSheet(0);
    }
  }, [course]);

  // Điều chỉnh kích thước cột dựa trên nội dung
  useEffect(() => {
    setTimeout(() => {
      const adjustColumnWidths = () => {
        const contentCells = document.querySelectorAll('.column-content');
        
        contentCells.forEach(cell => {
          const textLength = cell.textContent?.trim().length || 0;
          
          if (textLength < 30) {
            cell.style.width = 'fit-content';
            cell.style.minWidth = '100px';
            cell.style.maxWidth = '150px';
          } else if (textLength < 100) {
            cell.style.width = 'fit-content';
            cell.style.minWidth = '150px';
            cell.style.maxWidth = '250px';
          } else {
            cell.style.width = 'auto';
            cell.style.minWidth = '200px';
            cell.style.maxWidth = '350px';
          }
        });
      };
      
      adjustColumnWidths();
    }, 100);
  }, [activeSheet, course]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8 relative overflow-hidden">
          <div className="relative z-10">
          <div className="text-center py-10">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-lg text-gray-700 font-medium">Đang tải thông tin khóa học...</p>
              <p className="text-gray-500 text-sm">Vui lòng đợi trong giây lát</p>
              {cacheStatus === 'hit' && (
                <p className="text-xs text-indigo-600 mt-2">Đang tải từ bộ nhớ đệm...</p>
              )}
            </div>
          </div>
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-indigo-500 to-purple-600 animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8 relative">
          <div className="bg-red-50 p-6 rounded-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center">
              <div className="flex-shrink-0 bg-red-100 rounded-full p-3 mr-4 mb-4 sm:mb-0">
                <ExclamationCircleIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-red-800 mb-2">Đã xảy ra lỗi</h3>
                <div className="mt-2 text-sm text-red-700 mb-4">
                  <p>{error}</p>
                </div>
                <div className="mt-4 flex space-x-3">
                  <button
                    onClick={handleRetry}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 shadow-md"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="-ml-0.5 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Thử lại
                  </button>
                  <button
                    onClick={() => router.push('/khoa-hoc')}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 shadow-md"
                  >
                    <ArrowLeftIcon className="-ml-0.5 mr-2 h-4 w-4" />
                    Quay lại danh sách
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8 relative">
          <div className="text-center py-10">
            <div className="inline-block text-amber-500 mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Không tìm thấy khóa học</h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">Khóa học bạn đang tìm kiếm không tồn tại hoặc đã bị xóa.</p>
            <button
              onClick={() => router.push('/khoa-hoc')}
              className="inline-flex items-center px-5 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 transition-all duration-200 shadow-md"
            >
              <ArrowLeftIcon className="-ml-0.5 mr-2 h-5 w-5" />
              Quay lại danh sách khóa học
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-2 sm:p-6">
      {/* Loading overlay khi đang xử lý link */}
      <LoadingOverlay isVisible={processingLink} message="Đang tải tài nguyên..." />
      
      <div className="mx-auto bg-white rounded-xl shadow-lg">
        {/* Tiêu đề và thông tin khóa học */}
        <div className="pt-6 px-4 sm:px-8 pb-3 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-indigo-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <button
                onClick={() => router.push('/khoa-hoc')}
                className="inline-flex items-center text-indigo-600 hover:text-indigo-800 mb-4 transition-colors"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-1" />
                <span className="text-sm font-medium">Quay lại</span>
              </button>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {course.name || 'Chi tiết khóa học'}
              </h1>
            </div>
            <button
              onClick={handleRetry}
              className="flex items-center px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors mb-2 sm:mb-0"
              title="Làm mới dữ liệu"
              disabled={loading}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className={`h-5 w-5 mr-1 ${loading ? 'animate-spin' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loading ? 'Đang tải...' : 'Làm mới'}
            </button>
          </div>
        </div>
        
        {/* Dữ liệu khóa học */}
        {course.originalData && (
          <div className="">
            

            {/* Hiển thị dữ liệu dưới dạng bảng */}
            {course.originalData?.sheets && course.originalData.sheets.length > 0 && (
              <div className="mt-6 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Chọn khóa học khi có nhiều sheet */}
                {course.originalData?.sheets && course.originalData.sheets.length > 1 && (
                  <div className="border-b border-gray-200 px-4 sm:px-6 py-4 bg-gradient-to-r from-gray-50 to-white">
                    <h3 className="text-base font-medium text-gray-800 mb-3 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                      </svg>
                      Chọn khóa học:
                    </h3>
                    <div className="flex flex-wrap gap-2 overflow-x-auto pb-2">
                      {course.originalData.sheets.map((sheet, index) => (
                        <button
                          key={index}
                          onClick={() => setActiveSheet(index)}
                          className={`
                            px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap
                            ${activeSheet === index 
                              ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md' 
                              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                            }
                          `}
                        >
                          <div className="flex items-center">
                            <span>{getSheetTitle(index, course.originalData.sheets)}</span>
                            {sheet?.data?.[0]?.rowData && (
                              <span className={`text-xs ml-2 px-2 py-0.5 rounded-full ${
                                activeSheet === index ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {(sheet.data[0].rowData.length - 1) || 0}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  {/* Hiển thị sheet được chọn */}
                  <div key={activeSheet} className="mb-0">
                    <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-indigo-100 flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2">
                      <div className="font-medium text-gray-800 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <span className="font-bold text-indigo-800">{getSheetTitle(activeSheet, course.originalData.sheets)}</span>
                      </div>
                      {course.originalData.sheets[activeSheet]?.data?.[0]?.rowData && (
                        <div className="text-sm bg-indigo-600 text-white px-3 py-1 rounded-full font-medium shadow-sm ml-7 sm:ml-0">
                          Tổng số: {(course.originalData.sheets[activeSheet].data[0].rowData.length - 1) || 0} buổi
                        </div>
                      )}
                    </div>
                    
                    {/* Chọn chế độ xem cho thiết bị di động */}
                    <div className="md:hidden pb-2 pt-1 px-2 flex items-center justify-between border-b border-gray-200">
                      <div className="text-sm font-medium text-gray-700">Chế độ xem:</div>
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => setViewMode('table')}
                          className={`px-3 py-1 text-xs rounded-md flex items-center ${
                            viewMode === 'table' 
                              ? 'bg-indigo-600 text-white' 
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Bảng
                        </button>
                        <button 
                          onClick={() => setViewMode('list')}
                          className={`px-3 py-1 text-xs rounded-md flex items-center ${
                            viewMode === 'list' 
                              ? 'bg-indigo-600 text-white' 
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                          </svg>
                          Danh sách
                        </button>
                      </div>
                    </div>

                    {/* Chế độ xem bảng */}
                    {viewMode === 'table' ? (
                      course.originalData.sheets[activeSheet]?.data?.[0]?.rowData && course.originalData.sheets[activeSheet].data[0].rowData.length > 1 ? (
                        <div className="relative">
                          <div className="md:hidden bg-blue-50 p-2 border-b border-blue-100 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-2 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            <span className="text-sm font-bold text-blue-700">Vuốt ngang để xem toàn bộ bảng</span>
                          </div>
                          <div className="overflow-x-auto pb-2" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'thin' }}>
                            <table className="w-full divide-y divide-gray-200 border-collapse" style={{ tableLayout: 'auto' }}>
                              <thead>
                                <tr className="bg-gradient-to-r from-indigo-600 to-indigo-700">
                                  {course.originalData.sheets[activeSheet].data[0].rowData[0]?.values?.map((cell, index) => (
                                    <th 
                                      key={index} 
                                      className={`px-2 py-3 text-left text-xs font-medium text-white uppercase tracking-wider ${
                                        index === 0 
                                        ? 'text-center min-w-[90px] w-auto break-words hyphens-auto sticky left-0 z-20 bg-indigo-700 shadow-lg border-r-2 border-indigo-500' 
                                        : 'content-title min-w-[100px] max-w-[350px]'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="break-words">{cell.formattedValue || ''}</span>
                                        {index > 0 && 
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-1 opacity-70 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                                          </svg>
                                        }
                                      </div>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {course.originalData.sheets[activeSheet].data[0].rowData.slice(1).map((row, rowIndex) => (
                                  <tr 
                                    key={rowIndex} 
                                    className="group hover:bg-indigo-50 transition-colors duration-150"
                                  >
                                    {row.values && row.values.map((cell, cellIndex) => {
                                      // Xác định loại link nếu có
                                      const originalUrl = cell.userEnteredFormat?.textFormat?.link?.uri || cell.hyperlink;
                                      const { url } = getUpdatedUrl(originalUrl);
                                      const isLink = url ? true : false;
                                      const linkType = isLink 
                                        ? isYoutubeLink(url) 
                                          ? 'youtube' 
                                          : isPdfLink(url) 
                                            ? 'pdf' 
                                            : isGoogleDriveLink(url) 
                                              ? 'drive' 
                                              : 'external'
                                        : null;
                                      
                                      // Hàm format ngày tháng
                                      const formatDate = (dateStr) => {
                                        if (!dateStr) return '';
                                        // Tách ngày/tháng và năm
                                        const parts = dateStr.match(/^(\d{1,2}\/\d{1,2})\/(\d{4})$/);
                                        if (parts) {
                                          return (
                                            <>
                                              <div className="font-medium">{parts[1]}</div>
                                              <div className="text-xs opacity-80">{parts[2]}</div>
                                            </>
                                          );
                                        }
                                        return dateStr;
                                      };
                                      
                                      return (
                                        <td 
                                          key={cellIndex} 
                                          className={`px-2 py-3 border-r border-gray-100 last:border-r-0 ${
                                            cellIndex === 0 
                                              ? 'font-semibold text-indigo-700 text-center bg-indigo-100 group-hover:bg-indigo-200 sticky left-0 z-10 min-w-[90px] w-auto shadow-lg border-r-2 border-gray-200 break-words text-sm hyphens-auto' 
                                              : `text-gray-700 content-cell ${
                                                  !cell.formattedValue || cell.formattedValue.length < 30 
                                                    ? 'short-content' 
                                                    : cell.formattedValue.length < 100 
                                                      ? 'medium-content' 
                                                      : 'long-content'
                                                }`
                                          }`}
                                          title={cell.formattedValue || ''}
                                        >
                                          {cellIndex === 0 
                                            ? (
                                              <div className="break-words hyphens-auto text-center" title={cell.formattedValue || ''}>
                                                {cell.formattedValue ? formatDate(cell.formattedValue) : ''}
                                              </div>
                                            )
                                            : isLink
                                              ? (
                                                  <a 
                                                    onClick={(e) => {
                                                      e.preventDefault();
                                                      handleLinkClick(originalUrl, cell.formattedValue);
                                                    }}
                                                    href="#"
                                                    data-type={linkType}
                                                    className="inline-flex items-center text-indigo-600 font-medium hover:text-indigo-800 transition-colors duration-150 group cursor-pointer hover:underline"
                                                    title={cell.formattedValue || (linkType === 'youtube' ? 'Video' : linkType === 'pdf' ? 'PDF' : 'Tài liệu')}
                                                  >
                                                    <span className="icon-container mr-1 flex-shrink-0">
                                                      {linkType === 'youtube' ? (
                                                        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-red-100 text-red-600">
                                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                          </svg>
                                                        </span>
                                                      ) : linkType === 'pdf' ? (
                                                        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-pink-100 text-pink-600">
                                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M9 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                                                          </svg>
                                                        </span>
                                                      ) : linkType === 'drive' ? (
                                                        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-green-100 text-green-600">
                                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                                                          </svg>
                                                        </span>
                                                      ) : (
                                                        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-600">
                                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                          </svg>
                                                        </span>
                                                      )}
                                                    </span>
                                                    <span className="break-words whitespace-normal no-truncate text-sm" title={cell.formattedValue || ''}>
                                                      {cell.formattedValue || (linkType === 'youtube' ? 'Video' : linkType === 'pdf' ? 'PDF' : 'Tài liệu')}
                                                    </span>
                                                  </a>
                                                ) 
                                              : (
                                                  <span className="break-words whitespace-normal no-truncate text-sm" title={cell.formattedValue || ''}>
                                                    {cell.formattedValue || ''}
                                                  </span>
                                                )
                                          }
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 text-center">
                          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-indigo-100 text-indigo-500 mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                          </div>
                          <h3 className="text-lg font-medium text-gray-800 mb-1">Không có dữ liệu</h3>
                          <p className="text-gray-500 max-w-md mx-auto">
                            Hiện không có thông tin buổi học nào được tìm thấy trong hệ thống.
                          </p>
                        </div>
                      )
                    ) : (
                      /* Chế độ xem danh sách cho di động */
                      <div className="md:hidden">
                        {/* ... existing list view content ... */}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* YouTube Modal */}
        {youtubeModal.isOpen && (
          <YouTubeModal
            isOpen={youtubeModal.isOpen}
            onClose={closeYoutubeModal}
            videoId={youtubeModal.videoId}
            title={youtubeModal.title}
          />
        )}
        
        {/* PDF Modal */}
        <PDFModal
          isOpen={pdfModal.isOpen}
          onClose={closePdfModal}
          fileUrl={pdfModal.fileUrl}
          title={pdfModal.title}
        />

        {/* Footer */}
        <div className="mt-6 border-t border-gray-200 pt-6 pb-2 px-4 sm:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-gray-500">
            <div className="mb-4 sm:mb-0">
              <p>© {new Date().getFullYear()} Khoá học 6.0. Hệ thống quản lý học tập.</p>
            </div>
            <div className="flex space-x-4">
              <button onClick={() => router.push('/khoa-hoc')} className="text-indigo-600 hover:text-indigo-800 transition-colors">
                Danh sách khóa học
              </button>
              <button onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} className="text-indigo-600 hover:text-indigo-800 transition-colors">
                Lên đầu trang
              </button>
            </div>
          </div>
        </div>
      </div>
      <style jsx global>{`
        .word-break-all {
          word-break: break-all;
        }
        .word-wrap-breakword {
          word-wrap: break-word;
        }
        table {
          table-layout: auto;
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          width: auto;
          max-width: 300px;
          overflow: visible;
          white-space: normal;
          word-wrap: break-word;
          word-break: break-word;
        }
        th:first-child, td:first-child {
          width: auto;
          min-width: 90px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .content-title {
          width: auto;
          white-space: normal;
          word-break: break-word;
        }
        .content-cell {
          white-space: normal !important;
          word-break: break-word;
          overflow: visible !important;
          text-overflow: clip !important;
          transition: all 0.3s ease;
        }
        .short-content {
          width: fit-content !important;
          min-width: 100px !important;
          max-width: 150px !important;
        }
        .medium-content {
          width: fit-content !important;
          min-width: 150px !important;
          max-width: 250px !important;
        }
        .long-content {
          width: auto !important;
          min-width: 200px !important;
          max-width: 350px !important;
        }
        th:nth-child(3), td:nth-child(3) {
          min-width: 100px;
        }
        th:nth-child(4), td:nth-child(4), th:nth-child(5), td:nth-child(5) {
          min-width: 120px;
        }
        /* Chế độ xem điện thoại */
        @media (max-width: 640px) {
          th, td {
            min-width: 80px !important;
          }
          th:first-child, td:first-child {
            min-width: 85px !important;
          }
          .content-cell {
            min-width: 100px !important;
            max-width: 200px !important;
          }
          .short-content {
            max-width: 120px !important;
          }
          .medium-content, .long-content {
            max-width: 200px !important;
          }
        }
        .line-clamp-3 {
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
        }
        .no-truncate {
          white-space: normal !important;
          overflow: visible !important;
          text-overflow: clip !important;
          display: block !important;
        }
        .hyphens-auto {
          -webkit-hyphens: auto;
          -moz-hyphens: auto;
          hyphens: auto;
        }
        .whitespace-normal {
          white-space: normal;
        }
        .backdrop-blur-sm {
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
