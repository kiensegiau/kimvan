'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, PencilIcon, TrashIcon, CloudArrowDownIcon, ExclamationCircleIcon, XMarkIcon, ArrowPathIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { AdjustmentsHorizontalIcon, DocumentArrowUpIcon, DocumentMagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { use } from 'react';
import YouTubeModal from '../../components/YouTubeModal';
import PDFModal from '../../components/PDFModal';
import MediaProcessingModal from '../../components/MediaProcessingModal';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';

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
  const [showAddRowModal, setShowAddRowModal] = useState(false);
  const [newRowData, setNewRowData] = useState({});
  const [addingRow, setAddingRow] = useState(false);
  const [showEditRowModal, setShowEditRowModal] = useState(false);
  const [editRowData, setEditRowData] = useState({});
  const [editingRowIndex, setEditingRowIndex] = useState(null);
  const [updatingRow, setUpdatingRow] = useState(false);
  const [linkDetails, setLinkDetails] = useState({});
  // Add new state variables for sync confirmation
  const [showSyncConfirmModal, setShowSyncConfirmModal] = useState(false);
  const [syncPreviewData, setSyncPreviewData] = useState(null);
  const [loadingSyncPreview, setLoadingSyncPreview] = useState(false);
  // Thêm state để debug
  const [debugInfo, setDebugInfo] = useState(null);
  
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
    
    try {
      setLoadingSyncPreview(true);
      setSyncPreviewData(null);
      
      // Gọi API để lấy preview dữ liệu mới
      const previewResponse = await fetch(`/api/courses/${course.kimvanId}/preview`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const previewData = await previewResponse.json();
      
      if (!previewResponse.ok) {
        throw new Error(previewData.message || 'Không thể lấy dữ liệu preview');
      }
      
      // Lưu dữ liệu preview và hiển thị modal xác nhận
      setSyncPreviewData(previewData);
      setShowSyncConfirmModal(true);
      
    } catch (error) {
      console.error('Lỗi khi lấy preview:', error);
      toast.error(error.message || 'Không thể lấy dữ liệu preview');
    } finally {
      setLoadingSyncPreview(false);
    }
  };

  // Hàm xác nhận đồng bộ sau khi xem preview
  const handleConfirmSync = async () => {
    if (!course || !course.kimvanId) return;
    
    try {
      setSyncing(true);
      
      // Gọi API để lấy dữ liệu mới từ Kim Văn
      const response = await fetch(`/api/courses/${course.kimvanId}/preview`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const previewData = await response.json();
      
      if (!response.ok) {
        throw new Error(previewData.message || 'Không thể lấy dữ liệu preview');
      }

      console.log('Preview Data Structure:', previewData);

      // Kiểm tra và lấy dữ liệu mới
      let newData;
      if (previewData?.preview?.newData?.sampleRows) {
        // Nếu có sampleRows, sử dụng nó
        newData = previewData.preview.newData.sampleRows;
      } else if (previewData?.preview?.newData?.sheets?.[activeSheet]?.data?.[0]?.rowData) {
        // Nếu có cấu trúc sheets, sử dụng nó
        newData = previewData.preview.newData.sheets[activeSheet].data[0].rowData;
      } else if (Array.isArray(previewData?.preview?.newData)) {
        // Nếu newData là một mảng trực tiếp
        newData = previewData.preview.newData;
      } else {
        throw new Error('Không thể xác định cấu trúc dữ liệu mới');
      }

      // Lấy dữ liệu hiện tại
      const currentData = course.originalData.sheets[activeSheet].data[0].rowData;

      console.log('Current Data:', currentData);
      console.log('New Data:', newData);

      // Tạo map để lưu trữ URL gốc theo formattedValue
      const originalUrlMap = new Map();
      currentData.forEach((row, rowIndex) => {
        if (row.values) {
          row.values.forEach((cell, cellIndex) => {
            if (cell.formattedValue && cell.userEnteredFormat?.textFormat?.link?.uri) {
              originalUrlMap.set(cell.formattedValue, {
                uri: cell.userEnteredFormat.textFormat.link.uri,
                hyperlink: cell.hyperlink,
                rowIndex,
                cellIndex
              });
              console.log(`Mapped URL for "${cell.formattedValue}":`, {
                uri: cell.userEnteredFormat.textFormat.link.uri,
                hyperlink: cell.hyperlink
              });
            }
          });
        }
      });

      // Xử lý dữ liệu mới để giữ lại URL gốc nếu có
      const processedNewData = newData.map((row, rowIndex) => {
        if (!row.values) return row;

        const processedValues = row.values.map((cell, cellIndex) => {
          if (!cell.formattedValue || !cell.userEnteredFormat?.textFormat?.link?.uri) {
            return cell;
          }

          // Kiểm tra xem có URL gốc cho formattedValue này không
          const originalUrlData = originalUrlMap.get(cell.formattedValue);
          if (originalUrlData) {
            console.log(`Found original URL for "${cell.formattedValue}":`, originalUrlData);
            
            // So sánh URL để log sự thay đổi
            if (originalUrlData.uri !== cell.userEnteredFormat.textFormat.link.uri) {
              console.log(`URL changed for "${cell.formattedValue}":`, {
                from: originalUrlData.uri,
                to: cell.userEnteredFormat.textFormat.link.uri
              });
            }

            return {
              ...cell,
              userEnteredFormat: {
                ...cell.userEnteredFormat,
                textFormat: {
                  ...cell.userEnteredFormat.textFormat,
                  link: {
                    uri: originalUrlData.uri
                  }
                }
              },
              hyperlink: originalUrlData.hyperlink
            };
          }

          console.log(`No original URL found for "${cell.formattedValue}", keeping new URL:`, 
            cell.userEnteredFormat.textFormat.link.uri);
          return cell;
        });

        return {
          ...row,
          values: processedValues
        };
      });

      console.log('Processed New Data:', processedNewData);

      // Đóng gói dữ liệu theo cấu trúc sheets
      const processedDataPayload = {
        sheets: [
          {
            data: [
              {
                rowData: processedNewData
              }
            ]
          }
        ]
      };

      console.log('Final Payload:', processedDataPayload);

      // Gọi API để thực hiện đồng bộ với dữ liệu đã xử lý
      const syncResponse = await fetch(`/api/courses/${course._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          processedData: processedDataPayload
        })
      });
      
      const syncResult = await syncResponse.json();
      
      if (!syncResponse.ok) {
        throw new Error(syncResult.message || 'Không thể đồng bộ dữ liệu');
      }
      
      toast.success('Đồng bộ dữ liệu thành công');
      setShowSyncConfirmModal(false);
      setSyncPreviewData(null);
      
      // Tải lại trang để cập nhật dữ liệu mới
      router.refresh();
      
    } catch (error) {
      console.error('Lỗi khi đồng bộ:', error);
      toast.error(error.message || 'Không thể đồng bộ dữ liệu');
    } finally {
      setSyncing(false);
    }
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
  const getProcessedDriveFile = (originalUrl) => {
    if (!course?.processedDriveFiles || !originalUrl) return null;
    return course.processedDriveFiles.find(file => file.originalUrl === originalUrl);
  };

  // Hàm kiểm tra xem URL có phải là Google Drive PDF không
  const isGoogleDrivePdf = (url) => {
    if (!url) return false;
    return (url.includes('drive.google.com') || url.includes('docs.google.com')) && 
           (url.toLowerCase().endsWith('.pdf') || url.includes('pdf'));
  };

  // Hàm xuất bảng dữ liệu thành file Excel
  const exportTableToExcel = (tableId, filename = '') => {
    if (!course || !course.originalData || !course.originalData.sheets || !course.originalData.sheets[activeSheet]) {
      alert('Không có dữ liệu để xuất');
      return;
    }

    try {
      // Tạo tên file mặc định nếu không có
      filename = filename ? filename + '.xlsx' : `khoa-hoc-${course.kimvanId || course._id}.xlsx`;
      
      // Lấy dữ liệu từ bảng hiện tại
      const sheet = course.originalData.sheets[activeSheet];
      const sheetData = sheet?.data?.[0]?.rowData;
      
      if (!sheetData || sheetData.length === 0) {
        alert('Không có dữ liệu để xuất');
        return;
      }
      
      // Tạo mảng dữ liệu cho Excel
      const excelData = [];
      
      // Thêm tiêu đề
      const headers = [];
      const headerRow = sheetData[0];
      if (headerRow && headerRow.values) {
        headerRow.values.forEach(cell => {
          headers.push(cell.formattedValue || '');
        });
        excelData.push(headers);
      }
      
      // Thêm dữ liệu
      for (let i = 1; i < sheetData.length; i++) {
        const row = sheetData[i];
        if (row && row.values) {
          const rowData = [];
          row.values.forEach(cell => {
            // Lấy giá trị từ cell
            let value = cell.formattedValue || '';
            
            // Nếu có link, thêm link vào giá trị
            const url = cell.userEnteredFormat?.textFormat?.link?.uri || cell.hyperlink;
            if (url) {
              value = value || (isYoutubeLink(url) ? 'Xem video' : isPdfLink(url) ? 'Xem PDF' : 'Xem tài liệu');
              // Thêm URL vào giá trị để dễ tham khảo
              value += ` (${url})`;
            }
            
            rowData.push(value);
          });
          excelData.push(rowData);
        }
      }
      
      // Tạo workbook và worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(excelData);
      
      // Đặt tên cho worksheet
      XLSX.utils.book_append_sheet(wb, ws, getSheetTitle(activeSheet, course.originalData.sheets) || 'Sheet1');
      
      // Xuất file Excel
      XLSX.writeFile(wb, filename);
      
    } catch (error) {
      console.error('Lỗi khi xuất file Excel:', error);
      
      // Nếu không có thư viện XLSX, sử dụng phương pháp xuất Excel đơn giản hơn
      try {
        const tableSelect = document.getElementById(tableId);
        
        if (!tableSelect) {
          alert('Không tìm thấy bảng dữ liệu');
          return;
        }
        
        // Tạo một bản sao của bảng để xử lý
        const tableClone = tableSelect.cloneNode(true);
        
        // Xử lý các thẻ a và các thẻ HTML không cần thiết
        const links = tableClone.querySelectorAll('a');
        links.forEach(link => {
          // Thêm URL vào nội dung
          const url = link.getAttribute('href');
          const text = link.textContent || '';
          const newText = url ? `${text} (${url})` : text;
          const textNode = document.createTextNode(newText);
          link.parentNode.replaceChild(textNode, link);
        });
        
        // Xóa các biểu tượng SVG và các thẻ không cần thiết khác
        const svgs = tableClone.querySelectorAll('svg');
        svgs.forEach(svg => {
          svg.parentNode.removeChild(svg);
        });
        
        // Hiển thị các cột ẩn
        const hiddenCells = tableClone.querySelectorAll('.hidden');
        hiddenCells.forEach(cell => {
          cell.classList.remove('hidden');
          cell.style.display = 'table-cell';
        });
        
        // Tạo tên file mặc định nếu không có
        filename = filename ? filename.replace('.xlsx', '.xls') : `khoa-hoc-${course.kimvanId || course._id}.xls`;
        
        // Tạo template HTML cho Excel
        const excelTemplate = `
          <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
          <head>
            <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
            <meta name="ProgId" content="Excel.Sheet">
            <meta name="Generator" content="Microsoft Excel 11">
            <style>
              table, td, th {
                border: 1px solid black;
                border-collapse: collapse;
              }
              th {
                background-color: #f2f2f2;
                font-weight: bold;
              }
              .hidden {
                display: table-cell !important;
              }
            </style>
            <!--[if gte mso 9]>
            <xml>
              <x:ExcelWorkbook>
                <x:ExcelWorksheets>
                  <x:ExcelWorksheet>
                    <x:Name>${getSheetTitle(activeSheet, course.originalData.sheets) || 'Sheet1'}</x:Name>
                    <x:WorksheetOptions>
                      <x:DisplayGridlines/>
                    </x:WorksheetOptions>
                  </x:ExcelWorksheet>
                </x:ExcelWorksheets>
              </x:ExcelWorkbook>
            </xml>
            <![endif]-->
          </head>
          <body>
            ${tableClone.outerHTML}
          </body>
          </html>
        `;
        
        // Tạo link download
        const dataType = 'application/vnd.ms-excel';
        const downloadLink = document.createElement('a');
        document.body.appendChild(downloadLink);
        
        if (navigator.msSaveOrOpenBlob) {
          // Cho IE và Edge
          const blob = new Blob(['\ufeff', excelTemplate], {
            type: dataType
          });
          navigator.msSaveOrOpenBlob(blob, filename);
        } else {
          // Cho các trình duyệt khác
          downloadLink.href = 'data:' + dataType + ';charset=utf-8,' + encodeURIComponent(excelTemplate);
          downloadLink.download = filename;
          downloadLink.click();
        }
        
        document.body.removeChild(downloadLink);
      } catch (fallbackError) {
        console.error('Lỗi khi xuất file Excel bằng phương pháp dự phòng:', fallbackError);
        alert('Có lỗi xảy ra khi xuất file Excel: ' + error.message);
      }
    }
  };

  // Hàm mở modal thêm hàng mới
  const handleOpenAddRowModal = () => {
    if (!course?.originalData?.sheets || !course.originalData.sheets[activeSheet]) {
      alert('Không thể thêm hàng mới vì không có dữ liệu sheet');
      return;
    }
    
    // Khởi tạo dữ liệu hàng mới trống dựa trên tiêu đề
    const headerRow = course.originalData.sheets[activeSheet].data[0].rowData[0];
    const emptyRow = {};
    
    if (headerRow && headerRow.values) {
      headerRow.values.forEach((cell, index) => {
        const headerName = cell.formattedValue || `Cột ${index + 1}`;
        emptyRow[headerName] = '';
      });
    }
    
    setNewRowData(emptyRow);
    setShowAddRowModal(true);
  };
  
  // Hàm thay đổi giá trị của hàng mới
  const handleNewRowChange = (header, value) => {
    setNewRowData(prev => ({
      ...prev,
      [header]: value
    }));
  };
  
  // Hàm thêm hàng mới
  const handleAddRow = async () => {
    if (!course || !course._id) return;
    
    try {
      setAddingRow(true);
      
      // Chuyển đổi dữ liệu từ form sang định dạng phù hợp
      const headerRow = course.originalData.sheets[activeSheet].data[0].rowData[0];
      const rowValues = [];
      
      if (headerRow && headerRow.values) {
        headerRow.values.forEach(cell => {
          const headerName = cell.formattedValue || '';
          const value = newRowData[headerName] || '';
          
          // Kiểm tra nếu giá trị là URL
          if (value && (value.startsWith('http://') || value.startsWith('https://'))) {
            rowValues.push({
              formattedValue: value,
              hyperlink: value,
              userEnteredFormat: {
                textFormat: {
                  link: { uri: value }
                }
              }
            });
          } else {
            rowValues.push({
              formattedValue: value
            });
          }
        });
      }
      
      // Gọi API để thêm hàng
      const response = await fetch(`/api/courses/${course._id}/add-row`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sheetIndex: activeSheet,
          rowData: rowValues
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Không thể thêm hàng mới');
      }
      
      // Đóng modal và làm mới dữ liệu
      setShowAddRowModal(false);
      alert('Thêm hàng mới thành công!');
      await fetchCourseDetail();
    } catch (error) {
      console.error('Lỗi khi thêm hàng mới:', error);
      alert(`Lỗi khi thêm hàng mới: ${error.message}`);
    } finally {
      setAddingRow(false);
    }
  };

  // Sửa lại phần xử lý mở form chỉnh sửa để lấy và hiển thị đầy đủ thông tin hyperlink
  const handleOpenEditRowModal = (rowIndex) => {
    if (!course?.originalData?.sheets || !course.originalData.sheets[activeSheet]) {
      alert('Không thể sửa hàng vì không có dữ liệu sheet');
      return;
    }
    
    // Lấy dữ liệu hàng hiện tại
    const headerRow = course.originalData.sheets[activeSheet].data[0].rowData[0];
    const dataRow = course.originalData.sheets[activeSheet].data[0].rowData[rowIndex + 1]; // +1 vì hàng đầu tiên là header
    
    if (!headerRow || !headerRow.values || !dataRow || !dataRow.values) {
      alert('Không thể lấy dữ liệu hàng để sửa');
      return;
    }
    
    // In ra toàn bộ dữ liệu hàng để debug
    console.log('Full row data:', JSON.stringify(dataRow, null, 2));
    
    // Tạo object dữ liệu từ header và data
    const rowData = {};
    const linkDetails = {}; // Object để lưu chi tiết về link
    
    headerRow.values.forEach((headerCell, idx) => {
      const headerName = headerCell.formattedValue || `Cột ${idx + 1}`;
      const cell = dataRow.values[idx] || {};
      let value = cell.formattedValue || '';
      
      // Debug thông tin cell
      console.log(`Cell [${headerName}]:`, JSON.stringify(cell, null, 2));
      
      // Lưu TẤT CẢ thông tin về link nếu có
      linkDetails[headerName] = {
        uri: cell.userEnteredFormat?.textFormat?.link?.uri || '',
        hyperlink: cell.hyperlink || '',
        formattedValue: cell.formattedValue || ''
      };
      
      console.log(`Link details for ${headerName}:`, JSON.stringify(linkDetails[headerName], null, 2));
      
      // Log độ dài của hyperlink và uri để debug
      if (cell.hyperlink) {
        console.log(`Hyperlink length for ${headerName}:`, cell.hyperlink.length);
      }
      if (cell.userEnteredFormat?.textFormat?.link?.uri) {
        console.log(`URI length for ${headerName}:`, cell.userEnteredFormat.textFormat.link.uri.length);
      }
      
      // Lấy URL từ link.uri nếu có (ưu tiên cao nhất)
      if (cell.userEnteredFormat?.textFormat?.link?.uri) {
        value = cell.userEnteredFormat.textFormat.link.uri;
      } 
      // Nếu không có link.uri, thử lấy từ hyperlink (nếu là URL thật, không phải mã hóa)
      else if (cell.hyperlink && cell.hyperlink.startsWith('http')) {
        value = cell.hyperlink;
      }
      
      rowData[headerName] = value;
    });
    
    // Lưu debug info
    const debugInfo = {
      rowData,
      linkDetails,
      rowIndex
    };
    
    console.log('Row data:', JSON.stringify(rowData, null, 2));
    console.log('Link details:', JSON.stringify(linkDetails, null, 2));
    
    setEditRowData(rowData);
    setEditingRowIndex(rowIndex);
    setShowEditRowModal(true);
    setLinkDetails(linkDetails); // Lưu chi tiết về link
    setDebugInfo(debugInfo); // Lưu thông tin debug
  };
  
  // Hàm thay đổi giá trị khi sửa hàng
  const handleEditRowChange = (header, value) => {
    setEditRowData(prev => ({
      ...prev,
      [header]: value
    }));
  };
  
  // Hàm cập nhật hàng đã sửa
  const handleUpdateRow = async () => {
    if (!course || !course._id || editingRowIndex === null) return;
    
    try {
      setUpdatingRow(true);
      
      // Chuyển đổi dữ liệu từ form sang định dạng phù hợp
      const headerRow = course.originalData.sheets[activeSheet].data[0].rowData[0];
      // Lấy dữ liệu hàng hiện tại để giữ lại cấu trúc
      const currentRow = course.originalData.sheets[activeSheet].data[0].rowData[editingRowIndex + 1];
      const rowValues = [];
      
      if (headerRow && headerRow.values) {
        headerRow.values.forEach((cell, idx) => {
          const headerName = cell.formattedValue || '';
          const value = editRowData[headerName] || '';
          const currentCell = currentRow?.values?.[idx] || {};
          const detail = linkDetails[headerName] || {};
          
          // Kiểm tra nếu giá trị là URL
          if (value && (value.startsWith('http://') || value.startsWith('https://'))) {
            // Ưu tiên sử dụng formattedValue từ dữ liệu gốc nếu có
            const displayValue = detail.formattedValue || value.split('/').pop() || value;
            
            rowValues.push({
              formattedValue: displayValue,
              hyperlink: detail.hyperlink || value, // Giữ nguyên hyperlink gốc nếu có
              userEnteredFormat: {
                ...(currentCell.userEnteredFormat || {}),
                textFormat: {
                  ...(currentCell.userEnteredFormat?.textFormat || {}),
                  link: { uri: value }
                }
              }
            });
          } else {
            // Giữ lại định dạng cũ nhưng cập nhật giá trị
            rowValues.push({
              formattedValue: value,
              ...(currentCell.userEnteredFormat ? { userEnteredFormat: currentCell.userEnteredFormat } : {})
            });
          }
        });
      }
      
      // Gọi API để cập nhật hàng
      const response = await fetch(`/api/courses/${course._id}/update-row`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sheetIndex: activeSheet,
          rowIndex: editingRowIndex + 1, // +1 vì rowIndex 0 là header
          rowData: rowValues
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Không thể cập nhật hàng');
      }
      
      // Đóng modal và làm mới dữ liệu
      setShowEditRowModal(false);
      alert('Cập nhật hàng thành công!');
      await fetchCourseDetail();
    } catch (error) {
      console.error('Lỗi khi cập nhật hàng:', error);
      alert(`Lỗi khi cập nhật hàng: ${error.message}`);
    } finally {
      setUpdatingRow(false);
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

  // Hàm thêm liên kết vào trường dữ liệu
  const addLinkToField = (header, value) => {
    // Kiểm tra xem URL có hợp lệ không
    try {
      // Nếu không có protocol, thêm https://
      let url = value.trim();
      if (url && !url.match(/^https?:\/\//)) {
        url = 'https://' + url;
      }
      
      // Cập nhật giá trị vào trường dữ liệu
      if (showEditRowModal) {
        // Lưu cả URL trong formattedValue và hyperlink
        setEditRowData(prev => ({
          ...prev,
          [header]: url
        }));
      } else {
        // Lưu cả URL trong formattedValue và hyperlink
        setNewRowData(prev => ({
          ...prev,
          [header]: url
        }));
      }
    } catch (error) {
      console.error('Lỗi khi thêm liên kết:', error);
    }
  };

  // Sửa lại hàm getLinkPreview để luôn hiển thị thông tin link dựa trên header
  const getLinkPreview = (header, url) => {
    // Lấy thông tin chi tiết về link từ linkDetails theo header
    const detail = linkDetails[header] || {};
    console.log(`Link preview for ${header}:`, { url, detail });
    
    try {
      // Luôn hiển thị thông tin preview nếu có bất kỳ dữ liệu nào (uri, hyperlink hoặc formattedValue)
      if (detail.uri || detail.hyperlink || (detail.formattedValue && detail.formattedValue !== '')) {
        let displayUrl = url || detail.uri || detail.hyperlink || '';
        let fullUrl = displayUrl;
        
        // Nếu không có protocol, thêm https://
        if (displayUrl && !displayUrl.match(/^https?:\/\//)) {
          fullUrl = 'https://' + displayUrl;
        }
        
        // Rút gọn URL dài để hiển thị
        if (displayUrl.length > 60) {
          displayUrl = displayUrl.substring(0, 57) + '...';
        }
        
        return (
          <div className="space-y-2">
            {/* Hiển thị URL hiện tại */}
            <div className="flex items-center p-2 bg-gray-50 rounded">
              <a 
                href={fullUrl} 
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 break-all"
              >
                {displayUrl || '[Không có URL]'}
              </a>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Bạn có chắc chắn muốn xóa liên kết này?')) {
                    if (showEditRowModal) {
                      handleEditRowChange(header, '');
                    } else {
                      handleNewRowChange(header, '');
                    }
                  }
                }}
                className="ml-2 text-red-500 hover:text-red-700"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
            
            {/* Luôn hiển thị URI nếu có */}
            {detail.uri && (
              <div className="text-xs bg-blue-50 p-2 rounded">
                <div className="font-medium text-blue-700 mb-1">URI:</div>
                <div className="text-gray-600 break-all">{detail.uri}</div>
              </div>
            )}
            
            {/* Luôn hiển thị hyperlink nếu có */}
            {detail.hyperlink && (
              <div className="text-xs bg-amber-50 p-2 rounded mt-1">
                <div className="font-medium text-amber-700 mb-1">Hyperlink:</div>
                <div className="text-gray-600 break-all">{detail.hyperlink}</div>
              </div>
            )}
            
            {/* Hiển thị formattedValue nếu khác với URL hiện tại và không trống */}
            {detail.formattedValue && detail.formattedValue !== url && detail.formattedValue !== '' && (
              <div className="text-xs bg-green-50 p-2 rounded mt-1">
                <div className="font-medium text-green-700 mb-1">Hiển thị:</div>
                <div className="text-gray-600">{detail.formattedValue}</div>
              </div>
            )}
            
            {/* Thêm nút để xem thông tin debug chi tiết */}
            <button 
              onClick={() => alert(JSON.stringify(detail, null, 2))}
              className="text-xs text-blue-600 underline"
            >
              Debug Link Info
            </button>
          </div>
        );
      } else if (url) {
        // Nếu không có thông tin trong linkDetails nhưng có URL
        let displayUrl = url;
        let fullUrl = url;
        
        // Nếu không có protocol, thêm https://
        if (url && !url.match(/^https?:\/\//)) {
          fullUrl = 'https://' + url;
        }
        
        // Rút gọn URL dài để hiển thị
        if (displayUrl.length > 60) {
          displayUrl = displayUrl.substring(0, 57) + '...';
        }
        
        return (
          <div className="space-y-2">
            <div className="flex items-center p-2 bg-gray-50 rounded">
              <a 
                href={fullUrl} 
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 break-all"
              >
                {displayUrl}
              </a>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Bạn có chắc chắn muốn xóa liên kết này?')) {
                    if (showEditRowModal) {
                      handleEditRowChange(header, '');
                    } else {
                      handleNewRowChange(header, '');
                    }
                  }
                }}
                className="ml-2 text-red-500 hover:text-red-700"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      }
      
      // Nếu không có gì để hiển thị
      return null;
    } catch (error) {
      console.error('Lỗi khi hiển thị link:', error);
      return null;
    }
  };

  // Cập nhật phần hiển thị trường liên kết trong modal chỉnh sửa
  const renderEditLinkField = (header, value) => {
    // Lấy thông tin chi tiết về link theo header
    const detail = linkDetails[header] || {};
    const hasLinkInfo = detail.uri || detail.hyperlink || (detail.formattedValue && detail.formattedValue !== '');
    
    return (
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={value}
            onChange={(e) => handleEditRowChange(header, e.target.value)}
            className="max-w-lg block w-full shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300 rounded-md bg-blue-50"
            placeholder="Nhập URL (https://...)"
          />
          <button
            type="button"
            onClick={() => addLinkToField(header, value)}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Thêm URL
        </button>
      </div>
      
      {/* Luôn gọi getLinkPreview để hiển thị chi tiết */}
      {getLinkPreview(header, value)}
      
      <p className="text-xs text-gray-500">
        Nhập URL của tài liệu, video hoặc bất kỳ liên kết nào khác
      </p>
    </div>
  );
};

// Cập nhật phần hiển thị trường liên kết trong modal thêm hàng mới
const renderAddLinkField = (header, value) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <input
          type="text"
          value={value}
          onChange={(e) => handleNewRowChange(header, e.target.value)}
          className="max-w-lg block w-full shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300 rounded-md bg-blue-50"
          placeholder="Nhập URL (https://...)"
        />
        <button
          type="button"
          onClick={() => addLinkToField(header, value)}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Thêm URL
        </button>
      </div>
      
      {/* Hiển thị link preview */}
      {value && (
        <div className="flex items-center p-2 bg-gray-50 rounded">
          <a 
            href={value.startsWith('http') ? value : `https://${value}`} 
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-800 break-all"
          >
            {value.length > 60 ? value.substring(0, 57) + '...' : value}
          </a>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Bạn có chắc chắn muốn xóa liên kết này?')) {
                handleNewRowChange(header, '');
              }
            }}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )}
      
      <p className="text-xs text-gray-500">
        Nhập URL của tài liệu, video hoặc bất kỳ liên kết nào khác
      </p>
    </div>
  );
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
                    <div className="flex items-center gap-2">
                      {course.originalData.sheets[activeSheet]?.data?.[0]?.rowData && course.originalData.sheets[activeSheet].data[0].rowData.length > 0 ? (
                        <>
                          <div className="text-sm text-gray-600 ml-7 sm:ml-0">
                            Tổng số: <span className="font-medium text-blue-600">
                              {(course.originalData.sheets[activeSheet].data[0].rowData.length - 1) || 0} buổi
                            </span>
                          </div>
                          <button
                            onClick={handleOpenAddRowModal}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Thêm hàng
                          </button>
                          <button
                            onClick={() => exportTableToExcel('course-data-table', `khoa-hoc-${course.name ? course.name.replace(/\s+/g, '-') : 'data'}`)}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                            title="Xuất Excel bằng thư viện SheetJS (chất lượng cao)"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Xuất Excel
                          </button>
                        </>
                      ) : (
                        <div className="text-sm text-gray-600 ml-7 sm:ml-0">
                          Không có dữ liệu buổi học
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {course.originalData.sheets[activeSheet]?.data?.[0]?.rowData && course.originalData.sheets[activeSheet].data[0].rowData.length > 0 ? (
                    <div className="relative" id="course-data-table">
                      {/* Chỉ báo cuộn ngang cho điện thoại */}
                      <div className="md:hidden bg-blue-50 p-2 border-b border-blue-100 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                        <span className="text-sm text-blue-700">Vuốt ngang để xem đầy đủ nội dung</span>
                      </div>
                      
                      {/* Lấy danh sách tiêu đề từ hàng đầu tiên */}
                      {(() => {
                        const headerRow = course.originalData.sheets[activeSheet].data[0].rowData[0];
                        const headers = headerRow?.values?.map(cell => cell.formattedValue || '') || [];
                        
                        return (
                          <div className="overflow-x-auto">
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-2 text-white text-xs uppercase font-medium tracking-wider">
                              {headers.map((header, index) => (
                                <div key={index} className={`${index === 0 ? 'text-center' : ''}`}>
                                  {header}
                                </div>
                              ))}
                              <div className="text-center">Thao tác</div>
                            </div>
                            
                            {/* Render từng buổi học */}
                            <div className="divide-y divide-gray-200">
                              {course.originalData.sheets[activeSheet].data[0].rowData.slice(1).map((row, rowIndex) => {
                                if (!row.values) return null;
                                
                                return (
                                  <div key={rowIndex} className="hover:bg-blue-50 transition-colors duration-150">
                                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                      {row.values.map((cell, cellIndex) => {
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
                                        
                                        // Render header ở chế độ mobile
                                        const cellHeader = headers[cellIndex];
                                        
                                        return (
                                          <div key={cellIndex} className="space-y-1">
                                            {/* Tiêu đề cột cho mobile */}
                                            <div className="md:hidden text-xs font-medium text-gray-500">
                                              {cellHeader}
                                            </div>
                                            
                                            {/* Nội dung cell */}
                                            <div className={`${cellIndex === 0 ? 'font-medium text-gray-900 text-center md:text-left' : 'text-gray-700'}`}>
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
                                                          <span className="break-words">
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
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
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
                                                              const processedFile = getProcessedDriveFile(url);
                                                              
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
                                                      <span className="break-words">
                                                        {cell.formattedValue || ''}
                                                      </span>
                                                    )
                                              }
                                            </div>
                                          </div>
                                        );
                                      })}
                                      
                                      {/* Thêm cột thao tác */}
                                      <div className="space-y-1">
                                        <div className="md:hidden text-xs font-medium text-gray-500">
                                          Thao tác
                                        </div>
                                        <div className="flex items-center space-x-2">
                                          <button
                                            onClick={() => handleOpenEditRowModal(rowIndex)}
                                            className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none"
                                          >
                                            <PencilIcon className="h-3.5 w-3.5 mr-1" />
                                            Sửa
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            
                            {/* Thêm nút Thêm hàng ở dưới cùng của bảng */}
                            <div className="flex items-center justify-center py-4 bg-gray-50 border-t border-gray-200">
                              <button
                                onClick={handleOpenAddRowModal}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Thêm hàng mới
                              </button>
                            </div>
                          </div>
                        );
                      })()}
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
                      {/* Thêm nút Thêm hàng trong trường hợp không có dữ liệu */}
                      <div className="mt-6">
                        <button
                          onClick={handleOpenAddRowModal}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Thêm hàng đầu tiên
                        </button>
                      </div>
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
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
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
        
        {/* Modal thêm hàng mới */}
        {showAddRowModal && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Thêm hàng mới</h3>
                <button
                  onClick={() => setShowAddRowModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              <div className="p-4 sm:p-6 overflow-auto max-h-[calc(90vh-8rem)]">
                <div className="space-y-6">
                  {Object.keys(newRowData).map((header, index) => (
                    <div key={index} className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start">
                      <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">
                        {header}
                      </label>
                      <div className="mt-1 sm:mt-0 sm:col-span-2">
                        {index === 0 ? (
                          // Trường đầu tiên (thường là STT)
                          <input
                            type="text"
                            value={newRowData[header]}
                            onChange={(e) => handleNewRowChange(header, e.target.value)}
                            className="max-w-lg block w-full shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300 rounded-md"
                          />
                        ) : header.toLowerCase().includes('link') || 
                            header.toLowerCase().includes('video') || 
                            header.toLowerCase().includes('sách') || 
                            header.toLowerCase().includes('tài liệu') || 
                            header.toLowerCase().includes('bài giảng') || 
                            header.toLowerCase().includes('đáp án') ? (
                          // Các trường chứa link hoặc tài liệu
                          renderAddLinkField(header, newRowData[header])
                        ) : (
                          // Các trường khác
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={newRowData[header]}
                              onChange={(e) => handleNewRowChange(header, e.target.value)}
                              className="max-w-lg block w-full shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300 rounded-md"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => setShowAddRowModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 mr-3"
                >
                  Hủy
                </button>
                <button
                  onClick={handleAddRow}
                  disabled={addingRow}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {addingRow ? (
                    <span className="flex items-center">
                      <ArrowPathIcon className="animate-spin h-4 w-4 mr-2" />
                      Đang thêm...
                    </span>
                  ) : (
                    'Thêm hàng'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Modal sửa hàng */}
        {showEditRowModal && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Sửa thông tin buổi học</h3>
                <button
                  onClick={() => setShowEditRowModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              <div className="p-4 sm:p-6 overflow-auto max-h-[calc(90vh-8rem)]">
                <div className="space-y-6">
                  {Object.keys(editRowData).map((header, index) => (
                    <div key={index} className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start">
                      <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">
                        {header}
                      </label>
                      <div className="mt-1 sm:mt-0 sm:col-span-2">
                        {index === 0 ? (
                          // Trường đầu tiên (thường là STT)
                          <input
                            type="text"
                            value={editRowData[header]}
                            onChange={(e) => handleEditRowChange(header, e.target.value)}
                            className="max-w-lg block w-full shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300 rounded-md"
                          />
                        ) : header.toLowerCase().includes('link') || 
                             header.toLowerCase().includes('video') || 
                             header.toLowerCase().includes('sách') || 
                             header.toLowerCase().includes('tài liệu') || 
                             header.toLowerCase().includes('bài giảng') || 
                             header.toLowerCase().includes('đáp án') ? (
                          // Các trường chứa link hoặc tài liệu - sử dụng hàm renderEditLinkField mới
                          renderEditLinkField(header, editRowData[header])
                        ) : (
                          // Các trường khác
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editRowData[header]}
                              onChange={(e) => handleEditRowChange(header, e.target.value)}
                              className="max-w-lg block w-full shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300 rounded-md"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {/* Debug Info */}
                  <div className="mt-8 border-t border-gray-200 pt-4">
                    <button
                      type="button"
                      onClick={() => console.log('Current linkDetails:', linkDetails)}
                      className="text-sm text-indigo-600 hover:text-indigo-800"
                    >
                      Log Link Details
                    </button>
                    
                    {debugInfo && (
                      <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                        <details>
                          <summary className="cursor-pointer font-medium">Debug Info</summary>
                          <pre className="mt-2 overflow-auto max-h-40 p-2 bg-gray-800 text-gray-200 rounded">
                            {JSON.stringify(debugInfo, null, 2)}
                          </pre>
                        </details>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => setShowEditRowModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 mr-3"
                >
                  Hủy
                </button>
                <button
                  onClick={handleUpdateRow}
                  disabled={updatingRow}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {updatingRow ? (
                    <span className="flex items-center">
                      <ArrowPathIcon className="animate-spin h-4 w-4 mr-2" />
                      Đang cập nhật...
                    </span>
                  ) : (
                    'Cập nhật'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal xác nhận đồng bộ */}
        {showSyncConfirmModal && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Xác nhận đồng bộ khóa học</h3>
                <button
                  onClick={() => {
                    setShowSyncConfirmModal(false);
                    setSyncPreviewData(null);
                  }}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              <div className="p-4 sm:p-6 overflow-auto max-h-[calc(90vh-8rem)]">
                {loadingSyncPreview ? (
                  <div className="text-center py-4">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mb-2"></div>
                    <p className="text-gray-500">Đang tải preview dữ liệu...</p>
                  </div>
                ) : syncPreviewData ? (
                  <div className="space-y-6">
                    {/* Thống kê thay đổi */}
                    <div className="bg-yellow-50 p-4 rounded-md">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <ExclamationCircleIcon className="h-5 w-5 text-yellow-400" />
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-yellow-800">
                            Thống kê thay đổi
                          </h3>
                          <div className="mt-2 text-sm text-yellow-700">
                            <ul className="list-disc pl-5 space-y-1">
                              <li>Số hàng hiện tại: {syncPreviewData.preview.currentData.rowCount}</li>
                              <li>Số hàng trong dữ liệu mới: {syncPreviewData.preview.newData.rowCount}</li>
                              <li>Số hàng sẽ được thêm mới: {syncPreviewData.preview.changes.added.length}</li>
                              <li>Số hàng sẽ được cập nhật: {syncPreviewData.preview.changes.updated.length}</li>
                              <li>Số hàng không thay đổi: {syncPreviewData.preview.changes.unchanged.length}</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* So sánh dữ liệu */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-4">So sánh dữ liệu mẫu:</h4>
                      
                      {/* Headers */}
                      <div className="mb-4">
                        <h5 className="text-xs font-medium text-gray-500 mb-2">Cấu trúc cột:</h5>
                        <div className="bg-gray-50 p-3 rounded-md">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-xs font-medium text-gray-700 mb-1">Hiện tại:</div>
                              <div className="text-xs text-gray-600">
                                {syncPreviewData.preview.currentData.headers.join(', ')}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-gray-700 mb-1">Mới:</div>
                              <div className="text-xs text-gray-600">
                                {syncPreviewData.preview.newData.headers.join(', ')}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Sample Rows */}
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 mb-2">Dữ liệu mẫu (3 hàng đầu):</h5>
                        <div className="bg-gray-50 rounded-md overflow-hidden">
                          <div className="grid grid-cols-2 divide-x divide-gray-200">
                            <div className="p-3">
                              <div className="text-xs font-medium text-gray-700 mb-2">Dữ liệu hiện tại:</div>
                              <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                                {JSON.stringify(syncPreviewData.preview.currentData.sampleRows, null, 2)}
                              </pre>
                            </div>
                            <div className="p-3">
                              <div className="text-xs font-medium text-gray-700 mb-2">Dữ liệu mới:</div>
                              <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                                {JSON.stringify(syncPreviewData.preview.newData.sampleRows, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Cảnh báo */}
                    <div className="bg-red-50 p-4 rounded-md">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <ExclamationCircleIcon className="h-5 w-5 text-red-400" />
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-800">
                            Lưu ý quan trọng
                          </h3>
                          <div className="mt-2 text-sm text-red-700">
                            <p>Việc đồng bộ sẽ cập nhật toàn bộ dữ liệu khóa học. Hãy chắc chắn rằng bạn muốn thực hiện thao tác này.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-500">Không có dữ liệu preview</p>
                  </div>
                )}
              </div>
              
              <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => {
                    setShowSyncConfirmModal(false);
                    setSyncPreviewData(null);
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 mr-3"
                >
                  Hủy
                </button>
                <button
                  onClick={handleConfirmSync}
                  disabled={syncing || !syncPreviewData}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {syncing ? (
                    <span className="flex items-center">
                      <ArrowPathIcon className="animate-spin h-4 w-4 mr-2" />
                      Đang đồng bộ...
                    </span>
                  ) : (
                    'Xác nhận đồng bộ'
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
