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
      console.error("Lỗi giải mã:", error);
      throw new Error(`Không thể giải mã: ${error.message}`);
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
      return originalUrl;
    }
    
    // Kiểm tra xem processedDriveFiles ở đâu trong cấu trúc dữ liệu
    const processedFiles = course?.processedDriveFiles || [];
    
    if (processedFiles.length === 0) {
      return originalUrl;
    }

    // Tìm trong danh sách các file đã xử lý
    const processedFile = processedFiles.find(file => 
      file.originalUrl === originalUrl && file.processedUrl
    );

    if (processedFile) {
      return processedFile.processedUrl;
    }

    return originalUrl;
  };

  // Lấy thông tin chi tiết của khóa học
  const fetchCourseDetail = async () => {
    setLoading(true);
    setError(null); // Reset error trước khi fetch
    
    try {
      // Sử dụng tham số secure=true để nhận dữ liệu được mã hóa hoàn toàn
      const response = await fetch(`/api/courses/${id}?type=_id&secure=true`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Lỗi ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }
      
      const encryptedResponse = await response.json();
      
      // Kiểm tra nếu nhận được dữ liệu được mã hóa hoàn toàn
      if (encryptedResponse._secureData) {
        try {
          // Giải mã toàn bộ đối tượng
          const fullCourseData = decryptData(encryptedResponse._secureData);
          setCourse(fullCourseData);
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
          const fullCourseData = {
            ...encryptedResponse,
            originalData: decryptedData
          };
          delete fullCourseData._encryptedData;
          
          setCourse(fullCourseData);
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
        setCourse(encryptedResponse);
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
    
    try {
      // Hiển thị loading
      setProcessingLink(true);
      
      // Gọi API để xử lý link
      const response = await fetch('/api/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url,
          type: isYoutubeLink(url) ? 'youtube' : 
                isPdfLink(url) ? 'pdf' : 
                isGoogleDriveLink(url) ? 'drive' : 'external'
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
      } else if (isPdfLink(processedUrl) || isGoogleDriveLink(processedUrl)) {
        openPdfModal(processedUrl, title);
      } else {
        // Sử dụng API để chuyển hướng thay vì mở link trực tiếp
        window.open(`/api/links?url=${encodeURIComponent(encryptedOriginalUrl)}`, '_blank');
      }
    } catch (error) {
      console.error('Lỗi khi xử lý link:', error);
      // Ẩn loading
      setProcessingLink(false);
      
      // Fallback: sử dụng URL gốc nếu có lỗi
      const updatedUrl = getUpdatedUrl(url);
      
      if (isYoutubeLink(updatedUrl)) {
        openYoutubeModal(updatedUrl, title);
      } else if (isPdfLink(updatedUrl) || isGoogleDriveLink(updatedUrl)) {
        openPdfModal(updatedUrl, title);
      } else {
        window.open(updatedUrl, '_blank');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8 relative overflow-hidden">
          <div className="relative z-10">
          <div className="text-center py-10">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-lg text-gray-700 font-medium">Đang tải thông tin khóa học...</p>
              <p className="text-gray-500 text-sm">Vui lòng đợi trong giây lát</p>
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
      <LoadingOverlay isVisible={processingLink} message="Đang xử lý link..." />
      
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg relative overflow-hidden">
        

     
        
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
                    
                    {course.originalData.sheets[activeSheet]?.data?.[0]?.rowData && course.originalData.sheets[activeSheet].data[0].rowData.length > 0 ? (
                      <div className="relative">
                        {/* Chỉ báo cuộn ngang cho điện thoại */}
                        <div className="md:hidden bg-blue-50 p-2 border-b border-blue-100 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                          <span className="text-sm text-blue-700">Vuốt ngang để xem đầy đủ nội dung</span>
                        </div>
                        
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                              <tr className="bg-gradient-to-r from-indigo-600 to-indigo-700">
                                {course.originalData.sheets[activeSheet].data[0].rowData[0]?.values?.map((cell, index) => (
                                  <th 
                                    key={index} 
                                    className={`px-3 sm:px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider ${
                                      index === 0 ? 'text-center w-14 sm:w-16' : ''
                                    } ${index > 2 ? 'hidden sm:table-cell' : ''}`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span>{cell.formattedValue || ''}</span>
                                      {index > 0 && 
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                                        </svg>
                                      }
                                    </div>
                                  </th>
                                ))}
                                {/* Cột thêm mobile */}
                                <th className="sm:hidden w-16"></th>
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
                                    const url = getUpdatedUrl(originalUrl);
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
                                    
                                    return (
                                      <td 
                                        key={cellIndex} 
                                        className={`px-3 sm:px-6 py-2.5 sm:py-4 text-sm border-r border-gray-100 last:border-r-0 ${
                                          cellIndex === 0 
                                            ? 'whitespace-nowrap font-semibold text-indigo-700 text-center bg-indigo-50 group-hover:bg-indigo-100' 
                                            : 'text-gray-700'
                                        } ${cellIndex > 2 ? 'hidden sm:table-cell' : ''}`}
                                      >
                                        {cellIndex === 0 
                                          ? (
                                            <span className="inline-block min-w-[1.5rem]">{cell.formattedValue || ''}</span>
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
                                                >
                                                  <span className="icon-container mr-2">
                                                    {linkType === 'youtube' ? (
                                                      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-red-100 text-red-600">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                        </svg>
                                                      </span>
                                                    ) : linkType === 'pdf' ? (
                                                      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-pink-100 text-pink-600">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
                                                  <span className="break-words line-clamp-2 sm:line-clamp-none">
                                                    {cell.formattedValue || (linkType === 'youtube' ? 'Xem video' : linkType === 'pdf' ? 'Xem PDF' : 'Xem tài liệu')}
                                                  </span>
                                                </a>
                                              ) 
                                            : (
                                                <span className="break-words line-clamp-2 sm:line-clamp-none">
                                                  {cell.formattedValue || ''}
                                                </span>
                                              )
                                          }
                                      </td>
                                    );
                                  })}

                                  {/* Hiển thị nút "Chi tiết" chỉ trên mobile khi có hơn 3 cột */}
                                  {row.values && row.values.length > 3 && (
                                    <td className="px-3 py-3 text-right sm:hidden">
                                      <button
                                        onClick={() => {
                                          // Tìm link đầu tiên trong dòng nếu có
                                          const firstLink = row.values.find(cell => 
                                            cell.userEnteredFormat?.textFormat?.link?.uri || cell.hyperlink
                                          );
                                          
                                          if (firstLink) {
                                            const originalUrl = firstLink.userEnteredFormat?.textFormat?.link?.uri || firstLink.hyperlink;
                                            handleLinkClick(originalUrl, firstLink.formattedValue);
                                          }
                                        }}
                                        className="inline-flex items-center justify-center bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-medium hover:bg-indigo-200 transition-colors duration-150 shadow-sm"
                                        data-action="view-details"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                        Chi tiết
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white p-6 sm:p-12 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 mb-6">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-1">Không có dữ liệu</h3>
                        <p className="text-gray-500 max-w-md mx-auto">
                          Hiện không có thông tin buổi học nào được tìm thấy trong hệ thống.
                        </p>
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
              <p>© {new Date().getFullYear()} Kimvan. Hệ thống quản lý học tập.</p>
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
    </div>
  );
}
