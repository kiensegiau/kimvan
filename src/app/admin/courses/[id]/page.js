'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import CryptoJS from 'crypto-js';
import YouTubeModal from '../../components/YouTubeModal';
import PDFModal from '../../components/PDFModal';
import MediaProcessingModal from '../../components/MediaProcessingModal';

// Import new components
import CourseHeader from './components/CourseHeader';
import CourseInfo from './components/CourseInfo';
import LinkedSheets from './components/LinkedSheets';
import OriginalData from './components/OriginalData';
import ApiSheetData from './components/ApiSheetData';
import { 
  SyncResultNotification, 
  ProcessResultNotification, 
  UploadResultNotification, 
  ProcessAllDriveResultNotification,
  ProcessAllSheetsResultNotification
} from './components/Notifications';
import {
  JsonInputModal,
  PreviewModal,
  ProcessModal,
  UploadModal
} from './components/ModalComponents';
import {
  QuickEditModal,
  EditRowModal,
  AddRowModal,
  AddCourseModal,
  OriginalDataModal
} from './components/EditModals';

// Import custom hooks
import { useCourseData } from './hooks/useCourseData';
import { useModalState } from './hooks/useModalState';
import { useRowEditing } from './hooks/useRowEditing';
import { useProcessing } from './hooks/useProcessing';
import { useMediaHandlers } from './hooks/useMediaHandlers';
import { useApiSheetData } from './hooks/useApiSheetData';

