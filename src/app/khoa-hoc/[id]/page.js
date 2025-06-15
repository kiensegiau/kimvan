'use client';

import { use } from 'react';
import YouTubeModal from '../components/YouTubeModal';
import YouTubePlaylistModal from '../components/YouTubePlaylistModal';
import PDFModal from '../components/PDFModal';
import LoadingOverlay from '../components/LoadingOverlay';

// Import custom components
import CourseHeader from './components/CourseHeader';
import CourseInfo from './components/CourseInfo';
import LinkedSheets from './components/LinkedSheets';
import LoadingState from './components/LoadingState';
import ErrorState from './components/ErrorState';
import NotFoundState from './components/NotFoundState';

// Import custom hooks
import { useCourseData } from './hooks/useCourseData';
import { useMediaHandlers } from './hooks/useMediaHandlers';

export default function CourseDetailPage({ params }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  
  // Sử dụng custom hooks
  const {
    course,
    loading,
    error,
    activeSheet,
    setActiveSheet,
    isLoaded,
    linkedSheets,
    loadingSheets,
    sheetData,
    loadingSheetData,
    fetchLinkedSheets,
    fetchSheetData,
    setSheetData
  } = useCourseData(id);
  
  const {
    youtubeModal,
    youtubePlaylistModal,
    pdfModal,
    processingLink,
    openYoutubeModal,
    closeYoutubeModal,
    openPdfModal,
    closePdfModal,
    closeYoutubePlaylistModal,
    handleLinkClick,
    getProcessedDriveFile,
    getUpdatedUrl,
    isYoutubeLink,
    isPdfLink,
    isGoogleDriveLink
  } = useMediaHandlers();

  // Hiển thị trạng thái loading
  if (loading) {
    return <LoadingState />;
  }

  // Hiển thị trạng thái lỗi
  if (error) {
    return <ErrorState error={error} />;
  }

  // Hiển thị trạng thái không tìm thấy khóa học
  if (!course) {
    return <NotFoundState />;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-2 sm:p-6">
      <div className={`bg-white rounded-lg shadow p-4 sm:p-8 relative transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
        {/* Header with course title */}
        <CourseHeader course={course} />
        
        {/* Course info card */}
        <CourseInfo course={course} />
        
        {/* Linked sheets section */}
        <LinkedSheets
          id={id}
          linkedSheets={linkedSheets}
          loadingSheets={loadingSheets}
          fetchLinkedSheets={fetchLinkedSheets}
          sheetData={sheetData}
          loadingSheetData={loadingSheetData}
          fetchSheetData={fetchSheetData}
          handleLinkClick={handleLinkClick}
          setSheetData={setSheetData}
        />
        
        {/* Media Modals */}
        {youtubeModal.isOpen && (
          <YouTubeModal
            videoId={youtubeModal.videoId}
            title={youtubeModal.title}
            onClose={closeYoutubeModal}
          />
        )}
        
        {youtubePlaylistModal.isOpen && (
          <YouTubePlaylistModal
            playlistId={youtubePlaylistModal.playlistId}
            videoId={youtubePlaylistModal.videoId}
            title={youtubePlaylistModal.title}
            onClose={closeYoutubePlaylistModal}
          />
        )}
        
        {pdfModal.isOpen && (
          <PDFModal
            fileUrl={pdfModal.fileUrl}
            title={pdfModal.title}
            onClose={closePdfModal}
          />
        )}
        
        {/* Loading overlay khi đang xử lý link */}
        {processingLink && <LoadingOverlay message="Đang xử lý liên kết..." />}
      </div>
    </div>
  );
} 