import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CryptoJS from 'crypto-js';

export function useProcessing({ course, fetchCourseDetail, setShowJsonInputModal, setJsonInput, setJsonInputError, setSyncing, setSyncResult, setPreviewData, setShowPreviewModal, setApplyingSync }) {
  const router = useRouter();
  
  // States for sync
  const [syncing, setSyncingState] = useState(false);
  
  // States for processing
  const [processingData, setProcessingData] = useState(false);
  const [processingAllDrive, setProcessingAllDrive] = useState(false);
  const [processAllDriveResult, setProcessAllDriveResult] = useState(null);
  const [processingAllSheets, setProcessingAllSheets] = useState(false);
  const [processAllSheetsResult, setProcessAllSheetsResult] = useState(null);
  
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

  // Hàm thêm khóa học mới
  const handleAddCourse = async (newCourseData, setAddingCourse, setShowAddCourseModal) => {
    setAddingCourse(true);
    try {
      const response = await fetch('/api/courses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newCourseData),
      });
      
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Nếu API trả về dữ liệu mã hóa
      if (result._secureData) {
        alert('Đã tạo khóa học mới thành công!');
        // Chuyển hướng đến trang chi tiết khóa học vừa tạo
        const createdCourseData = JSON.parse(CryptoJS.AES.decrypt(result._secureData, 'kimvan-secure-key-2024').toString(CryptoJS.enc.Utf8));
        router.push(`/admin/courses/${createdCourseData.course._id}`);
      } else if (result.success) {
        alert('Đã tạo khóa học mới thành công!');
        // Chuyển hướng đến trang chi tiết khóa học vừa tạo
        router.push(`/admin/courses/${result.course._id}`);
      } else {
        throw new Error(result.message || 'Không thể tạo khóa học mới');
      }
    } catch (error) {
      console.error('Lỗi khi tạo khóa học mới:', error);
      alert(`Không thể tạo khóa học mới: ${error.message}`);
    } finally {
      setAddingCourse(false);
      setShowAddCourseModal(false);
    }
  };

  // Hàm đồng bộ khóa học
  const handleSync = async () => {
    if (!course || !course.kimvanId) return;
    
    // Reset state
    setJsonInput('');
    setJsonInputError(null);
    
    // Mở modal nhập JSON
    setShowJsonInputModal(true);
  };

  // Hàm xử lý submit form nhập JSON
  const handleJsonSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Bắt đầu quá trình đồng bộ
      setSyncing(true);
      setSyncResult({
        success: true,
        message: `Đang đồng bộ khóa học "${course.name}"...`,
        inProgress: true
      });
      
      let jsonData;
      
      try {
        // Nếu có JSON input, sử dụng nó
        if (jsonInput.trim()) {
          jsonData = JSON.parse(jsonInput);
        }
      } catch (error) {
        setJsonInputError(`Lỗi phân tích JSON: ${error.message}`);
        setSyncing(false);
        return;
      }
      
      // Chuẩn bị data cho API
      const requestData = {
        preview: true,
        useCache: false,
        originalPrice: course.originalPrice, // Sử dụng giá gốc từ dữ liệu khóa học
        manualJson: jsonData // Thêm JSON người dùng nhập vào nếu có
      };
      
      // Gọi API để xem trước dữ liệu
      console.log(`🔍 Gửi yêu cầu xem trước dữ liệu đồng bộ cho khóa học: ${course.kimvanId}`);
      const previewResponse = await fetch(`/api/courses/${course.kimvanId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });
      
      const previewResult = await previewResponse.json();
      
      if (!previewResponse.ok) {
        throw new Error(previewResult.message || 'Không thể xem trước dữ liệu đồng bộ');
      }
      
      // Đóng modal nhập JSON
      setShowJsonInputModal(false);
      
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
      
    } catch (err) {
      console.error('Lỗi khi đồng bộ khóa học:', err);
      setJsonInputError(`Lỗi đồng bộ: ${err.message}`);
      setSyncResult({
        success: false,
        message: `Lỗi đồng bộ: ${err.message}`,
        inProgress: false
      });
      setSyncing(false);
    }
  };

  // Hàm áp dụng đồng bộ sau khi xem trước
  const applySync = async (previewData) => {
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
          applyProcessedLinks: true,
          preview: false,
          useCache: true,
          originalPrice: course.originalPrice,
          manualJson: previewData?.manualJson // Chuyển tiếp JSON đã nhập nếu có
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

  // Hàm xử lý dữ liệu database
  const handleProcessData = async (processMethod) => {
    if (!course) return;
    
    try {
      setProcessingData(true);
      
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
      
      // Nếu xử lý thành công, tải lại thông tin khóa học
      if (data.success) {
        await fetchCourseDetail();
      }

      return data;
    } catch (err) {
      console.error('Lỗi khi xử lý dữ liệu khóa học:', err);
      return {
        success: false,
        message: err.message || 'Đã xảy ra lỗi khi xử lý dữ liệu khóa học'
      };
    } finally {
      setProcessingData(false);
    }
  };

  // Hàm xử lý upload file PDF
  const handleUploadPdf = async (pdfFile, setUploadingPdf, setUploadResult, setPdfFile) => {
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

  // Hàm xử lý tất cả các link Drive trong khóa học
  const handleProcessAllDrive = async (skipWatermarkRemoval) => {
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

  // Hàm xử lý đồng bộ tất cả sheets với database
  const handleProcessAllSheets = async () => {
    if (!course) {
      console.log("❌ [CLIENT] handleProcessAllSheets: No course data available");
      return;
    }
    
    console.log(`🔄 [CLIENT] handleProcessAllSheets: Starting for course "${course.name}" (${course._id})`);
    console.log(`🔄 [CLIENT] handleProcessAllSheets: Current sheets:`, course.sheets);
    
    if (window.confirm(`Bạn có muốn đồng bộ tất cả sheets với database cho khóa học "${course.name}" không?`)) {
      console.log("✅ [CLIENT] handleProcessAllSheets: User confirmed sync operation");
      try {
        setProcessingAllSheets(true);
        console.log("🔄 [CLIENT] handleProcessAllSheets: Set processingAllSheets = true");
        
        // Hiển thị thông báo đang xử lý
        setProcessAllSheetsResult({
          success: true,
          message: `Đang đồng bộ tất cả sheets cho khóa học "${course.name}"...`,
          inProgress: true
        });
        console.log("🔄 [CLIENT] handleProcessAllSheets: Set initial notification");
        
        console.log(`🔄 [CLIENT] handleProcessAllSheets: Calling API endpoint /api/courses/${course._id}/process-all-sheets`);
        const response = await fetch(`/api/courses/${course._id}/process-all-sheets`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        console.log(`🔄 [CLIENT] handleProcessAllSheets: API response status:`, response.status);
        const result = await response.json();
        console.log(`🔄 [CLIENT] handleProcessAllSheets: API response data:`, result);
        
        if (!response.ok) {
          console.error(`❌ [CLIENT] handleProcessAllSheets: API returned error status ${response.status}:`, result);
          throw new Error(result.message || 'Không thể đồng bộ sheets');
        }
        
        console.log(`✅ [CLIENT] handleProcessAllSheets: API call successful, results:`, result.results);
        setProcessAllSheetsResult({
          success: true,
          message: result.message || 'Đồng bộ sheets thành công',
          results: result.results,
          errors: result.errors
        });
        console.log("✅ [CLIENT] handleProcessAllSheets: Updated notification with success");
        
        // Tải lại thông tin khóa học
        console.log("🔄 [CLIENT] handleProcessAllSheets: Refreshing course data...");
        await fetchCourseDetail();
        console.log("✅ [CLIENT] handleProcessAllSheets: Course data refreshed");
        
      } catch (err) {
        console.error('❌ [CLIENT] handleProcessAllSheets: Error:', err);
        setProcessAllSheetsResult({
          success: false,
          message: `Lỗi đồng bộ sheets: ${err.message}`
        });
        console.log("❌ [CLIENT] handleProcessAllSheets: Updated notification with error");
      } finally {
        setProcessingAllSheets(false);
        console.log("✅ [CLIENT] handleProcessAllSheets: Set processingAllSheets = false");
      }
    } else {
      console.log("ℹ️ [CLIENT] handleProcessAllSheets: User cancelled operation");
    }
  };

  return {
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
  };
} 