export default function CourseDetailPage({ params }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  
  // Sync state
  const [syncResult, setSyncResult] = useState(null);
  const [applyingSync, setApplyingSync] = useState(false);
  
  // Processing state
  const [processResult, setProcessResult] = useState(null);
  const [skipWatermarkRemoval, setSkipWatermarkRemoval] = useState(true);
  
  // Sử dụng các custom hooks
  const { 
    course,
    setCourse,
    loading,
    error, 
    formData,
    isLoaded,
    activeSheet,
    setActiveSheet,
    getSheetTitle,
    linkedSheets,
    loadingSheets,
    sheetData,
    loadingSheetData,
    fetchLinkedSheets,
    fetchSheetData,
    fetchCourseDetail,
    refreshCourseData,
    setSheetData
  } = useCourseData(id);
  
  // Sử dụng API Sheet
  const {
    apiSheetData,
    loadingApiSheet,
    apiSheetError,
    activeApiSheet,
    setActiveApiSheet,
    fetchApiSheetData,
    fetchSheetDetail
  } = useApiSheetData(id);
  
  const modalState = useModalState();
  
  const { 
    handleOpenEditRowModal,
    handleEditRowChange,
    handleUpdateRow,
    handleInsertRow,
    handleNewRowChange,
    handleAddRow,
    handleQuickEdit,
    handleUpdateCell,
    updatingRow,
    addingRow,
    updatingCell
  } = useRowEditing({
    course,
    setCourse,
    activeSheet,
    setShowQuickEditModal: modalState.setShowQuickEditModal,
    setQuickEditData: modalState.setQuickEditData,
    setShowAddRowModal: modalState.setShowAddRowModal,
    setNewRowData: modalState.setNewRowData,
    setInsertPosition: modalState.setInsertPosition,
    setShowEditRowModal: modalState.setShowEditRowModal,
    setEditRowData: modalState.setEditRowData,
    setEditingRowIndex: modalState.setEditingRowIndex,
    setActualRowIndex: modalState.setActualRowIndex,
    fetchCourseDetail
  });
  
  const {
    openYoutubeModal,
    closeYoutubeModal,
    openPdfModal,
    closePdfModal,
    handleLinkClick,
    getProcessedDriveFile
  } = useMediaHandlers({
    setYoutubeModal: modalState.setYoutubeModal,
    setPdfModal: modalState.setPdfModal
  });
  
  const {
    handleDelete,
    handleAddCourse,
    handleSync,
    handleJsonSubmit,
    applySync,
    cancelSync,
    handleProcessData,
    handleUploadPdf,
    handleProcessAllDrive,
    handleProcessAllSheets,
    processingData,
    processingAllDrive,
    processAllDriveResult,
    setProcessAllDriveResult,
    processingAllSheets,
    processAllSheetsResult,
    setProcessAllSheetsResult,
    syncing
  } = useProcessing({
    course,
    fetchCourseDetail,
    setShowJsonInputModal: modalState.setShowJsonInputModal,
    setJsonInput: modalState.setJsonInput,
    setJsonInputError: modalState.setJsonInputError,
    setSyncing: (value) => {},  // Handled by hook internally
    setSyncResult,
    setPreviewData: modalState.setPreviewData,
    setShowPreviewModal: modalState.setShowPreviewModal,
    setApplyingSync
  });
  
  // Hàm xử lý newCourseChange
  const handleNewCourseChange = (field, value) => {
    modalState.setNewCourseData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Hàm wrapper cho các hàm cần tham số bổ sung
  const handleAddCourseWrapper = async () => {
    await handleAddCourse(
      modalState.newCourseData,
      modalState.setAddingCourse,
      modalState.setShowAddCourseModal
    );
  };
  
  const handleUploadPdfWrapper = async (e) => {
    e.preventDefault();
    await handleUploadPdf(
      modalState.pdfFile, 
      modalState.setUploadingPdf,
      modalState.setUploadResult,
      modalState.setPdfFile
    );
  };
  
  const handleUpdateRowWrapper = async () => {
    await handleUpdateRow(modalState.editRowData, modalState.actualRowIndex);
  };
  
  const handleUpdateCellWrapper = async () => {
    await handleUpdateCell(modalState.quickEditData);
  };
  
  const handleAddRowWrapper = async () => {
    await handleAddRow(modalState.newRowData, modalState.insertPosition);
  };
  
  const handleProcessDataWrapper = async () => {
    const result = await handleProcessData(modalState.processMethod);
    setProcessResult(result);
  };
  
  const handleViewOriginalDataWrapper = () => {
    modalState.handleViewOriginalData(course);
  };
  
  const applyPreviewData = async () => {
    await applySync(modalState.previewData);
  };

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
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
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
                    <svg className="-ml-0.5 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
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
              <svg className="-ml-0.5 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              Quay lại danh sách khóa học
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-2 sm:p-6">
      <div className="bg-white rounded-lg shadow p-4 sm:p-8 relative">
        {/* Header with action buttons */}
        <CourseHeader 
          course={course}
          syncing={syncing}
          processingAllDrive={processingAllDrive}
          skipWatermarkRemoval={skipWatermarkRemoval}
          setSkipWatermarkRemoval={setSkipWatermarkRemoval}
          handleSync={handleSync}
          setShowProcessModal={modalState.setShowProcessModal}
          setShowUploadModal={modalState.setShowUploadModal}
          handleProcessAllDrive={handleProcessAllDrive}
          refreshCourseData={refreshCourseData}
          handleDelete={handleDelete}
          setShowAddCourseModal={modalState.setShowAddCourseModal}
        />
        
        {/* Notifications */}
        <ProcessAllDriveResultNotification 
          processAllDriveResult={processAllDriveResult} 
          setProcessAllDriveResult={setProcessAllDriveResult} 
        />
        <ProcessAllSheetsResultNotification 
          processAllSheetsResult={processAllSheetsResult} 
          setProcessAllSheetsResult={setProcessAllSheetsResult} 
        />
        
        <ProcessResultNotification 
          processResult={processResult} 
          setProcessResult={setProcessResult} 
        />
        
        <UploadResultNotification 
          uploadResult={modalState.uploadResult} 
          setUploadResult={modalState.setUploadResult} 
        />
        
        <SyncResultNotification 
          syncResult={syncResult} 
          setSyncResult={setSyncResult} 
        />
        
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
            setSheetData={setSheetData}
            handleProcessAllSheets={handleProcessAllSheets}
            processingAllSheets={processingAllSheets}
          />
        
        {/* API Sheet Data section - New */}
        {/* Removed to avoid duplication with LinkedSheets */}
        
        {/* Original data section - Hide or remove this section if not needed */}
        {/*
        {course.originalData && (
          <OriginalData
            course={course}
            activeSheet={activeSheet}
            setActiveSheet={setActiveSheet}
            getSheetTitle={getSheetTitle}
            handleViewOriginalData={handleViewOriginalDataWrapper}
            handleDownloadOriginalData={() => modalState.handleDownloadOriginalData(course)}
            downloadingData={modalState.downloadingData}
            setShowAddRowModal={modalState.setShowAddRowModal}
            handleOpenEditRowModal={handleOpenEditRowModal}
            handleInsertRow={handleInsertRow}
            handleQuickEdit={handleQuickEdit}
          />
        )}
        */}
        
        {/* Modals */}
        <JsonInputModal 
          isOpen={modalState.showJsonInputModal}
          onClose={() => modalState.setShowJsonInputModal(false)}
          jsonInput={modalState.jsonInput}
          setJsonInput={modalState.setJsonInput}
          jsonInputError={modalState.jsonInputError}
          handleJsonSubmit={handleJsonSubmit}
          syncing={syncing}
        />
        
        <PreviewModal
          isOpen={modalState.showPreviewModal}
          onClose={() => modalState.setShowPreviewModal(false)}
          previewData={modalState.previewData}
          activeTab={modalState.previewActiveTab}
          setActiveTab={modalState.setPreviewActiveTab}
          applyingSync={applyingSync}
          applySync={applyPreviewData}
          cancelSync={cancelSync}
        />
        
        <ProcessModal
          isOpen={modalState.showProcessModal}
          onClose={() => modalState.setShowProcessModal(false)}
          processMethod={modalState.processMethod}
          setProcessMethod={modalState.setProcessMethod}
          handleProcessData={handleProcessDataWrapper}
          processingData={processingData}
        />
        
        <UploadModal
          isOpen={modalState.showUploadModal}
          onClose={() => modalState.setShowUploadModal(false)}
          handleFileChange={(e) => modalState.setPdfFile(e.target.files?.[0] || null)}
          handleUploadPdf={handleUploadPdfWrapper}
          pdfFile={modalState.pdfFile}
          uploadingPdf={modalState.uploadingPdf}
        />
        
        <QuickEditModal
          isOpen={modalState.showQuickEditModal}
          onClose={() => modalState.setShowQuickEditModal(false)}
          quickEditData={modalState.quickEditData}
          setQuickEditData={modalState.setQuickEditData}
          handleUpdateCell={handleUpdateCellWrapper}
          updatingCell={updatingCell}
        />
        
        <EditRowModal
          isOpen={modalState.showEditRowModal}
          onClose={() => modalState.setShowEditRowModal(false)}
          editRowData={modalState.editRowData}
          handleEditRowChange={handleEditRowChange}
          handleUpdateRow={handleUpdateRowWrapper}
          updatingRow={updatingRow}
        />
        
        <AddRowModal
          isOpen={modalState.showAddRowModal}
          onClose={() => modalState.setShowAddRowModal(false)}
          newRowData={modalState.newRowData}
          handleNewRowChange={handleNewRowChange}
          handleAddRow={handleAddRowWrapper}
          addingRow={addingRow}
          insertPosition={modalState.insertPosition}
        />
        
        <AddCourseModal
          isOpen={modalState.showAddCourseModal}
          onClose={() => modalState.setShowAddCourseModal(false)}
          newCourseData={modalState.newCourseData}
          handleNewCourseChange={handleNewCourseChange}
          handleAddCourse={handleAddCourseWrapper}
          addingCourse={modalState.addingCourse}
        />
        
        <OriginalDataModal
          isOpen={modalState.showOriginalDataModal}
          onClose={() => modalState.setShowOriginalDataModal(false)}
          originalData={modalState.originalData}
          loadingOriginalData={modalState.loadingOriginalData}
        />
        
        {/* Media Modals */}
        {modalState.youtubeModal.isOpen && (
          <YouTubeModal
            videoId={modalState.youtubeModal.videoId}
            title={modalState.youtubeModal.title}
            onClose={closeYoutubeModal}
          />
        )}
        
        {modalState.pdfModal.isOpen && (
          <PDFModal
            fileUrl={modalState.pdfModal.fileUrl}
            title={modalState.pdfModal.title}
            onClose={closePdfModal}
          />
        )}
        
        {modalState.showProcessModal && (
          <MediaProcessingModal
            isOpen={true}
            onClose={() => modalState.setShowProcessModal(false)}
          />
        )}
      </div>
    </div>
  );
}
