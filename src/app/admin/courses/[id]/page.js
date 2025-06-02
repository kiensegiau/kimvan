'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, PencilIcon, TrashIcon, CloudArrowDownIcon, ExclamationCircleIcon, XMarkIcon, ArrowPathIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { AdjustmentsHorizontalIcon, DocumentArrowUpIcon, DocumentMagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { use } from 'react';
import YouTubeModal from '../../components/YouTubeModal';
import PDFModal from '../../components/PDFModal';
import MediaProcessingModal from '../../components/MediaProcessingModal';

export default function CourseDetailPage({ params }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showOriginalDataModal, setShowOriginalDataModal] = useState(false);
  const [originalData, setOriginalData] = useState(null);
  const [loadingOriginalData, setLoadingOriginalData] = useState(false);
  const [downloadingData, setDownloadingData] = useState(false);
  const [downloadError, setDownloadError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [formData, setFormData] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeSheet, setActiveSheet] = useState(0);
  const [youtubeModal, setYoutubeModal] = useState({ isOpen: false, videoId: null, title: '' });
  const [pdfModal, setPdfModal] = useState({ isOpen: false, fileUrl: null, title: '' });
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [processingData, setProcessingData] = useState(false);
  const [processMethod, setProcessMethod] = useState('normalize_data');
  const [processResult, setProcessResult] = useState(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [processingAllDrive, setProcessingAllDrive] = useState(false);
  const [processAllDriveResult, setProcessAllDriveResult] = useState(null);
  const [skipWatermarkRemoval, setSkipWatermarkRemoval] = useState(true);
  const [previewData, setPreviewData] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [applyingSync, setApplyingSync] = useState(false);
  const [previewActiveTab, setPreviewActiveTab] = useState('sheet');
  
  // Hàm lấy tiêu đề của sheet
  const getSheetTitle = (index, sheets) => {
    if (!sheets || !sheets[index]) return `Khóa ${index + 1}`;
    const sheet = sheets[index];
    return sheet?.properties?.title || `Khóa ${index + 1}`;
  };

  // Hàm lấy thông tin chi tiết của khóa học
  const fetchCourseDetail = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/courses/raw/${id}?type=_id`);
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Có lỗi xảy ra khi lấy dữ liệu');
      }
      
      console.log('Dữ liệu khóa học đầy đủ:', result.data);
      setCourse(result.data);
      setFormData(result.data);
      
      // Hiệu ứng fade-in
      setTimeout(() => {
        setIsLoaded(true);
      }, 100);
      
      setLoading(false);
    } catch (error) {
      console.error("Lỗi khi lấy thông tin khóa học:", error);
      setError(`Không thể lấy thông tin khóa học: ${error.message}`);
      setLoading(false);
    }
  };

  // Hàm làm mới dữ liệu khóa học
  const refreshCourseData = async () => {
    try {
      const response = await fetch(`/api/courses/raw/${id}?type=_id`);
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Có lỗi xảy ra khi lấy dữ liệu');
      }
      
      console.log('Dữ liệu khóa học đã được làm mới:', result.data);
      setCourse(result.data);
      setFormData(result.data);
      alert('Đã làm mới dữ liệu khóa học thành công!');
    } catch (error) {
      console.error("Lỗi khi làm mới dữ liệu:", error);
      alert(`Không thể làm mới dữ liệu: ${error.message}`);
    }
  };

  // Hàm tải dữ liệu gốc
  const handleViewOriginalData = async () => {
    if (!course || !course.originalData) return;
    
    setShowOriginalDataModal(true);
    setLoadingOriginalData(true);
    
    try {
      // Lấy dữ liệu gốc từ dữ liệu khóa học
      setOriginalData(course.originalData);
    } catch (error) {
      console.error('Lỗi khi lấy dữ liệu gốc:', error);
      setOriginalData(null);
    } finally {
      setLoadingOriginalData(false);
    }
  };

  // Hàm tải xuống dữ liệu gốc
  const handleDownloadOriginalData = async () => {
    if (!course || !course.originalData) return;
    
    setDownloadingData(true);
    setDownloadError(null);
    
    try {
      // Tạo file JSON để tải xuống từ dữ liệu gốc có sẵn
      const blob = new Blob([JSON.stringify(course.originalData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Tạo thẻ a và kích hoạt sự kiện click để tải xuống
      const a = document.createElement('a');
      a.href = url;
      a.download = `kimvan-course-${course.kimvanId || course._id}.json`;
      document.body.appendChild(a);
      a.click();
      
      // Dọn dẹp
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error('Lỗi khi tải xuống dữ liệu gốc:', error);
      setDownloadError(error.message);
    } finally {
      setDownloadingData(false);
    }
  };

  // Hàm xóa khóa học
  const handleDelete = async () => {
    if (!course) return;
    
    if (window.confirm('Bạn có chắc chắn muốn xóa khóa học này?')) {
      try {
        const response = await fetch(`/api/courses/${course._id}`, {
          method: 'DELETE',
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Không thể xóa khóa học');
        }
        
        alert('Xóa khóa học thành công!');
        router.push('/admin/courses');
      } catch (err) {
        console.error('Lỗi khi xóa khóa học:', err);
        alert(`Lỗi khi xóa khóa học: ${err.message}`);
      }
    }
  };

  // Hàm đồng bộ khóa học
  const handleSync = async () => {
    if (!course || !course.kimvanId) return;
    
    if (window.confirm(`Bạn có muốn đồng bộ khóa học "${course.name}" không?`)) {
      try {
        setSyncing(true);
        setSyncResult({
          success: true,
          message: `Đang đồng bộ khóa học "${course.name}"...`,
          inProgress: true
        });
        
        // Bước 1: Gọi API để xem trước dữ liệu
        console.log(`🔍 Gửi yêu cầu xem trước dữ liệu đồng bộ cho khóa học: ${course.kimvanId}`);
        const previewResponse = await fetch(`/api/courses/${course.kimvanId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            preview: true,
            useCache: false // Không sử dụng cache trong xem trước ban đầu
          })
        });
        
        const previewResult = await previewResponse.json();
        
        if (!previewResponse.ok) {
          throw new Error(previewResult.message || 'Không thể xem trước dữ liệu đồng bộ');
        }
        
        // Hiển thị kết quả xem trước
        console.log('✅ Nhận dữ liệu xem trước thành công:', previewResult);
        setPreviewData(previewResult.previewData);
        setShowPreviewModal(true);
        
        // Cập nhật thông báo
        setSyncResult({
          success: true,
          message: 'Đã tải dữ liệu xem trước, vui lòng xác nhận để tiếp tục',
          inProgress: false,
          preview: true
        });
        
        // Dừng ở đây, đợi người dùng xác nhận từ modal
        
      } catch (err) {
        console.error('Lỗi khi đồng bộ khóa học:', err);
        setSyncResult({
          success: false,
          message: `Lỗi đồng bộ: ${err.message}`,
          inProgress: false
        });
        setSyncing(false);
      }
    }
  };

  // Hàm áp dụng đồng bộ sau khi xem trước
  const applySync = async () => {
    try {
      setApplyingSync(true);
      setSyncResult({
        success: true,
        message: `Đang áp dụng đồng bộ khóa học "${course.name}"...`,
        inProgress: true
      });
      
      // Gọi API để thực hiện đồng bộ thực sự
      const response = await fetch(`/api/courses/${course.kimvanId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          applyProcessedLinks: true, // Thêm tham số để đảm bảo áp dụng các link đã xử lý
          preview: false,
          useCache: true // Sử dụng dữ liệu đã được lưu trong cache
        })
      });
      
      const syncData = await response.json();
      
      if (!response.ok) {
        throw new Error(syncData.message || 'Không thể đồng bộ khóa học');
      }
      
      // Hiển thị kết quả đồng bộ
      setSyncResult({
        success: true,
        message: syncData.message || 'Đồng bộ khóa học thành công',
        stats: syncData.stats,
        inProgress: false
      });
      
      // Tải lại thông tin khóa học
      await fetchCourseDetail();
      
      // Đóng modal xem trước
      setShowPreviewModal(false);
      setPreviewData(null);
      
    } catch (err) {
      console.error('Lỗi khi áp dụng đồng bộ khóa học:', err);
      setSyncResult({
        success: false,
        message: `Lỗi áp dụng đồng bộ: ${err.message}`,
        inProgress: false
      });
    } finally {
      setApplyingSync(false);
      setSyncing(false);
    }
  };

  // Hàm hủy đồng bộ
  const cancelSync = () => {
    setShowPreviewModal(false);
    setPreviewData(null);
    setSyncing(false);
    setSyncResult(null);
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
  
  // Hàm kiểm tra xem URL có phải là Google Drive PDF không
  const isGoogleDrivePdf = (url) => {
    if (!url) return false;
    return (url.includes('drive.google.com') || url.includes('docs.google.com')) && 
           (url.toLowerCase().endsWith('.pdf') || url.includes('pdf'));
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
  const handleLinkClick = (url, title) => {
    if (isYoutubeLink(url)) {
      openYoutubeModal(url, title);
    } else if (isPdfLink(url) || isGoogleDriveLink(url)) {
      openPdfModal(url, title);
    } else {
      window.open(url, '_blank');
    }
  };

  // Hàm xử lý dữ liệu database
  const handleProcessData = async () => {
    if (!course) return;
    
    try {
      setProcessingData(true);
      setError(null);
      setProcessResult(null);
      
      const response = await fetch(`/api/courses/process/${course._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method: processMethod
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Không thể xử lý dữ liệu khóa học');
      }
      
      setProcessResult(data);
      
      // Nếu xử lý thành công, tải lại thông tin khóa học
      if (data.success) {
        await fetchCourseDetail();
      }
    } catch (err) {
      console.error('Lỗi khi xử lý dữ liệu khóa học:', err);
      setProcessResult({
        success: false,
        message: err.message || 'Đã xảy ra lỗi khi xử lý dữ liệu khóa học'
      });
    } finally {
      setProcessingData(false);
    }
  };

  // Hàm xử lý upload file PDF
  const handleUploadPdf = async (e) => {
    e.preventDefault();
    
    if (!pdfFile) {
      alert('Vui lòng chọn file PDF để tải lên');
      return;
    }
    
    // Kiểm tra định dạng file
    if (pdfFile.type !== 'application/pdf') {
      alert('Chỉ hỗ trợ tải lên file PDF');
      return;
    }
    
    try {
      setUploadingPdf(true);
      setUploadResult(null);
      
      const formData = new FormData();
      formData.append('pdf', pdfFile);
      formData.append('courseId', course._id);
      
      const response = await fetch('/api/courses/pdf/upload', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Không thể tải lên file PDF');
      }
      
      setUploadResult({
        success: true,
        message: 'Tải lên file PDF thành công',
        url: data.url,
        filename: data.filename
      });
      
      // Reset file input
      setPdfFile(null);
      
      // Tải lại thông tin khóa học
      await fetchCourseDetail();
    } catch (err) {
      console.error('Lỗi khi tải lên file PDF:', err);
      setUploadResult({
        success: false,
        message: err.message || 'Đã xảy ra lỗi khi tải lên file PDF'
      });
    } finally {
      setUploadingPdf(false);
    }
  };

  // Hàm xử lý chọn file PDF
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setPdfFile(e.target.files[0]);
    }
  };

  // Hàm xử lý tất cả các link Drive trong khóa học
  const handleProcessAllDrive = async () => {
    if (!course) return;
    
    if (window.confirm(`Bạn có muốn xử lý tất cả các link Drive trong khóa học "${course.name}" không?`)) {
      try {
        setProcessingAllDrive(true);
        setProcessAllDriveResult({
          success: true,
          message: `Đang xử lý tất cả các link Drive trong khóa học "${course.name}"...`,
          inProgress: true
        });
        
        const response = await fetch(`/api/courses/${course._id}/process-all-drive`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            skipWatermarkRemoval: skipWatermarkRemoval
          })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.message || 'Không thể xử lý các link Drive');
        }
        
        // Hiển thị kết quả xử lý
        setProcessAllDriveResult({
          success: true,
          message: result.message || 'Xử lý tất cả các link Drive thành công',
          details: result.details || null,
          inProgress: false
        });
        
        // Tải lại thông tin khóa học
        await fetchCourseDetail();
      } catch (err) {
        console.error('Lỗi khi xử lý các link Drive:', err);
        setProcessAllDriveResult({
          success: false,
          message: `Lỗi xử lý: ${err.message}`,
          inProgress: false
        });
      } finally {
        setProcessingAllDrive(false);
      }
    }
  };

  // Hàm kiểm tra và lấy URL đã xử lý
  const getProcessedDriveFile = (originalUrl, rowIndex, cellIndex, sheetIndex) => {
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
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-8 relative">
          <div className="text-center py-10">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600 mb-2"></div>
            <p className="text-gray-500">Đang tải thông tin khóa học...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-8 relative">
          <div className="bg-red-50 p-4 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <ExclamationCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Đã xảy ra lỗi</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => router.push('/admin/courses')}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
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
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-8 relative">
          <div className="text-center py-10">
            <div className="inline-block text-red-500 text-5xl mb-5">⚠️</div>
            <h2 className="text-xl font-medium text-gray-900 mb-2">Không tìm thấy khóa học</h2>
            <p className="text-gray-500 mb-6">Khóa học bạn đang tìm kiếm không tồn tại hoặc đã bị xóa.</p>
            <button
              onClick={() => router.push('/admin/courses')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <ArrowLeftIcon className="-ml-0.5 mr-2 h-4 w-4" />
              Quay lại danh sách khóa học
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-2 sm:p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-4 sm:p-8 relative">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/admin/courses')}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200"
          >
            <ArrowLeftIcon className="-ml-0.5 mr-2 h-4 w-4" />
            Quay lại danh sách
          </button>
          
          <div className="flex flex-wrap gap-2">
            {course?.kimvanId && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {syncing ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
                    Đang đồng bộ...
                  </>
                ) : (
                  <>
                    <ArrowPathIcon className="h-4 w-4 mr-2" />
                    Đồng bộ
                  </>
                )}
              </button>
            )}
            
            <button
              onClick={() => setShowProcessModal(true)}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
            >
              <AdjustmentsHorizontalIcon className="h-4 w-4 mr-2" />
              Xử lý dữ liệu
            </button>
            
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
            >
              <DocumentArrowUpIcon className="h-4 w-4 mr-2" />
              Tải lên PDF
            </button>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                <input
                  id="skipWatermarkRemoval"
                  type="checkbox"
                  checked={skipWatermarkRemoval}
                  onChange={(e) => setSkipWatermarkRemoval(e.target.checked)}
                  className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
                />
                <label htmlFor="skipWatermarkRemoval" className="ml-2 block text-sm text-gray-700">
                  Bỏ qua xử lý watermark
                </label>
              </div>
              
              <button
                onClick={handleProcessAllDrive}
                disabled={processingAllDrive}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
              >
                {processingAllDrive ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <DocumentMagnifyingGlassIcon className="h-4 w-4 mr-2" />
                    Xử lý tất cả PDF Drive
                  </>
                )}
              </button>
            </div>
            
            <button
              onClick={() => router.push(`/admin/courses/edit/${course?._id}`)}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <PencilIcon className="h-4 w-4 mr-2" />
              Chỉnh sửa
            </button>
            
            <button
              onClick={refreshCourseData}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-500 hover:bg-blue-600"
            >
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              Làm mới dữ liệu
            </button>
            
            <button
              onClick={handleDelete}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Xóa
            </button>
          </div>
        </div>
        
        {/* Kết quả xử lý tất cả link Drive */}
        {processAllDriveResult && (
          <div className={`bg-${processAllDriveResult.success ? 'amber' : 'red'}-50 p-4 rounded-md mb-6`}>
            <div className="flex">
              <div className="flex-shrink-0">
                {processAllDriveResult.success ? (
                  <>
                    {processAllDriveResult.inProgress ? (
                      <ArrowPathIcon className="h-5 w-5 text-amber-400 animate-spin" />
                    ) : (
                      <svg className="h-5 w-5 text-amber-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </>
                ) : (
                  <ExclamationCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
                )}
              </div>
              <div className="ml-3">
                <p className={`text-sm font-medium text-${processAllDriveResult.success ? 'amber' : 'red'}-800`}>
                  {processAllDriveResult.message}
                </p>
                {processAllDriveResult.details && !processAllDriveResult.inProgress && (
                  <ul className="mt-2 text-sm text-amber-700 list-disc list-inside">
                    {processAllDriveResult.details.map((detail, index) => (
                      <li key={index}>{detail}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="ml-auto pl-3">
                <div className="-mx-1.5 -my-1.5">
                  <button
                    onClick={() => setProcessAllDriveResult(null)}
                    className={`inline-flex rounded-md p-1.5 text-${processAllDriveResult.success ? 'amber' : 'red'}-500 hover:bg-${processAllDriveResult.success ? 'amber' : 'red'}-100`}
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Kết quả xử lý dữ liệu */}
        {processResult && (
          <div className={`bg-${processResult.success ? 'purple' : 'red'}-50 p-4 rounded-md mb-6`}>
            <div className="flex">
              <div className="flex-shrink-0">
                {processResult.success ? (
                  <svg className="h-5 w-5 text-purple-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <ExclamationCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
                )}
              </div>
              <div className="ml-3">
                <p className={`text-sm font-medium text-${processResult.success ? 'purple' : 'red'}-800`}>
                  {processResult.message}
                </p>
              </div>
              <div className="ml-auto pl-3">
                <div className="-mx-1.5 -my-1.5">
                  <button
                    onClick={() => setProcessResult(null)}
                    className={`inline-flex rounded-md p-1.5 text-${processResult.success ? 'purple' : 'red'}-500 hover:bg-${processResult.success ? 'purple' : 'red'}-100`}
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Kết quả upload PDF */}
        {uploadResult && (
          <div className={`bg-${uploadResult.success ? 'green' : 'red'}-50 p-4 rounded-md mb-6`}>
            <div className="flex">
              <div className="flex-shrink-0">
                {uploadResult.success ? (
                  <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <ExclamationCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
                )}
              </div>
              <div className="ml-3">
                <p className={`text-sm font-medium text-${uploadResult.success ? 'green' : 'red'}-800`}>
                  {uploadResult.message}
                </p>
                {uploadResult.success && uploadResult.url && (
                  <div className="mt-2">
                    <a 
                      href={uploadResult.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {uploadResult.filename || 'Xem file PDF đã tải lên'}
                    </a>
                  </div>
                )}
              </div>
              <div className="ml-auto pl-3">
                <div className="-mx-1.5 -my-1.5">
                  <button
                    onClick={() => setUploadResult(null)}
                    className={`inline-flex rounded-md p-1.5 text-${uploadResult.success ? 'green' : 'red'}-500 hover:bg-${uploadResult.success ? 'green' : 'red'}-100`}
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Thông báo kết quả đồng bộ */}
        {syncResult && (
          <div className={`bg-${syncResult.success ? 'green' : 'red'}-50 p-4 rounded-md mb-6`}>
            <div className="flex">
              <div className="flex-shrink-0">
                {syncResult.success ? (
                  <>
                    {syncResult.inProgress ? (
                      <ArrowPathIcon className="h-5 w-5 text-green-400 animate-spin" />
                    ) : (
                      <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </>
                ) : (
                  <ExclamationCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
                )}
              </div>
              <div className="ml-3">
                <p className={`text-sm font-medium text-${syncResult.success ? 'green' : 'red'}-800`}>
                  {syncResult.message}
                </p>
              </div>
              <div className="ml-auto pl-3">
                <div className="-mx-1.5 -my-1.5">
                  <button
                    onClick={() => setSyncResult(null)}
                    className={`inline-flex rounded-md p-1.5 text-${syncResult.success ? 'green' : 'red'}-500 hover:bg-${syncResult.success ? 'green' : 'red'}-100`}
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Thông tin khóa học */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900">Thông tin khóa học</h3>
          </div>
          <div className="p-4 sm:p-6">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Tên khóa học</dt>
                <dd className="mt-1 text-lg font-medium text-gray-900 break-words">{course.name || 'Chưa có tên'}</dd>
              </div>
              
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Mô tả</dt>
                <dd className="mt-1 text-sm text-gray-900">{course.description || 'Chưa có mô tả'}</dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-gray-500">Giá (VND)</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {course.price ? course.price.toLocaleString('vi-VN') : 'Chưa có giá'}
                </dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-gray-500">Trạng thái</dt>
                <dd className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    course.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {course.status === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                  </span>
                </dd>
              </div>
              
              {course.kimvanId && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">ID Kimvan</dt>
                  <dd className="mt-1 text-sm text-gray-900 break-words">{course.kimvanId}</dd>
                </div>
              )}
              
              {course.updatedAt && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Cập nhật lần cuối</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(course.updatedAt).toLocaleString('vi-VN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
        
        {/* Dữ liệu gốc khóa học */}
        {course.originalData && (
          <div className="mt-6 bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h3 className="text-lg font-medium text-gray-900">Dữ liệu gốc</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleViewOriginalData}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Xem JSON
                </button>
                
                <button
                  onClick={handleDownloadOriginalData}
                  disabled={downloadingData}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                >
                  {downloadingData ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 animate-spin mr-1" />
                      Đang tải...
                    </>
                  ) : (
                    <>
                      <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                      Tải xuống
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Chọn khóa học khi có nhiều sheet */}
            {course.originalData?.sheets && course.originalData.sheets.length > 1 && (
              <div className="border-b border-gray-200 px-4 sm:px-6 py-4 bg-gray-50">
                <h3 className="text-base font-medium text-gray-800 mb-3">Chọn khóa học:</h3>
                <div className="flex flex-wrap gap-2 overflow-x-auto pb-2">
                  {course.originalData.sheets.map((sheet, index) => (
                    <button
                      key={index}
                      onClick={() => setActiveSheet(index)}
                      className={`
                        px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap
                        ${activeSheet === index 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }
                      `}
                    >
                      <div className="flex items-center">
                        <span>{getSheetTitle(index, course.originalData.sheets)}</span>
                        {sheet?.data?.[0]?.rowData && (
                          <span className={`text-xs ml-2 px-2 py-0.5 rounded-full ${
                            activeSheet === index ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
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

            {/* Hiển thị dữ liệu dưới dạng bảng */}
            {course.originalData?.sheets && course.originalData.sheets.length > 0 && (
              <div className="overflow-x-auto">
                {/* Hiển thị sheet được chọn */}
                <div key={activeSheet} className="mb-6">
                  <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2">
                    <div className="font-medium text-gray-800 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      {getSheetTitle(activeSheet, course.originalData.sheets)}
                    </div>
                    {course.originalData.sheets[activeSheet]?.data?.[0]?.rowData && course.originalData.sheets[activeSheet].data[0].rowData.length > 0 ? (
                      <div className="text-sm text-gray-600 ml-7 sm:ml-0">
                        Tổng số: <span className="font-medium text-blue-600">
                          {(course.originalData.sheets[activeSheet].data[0].rowData.length - 1) || 0} buổi
                        </span>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600 ml-7 sm:ml-0">
                        Không có dữ liệu buổi học
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
                      
                      <div className="overflow-x-auto pb-4">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead>
                            <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
                              {course.originalData.sheets[activeSheet].data[0].rowData[0]?.values?.map((cell, index) => (
                                <th 
                                  key={index} 
                                  className={`px-3 sm:px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider ${
                                    index === 0 ? 'text-center w-12 sm:w-16' : ''
                                  } ${index > 2 ? 'hidden sm:table-cell' : ''}`}
                                >
                                  <div className="flex items-center">
                                    {cell.formattedValue || ''}
                                    {index > 0 && 
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                                className="group hover:bg-blue-50 transition-colors duration-150"
                              >
                                {row.values && row.values.map((cell, cellIndex) => {
                                  // Xác định loại link nếu có
                                  const url = cell.userEnteredFormat?.textFormat?.link?.uri || cell.hyperlink;
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
                                      className={`px-3 sm:px-6 py-3 sm:py-4 text-sm ${
                                        cellIndex === 0 
                                          ? 'whitespace-nowrap font-medium text-gray-900 text-center' 
                                          : 'text-gray-700'
                                      } ${cellIndex > 2 ? 'hidden sm:table-cell' : ''}`}
                                    >
                                      {cellIndex === 0 
                                        ? (cell.formattedValue || '')
                                        : isLink
                                          ? (
                                              <div>
                                                <a 
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    handleLinkClick(url, cell.formattedValue);
                                                  }}
                                                  href={url}
                                                  className="inline-flex items-center text-blue-600 font-medium hover:text-blue-800 transition-colors duration-150 group cursor-pointer"
                                                >
                                                  <span className="break-words line-clamp-2 sm:line-clamp-none">
                                                    {cell.formattedValue || (linkType === 'youtube' ? 'Xem video' : linkType === 'pdf' ? 'Xem PDF' : 'Xem tài liệu')}
                                                  </span>
                                                  <span className="ml-1.5 p-1 rounded-md group-hover:bg-blue-100 transition-colors duration-150">
                                                    {linkType === 'youtube' ? (
                                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                      </svg>
                                                    ) : linkType === 'pdf' ? (
                                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                      </svg>
                                                    ) : linkType === 'drive' ? (
                                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                                                      </svg>
                                                    ) : (
                                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                      </svg>
                                                    )}
                                                  </span>
                                                </a>

                                                {/* Hiển thị link đã xử lý nếu là Google Drive PDF */}
                                                {isGoogleDrivePdf(url) && (
                                                  <div className="mt-1.5">
                                                    {(() => {
                                                      const processedFile = getProcessedDriveFile(url, rowIndex, cellIndex, activeSheet);
                                                      
                                                      if (processedFile) {
                                                        return (
                                                          <div className="flex flex-col space-y-1">
                                                            <a 
                                                              onClick={(e) => {
                                                                e.preventDefault();
                                                                handleLinkClick(processedFile.processedUrl, `[Đã xử lý] ${cell.formattedValue}`);
                                                              }}
                                                              href={processedFile.processedUrl}
                                                              className="inline-flex items-center text-green-600 text-xs font-medium hover:text-green-800 transition-colors duration-150"
                                                            >
                                                              <DocumentMagnifyingGlassIcon className="h-3.5 w-3.5 mr-1" />
                                                              <span>Bản đã xử lý watermark</span>
                                                            </a>
                                                            <div className="text-xs text-gray-500">
                                                              Xử lý {new Date(processedFile.processedAt).toLocaleDateString('vi-VN')}
                                                            </div>
                                                          </div>
                                                        );
                                                      } else {
                                                        return (
                                                          <div className="text-xs text-amber-600 flex items-center">
                                                            <ExclamationCircleIcon className="h-3.5 w-3.5 mr-1" />
                                                            <span>Chưa xử lý watermark</span>
                                                          </div>
                                                        );
                                                      }
                                                    })()}
                                                  </div>
                                                )}
                                              </div>
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

                                {/* Hiển thị nút "Xem thêm" chỉ trên mobile khi có hơn 3 cột */}
                                {row.values && row.values.length > 3 && (
                                  <td className="px-3 py-3 text-right sm:hidden">
                                    <button
                                      onClick={() => {
                                        // Tìm link đầu tiên trong dòng nếu có
                                        const firstLink = row.values.find(cell => 
                                          cell.userEnteredFormat?.textFormat?.link?.uri || cell.hyperlink
                                        );
                                        
                                        if (firstLink) {
                                          const url = firstLink.userEnteredFormat?.textFormat?.link?.uri || firstLink.hyperlink;
                                          handleLinkClick(url, firstLink.formattedValue);
                                        }
                                      }}
                                      className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs font-medium hover:bg-blue-100"
                                    >
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
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 text-blue-600 mb-6">
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
            )}
            
            {downloadError && (
              <div className="p-6 text-sm text-red-600">
                <p>Lỗi khi tải xuống: {downloadError}</p>
              </div>
            )}
          </div>
        )}
        
        {/* Modal xem dữ liệu gốc */}
        {showOriginalDataModal && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Dữ liệu gốc</h3>
                <button
                  onClick={() => setShowOriginalDataModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              <div className="p-4 sm:p-6 overflow-auto max-h-[calc(90vh-8rem)]">
                {loadingOriginalData ? (
                  <div className="text-center py-4">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600 mb-2"></div>
                    <p className="text-gray-500">Đang tải dữ liệu gốc...</p>
                  </div>
                ) : originalData ? (
                  <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-xs font-mono">
                    {JSON.stringify(originalData, null, 2)}
                  </pre>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-500">Không có dữ liệu gốc hoặc đã xảy ra lỗi khi tải dữ liệu.</p>
                  </div>
                )}
              </div>
              
              <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => setShowOriginalDataModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  Đóng
                </button>
              </div>
            </div>
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

        {/* Modal xử lý dữ liệu */}
        {showProcessModal && (
          <MediaProcessingModal
            isOpen={showProcessModal}
            onClose={() => setShowProcessModal(false)}
            courseData={course}
            courseId={course._id}
          />
        )}
        
        {/* Modal upload PDF */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Tải lên file PDF</h3>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              <form onSubmit={handleUploadPdf}>
                <div className="p-4 sm:p-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Chọn file PDF</label>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                        className="block w-full text-sm text-gray-500
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-md file:border-0
                          file:text-sm file:font-semibold
                          file:bg-blue-50 file:text-blue-700
                          hover:file:bg-blue-100"
                        disabled={uploadingPdf}
                      />
                    </div>
                    
                    {pdfFile && (
                      <div className="bg-green-50 p-3 rounded-md">
                        <p className="text-sm text-green-700">
                          File đã chọn: {pdfFile.name} ({Math.round(pdfFile.size / 1024)} KB)
                        </p>
                      </div>
                    )}
                    
                    <div className="bg-yellow-50 px-4 py-3 rounded-md">
                      <p className="text-sm text-yellow-700">
                        Chỉ hỗ trợ tải lên file PDF. Kích thước tối đa 10MB.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 mr-3"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={!pdfFile || uploadingPdf}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {uploadingPdf ? (
                      <span className="flex items-center">
                        <ArrowPathIcon className="animate-spin h-4 w-4 mr-2" />
                        Đang tải lên...
                      </span>
                    ) : (
                      'Tải lên'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal xem trước dữ liệu đồng bộ */}
        {showPreviewModal && previewData && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600 flex justify-between items-center">
                <h3 className="text-lg font-medium text-white">Xem trước dữ liệu đồng bộ</h3>
                <button
                  onClick={cancelSync}
                  className="text-white hover:text-gray-200"
                  disabled={applyingSync}
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              {/* Tab Navigation */}
              <div className="px-6 pt-4 border-b border-gray-200">
                <div className="flex space-x-4">
                  <button
                    onClick={() => setPreviewActiveTab('sheet')}
                    className={`pb-3 px-1 text-sm font-medium ${
                      previewActiveTab === 'sheet'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Dữ liệu Sheet
                  </button>
                  <button
                    onClick={() => setPreviewActiveTab('processed')}
                    className={`pb-3 px-1 text-sm font-medium flex items-center ${
                      previewActiveTab === 'processed'
                        ? 'text-green-600 border-b-2 border-green-600'
                        : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span>Link đã xử lý</span>
                    {previewData.allLinks?.processed && (
                      <span className="ml-2 bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                        {previewData.allLinks.processed.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setPreviewActiveTab('unprocessed')}
                    className={`pb-3 px-1 text-sm font-medium flex items-center ${
                      previewActiveTab === 'unprocessed'
                        ? 'text-amber-600 border-b-2 border-amber-600'
                        : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span>Link chưa xử lý</span>
                    {previewData.allLinks?.unprocessed && (
                      <span className="ml-2 bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                        {previewData.allLinks.unprocessed.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>
              
              <div className="overflow-auto max-h-[calc(90vh-12rem)]">
                {/* Tab Thông tin khóa học - Luôn hiển thị */}
                <div className="p-6">
                  {/* Thông tin khóa học */}
                  <div className="mb-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-3">Thông tin khóa học</h4>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <dt className="text-sm font-medium text-gray-500">Tên khóa học</dt>
                          <dd className="mt-1 text-base font-medium text-gray-900">{previewData.courseInfo.name}</dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-sm font-medium text-gray-500">Mô tả</dt>
                          <dd className="mt-1 text-sm text-gray-900">{previewData.courseInfo.description}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Giá</dt>
                          <dd className="mt-1 text-sm text-gray-900">{previewData.courseInfo.price.toLocaleString('vi-VN')} VND</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Trạng thái</dt>
                          <dd className="mt-1">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              previewData.courseInfo.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {previewData.courseInfo.status === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                            </span>
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                  
                  {/* Thống kê đồng bộ */}
                  <div className="mb-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-3">Thống kê đồng bộ</h4>
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <div className="flex flex-col bg-white p-3 rounded-lg border border-blue-100">
                          <dt className="text-sm font-medium text-gray-500">Tổng số sheet</dt>
                          <dd className="mt-1 text-xl font-semibold text-blue-600">{previewData.stats.totalSheets}</dd>
                        </div>
                        <div className="flex flex-col bg-white p-3 rounded-lg border border-blue-100">
                          <dt className="text-sm font-medium text-gray-500">Tổng số link</dt>
                          <dd className="mt-1 text-xl font-semibold text-blue-600">{previewData.stats.totalLinks}</dd>
                        </div>
                        <div className="flex flex-col bg-white p-3 rounded-lg border border-blue-100">
                          <dt className="text-sm font-medium text-gray-500">Link đã xử lý</dt>
                          <dd className="mt-1 text-xl font-semibold text-green-600">{previewData.stats.processedLinks}</dd>
                        </div>
                        <div className="flex flex-col bg-white p-3 rounded-lg border border-blue-100">
                          <dt className="text-sm font-medium text-gray-500">File đã xử lý giữ lại</dt>
                          <dd className="mt-1 text-xl font-semibold text-purple-600">{previewData.stats.preservedProcessedFiles}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>

                {/* Tab Sheet */}
                {previewActiveTab === 'sheet' && previewData.sampleSheet && (
                  <div className="px-6 pb-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-3">
                      Xem trước sheet: {previewData.sampleSheet.title}
                      <span className="ml-2 text-sm text-gray-500">
                        ({previewData.sampleSheet.rowCount} hàng)
                      </span>
                    </h4>
                    
                    {/* Thêm cảnh báo về link giả */}
                    <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-red-700">
                            <strong>Cảnh báo quan trọng:</strong> Tất cả link được trả về từ API Kimvan đều là giả mạo, trỏ đến cùng một file. Không thể mở trực tiếp trong Chrome. Hệ thống đã được điều chỉnh để duy trì cấu trúc và vị trí của tất cả link.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Công cụ Debug dữ liệu */}
                    <div className="mb-4 bg-blue-50 border border-blue-200 p-4 rounded-lg">
                      <h5 className="text-base font-medium text-blue-800 mb-2">Công cụ phân tích dữ liệu</h5>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <button
                          onClick={() => {
                            console.log('=== PHÂN TÍCH DỮ LIỆU ===');
                            console.log('1. Dữ liệu cũ (processedLinks):', previewData.processedLinks);
                            console.log('2. Dữ liệu mới (sheet data):', previewData.sampleSheet);
                            
                            // In ra một số mẫu processedLinks để phân tích
                            if (previewData.processedLinks && previewData.processedLinks.length > 0) {
                              console.log('1.1 Mẫu 5 processedLinks đầu tiên:');
                              for (let i = 0; i < Math.min(5, previewData.processedLinks.length); i++) {
                                const link = previewData.processedLinks[i];
                                console.log(`Link #${i}:`, {
                                  sheet: link.position.sheet,
                                  row: link.position.row,
                                  col: link.position.col,
                                  originalUrl: link.originalUrl,
                                  processedUrl: link.processedUrl
                                });
                              }
                            }
                            
                            // Tạo bảng đối chiếu để so sánh
                            const comparisonTable = [];
                            
                            // Duyệt qua dữ liệu mới
                            if (previewData.sampleSheet && previewData.sampleSheet.firstFewRows) {
                              const sheetTitle = previewData.sampleSheet.title;
                              console.log('2.1 Tên sheet:', sheetTitle);
                              
                              previewData.sampleSheet.firstFewRows.forEach((row, rowIndex) => {
                                if (row.values) {
                                  row.values.forEach((cell, cellIndex) => {
                                    const originalUrl = cell.userEnteredFormat?.textFormat?.link?.uri || cell.hyperlink;
                                    const processedUrl = cell.processedUrl || (cell.processedLinks && cell.processedLinks.url);
                                    
                                    if (originalUrl) {
                                      // Tìm xem có link đã xử lý trước đó không - tìm theo vị trí chính xác
                                      let matchingProcessedLink = null;
                                      if (previewData.processedLinks && Array.isArray(previewData.processedLinks)) {
                                        matchingProcessedLink = previewData.processedLinks.find(link => 
                                          link.position.sheet === sheetTitle && 
                                          link.position.row === rowIndex && 
                                          link.position.col === cellIndex
                                        );
                                        
                                        // Nếu không tìm thấy, thử tìm theo cách khác
                                        if (!matchingProcessedLink) {
                                          // In thông tin debug
                                          console.log(`2.2 Không tìm thấy link cho vị trí [${sheetTitle}|${rowIndex}|${cellIndex}]`);
                                          
                                          // Tìm kiếm tất cả vị trí có row gần bằng với rowIndex
                                          const nearMatches = previewData.processedLinks.filter(link => 
                                            link.position.sheet === sheetTitle && 
                                            Math.abs(link.position.row - rowIndex) <= 1 && 
                                            link.position.col === cellIndex
                                          );
                                          
                                          if (nearMatches.length > 0) {
                                            console.log(`2.3 Tìm thấy ${nearMatches.length} vị trí gần đúng:`, nearMatches);
                                          }
                                        } else {
                                          console.log(`2.4 Tìm thấy link khớp cho vị trí [${sheetTitle}|${rowIndex}|${cellIndex}]`);
                                        }
                                      }
                                      
                                      comparisonTable.push({
                                        position: `Hàng ${rowIndex + 1}, Cột ${cellIndex + 1}`,
                                        positionKey: `${sheetTitle}|${rowIndex}|${cellIndex}`,
                                        displayText: cell.formattedValue || 'N/A',
                                        originalUrl,
                                        processedUrl: processedUrl || 'Chưa xử lý',
                                        hasProcessed: !!processedUrl,
                                        matchInOldData: !!matchingProcessedLink,
                                        oldProcessedUrl: matchingProcessedLink ? matchingProcessedLink.processedUrl : 'Không có'
                                      });
                                    }
                                  });
                                }
                              });
                            }
                            
                            console.log('3. Bảng đối chiếu:', comparisonTable);
                            
                            // Phân tích vị trí của các link đã xử lý
                            console.log('4. Phân tích vị trí các link đã xử lý:');
                            if (previewData.allLinks && previewData.allLinks.processed) {
                              const processedByPosition = {};
                              
                              previewData.allLinks.processed.forEach(link => {
                                const posKey = `${link.position.sheet}|${link.position.row}|${link.position.col}`;
                                processedByPosition[posKey] = {
                                  originalUrl: link.originalUrl,
                                  processedUrl: link.processedUrl,
                                  displayText: link.displayText
                                };
                              });
                              
                              console.log('   - Phân tích theo vị trí:', processedByPosition);
                            }
                            
                            // Phân tích so sánh theo vị trí
                            console.log('5. So sánh theo vị trí:');
                            if (previewData.processedLinks && Array.isArray(previewData.processedLinks)) {
                              const linksByPosition = {};
                              
                              previewData.processedLinks.forEach(link => {
                                const posKey = `${link.position.sheet}|${link.position.row}|${link.position.col}`;
                                linksByPosition[posKey] = {
                                  originalUrl: link.originalUrl,
                                  processedUrl: link.processedUrl
                                };
                              });
                              
                              console.log('   - Links theo vị trí:', linksByPosition);
                              
                              // Kiểm tra khớp vị trí trong dữ liệu mới
                              if (previewData.sampleSheet && previewData.sampleSheet.firstFewRows) {
                                const sheetTitle = previewData.sampleSheet.title;
                                const matchResults = [];
                                
                                previewData.sampleSheet.firstFewRows.forEach((row, rowIndex) => {
                                  if (row.values) {
                                    row.values.forEach((cell, cellIndex) => {
                                      const posKey = `${sheetTitle}|${rowIndex}|${cellIndex}`;
                                      const hasMatch = !!linksByPosition[posKey];
                                      const originalUrl = cell.userEnteredFormat?.textFormat?.link?.uri || cell.hyperlink;
                                      
                                      if (originalUrl) {
                                        matchResults.push({
                                          position: posKey,
                                          hasMatch,
                                          displayText: cell.formattedValue || 'N/A',
                                          newUrl: originalUrl,
                                          oldUrl: hasMatch ? linksByPosition[posKey].originalUrl : 'N/A',
                                          processedUrl: hasMatch ? linksByPosition[posKey].processedUrl : 'N/A'
                                        });
                                      }
                                    });
                                  }
                                });
                                
                                console.log('   - Kết quả khớp vị trí:', matchResults);
                              }
                            }
                            
                            alert('Đã ghi log phân tích dữ liệu vào Console. Mở DevTools để xem chi tiết.');
                          }}
                          className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
                        >
                          Log dữ liệu để phân tích
                        </button>
                        
                        <button
                          onClick={() => {
                            console.log('=== TẤT CẢ DỮ LIỆU ===');
                            console.log('Toàn bộ dữ liệu xem trước:', previewData);
                            alert('Đã ghi log toàn bộ dữ liệu xem trước vào Console. Mở DevTools để xem chi tiết.');
                          }}
                          className="px-3 py-2 bg-purple-600 text-white text-sm font-medium rounded hover:bg-purple-700"
                        >
                          Log toàn bộ dữ liệu xem trước
                        </button>
                        
                        {previewData.debug && (
                          <button
                            onClick={() => {
                              console.log('=== THÔNG TIN DEBUG ===');
                              console.log('Debug info:', previewData.debug);
                              
                              if (previewData.debug.positionMapInfo) {
                                console.log('1. Thông tin bản đồ vị trí:');
                                console.log(`- Tổng số entry: ${previewData.debug.positionMapInfo.totalEntries}`);
                                console.log(`- Số entry đã xử lý: ${previewData.debug.positionMapInfo.processedEntries}`);
                                console.log('- Mẫu entries:', previewData.debug.positionMapInfo.sampleEntries);
                              }
                              
                              if (previewData.debug.processedDriveFilesInfo) {
                                console.log('2. Thông tin về processedDriveFiles:');
                                console.log(`- Tổng số file: ${previewData.debug.processedDriveFilesInfo.totalFiles}`);
                                console.log(`- Số file có vị trí: ${previewData.debug.processedDriveFilesInfo.filesWithPosition}`);
                                console.log('- Mẫu files:', previewData.debug.processedDriveFilesInfo.sampleFiles);
                              }
                              
                              if (previewData.debug.matchingStats) {
                                console.log('3. Thống kê việc khớp link:');
                                console.log(`- Tổng số link trong dữ liệu mới: ${previewData.debug.matchingStats.totalLinks}`);
                                console.log(`- Số link đã khớp và áp dụng: ${previewData.debug.matchingStats.processedMatches}`);
                                
                                // Tính tỷ lệ
                                const matchRate = previewData.debug.matchingStats.totalLinks > 0 
                                  ? ((previewData.debug.matchingStats.processedMatches / previewData.debug.matchingStats.totalLinks) * 100).toFixed(2)
                                  : 0;
                                
                                console.log(`- Tỷ lệ khớp: ${matchRate}%`);
                              }
                              
                              alert('Đã ghi log thông tin debug vào Console. Mở DevTools để xem chi tiết.');
                            }}
                            className="px-3 py-2 bg-amber-600 text-white text-sm font-medium rounded hover:bg-amber-700"
                          >
                            Log thông tin debug
                          </button>
                        )}
                      </div>
                      
                      {/* Thêm thống kê về các file đã xử lý */}
                      {previewData.processedLinks && (
                        <div className="mb-3 bg-green-50 p-3 rounded border border-green-200">
                          <h6 className="text-sm font-medium text-green-800 mb-2">
                            Thống kê các link đã xử lý ({previewData.processedLinks.length} link)
                          </h6>
                          <div className="text-xs text-green-700">
                            <div className="grid grid-cols-2 gap-2">
                              <div>Link theo vị trí: {previewData.processedLinks.length}</div>
                              <div>Link trong dữ liệu mới: {previewData.stats.processedLinks}</div>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              if (!previewData.processedLinks) return;
                              
                              // Nhóm theo sheet
                              const linksBySheet = {};
                              previewData.processedLinks.forEach(link => {
                                const sheet = link.position.sheet;
                                if (!linksBySheet[sheet]) {
                                  linksBySheet[sheet] = [];
                                }
                                linksBySheet[sheet].push(link);
                              });
                              
                              console.log('=== CHI TIẾT LINK ĐÃ XỬ LÝ ===');
                              console.log('1. Tổng số link:', previewData.processedLinks.length);
                              console.log('2. Link theo sheet:', linksBySheet);
                              
                              // Kiểm tra khớp vị trí trong dữ liệu mới
                              if (previewData.sampleSheet && previewData.sampleSheet.firstFewRows) {
                                const positionKeys = previewData.processedLinks.map(
                                  link => `${link.position.sheet}|${link.position.row}|${link.position.col}`
                                );
                                
                                console.log('3. Vị trí của các link đã xử lý:', positionKeys);
                              }
                              
                              alert('Đã ghi log chi tiết các link đã xử lý vào Console. Mở DevTools để xem chi tiết.');
                            }}
                            className="mt-2 px-3 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700"
                          >
                            Phân tích chi tiết các link đã xử lý
                          </button>
                        </div>
                      )}
                      
                      <div className="bg-white p-3 rounded border border-blue-200 text-sm text-blue-800">
                        <p className="mb-2"><strong>Hướng dẫn sử dụng:</strong></p>
                        <ol className="list-decimal list-inside space-y-1">
                          <li>Nhấn vào các nút trên để log dữ liệu vào Console</li>
                          <li>Mở DevTools bằng cách nhấn F12 hoặc Ctrl+Shift+I (Windows/Linux) hoặc Cmd+Option+I (Mac)</li>
                          <li>Chuyển đến tab Console để xem dữ liệu được log</li>
                          <li>Phân tích sự khác biệt giữa dữ liệu cũ và mới</li>
                        </ol>
                      </div>
                    </div>
                    
                    {/* Thêm cảnh báo về link giả */}
                    <div className="mb-4 bg-yellow-50 border-l-4 border-yellow-400 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-yellow-700">
                            <strong>Lưu ý:</strong> Hệ thống sẽ tự động giữ lại các link đã xử lý trước đó dù API trả về link giả.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {previewData.sampleSheet.firstFewRows && previewData.sampleSheet.firstFewRows.length > 0 ? (
                      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                              <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
                                {previewData.sampleSheet.firstFewRows[0]?.values?.map((cell, index) => (
                                  <th 
                                    key={index} 
                                    className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider"
                                  >
                                    {cell.formattedValue || `Cột ${index + 1}`}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {previewData.sampleSheet.firstFewRows.slice(1).map((row, rowIndex) => (
                                <tr key={rowIndex} className="hover:bg-gray-50">
                                  {row.values && row.values.map((cell, cellIndex) => {
                                    // Kiểm tra xem cell có phải là link đã xử lý không
                                    const hasProcessedUrl = !!cell.processedUrl;
                                    // Kiểm tra có link không (link gốc hoặc link đã xử lý)
                                    const originalUrl = cell.userEnteredFormat?.textFormat?.link?.uri || cell.hyperlink;
                                    const processedUrl = cell.processedUrl || (cell.processedLinks && cell.processedLinks.url);
                                    
                                    // Kiểm tra link có vẻ giả mạo (tất cả các link đều trỏ đến một drive.google.com)
                                    const seemsSuspicious = originalUrl && originalUrl.includes('drive.google.com/file/d/1zEQxmW1VXzwFz4gw65mwpRSV7QiArLAr');
                                    
                                    // Kiểm tra xem có phải link YouTube không
                                    const isYoutube = originalUrl && (originalUrl.includes('youtube.com') || originalUrl.includes('youtu.be'));
                                    // Trích xuất YouTube video ID nếu có
                                    const extractYoutubeId = (url) => {
                                      if (!url) return null;
                                      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
                                      const match = url.match(regExp);
                                      return (match && match[2].length === 11) ? match[2] : null;
                                    };
                                    const youtubeId = isYoutube ? extractYoutubeId(originalUrl) : null;
                                    
                                    return (
                                      <td 
                                        key={cellIndex} 
                                        className={`px-6 py-4 whitespace-nowrap text-sm ${
                                          hasProcessedUrl ? 'bg-green-50' : ''
                                        }`}
                                      >
                                        {originalUrl ? (
                                          <div className="text-gray-900">
                                            <div className="flex items-center space-x-2">
                                              <a 
                                                href={processedUrl || originalUrl} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:text-blue-800 hover:underline truncate max-w-xs"
                                                title={processedUrl || originalUrl}
                                                onClick={(e) => {
                                                  // Ngăn mở link giả mạo
                                                  if (!processedUrl && (originalUrl.includes('drive.google.com/file/d/1zEQxmW1VXzwFz4gw65mwpRSV7QiArLAr') || originalUrl.includes('/api/shared?link='))) {
                                                    e.preventDefault();
                                                    alert('⚠️ Đây là link giả mạo từ API Kimvan. Không thể mở trực tiếp.');
                                                    return false;
                                                  }
                                                }}
                                              >
                                                {cell.formattedValue || originalUrl}
                                              </a>
                                              {isYoutube && youtubeId && (
                                                <button
                                                  onClick={() => openYoutubeModal(originalUrl, cell.formattedValue)}
                                                  className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                                                  title="Xem video YouTube"
                                                >
                                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                                  </svg>
                                                </button>
                                              )}
                                            </div>
                                            
                                            {originalUrl && (
                                              <div className={`mt-1 text-xs ${seemsSuspicious ? 'text-red-500' : 'text-gray-500'} truncate flex items-center`} title={originalUrl}>
                                                {seemsSuspicious && (
                                                  <svg className="h-3 w-3 mr-1 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                  </svg>
                                                )}
                                                <span>{seemsSuspicious ? 'Link giả mạo - không mở trong Chrome' : 'Link API trả về: '}</span>
                                                {!seemsSuspicious && <span className="truncate">{originalUrl}</span>}
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="text-gray-900">{cell.formattedValue || ''}</div>
                                        )}
                                        
                                        {hasProcessedUrl && (
                                          <div className="mt-1 flex items-center text-xs text-green-600">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span 
                                              className="cursor-help" 
                                              title={processedUrl}
                                            >
                                              Đã áp dụng link xử lý watermark
                                            </span>
                                          </div>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        
                        {previewData.sampleSheet.rowCount > 5 && (
                          <div className="px-6 py-3 bg-gray-50 text-center text-sm text-gray-500">
                            Chỉ hiển thị 5 hàng đầu tiên trong tổng số {previewData.sampleSheet.rowCount} hàng
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-gray-50 p-4 rounded-lg text-center text-gray-500">
                        Không có dữ liệu hàng nào để hiển thị
                      </div>
                    )}
                  </div>
                )}
                
                {/* Tab Link đã xử lý */}
                {previewActiveTab === 'processed' && (
                  <div className="px-6 pb-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-3">
                      Danh sách các link đã xử lý watermark ({previewData.allLinks?.processed?.length || 0})
                    </h4>
                    
                    {/* Thêm cảnh báo về link giả trong tab link đã xử lý */}
                    <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-red-700">
                            <strong>Cảnh báo quan trọng:</strong> Các "link gốc" được trả về từ API Kimvan đều là giả mạo, trỏ đến cùng một file. Không thể mở trực tiếp trong Chrome. Chỉ nên sử dụng các link đã xử lý (link màu xanh lá).
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Công cụ Debug chi tiết các link đã xử lý */}
                    <div className="mb-4 bg-blue-50 border border-blue-200 p-4 rounded-lg">
                      <h5 className="text-base font-medium text-blue-800 mb-2">Phân tích link đã xử lý</h5>
                      <button
                        onClick={() => {
                          console.log('=== CHI TIẾT LINK ĐÃ XỬ LÝ ===');
                          if (previewData.allLinks && previewData.allLinks.processed) {
                            // Nhóm theo sheet, row để dễ phân tích
                            const groupedBySheet = {};
                            
                            previewData.allLinks.processed.forEach(link => {
                              const sheetName = link.position.sheet;
                              if (!groupedBySheet[sheetName]) {
                                groupedBySheet[sheetName] = [];
                              }
                              groupedBySheet[sheetName].push({
                                row: link.position.row + 1,
                                col: link.position.col + 1,
                                displayText: link.displayText,
                                originalUrl: link.originalUrl,
                                processedUrl: link.processedUrl
                              });
                            });
                            
                            console.log('Link đã xử lý theo sheet:', groupedBySheet);
                            
                            // Kiểm tra các link trùng lặp
                            const urlCounts = {};
                            let duplicateUrls = 0;
                            
                            previewData.allLinks.processed.forEach(link => {
                              if (!urlCounts[link.originalUrl]) {
                                urlCounts[link.originalUrl] = 0;
                              }
                              urlCounts[link.originalUrl]++;
                              
                              if (urlCounts[link.originalUrl] > 1) {
                                duplicateUrls++;
                              }
                            });
                            
                            console.log('Số link trùng lặp:', duplicateUrls);
                            console.log('Thống kê các link trùng lặp:', Object.entries(urlCounts)
                              .filter(([_, count]) => count > 1)
                              .map(([url, count]) => ({ url, count }))
                            );
                          } else {
                            console.log('Không có dữ liệu link đã xử lý');
                          }
                          
                          alert('Đã ghi log chi tiết link đã xử lý vào Console. Mở DevTools để xem chi tiết.');
                        }}
                        className="px-3 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700"
                      >
                        Phân tích chi tiết link đã xử lý
                      </button>
                    </div>
                    
                    {/* Thêm cảnh báo về link giả */}
                    <div className="mb-4 bg-yellow-50 border-l-4 border-yellow-400 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-yellow-700">
                            <strong>Cảnh báo:</strong> API Kimvan có thể trả về các link giả mạo. Nhiều link trỏ đến cùng một file Drive. Hệ thống vẫn sẽ giữ lại các link đã được xử lý trước đó.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {previewData.allLinks?.processed && previewData.allLinks.processed.length > 0 ? (
                      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                              <tr className="bg-gradient-to-r from-green-600 to-emerald-600">
                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-1/4">Nội dung</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-1/4">Vị trí</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-1/4">Link gốc</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-1/4">Link đã xử lý</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {previewData.allLinks.processed.map((link, index) => {
                                // Kiểm tra xem có phải link YouTube không
                                const isYoutube = link.originalUrl && (link.originalUrl.includes('youtube.com') || link.originalUrl.includes('youtu.be'));
                                // Kiểm tra link có vẻ giả mạo
                                const seemsSuspicious = link.originalUrl && link.originalUrl.includes('drive.google.com/file/d/1zEQxmW1VXzwFz4gw65mwpRSV7QiArLAr');
                                // Trích xuất YouTube video ID nếu có
                                const extractYoutubeId = (url) => {
                                  if (!url) return null;
                                  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
                                  const match = url.match(regExp);
                                  return (match && match[2].length === 11) ? match[2] : null;
                                };
                                const youtubeId = isYoutube ? extractYoutubeId(link.originalUrl) : null;
                                
                                return (
                                  <tr key={index} className="hover:bg-green-50">
                                    <td className="px-6 py-4 text-sm">
                                      <div className="text-gray-900 font-medium break-words flex items-center space-x-2">
                                        <span>{link.displayText}</span>
                                        {isYoutube && youtubeId && (
                                          <button
                                            onClick={() => openYoutubeModal(link.originalUrl, link.displayText)}
                                            className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                                            title="Xem video YouTube"
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                            </svg>
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-700">
                                      Sheet: {link.position.sheet}, Hàng: {link.position.row + 1}, Cột: {link.position.col + 1}
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                      <div>
                                        <a 
                                          href={link.originalUrl} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-blue-600 hover:text-blue-800 hover:underline flex items-center group"
                                          title={link.originalUrl}
                                          onClick={(e) => {
                                            // Ngăn mở link giả mạo
                                            if (link.originalUrl.includes('drive.google.com/file/d/1zEQxmW1VXzwFz4gw65mwpRSV7QiArLAr') || link.originalUrl.includes('/api/shared?link=')) {
                                              e.preventDefault();
                                              alert('⚠️ Đây là link giả mạo từ API Kimvan. Không thể mở trực tiếp. Vui lòng sử dụng link đã xử lý.');
                                              return false;
                                            }
                                          }}
                                        >
                                          <span className="truncate max-w-xs block group-hover:text-blue-800">{link.originalUrl}</span>
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                          </svg>
                                        </a>
                                        {isYoutube && (
                                          <div className="mt-1 text-xs text-red-500 flex items-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                            </svg>
                                            <span>Link YouTube thật</span>
                                          </div>
                                        )}
                                        {seemsSuspicious && (
                                          <div className="mt-1 text-xs text-orange-500 flex items-center">
                                            <svg className="h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            <span>Link có thể không đáng tin cậy</span>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                      <a 
                                        href={link.processedUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-green-600 hover:text-green-800 hover:underline flex items-center group"
                                        title={link.processedUrl}
                                      >
                                        <span className="truncate max-w-xs block group-hover:text-green-800">{link.processedUrl}</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                      </a>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 p-4 rounded-lg text-center text-gray-500">
                        Không có link nào đã được xử lý
                      </div>
                    )}
                  </div>
                )}
                
                {/* Tab Link chưa xử lý */}
                {previewActiveTab === 'unprocessed' && (
                  <div className="px-6 pb-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-3">
                      Danh sách các link chưa xử lý watermark ({previewData.allLinks?.unprocessed?.length || 0})
                    </h4>
                    
                    {/* Thêm cảnh báo về link giả trong tab link chưa xử lý */}
                    <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-red-700">
                            <strong>Cảnh báo quan trọng:</strong> API Kimvan trả về các link giả mạo. Tất cả link hiển thị ở đây đều là giả mạo và không thể mở trực tiếp trong Chrome. Sau khi đồng bộ, bạn cần xử lý thủ công các link này.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {previewData.allLinks?.unprocessed && previewData.allLinks.unprocessed.length > 0 ? (
                      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                              <tr className="bg-gradient-to-r from-amber-500 to-amber-600">
                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-1/3">Nội dung</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-1/3">Vị trí</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-1/3">Link gốc</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {previewData.allLinks.unprocessed.map((link, index) => {
                                // Kiểm tra xem có phải link YouTube không
                                const isYoutube = link.originalUrl && (link.originalUrl.includes('youtube.com') || link.originalUrl.includes('youtu.be'));
                                // Kiểm tra link có vẻ giả mạo
                                const seemsSuspicious = link.originalUrl && link.originalUrl.includes('drive.google.com/file/d/1zEQxmW1VXzwFz4gw65mwpRSV7QiArLAr');
                                // Trích xuất YouTube video ID nếu có
                                const extractYoutubeId = (url) => {
                                  if (!url) return null;
                                  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
                                  const match = url.match(regExp);
                                  return (match && match[2].length === 11) ? match[2] : null;
                                };
                                const youtubeId = isYoutube ? extractYoutubeId(link.originalUrl) : null;
                                
                                return (
                                  <tr key={index} className="hover:bg-amber-50">
                                    <td className="px-6 py-4 text-sm">
                                      <div className="text-gray-900 font-medium break-words flex items-center space-x-2">
                                        <span>{link.displayText}</span>
                                        {isYoutube && youtubeId && (
                                          <button
                                            onClick={() => openYoutubeModal(link.originalUrl, link.displayText)}
                                            className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                                            title="Xem video YouTube"
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                            </svg>
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-700">
                                      Sheet: {link.position.sheet}, Hàng: {link.position.row + 1}, Cột: {link.position.col + 1}
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                      <div>
                                        <a 
                                          href={link.originalUrl} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-blue-600 hover:text-blue-800 hover:underline flex items-center group"
                                          title={link.originalUrl}
                                          onClick={(e) => {
                                            // Ngăn mở link giả mạo
                                            if (link.originalUrl.includes('drive.google.com/file/d/1zEQxmW1VXzwFz4gw65mwpRSV7QiArLAr') || link.originalUrl.includes('/api/shared?link=')) {
                                              e.preventDefault();
                                              alert('⚠️ Đây là link giả mạo từ API Kimvan. Không thể mở trực tiếp.');
                                              return false;
                                            }
                                          }}
                                        >
                                          <span className="truncate max-w-xs block group-hover:text-blue-800">{link.originalUrl}</span>
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                          </svg>
                                        </a>
                                        {isYoutube && (
                                          <div className="mt-1 text-xs text-red-500 flex items-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                            </svg>
                                            <span>Link YouTube thật</span>
                                          </div>
                                        )}
                                        {seemsSuspicious && (
                                          <div className="mt-1 text-xs text-orange-500 flex items-center">
                                            <svg className="h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            <span>Link có thể không đáng tin cậy</span>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 p-4 rounded-lg text-center text-gray-500">
                        Không có link nào chưa được xử lý
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  onClick={cancelSync}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  disabled={applyingSync}
                >
                  Hủy đồng bộ
                </button>
                <button
                  onClick={applySync}
                  disabled={applyingSync}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {applyingSync ? (
                    <span className="flex items-center">
                      <ArrowPathIcon className="animate-spin h-4 w-4 mr-2" />
                      Đang áp dụng...
                    </span>
                  ) : (
                    'Áp dụng đồng bộ'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
