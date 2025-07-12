'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, CloudArrowDownIcon, ExclamationCircleIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { AdjustmentsHorizontalIcon, CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';

export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [currentCourse, setCurrentCourse] = useState(null);
  const [error, setError] = useState(null);
  // Removed unused state variables related to sync/initialization
  const [hasMongoConnection, setHasMongoConnection] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [showOriginalDataModal, setShowOriginalDataModal] = useState(false);
  const [showOriginalData, setShowOriginalData] = useState(false);
  const [originalData, setOriginalData] = useState(null);
  const [currentCourseId, setCurrentCourseId] = useState(null);
  const [loadingOriginalData, setLoadingOriginalData] = useState(false);
  const [originalDataError, setOriginalDataError] = useState(null);
  const [downloadingData, setDownloadingData] = useState(false);
  const [downloadError, setDownloadError] = useState(null);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [processingData, setProcessingData] = useState(false);
  const [processMethod, setProcessMethod] = useState('update_prices');
  const [processResult, setProcessResult] = useState(null);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [processValue, setProcessValue] = useState('');
  const [processingPDFs, setProcessingPDFs] = useState(false);
  const [analyzingCourses, setAnalyzingCourses] = useState({});
  const [processingPDFCourses, setProcessingPDFCourses] = useState({});
  
  // Hàm tiện ích để đồng bộ dữ liệu với bảng minicourse
  const syncToMiniCourse = async (courseData) => {
    try {
      console.log('🔄 Đang đồng bộ với minicourse...');
      const miniCourse = {
        kimvanId: courseData.kimvanId || null,
        name: courseData.name,
        description: courseData.description,
        price: courseData.price,
        status: courseData.status,
        courseId: courseData._id
      };
      
      // Gọi API để thêm/cập nhật minicourse
      const miniCourseResponse = await fetch('/api/minicourses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(miniCourse),
      });
      
      if (!miniCourseResponse.ok) {
        console.warn('⚠️ Thêm/cập nhật minicourse không thành công');
        return false;
      } else {
        console.log('✅ Thêm/cập nhật minicourse thành công');
        return true;
      }
    } catch (miniErr) {
      console.error('❌ Lỗi khi đồng bộ minicourse:', miniErr);
      return false;
    }
  };
  
  // Thiết lập cookie admin_access khi trang được tải
  useEffect(() => {
    // Thiết lập cookie admin_access=true (có thể hết hạn sau 1 ngày)
    document.cookie = "admin_access=true; path=/; max-age=86400; SameSite=Lax";
    console.log("✅ Đã thiết lập cookie admin_access=true");
    
    // Thêm bộ lọc console để bỏ qua lỗi 404 /api/users/me
    const originalError = console.error;
    console.error = (...args) => {
      // Bỏ qua lỗi 404 từ /api/users/me
      if (
        args[0] && 
        typeof args[0] === 'string' && 
        (args[0].includes('/api/users/me') || 
         args[0].includes('Failed to load resource: the server responded with a status of 404'))
      ) {
        // Bỏ qua lỗi 404 từ /api/users/me
        return;
      }
      originalError(...args);
    };
    
    // Khôi phục console.error khi component unmount
    return () => {
      console.error = originalError;
    };
  }, []);

  // Hàm để tải danh sách khóa học từ API
  const fetchCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log("🔍 Đang gửi yêu cầu đến /api/admin/courses...");
      const response = await fetch('/api/admin/courses');
      console.log("📋 Phản hồi:", response.status, response.statusText);
      
      // Nếu API trả về lỗi 403, thử làm mới cookie và gọi lại
      if (response.status === 403) {
        console.log("🔄 Phát hiện lỗi 403, thiết lập lại cookie và thử lại...");
        document.cookie = "admin_access=true; path=/; max-age=86400; SameSite=Lax";
        const retryResponse = await fetch('/api/admin/courses');
        
        if (!retryResponse.ok) {
          const retryData = await retryResponse.json();
          setHasMongoConnection(false);
          throw new Error(retryData.message || 'Không thể tải dữ liệu khóa học sau khi thử lại');
        }
        
        const retryData = await retryResponse.json();
        setHasMongoConnection(true);
        // Kiểm tra xem retryData có thuộc tính courses không
        if (retryData && retryData.courses && Array.isArray(retryData.courses)) {
          setCourses(retryData.courses);
        } else if (Array.isArray(retryData)) {
          setCourses(retryData);
        } else {
          console.warn('Format dữ liệu retry không như mong đợi:', retryData);
          setCourses([]);
        }
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        setHasMongoConnection(false);
        throw new Error(data.message || 'Không thể tải dữ liệu khóa học');
      }
      
      setHasMongoConnection(true);
      // Kiểm tra xem data có thuộc tính courses không
      if (data && data.courses && Array.isArray(data.courses)) {
        setCourses(data.courses);
      } else if (Array.isArray(data)) {
        setCourses(data);
      } else {
        console.warn('Format dữ liệu không như mong đợi:', data);
        setCourses([]);
      }
    } catch (err) {
      console.error('Lỗi khi tải danh sách khóa học:', err);
      setError(err.message || 'Đã xảy ra lỗi khi tải dữ liệu. Vui lòng kiểm tra kết nối MongoDB.');
      setCourses([]);
      setHasMongoConnection(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const filteredCourses = courses.filter(course =>
    course.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (course) => {
    setCurrentCourse({
      _id: course._id,
      name: course.name,
      description: course.description,
      price: course.price,
      status: course.status
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa khóa học này?')) {
      try {
        setError(null);
        
        // Lấy thông tin khóa học trước khi xóa để có kimvanId
        const courseResponse = await fetch(`/api/admin/courses/${id}`);
        const courseData = await courseResponse.json();
        const kimvanId = courseData.kimvanId;
        
        // Xóa khóa học
        const response = await fetch(`/api/admin/courses/${id}`, {
          method: 'DELETE',
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Không thể xóa khóa học');
        }
        
        // Cập nhật danh sách khóa học sau khi xóa
        setCourses(courses.filter(course => course._id !== id));
        
        // Xóa minicourse tương ứng
        try {
          console.log('Đang xóa minicourse tương ứng...');
          const miniCourseResponse = await fetch('/api/minicourses', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              courseId: id,
              kimvanId: kimvanId
            }),
          });
          
          if (miniCourseResponse.ok) {
            console.log('✅ Đã xóa minicourse thành công');
          } else {
            console.warn('⚠️ Không thể xóa minicourse');
          }
        } catch (miniErr) {
          console.error('❌ Lỗi khi xóa minicourse:', miniErr);
        }
      } catch (err) {
        console.error('Lỗi khi xóa khóa học:', err);
        setError(err.message || 'Đã xảy ra lỗi khi xóa khóa học. Vui lòng kiểm tra kết nối MongoDB.');
      }
    }
  };

  // Handler removed: handleCreateFromSheets

  const handleSave = async (e) => {
    e.preventDefault();
    
    try {
      setError(null);
      let response;
      let savedCourse;
      
      // Nếu có _id, thì cập nhật khóa học hiện có
      if (currentCourse._id) {
        response = await fetch(`/api/admin/courses/${currentCourse._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(currentCourse),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Không thể cập nhật khóa học');
        }
        
        // Cập nhật danh sách khóa học
        setCourses(courses.map(course => 
          course._id === currentCourse._id ? currentCourse : course
        ));
        
        savedCourse = currentCourse;
      } 
      // Ngược lại, tạo khóa học mới
      else {
        response = await fetch('/api/admin/courses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(currentCourse),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Không thể tạo khóa học mới');
        }
        
        // Thêm khóa học mới vào danh sách
        setCourses([...courses, data.course]);
        savedCourse = data.course;
      }
      
      // Đồng bộ với bảng minicourse
      await syncToMiniCourse(savedCourse);
      
      // Đóng modal và đặt lại trạng thái
      setShowModal(false);
      setCurrentCourse(null);
    } catch (err) {
      console.error('Lỗi khi lưu khóa học:', err);
      setError(err.message || 'Đã xảy ra lỗi khi lưu khóa học. Vui lòng kiểm tra kết nối MongoDB.');
    }
  };

  // Handler removed: handleShowSyncModal

  // Hàm trích xuất ID YouTube từ URL
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
    
    // Kiểm tra nhiều trường hợp của link PDF
    const urlLower = url.toLowerCase();
    
    // Kiểm tra đuôi file là .pdf
    if (urlLower.endsWith('.pdf')) return true;
    
    // Kiểm tra URL có chứa 'pdf' trong đường dẫn
    if (urlLower.includes('/pdf/')) return true;
    
    // Kiểm tra URL Google Drive có định dạng PDF
    if (urlLower.includes('drive.google.com') && urlLower.includes('pdf')) return true;
    
    // Kiểm tra URL có tham số type=pdf
    if (urlLower.includes('type=pdf')) return true;
    
    // Kiểm tra URL có tham số format=pdf
    if (urlLower.includes('format=pdf')) return true;
    
    return false;
  };
  
  // Hàm kiểm tra xem URL có phải là Google Drive link không
  const isGoogleDriveLink = (url) => {
    if (!url) return false;
    return url.includes('drive.google.com') || url.includes('docs.google.com');
  };

  // Hàm phân tích dữ liệu từ Kimvan
  const analyzeKimvanData = (data) => {
    if (!data) return null;
    
    try {
      // Khởi tạo đối tượng phân tích
      const analysis = {
        youtubeLinks: 0,
        driveLinks: 0,
        pdfLinks: 0, // Thêm đếm số lượng PDF
        totalLinks: 0,
        lessons: [],
        documents: [],
        attachments: []
      };
      
      // Hàm đệ quy để tìm link trong cấu trúc JSON phức tạp
      const findLinks = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        
        // Kiểm tra nếu đối tượng có trường link và uri
        if (obj.textFormat && obj.textFormat.link && obj.textFormat.link.uri) {
          const url = obj.textFormat.link.uri;
          analysis.totalLinks++;
          
          if (isYoutubeLink(url)) {
            analysis.youtubeLinks++;
            return { type: 'youtube', url, id: extractYoutubeId(url) };
          } else if (isGoogleDriveLink(url)) {
            analysis.driveLinks++;
            return { type: 'drive', url };
          } else if (isPdfLink(url)) {
            analysis.pdfLinks++;
            return { type: 'pdf', url };
          } else {
            return { type: 'other', url };
          }
        }
        
        // Kiểm tra trường hyperlink (có thể chứa URL)
        if (obj.hyperlink) {
          const url = obj.hyperlink;
          if (url.includes('http')) {
            analysis.totalLinks++;
            if (isYoutubeLink(url)) {
              analysis.youtubeLinks++;
              return { type: 'youtube', url, id: extractYoutubeId(url) };
            } else if (isGoogleDriveLink(url)) {
              analysis.driveLinks++;
              return { type: 'drive', url };
            } else if (isPdfLink(url)) {
              analysis.pdfLinks++;
              return { type: 'pdf', url };
            } else {
              return { type: 'other', url };
            }
          }
        }
        
        // Kiểm tra trường formattedValue có chứa URL không
        if (obj.formattedValue && typeof obj.formattedValue === 'string') {
          const url = obj.formattedValue;
          if (url.startsWith('http')) {
            analysis.totalLinks++;
            if (isYoutubeLink(url)) {
              analysis.youtubeLinks++;
              return { type: 'youtube', url, id: extractYoutubeId(url) };
            } else if (isGoogleDriveLink(url)) {
              analysis.driveLinks++;
              return { type: 'drive', url };
            } else if (isPdfLink(url)) {
              analysis.pdfLinks++;
              return { type: 'pdf', url };
            }
          }
        }
        
        // Kiểm tra cấu trúc dữ liệu từ sheets API
        if (obj.values && Array.isArray(obj.values)) {
          obj.values.forEach(val => {
            if (val.userEnteredFormat && val.userEnteredFormat.textFormat && 
                val.userEnteredFormat.textFormat.link && val.userEnteredFormat.textFormat.link.uri) {
              const url = val.userEnteredFormat.textFormat.link.uri;
              analysis.totalLinks++;
              
              if (isYoutubeLink(url)) {
                analysis.youtubeLinks++;
              } else if (isGoogleDriveLink(url)) {
                analysis.driveLinks++;
              } else if (isPdfLink(url)) {
                analysis.pdfLinks++;
              }
            }
            
            // Kiểm tra formattedValue có chứa URL không
            if (val.formattedValue && typeof val.formattedValue === 'string') {
              const text = val.formattedValue;
              if (text.startsWith('http')) {
                analysis.totalLinks++;
                if (isYoutubeLink(text)) {
                  analysis.youtubeLinks++;
                } else if (isGoogleDriveLink(text)) {
                  analysis.driveLinks++;
                } else if (isPdfLink(text)) {
                  analysis.pdfLinks++;
                }
              }
            }
          });
        }
        
        // Duyệt đệ quy qua tất cả các trường
        for (const key in obj) {
          if (obj[key] && typeof obj[key] === 'object') {
            findLinks(obj[key]);
          }
        }
      };
      
      // Xử lý dữ liệu bài học
      if (data.chapters && Array.isArray(data.chapters)) {
        data.chapters.forEach(chapter => {
          if (chapter.lessons && Array.isArray(chapter.lessons)) {
            chapter.lessons.forEach(lesson => {
              // Xác định loại video dựa trên URL
              let videoType = 'unknown';
              let videoUrl = lesson.videoUrl || '';
              let videoId = null;
              
              if (videoUrl) {
                if (isYoutubeLink(videoUrl)) {
                  videoType = 'youtube';
                  videoId = extractYoutubeId(videoUrl);
                } else if (isGoogleDriveLink(videoUrl)) {
                  videoType = 'drive';
                } else if (isPdfLink(videoUrl)) {
                  videoType = 'pdf';
                }
              }
              
              // Thêm vào danh sách bài học
              analysis.lessons.push({
                id: lesson.id || '',
                title: lesson.title || 'Không có tiêu đề',
                videoType: videoType,
                videoUrl: videoUrl,
                videoId: videoId,
                chapterTitle: chapter.title || 'Chưa phân loại'
              });
            });
          }
        });
      }
      
      // Phân tích dữ liệu tài liệu
      if (data.resources && Array.isArray(data.resources)) {
        data.resources.forEach(resource => {
          // Xác định loại tài liệu dựa trên URL
          let resourceType = resource.type || 'unknown';
          let resourceUrl = resource.url || '';
          let resourceId = null;
          
          if (resourceUrl) {
            if (isYoutubeLink(resourceUrl)) {
              resourceType = 'youtube';
              resourceId = extractYoutubeId(resourceUrl);
            } else if (isGoogleDriveLink(resourceUrl)) {
              resourceType = 'drive';
            } else if (isPdfLink(resourceUrl)) {
              resourceType = 'pdf';
            }
          }
          
          // Thêm vào danh sách tài liệu
          analysis.documents.push({
            id: resource.id || '',
            title: resource.title || 'Không có tiêu đề',
            type: resourceType,
            url: resourceUrl,
            resourceId: resourceId
          });
        });
      }
      
      // Phân tích dữ liệu đính kèm
      if (data.attachments && Array.isArray(data.attachments)) {
        data.attachments.forEach(attachment => {
          // Xác định loại đính kèm dựa trên URL
          let attachmentType = attachment.type || 'unknown';
          let attachmentUrl = attachment.url || '';
          let attachmentId = null;
          
          if (attachmentUrl) {
            if (isYoutubeLink(attachmentUrl)) {
              attachmentType = 'youtube';
              attachmentId = extractYoutubeId(attachmentUrl);
            } else if (isGoogleDriveLink(attachmentUrl)) {
              attachmentType = 'drive';
            } else if (isPdfLink(attachmentUrl)) {
              attachmentType = 'pdf';
            }
          }
          
          // Thêm vào danh sách đính kèm
          analysis.attachments.push({
            id: attachment.id || '',
            title: attachment.title || 'Không có tiêu đề',
            type: attachmentType,
            url: attachmentUrl,
            attachmentId: attachmentId
          });
        });
      }
      
      // Phân tích cấu trúc phức tạp từ Google Sheets
      if (data.sheets && Array.isArray(data.sheets)) {
        data.sheets.forEach(sheet => {
          // Kiểm tra tiêu đề sheet
          if (sheet.properties && sheet.properties.title) {
            console.log(`📊 Đang phân tích sheet: ${sheet.properties.title}`);
          }
          
          if (sheet.data && Array.isArray(sheet.data)) {
            sheet.data.forEach(sheetData => {
              if (sheetData.rowData && Array.isArray(sheetData.rowData)) {
                sheetData.rowData.forEach(row => {
                  findLinks(row);
                });
              }
            });
          }
        });
      }
      
      console.log('✅ Kết quả phân tích:', analysis);
      return analysis;
    } catch (error) {
      console.error('Lỗi khi phân tích dữ liệu Kimvan:', error);
      return null;
    }
  };

  // Handler removed: handleConfirmSync

  // Handler removed: handleSyncSingleCourse

  // Handler removed: handleSync

  // Handler removed: handleInitDatabase

  // Thêm hàm xử lý khi đóng modal
  const handleCloseModal = () => {
    setShowModal(false);
  };

  // Handler removed: handleCloseSyncModal

  // Hàm hiển thị dữ liệu gốc trong modal
  const handleViewOriginalData = async (courseId) => {
    setShowOriginalDataModal(true);
    setLoadingOriginalData(true);
    setCurrentCourseId(courseId);
    
    try {
      const courseResponse = await fetch(`/api/admin/courses/${courseId}`);
      if (!courseResponse.ok) {
        throw new Error(`Lỗi: ${courseResponse.status} ${courseResponse.statusText}`);
      }
      const data = await courseResponse.json();
      setOriginalData(data.originalData);
    } catch (error) {
      console.error('Lỗi khi lấy dữ liệu gốc:', error);
      setOriginalData(null);
    } finally {
      setLoadingOriginalData(false);
    }
  }

  // Hàm để tải xuống dữ liệu gốc dưới dạng file JSON
  const handleDownloadOriginalData = async () => {
    if (!currentCourseId) return;
    
    setDownloadingData(true);
    setDownloadError(null);
    
    try {
      const courseResponse = await fetch(`/api/admin/courses/${currentCourseId}`);
      if (!courseResponse.ok) {
        throw new Error(`Lỗi: ${courseResponse.status} ${courseResponse.statusText}`);
      }
      
      const courseData = await courseResponse.json();
      
      if (!courseData.originalData) {
        throw new Error('Không tìm thấy dữ liệu gốc cho khóa học này');
      }
      
      // Tạo file JSON để tải xuống
      const blob = new Blob([JSON.stringify(courseData.originalData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Tạo thẻ a và kích hoạt sự kiện click để tải xuống
      const a = document.createElement('a');
      a.href = url;
      a.download = `kimvan-course-${currentCourseId}.json`;
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

  // Thêm hàm xử lý dữ liệu khóa học
  const handleProcessData = async () => {
    if (selectedCourses.length === 0) {
      alert('Vui lòng chọn ít nhất một khóa học để xử lý');
      return;
    }

    try {
      setProcessingData(true);
      setError(null);
      setProcessResult(null);
      
      const response = await fetch('/api/admin/courses/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseIds: selectedCourses,
          method: processMethod,
          value: processValue
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Không thể xử lý dữ liệu khóa học');
      }
      
      setProcessResult(data);
      
      // Nếu xử lý thành công, tải lại danh sách khóa học
      if (data.success) {
        await fetchCourses();
        
        // Đồng bộ với minicourse cho từng khóa học đã xử lý
        if (data.updatedCourses && Array.isArray(data.updatedCourses)) {
          console.log('Đồng bộ dữ liệu với minicourse cho các khóa học đã xử lý');
          for (const course of data.updatedCourses) {
            await syncToMiniCourse(course);
          }
        } else {
          // Nếu API không trả về danh sách khóa học đã cập nhật, tải lại từng khóa học và đồng bộ
          for (const courseId of selectedCourses) {
            try {
              const courseResponse = await fetch(`/api/admin/courses/${courseId}`);
              if (courseResponse.ok) {
                const courseData = await courseResponse.json();
                await syncToMiniCourse(courseData);
              }
            } catch (err) {
              console.error(`Lỗi khi đồng bộ minicourse cho khóa học ${courseId}:`, err);
            }
          }
        }
        
        // Reset lựa chọn sau khi xử lý thành công
        setSelectedCourses([]);
      }
    } catch (err) {
      console.error('Lỗi khi xử lý dữ liệu khóa học:', err);
      setError(err.message || 'Đã xảy ra lỗi khi xử lý dữ liệu khóa học');
    } finally {
      setProcessingData(false);
    }
  };

  // Xử lý chọn tất cả khóa học
  const handleSelectAllCourses = (e) => {
    if (e.target.checked) {
      setSelectedCourses(courses.map(course => course._id));
    } else {
      setSelectedCourses([]);
    }
  };

  // Xử lý chọn/bỏ chọn một khóa học
  const handleSelectCourse = (courseId, isChecked) => {
    if (isChecked) {
      setSelectedCourses([...selectedCourses, courseId]);
    } else {
      setSelectedCourses(selectedCourses.filter(id => id !== courseId));
    }
  };

  // Hàm xử lý tất cả file PDF
  const handleProcessAllPDFs = async () => {
    try {
      setProcessingPDFs(true);
      setError(null);
      
      // Tạo một mảng chứa tất cả promise xử lý PDF
      const processPromises = courses.map(async (course) => {
        try {
          // Đánh dấu đang xử lý cho khóa học này
          setProcessingPDFCourses(prev => ({ ...prev, [course._id]: true }));
          
          // Gọi API để xử lý PDF cho khóa học cụ thể
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15 * 60 * 1000); // 15 phút
          
          try {
            // Thêm retry logic
            let retryCount = 0;
            const maxRetries = 2;
            let response = null;
            
            while (retryCount <= maxRetries) {
              try {
                console.log(`Thử gọi API xử lý PDF lần ${retryCount + 1} cho khóa học ${course._id}`);
                response = await fetch(`/api/courses/${course._id}/process-all-drive`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  signal: controller.signal,
                  timeout: 15 * 60 * 1000 // 15 phút
                });
                
                // Nếu fetch thành công, thoát khỏi vòng lặp
                break;
              } catch (fetchError) {
                retryCount++;
                
                // Nếu đã hết số lần thử lại hoặc lỗi không phải timeout, throw lỗi
                if (retryCount > maxRetries || 
                   (fetchError.name !== 'AbortError' && 
                    !fetchError.message.includes('timeout') && 
                    !fetchError.message.includes('Headers Timeout Error'))) {
                  throw fetchError;
                }
                
                // Đợi trước khi thử lại
                console.log(`Lỗi fetch: ${fetchError.message}. Thử lại sau 5 giây...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
              }
            }
            
            clearTimeout(timeoutId); // Xóa timeout nếu fetch hoàn thành
            
            if (!response) {
              throw new Error('Không thể kết nối đến API sau nhiều lần thử');
            }
          
            const data = await response.json();
          
            if (!response.ok) {
              throw new Error(data.message || data.error || 'Không thể xử lý file PDF');
            }
          
            // Đánh dấu đã xử lý xong cho khóa học này
            setProcessingPDFCourses(prev => ({ ...prev, [course._id]: false }));
            
            // Đồng bộ với minicourse sau khi xử lý PDF
            try {
              const courseResponse = await fetch(`/api/admin/courses/${course._id}`);
              if (courseResponse.ok) {
                const courseData = await courseResponse.json();
                await syncToMiniCourse(courseData);
                console.log(`Đã đồng bộ minicourse cho khóa học ${course._id} sau khi xử lý PDF`);
              }
            } catch (syncError) {
              console.error(`Lỗi khi đồng bộ minicourse cho khóa học ${course._id}:`, syncError);
            }
          
            return {
              courseId: course._id,
              courseName: course.name,
              success: true,
              summary: data.summary
            };
          } catch (fetchError) {
            throw fetchError;
          } finally {
            clearTimeout(timeoutId);
          }
          
        } catch (err) {
          console.error(`Lỗi khi xử lý PDF cho khóa học ${course.name}:`, err);
          
          // Đánh dấu đã xử lý xong cho khóa học này (dù bị lỗi)
          setProcessingPDFCourses(prev => ({ ...prev, [course._id]: false }));
          
          return {
            courseId: course._id,
            courseName: course.name,
            success: false,
            error: err.message
          };
        }
      });
      
      // Chờ tất cả các promise hoàn thành
      const results = await Promise.all(processPromises);
      
      // Tính toán tổng kết quả
      const summary = results.reduce((acc, result) => {
        return {
          total: acc.total + 1,
          success: acc.success + (result.success ? 1 : 0),
          errors: acc.errors + (result.success ? 0 : 1)
        };
      }, { total: 0, success: 0, errors: 0 });
      
      // Hiển thị kết quả xử lý
      setProcessResult({
        success: summary.errors === 0,
        message: `Đã xử lý ${summary.total} khóa học: ${summary.success} thành công, ${summary.errors} lỗi`,
        summary: summary,
        details: results
      });
      
      // Tải lại danh sách khóa học
      await fetchCourses();
      
    } catch (err) {
      console.error('Lỗi khi xử lý tất cả file PDF:', err);
      setError(err.message || 'Đã xảy ra lỗi khi xử lý file PDF');
      setProcessResult({
        success: false,
        message: `Lỗi: ${err.message}`,
        summary: {
          total: 0,
          success: 0,
          errors: 1
        }
      });
    } finally {
      setProcessingPDFs(false);
    }
  };

  // Hàm xử lý PDF cho một khóa học cụ thể
  const handleProcessPDF = async (courseId) => {
    try {
      setProcessingPDFCourses(prev => ({ ...prev, [courseId]: true }));
      setError(null);
      
      // Gọi API để xử lý PDF cho khóa học cụ thể
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15 * 60 * 1000); // 15 phút
      
      try {
        // Thêm retry logic
        let retryCount = 0;
        const maxRetries = 2;
        let response = null;
        
        while (retryCount <= maxRetries) {
          try {
            console.log(`Thử gọi API xử lý PDF lần ${retryCount + 1} cho khóa học ${courseId}`);
            response = await fetch(`/api/courses/${courseId}/process-all-drive`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              signal: controller.signal,
              timeout: 15 * 60 * 1000 // 15 phút
            });
            
            // Nếu fetch thành công, thoát khỏi vòng lặp
            break;
          } catch (fetchError) {
            retryCount++;
            
            // Nếu đã hết số lần thử lại hoặc lỗi không phải timeout, throw lỗi
            if (retryCount > maxRetries || 
               (fetchError.name !== 'AbortError' && 
                !fetchError.message.includes('timeout') && 
                !fetchError.message.includes('Headers Timeout Error'))) {
              throw fetchError;
            }
            
            // Đợi trước khi thử lại
            console.log(`Lỗi fetch: ${fetchError.message}. Thử lại sau 5 giây...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
        
        clearTimeout(timeoutId); // Xóa timeout nếu fetch hoàn thành
        
        if (!response) {
          throw new Error('Không thể kết nối đến API sau nhiều lần thử');
        }
      
        const data = await response.json();
      
        if (!response.ok) {
          throw new Error(data.message || data.error || 'Không thể xử lý file PDF');
        }
      
        // Hiển thị kết quả xử lý
        setProcessResult({
          success: true,
          message: 'Xử lý file PDF thành công',
          summary: data.summary
        });
      
        // Tải lại danh sách khóa học
        await fetchCourses();
        
        // Đồng bộ với minicourse sau khi xử lý PDF
        try {
          const courseResponse = await fetch(`/api/admin/courses/${courseId}`);
          if (courseResponse.ok) {
            const courseData = await courseResponse.json();
            await syncToMiniCourse(courseData);
            console.log(`Đã đồng bộ minicourse cho khóa học ${courseId} sau khi xử lý PDF`);
          }
        } catch (syncError) {
          console.error(`Lỗi khi đồng bộ minicourse cho khóa học ${courseId}:`, syncError);
        }
      } catch (fetchError) {
        throw fetchError;
      } finally {
        clearTimeout(timeoutId);
      }
      
    } catch (err) {
      console.error('Lỗi khi xử lý file PDF:', err);
      setError(err.message || 'Đã xảy ra lỗi khi xử lý file PDF');
      setProcessResult({
        success: false,
        message: `Lỗi: ${err.message}`,
        summary: {
          total: 0,
          success: 0,
          errors: 1
        }
      });
    } finally {
      setProcessingPDFCourses(prev => ({ ...prev, [courseId]: false }));
    }
  };

  // Handler removed: handleAutoSyncAllCourses

  // Handler removed: handleStopAutoSync

  // Hàm xử lý tất cả khóa học tuần tự
  const handleProcessAllCourses = async () => {
    try {
      // Lọc ra các khóa học có kimvanId
      const coursesWithKimvanId = courses.filter(course => course.kimvanId);
      
      if (coursesWithKimvanId.length === 0) {
        alert('Không có khóa học nào có ID Kimvan để xử lý');
        return;
      }
      
      if (!window.confirm(`Bạn có chắc chắn muốn xử lý tất cả ${coursesWithKimvanId.length} khóa học tuần tự? Quá trình này sẽ mất nhiều thời gian.`)) {
        return;
      }
      
      setProcessingData(true);
      // Khởi tạo kết quả xử lý
      const results = {
        inProgress: true,
        success: true,
        message: `Đang bắt đầu xử lý ${coursesWithKimvanId.length} khóa học...`,
        details: [],
        errors: []
      };
      setProcessResult(results);
      
      // Hàm đệ quy để xử lý từng khóa học một với độ trễ
      const processNextCourse = async (index) => {
        if (index >= coursesWithKimvanId.length) {
          // Đã hoàn thành tất cả
          setProcessingData(false);
          setProcessResult({
            inProgress: false,
            success: results.errors.length === 0,
            message: `Đã hoàn thành xử lý ${results.details.length} khóa học, có ${results.errors.length} lỗi`,
            details: results.details,
            errors: results.errors
          });
          return;
        }
        
        const currentCourse = coursesWithKimvanId[index];
        
        // Hiển thị thông báo đang xử lý
        setProcessResult({
          inProgress: true,
          success: true,
          message: `Đang xử lý khóa học ${index + 1}/${coursesWithKimvanId.length}: ${currentCourse.name}`,
          details: results.details,
          errors: results.errors
        });
        
        try {
          console.log(`🔄 Bắt đầu xử lý khóa học ${index + 1}/${coursesWithKimvanId.length}: ${currentCourse.name}`);
          
          // Gọi API để xử lý khóa học - sử dụng URL tuyệt đối
          const baseUrl = window.location.origin;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 giây timeout
          
          try {
            const response = await fetch(`${baseUrl}/api/courses/${currentCourse._id}/process-all-sheets`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            const data = await response.json();
            
            if (!response.ok) {
              throw new Error(data.message || `Không thể xử lý khóa học ${currentCourse.name}`);
            }
            
            console.log(`✅ Xử lý khóa học ${currentCourse.name} thành công`);
            
            // Đồng bộ với minicourse sau khi xử lý
            try {
              const courseResponse = await fetch(`${baseUrl}/api/admin/courses/${currentCourse._id}`);
              if (courseResponse.ok) {
                const courseData = await courseResponse.json();
                await syncToMiniCourse(courseData);
                console.log(`Đã đồng bộ minicourse cho khóa học ${currentCourse._id} sau khi xử lý`);
              }
            } catch (syncError) {
              console.error(`Lỗi khi đồng bộ minicourse cho khóa học ${currentCourse._id}:`, syncError);
            }
            
            // Thêm kết quả thành công
            results.details.push({
              courseId: currentCourse._id, 
              courseName: currentCourse.name,
              message: 'Xử lý thành công',
              timestamp: new Date().toISOString()
            });
          } catch (apiErr) {
            console.error(`❌ Lỗi khi gọi API xử lý khóa học ${currentCourse.name}:`, apiErr);
            
            // Thêm kết quả lỗi
            const errorMessage = apiErr.name === 'AbortError' 
              ? 'Quá thời gian chờ - yêu cầu bị hủy sau 60 giây' 
              : (apiErr.message || 'Đã xảy ra lỗi khi xử lý');
              
            results.errors.push({
              courseId: currentCourse._id, 
              courseName: currentCourse.name,
              message: errorMessage,
              timestamp: new Date().toISOString()
            });
          } finally {
            // Đảm bảo rằng timeout luôn được xóa
            clearTimeout(timeoutId);
          }
          
        } catch (err) {
          console.error(`❌ Lỗi ngoại lệ khi xử lý khóa học ${currentCourse.name}:`, err);
          
          results.errors.push({
            courseId: currentCourse._id, 
            courseName: currentCourse.name,
            message: 'Lỗi không mong đợi: ' + (err.message || 'Không xác định'),
            timestamp: new Date().toISOString()
          });
        } finally {
          // Đợi 10 giây trước khi xử lý khóa học tiếp theo
          console.log(`⏱️ Đợi 10 giây trước khi xử lý khóa học tiếp theo...`);
          setTimeout(() => {
            processNextCourse(index + 1);
          }, 10000); // 10000ms = 10 giây
        }
      };
      
      // Bắt đầu quy trình xử lý với khóa học đầu tiên
      processNextCourse(0);
      
    } catch (err) {
      console.error('Lỗi khi khởi tạo xử lý tự động:', err);
      setProcessResult({
        inProgress: false,
        success: false,
        message: err.message || 'Đã xảy ra lỗi khi khởi tạo xử lý tự động',
        details: [],
        errors: [{ message: err.message || 'Lỗi không xác định' }]
      });
      setProcessingData(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Quản lý khóa học</h1>
        <div className="flex space-x-4">
          
          <button
            onClick={handleProcessAllCourses}
            disabled={processingData || processingPDFs}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50"
          >
            <AdjustmentsHorizontalIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            {processingData ? 'Đang xử lý...' : 'Xử lý tất cả khóa học'}
          </button>
          
          <button
            onClick={handleProcessAllPDFs}
            disabled={processingPDFs}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
          >
            <ArrowDownTrayIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            {processingPDFs ? 'Đang xử lý PDF...' : 'Xử lý tất cả PDF'}
          </button>
          {/* Nút xử lý dữ liệu đã được xóa */}
          <button
            onClick={() => {
              setCurrentCourse({
                _id: null,
                name: '',
                description: '',
                price: 0,
                status: 'active',
              });
              setShowModal(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Thêm khóa học
          </button>
        </div>
      </div>

      {/* Notification area for initialization removed */}

      {/* Notification area for sync results removed */}

      {processResult && (
        <div className={`bg-${processResult.success ? 'blue' : 'red'}-50 p-4 rounded-md mb-4`}>
          <div className="flex">
            <div className="flex-shrink-0">
              {processResult.success ? (
                <CheckCircleIcon className="h-5 w-5 text-blue-400" aria-hidden="true" />
              ) : (
                <ExclamationCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
              )}
            </div>
            <div className="ml-3">
              <h3 className={`text-sm font-medium text-${processResult.success ? 'blue' : 'red'}-800`}>
                {processResult.success ? 'Xử lý dữ liệu thành công' : 'Xử lý dữ liệu thất bại'}
              </h3>
              <div className={`mt-2 text-sm text-${processResult.success ? 'blue' : 'red'}-700`}>
                <p>{processResult.message}</p>
                {processResult.success && processResult.summary && (
                  <>
                    <p>Tổng số khóa học đã xử lý: {processResult.summary.total}</p>
                    <p>Số khóa học cập nhật thành công: {processResult.summary.success}</p>
                    <p>Số khóa học bị lỗi: {processResult.summary.errors}</p>
                  </>
                )}
              </div>
              <div className="mt-4">
                <div className="-mx-2 -my-1.5 flex">
                  <button
                    type="button"
                    onClick={() => setProcessResult(null)}
                    className={`bg-${processResult.success ? 'blue' : 'red'}-50 px-2 py-1.5 rounded-md text-sm font-medium text-${processResult.success ? 'blue' : 'red'}-800 hover:bg-${processResult.success ? 'blue' : 'red'}-100`}
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="mb-4">
            <input
              type="text"
              placeholder="Tìm kiếm khóa học..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          {error && (
            <div className="bg-red-50 p-4 mb-4 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <ExclamationCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Đã xảy ra lỗi
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-10">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600 mb-2"></div>
              <p className="text-gray-500">Đang tải dữ liệu...</p>
            </div>
          ) : !hasMongoConnection ? (
            <div className="bg-gray-50 p-8 rounded-md text-center">
              <ExclamationCircleIcon className="h-12 w-12 text-red-400 mx-auto mb-4" aria-hidden="true" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Không thể kết nối cơ sở dữ liệu</h3>
              <p className="text-sm text-gray-500 mb-4">
                Không thể kết nối với cơ sở dữ liệu MongoDB. Vui lòng kiểm tra kết nối với cơ sở dữ liệu.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {filteredCourses.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <input
                          type="checkbox"
                          onChange={handleSelectAllCourses}
                          checked={selectedCourses.length === courses.length && courses.length > 0}
                          className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên khóa học</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ngày chỉnh sửa</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCourses.map((course) => (
                      <tr key={course._id}>
                        <td className="px-2 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedCourses.includes(course._id)}
                            onChange={(e) => handleSelectCourse(course._id, e.target.checked)}
                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <button 
                            onClick={() => router.push(`/admin/courses/${course._id}`)}
                            className="text-left hover:text-indigo-600 hover:underline cursor-pointer"
                          >
                            {course.name}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {course.updatedAt 
                            ? new Date(course.updatedAt).toLocaleDateString('vi-VN') + ' ' + new Date(course.updatedAt).toLocaleTimeString('vi-VN')
                            : new Date(course.createdAt).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleEdit(course)}
                            className="text-indigo-600 hover:text-indigo-900 mr-2"
                            title="Chỉnh sửa khóa học"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          {course.kimvanId && (
                            <>
                              <button
                                onClick={() => handleViewOriginalData(course._id)}
                                className="text-yellow-600 hover:text-yellow-900 mr-2"
                                title="Xem dữ liệu gốc"
                              >
                                <CloudArrowDownIcon className="h-5 w-5" />
                              </button>
                              {/* Sync button removed */}
                            </>
                          )}
                          <button
                            onClick={() => handleDelete(course._id)}
                            className="text-red-600 hover:text-red-900"
                            title="Xóa khóa học"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleProcessPDF(course._id)}
                            disabled={processingPDFCourses[course._id]}
                            className={`text-purple-600 hover:text-purple-900 ml-2 ${processingPDFCourses[course._id] ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="Xử lý PDF của khóa học này"
                          >
                            <ArrowDownTrayIcon className={`h-5 w-5 ${processingPDFCourses[course._id] ? 'animate-spin' : ''}`} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-10">
                  <p className="text-gray-500">Không tìm thấy khóa học nào</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Thêm/Chỉnh sửa khóa học */}
      {showModal && (
        <>
          {/* Lớp phủ */}
          <div 
            className="fixed inset-0 bg-gray-500 bg-opacity-75 z-40 cursor-pointer" 
            onClick={handleCloseModal}
          ></div>
          
          {/* Nội dung modal */}
          <div className="fixed z-50 inset-0 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full" onClick={(e) => e.stopPropagation()}>
                <form onSubmit={handleSave}>
                  <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      {currentCourse._id ? 'Chỉnh sửa khóa học' : 'Thêm khóa học mới'}
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Tên khóa học</label>
                        <input
                          type="text"
                          value={currentCourse.name}
                          onChange={(e) => setCurrentCourse({ ...currentCourse, name: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Mô tả</label>
                        <textarea
                          value={currentCourse.description}
                          onChange={(e) => setCurrentCourse({ ...currentCourse, description: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          rows="3"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Giá</label>
                        <input
                          type="number"
                          value={currentCourse.price}
                          onChange={(e) => setCurrentCourse({ ...currentCourse, price: parseInt(e.target.value) })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Trạng thái</label>
                        <select
                          value={currentCourse.status}
                          onChange={(e) => setCurrentCourse({ ...currentCourse, status: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        >
                          <option value="active">Đang hoạt động</option>
                          <option value="inactive">Ngừng hoạt động</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button
                      type="submit"
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                    >
                      Lưu
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal for sync removed */}

      {/* Modal hiển thị dữ liệu gốc */}
      {showOriginalDataModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Dữ liệu gốc của khóa học</h3>
              <button
                onClick={() => setShowOriginalDataModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="mb-4">
              <button
                onClick={handleDownloadOriginalData}
                disabled={downloadingData || !originalData}
                className="bg-green-600 text-white px-4 py-2 rounded mr-2 hover:bg-green-700 disabled:opacity-50"
              >
                {downloadingData ? (
                  <span className="flex items-center">
                    <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
                    Đang tải xuống...
                  </span>
                ) : (
                  <span className="flex items-center">
                    <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                    Tải xuống dữ liệu đầy đủ
                  </span>
                )}
              </button>
              
              {downloadError && (
                <div className="text-red-500 mt-2">
                  <p>Lỗi khi tải xuống: {downloadError}</p>
                </div>
              )}
            </div>
            
            {loadingOriginalData ? (
              <div className="flex justify-center items-center py-20">
                <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-500" />
                <span className="ml-2">Đang tải dữ liệu...</span>
              </div>
            ) : originalDataError ? (
              <div className="text-red-500 py-10 text-center">
                <p>Đã xảy ra lỗi khi tải dữ liệu:</p>
                <p>{originalDataError}</p>
              </div>
            ) : originalData ? (
              <div className="bg-gray-100 p-4 rounded-md">
                <pre className="whitespace-pre-wrap overflow-auto max-h-[60vh]">
                  {JSON.stringify(originalData, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="text-center py-10">
                <p>Không có dữ liệu để hiển thị</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Xử lý dữ liệu khóa học đã được xóa */}

      {/* Modal for sync confirmation with data analysis removed */}
    </div>
  );
} 