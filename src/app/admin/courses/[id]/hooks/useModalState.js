import { useState } from 'react';

export function useModalState() {
  // Modal original data
  const [showOriginalDataModal, setShowOriginalDataModal] = useState(false);
  const [originalData, setOriginalData] = useState(null);
  const [loadingOriginalData, setLoadingOriginalData] = useState(false);
  const [downloadingData, setDownloadingData] = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  // Modal YouTube and PDF
  const [youtubeModal, setYoutubeModal] = useState({ isOpen: false, videoId: null, title: '' });
  const [pdfModal, setPdfModal] = useState({ isOpen: false, fileUrl: null, title: '' });

  // Modal for process data
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [processingData, setProcessingData] = useState(false);
  const [processMethod, setProcessMethod] = useState('normalize_data');
  const [processResult, setProcessResult] = useState(null);

  // Modal for upload
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // Modal for preview
  const [previewData, setPreviewData] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewActiveTab, setPreviewActiveTab] = useState('sheet');

  // Modal for editing rows
  const [showEditRowModal, setShowEditRowModal] = useState(false);
  const [editRowData, setEditRowData] = useState({});
  const [editingRowIndex, setEditingRowIndex] = useState(null);
  const [updatingRow, setUpdatingRow] = useState(false);
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [actualRowIndex, setActualRowIndex] = useState(null);

  // Modal for quick editing
  const [showQuickEditModal, setShowQuickEditModal] = useState(false);
  const [quickEditData, setQuickEditData] = useState({
    rowIndex: null,
    colIndex: null,
    value: '',
    url: '',
    header: ''
  });
  const [updatingCell, setUpdatingCell] = useState(false);

  // Modal for JSON input
  const [showJsonInputModal, setShowJsonInputModal] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [jsonInputError, setJsonInputError] = useState(null);

  // Modal for adding row
  const [showAddRowModal, setShowAddRowModal] = useState(false);
  const [newRowData, setNewRowData] = useState({});
  const [addingRow, setAddingRow] = useState(false);
  const [insertPosition, setInsertPosition] = useState(null);

  // Modal for adding course
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);
  const [newCourseData, setNewCourseData] = useState({
    name: '',
    description: '',
    price: 0,
    status: 'active'
  });
  const [addingCourse, setAddingCourse] = useState(false);

  // Hàm mở modal xem dữ liệu gốc
  const handleViewOriginalData = (course) => {
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
  const handleDownloadOriginalData = (course) => {
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

  return {
    // Original data modal
    showOriginalDataModal,
    setShowOriginalDataModal,
    originalData,
    setOriginalData,
    loadingOriginalData,
    setLoadingOriginalData,
    downloadingData,
    setDownloadingData,
    downloadError,
    setDownloadError,
    handleViewOriginalData,
    handleDownloadOriginalData,

    // YouTube and PDF modal
    youtubeModal,
    setYoutubeModal,
    pdfModal,
    setPdfModal,

    // Process modal
    showProcessModal,
    setShowProcessModal,
    processingData,
    setProcessingData,
    processMethod,
    setProcessMethod,
    processResult,
    setProcessResult,

    // Upload modal
    uploadingPdf,
    setUploadingPdf,
    pdfFile,
    setPdfFile,
    showUploadModal,
    setShowUploadModal,
    uploadResult,
    setUploadResult,

    // Preview modal
    previewData,
    setPreviewData,
    showPreviewModal,
    setShowPreviewModal,
    previewActiveTab,
    setPreviewActiveTab,

    // Edit row modal
    showEditRowModal,
    setShowEditRowModal,
    editRowData,
    setEditRowData,
    editingRowIndex,
    setEditingRowIndex,
    updatingRow,
    setUpdatingRow,
    headerRowIndex,
    setHeaderRowIndex,
    actualRowIndex,
    setActualRowIndex,

    // Quick edit modal
    showQuickEditModal,
    setShowQuickEditModal,
    quickEditData,
    setQuickEditData,
    updatingCell,
    setUpdatingCell,

    // JSON input modal
    showJsonInputModal,
    setShowJsonInputModal,
    jsonInput,
    setJsonInput,
    jsonInputError,
    setJsonInputError,

    // Add row modal
    showAddRowModal,
    setShowAddRowModal,
    newRowData,
    setNewRowData,
    addingRow,
    setAddingRow,
    insertPosition,
    setInsertPosition,

    // Add course modal
    showAddCourseModal,
    setShowAddCourseModal,
    newCourseData,
    setNewCourseData,
    addingCourse,
    setAddingCourse,
  };
} 