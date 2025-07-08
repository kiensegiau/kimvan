'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, CloudArrowDownIcon, ExclamationCircleIcon, XMarkIcon, ArrowPathIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { ServerIcon as DatabaseIcon } from '@heroicons/react/24/outline';
import { AdjustmentsHorizontalIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';

export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [currentCourse, setCurrentCourse] = useState(null);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [initResult, setInitResult] = useState(null);
  const [hasMongoConnection, setHasMongoConnection] = useState(true);
  const [kimvanCourses, setKimvanCourses] = useState([]);
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
  const [showSyncConfirmModal, setShowSyncConfirmModal] = useState(false);
  const [syncAnalysisData, setSyncAnalysisData] = useState(null);
  const [analyzingData, setAnalyzingData] = useState(false);
  const [pendingSyncData, setPendingSyncData] = useState(null);
  const [processingPDFs, setProcessingPDFs] = useState(false);
  const [syncingCourses, setSyncingCourses] = useState({});
  const [analyzingCourses, setAnalyzingCourses] = useState({});
  const [processingPDFCourses, setProcessingPDFCourses] = useState({});
  const [autoSyncInProgress, setAutoSyncInProgress] = useState(false);
  const [currentAutoSyncIndex, setCurrentAutoSyncIndex] = useState(0);
  const [autoSyncTotal, setAutoSyncTotal] = useState(0);
  const [autoSyncResults, setAutoSyncResults] = useState([]);
  
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
        const response = await fetch(`/api/admin/courses/${id}`, {
          method: 'DELETE',
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Không thể xóa khóa học');
        }
        
        // Cập nhật danh sách khóa học sau khi xóa
        setCourses(courses.filter(course => course._id !== id));
      } catch (err) {
        console.error('Lỗi khi xóa khóa học:', err);
        setError(err.message || 'Đã xảy ra lỗi khi xóa khóa học. Vui lòng kiểm tra kết nối MongoDB.');
      }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    try {
      setError(null);
      let response;
      
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
      }
      
      // Đóng modal và đặt lại trạng thái
      setShowModal(false);
      setCurrentCourse(null);
    } catch (err) {
      console.error('Lỗi khi lưu khóa học:', err);
      setError(err.message || 'Đã xảy ra lỗi khi lưu khóa học. Vui lòng kiểm tra kết nối MongoDB.');
    }
  };

  // Hàm mở modal xác nhận đồng bộ
  const handleShowSyncModal = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Lấy danh sách khóa học từ API spreadsheets
      const response = await fetch('/api/spreadsheets/create/fullcombokhoa2k8');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Không thể lấy danh sách khóa học từ Khoá học 6.0');
      }
      
      // Lưu danh sách khóa học gốc từ Kimvan vào state
      const kimvanCoursesOriginal = data.map((item) => ({
        kimvanId: item.id,
        name: item.name,
        description: `Khóa học ${item.name}`,
        price: 500000,
        status: 'active',
        originalData: item
      }));
      
      // Đồng thời tạo danh sách minicourses không chứa originalData
      const miniCourses = data.map((item) => ({
        kimvanId: item.id,
        name: item.name,
        description: `Khóa học ${item.name}`,
        price: 500000,
        status: 'active',
        // Không bao gồm originalData và processedDriveFiles để giảm kích thước
        createdAt: new Date(),
        updatedAt: new Date()
      }));
      
      setKimvanCourses(kimvanCoursesOriginal || []);
      setShowSyncModal(true);
      
      // Tự động đồng bộ minicourses song song
      try {
        console.log('🔄 Đang đồng bộ minicourses song song...');
        const miniCourseResponse = await fetch('/api/minicourses/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            courses: miniCourses 
          }),
        });
        
        const miniCourseData = await miniCourseResponse.json();
        
        if (miniCourseResponse.ok) {
          console.log('✅ Đồng bộ minicourses thành công:', miniCourseData);
        } else {
          console.warn('⚠️ Đồng bộ minicourses không thành công:', miniCourseData);
        }
      } catch (miniErr) {
        console.error('❌ Lỗi khi đồng bộ minicourses:', miniErr);
        // Không hiển thị lỗi này cho người dùng vì đây là quá trình chạy ngầm
      }
    } catch (err) {
      console.error('Lỗi khi lấy danh sách khóa học từ Khoá học 6.0:', err);
      setError(err.message || 'Đã xảy ra lỗi khi lấy danh sách khóa học từ Kimvan');
    } finally {
      setLoading(false);
    }
  };

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

  // Hàm xác nhận đồng bộ sau khi phân tích
  const handleConfirmSync = async () => {
    try {
      console.log('🚀 Bắt đầu quá trình đồng bộ sau khi xác nhận');
      setShowSyncConfirmModal(false);
      setSyncing(true);
      
      // Lấy dữ liệu đang chờ đồng bộ
      const { existingCourse, kimvanData } = pendingSyncData;
      console.log('📦 Dữ liệu đang chờ đồng bộ:', existingCourse.name);
      
      // Định dạng dữ liệu
      const courseToSync = {
        _id: existingCourse._id,
        kimvanId: existingCourse.kimvanId,
        name: existingCourse.name,
        description: existingCourse.description,
        price: existingCourse.price,
        status: existingCourse.status,
        originalData: kimvanData
      };
      
      // Gọi API để đồng bộ với MongoDB
      console.log('📡 Gửi dữ liệu đến API...');
      const syncResponse = await fetch(`/api/admin/courses/${existingCourse._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          ...courseToSync,
          updatedAt: new Date()
        }),
      });
      
      const syncData = await syncResponse.json();
      
      if (!syncResponse.ok) {
        throw new Error(syncData.message || 'Không thể đồng bộ dữ liệu');
      }
      
      console.log('✅ Đồng bộ thành công');
      
      // Đồng bộ song song với minicourses
      try {
        console.log('🔄 Đang đồng bộ minicourse song song...');
        // Tạo dữ liệu minicourse không chứa originalData
        const miniCourse = {
          kimvanId: existingCourse.kimvanId,
          name: existingCourse.name,
          description: existingCourse.description,
          price: existingCourse.price,
          status: existingCourse.status,
          courseId: existingCourse._id,
          updatedAt: new Date()
        };
        
        const miniCourseResponse = await fetch('/api/minicourses/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            courses: [miniCourse] 
          }),
        });
        
        const miniCourseData = await miniCourseResponse.json();
        
        if (miniCourseResponse.ok) {
          console.log('✅ Đồng bộ minicourse thành công:', miniCourseData);
        } else {
          console.warn('⚠️ Đồng bộ minicourse không thành công:', miniCourseData);
        }
      } catch (miniErr) {
        console.error('❌ Lỗi khi đồng bộ minicourse:', miniErr);
        // Không hiển thị lỗi này cho người dùng vì đây là quá trình chạy ngầm
      }
      
      // Hiển thị kết quả đồng bộ
      setSyncResults({
        inProgress: false,
        success: true,
        message: 'Đồng bộ khóa học thành công',
        summary: {
          total: 1,
          created: 0,
          updated: 1,
          errors: 0
        }
      });
      
      // Tải lại danh sách khóa học
      // await fetchCourses();
      
    } catch (err) {
      console.error('❌ Lỗi khi đồng bộ khóa học:', err);
      setError(err.message || 'Đã xảy ra lỗi khi đồng bộ khóa học từ Kimvan');
      
      // Hiển thị kết quả lỗi
      setSyncResults({
        inProgress: false,
        success: false,
        message: `Lỗi: ${err.message}`,
        summary: {
          total: 1,
          created: 0,
          updated: 0,
          errors: 1
        }
      });
    } finally {
      setSyncing(false);
      setPendingSyncData(null);
    }
  };

  // Hàm đồng bộ dữ liệu cho một khóa học cụ thể
  const handleSyncSingleCourse = async (courseId) => {
    try {
      setAnalyzingCourses(prev => ({ ...prev, [courseId]: true }));
      setError(null);
      
      console.log('🔍 Bắt đầu phân tích dữ liệu khóa học:', courseId);
      
      // Hiển thị thông báo
      setSyncResults({
        inProgress: true,
        success: true,
        message: 'Đang phân tích dữ liệu khóa học...',
        summary: {
          total: 1,
          created: 0,
          updated: 0,
          errors: 0
        }
      });
      
      // Bước 1: Tìm khóa học hiện có trong danh sách
      const existingCourse = courses.find(course => course.kimvanId === courseId);
      
      if (!existingCourse) {
        throw new Error('Không tìm thấy khóa học trong hệ thống');
      }
      
      console.log('📋 Tìm thấy khóa học trong hệ thống:', existingCourse.name);
      
      // Bước 2: Gọi API để lấy dữ liệu chi tiết từ Kimvan
      console.log('🌐 Đang lấy dữ liệu từ Kimvan...');
      const response = await fetch(`/api/spreadsheets/${courseId}`);
      if (!response.ok) {
        throw new Error(`Lỗi khi lấy dữ liệu từ Kimvan: ${response.status}`);
      }
      
      const kimvanData = await response.json();
      console.log('✅ Đã nhận dữ liệu từ Kimvan');
      
      // Bước 3: Phân tích dữ liệu từ Kimvan
      console.log('🔎 Đang phân tích dữ liệu...');
      const analysis = analyzeKimvanData(kimvanData);
      console.log('📊 Kết quả phân tích:', analysis);
      
      // Lưu dữ liệu phân tích và dữ liệu đang chờ đồng bộ
      setSyncAnalysisData(analysis);
      setPendingSyncData({ existingCourse, kimvanData });
      
      // Đảm bảo state được cập nhật trước khi hiển thị modal
      setTimeout(() => {
        // Bước 4: Hiển thị modal xác nhận với dữ liệu phân tích
        console.log('🖼️ Hiển thị modal xác nhận đồng bộ');
        setShowSyncConfirmModal(true);
        setAnalyzingData(false);
        
        // Xóa thông báo đang phân tích
        setSyncResults(null);
      }, 300);
      
    } catch (err) {
      console.error('❌ Lỗi khi phân tích khóa học:', err);
      setError(err.message || 'Đã xảy ra lỗi khi phân tích khóa học từ Kimvan');
      // Hiển thị kết quả lỗi
      setSyncResults({
        inProgress: false,
        success: false,
        message: `Lỗi: ${err.message}`,
        summary: {
          total: 1,
          created: 0,
          updated: 0,
          errors: 1
        }
      });
    } finally {
      setAnalyzingCourses(prev => ({ ...prev, [courseId]: false }));
    }
  };

  // Hàm đồng bộ dữ liệu từ Kimvan
  const handleSync = async () => {
    try {
      // Đóng modal đồng bộ trước tiên để loại bỏ overlay
      setShowSyncModal(false);
      
      // Đợi một chút để đảm bảo DOM đã được cập nhật
      setTimeout(() => {
        const startSync = async () => {
          try {
            setSyncing(true);
            setSyncResults(null);
            setError(null);
            
            const response = await fetch('/api/kimvan-sync', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ 
                sync: true,
                courses: kimvanCourses
              }),
            });
            
            const data = await response.json();
            
            if (!response.ok) {
              throw new Error(data.message || 'Không thể đồng bộ dữ liệu');
            }
            
            // Hiển thị kết quả đồng bộ
            setSyncResults(data);
            
            // Tải lại danh sách khóa học
            await fetchCourses();
          } catch (err) {
            console.error('Lỗi khi đồng bộ dữ liệu:', err);
            setError(err.message || 'Đã xảy ra lỗi khi đồng bộ dữ liệu. Vui lòng kiểm tra kết nối MongoDB.');
          } finally {
            setSyncing(false);
          }
        };
        
        startSync();
      }, 300); // Tăng thời gian delay để đảm bảo overlay đã biến mất
    } catch (err) {
      console.error('Lỗi khi xử lý đồng bộ:', err);
      setError(err.message || 'Đã xảy ra lỗi khi xử lý yêu cầu đồng bộ.');
      setSyncing(false);
    }
  };

  // Hàm khởi tạo cơ sở dữ liệu
  const handleInitDatabase = async () => {
    try {
      setInitializing(true);
      setInitResult(null);
      setError(null);
      
      const response = await fetch('/api/db-initialize');
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Không thể khởi tạo cơ sở dữ liệu');
      }
      
      // Hiển thị kết quả khởi tạo
      setInitResult(data);
      
      // Nếu đã tạo dữ liệu mới, tải lại danh sách khóa học
      if (data.created) {
        await fetchCourses();
      }
    } catch (err) {
      console.error('Lỗi khi khởi tạo cơ sở dữ liệu:', err);
      setError(err.message || 'Đã xảy ra lỗi khi khởi tạo cơ sở dữ liệu. Vui lòng kiểm tra kết nối MongoDB.');
    } finally {
      setInitializing(false);
    }
  };

  // Thêm hàm xử lý khi đóng modal
  const handleCloseModal = () => {
    setShowModal(false);
  };

  // Thêm hàm xử lý khi đóng modal đồng bộ
  const handleCloseSyncModal = () => {
    setShowSyncModal(false);
  };

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

  // Hàm đồng bộ tất cả khóa học tự động với độ trễ
  const handleAutoSyncAllCourses = async () => {
    try {
      // Lọc ra các khóa học có kimvanId
      const coursesWithKimvanId = courses.filter(course => course.kimvanId);
      
      if (coursesWithKimvanId.length === 0) {
        alert('Không có khóa học nào có ID Kimvan để đồng bộ');
        return;
      }
      
      setAutoSyncInProgress(true);
      setCurrentAutoSyncIndex(0);
      setAutoSyncTotal(coursesWithKimvanId.length);
      setAutoSyncResults([]);
      setError(null);
      
      // Hàm đệ quy để đồng bộ từng khóa học một với độ trễ
      const syncNextCourse = async (index) => {
        if (index >= coursesWithKimvanId.length) {
          // Đã hoàn thành tất cả
          setAutoSyncInProgress(false);
          setSyncResults({
            inProgress: false,
            success: true,
            message: `Đã hoàn thành đồng bộ ${autoSyncResults.filter(r => r.success).length}/${coursesWithKimvanId.length} khóa học`,
            summary: {
              total: coursesWithKimvanId.length,
              created: 0,
              updated: autoSyncResults.filter(r => r.success).length,
              errors: autoSyncResults.filter(r => !r.success).length
            }
          });
          return;
        }
        
        const currentCourse = coursesWithKimvanId[index];
        setCurrentAutoSyncIndex(index);
        
        // Hiển thị thông báo đang đồng bộ
        setSyncResults({
          inProgress: true,
          success: true,
          message: `Đang đồng bộ khóa học ${index + 1}/${coursesWithKimvanId.length}: ${currentCourse.name}`,
          summary: {
            total: coursesWithKimvanId.length,
            created: 0,
            updated: autoSyncResults.filter(r => r.success).length,
            errors: autoSyncResults.filter(r => !r.success).length
          }
        });
        
        try {
          console.log(`🔄 Bắt đầu đồng bộ khóa học ${index + 1}/${coursesWithKimvanId.length}: ${currentCourse.name}`);
          
          // Đánh dấu đang phân tích
          setAnalyzingCourses(prev => ({ ...prev, [currentCourse.kimvanId]: true }));
          
          // Gọi API để lấy dữ liệu chi tiết từ Kimvan
          const response = await fetch(`/api/spreadsheets/${currentCourse.kimvanId}`);
          if (!response.ok) {
            throw new Error(`Lỗi khi lấy dữ liệu từ Kimvan: ${response.status}`);
          }
          
          const kimvanData = await response.json();
          console.log('✅ Đã nhận dữ liệu từ Kimvan');
          
          // Phân tích dữ liệu
          const analysis = analyzeKimvanData(kimvanData);
          
          // Kiểm tra xem khóa học có link YouTube không
          if (!analysis || analysis.youtubeLinks === 0) {
            console.log(`⚠️ Khóa học ${currentCourse.name} không có link YouTube, bỏ qua đồng bộ`);
            
            // Thêm kết quả bỏ qua
            setAutoSyncResults(prev => [...prev, { 
              courseId: currentCourse._id, 
              courseName: currentCourse.name,
              success: false,
              message: 'Bỏ qua đồng bộ: Không có link YouTube',
              analysis: analysis
            }]);
            
            // Chuyển sang khóa học tiếp theo sau 1 phút
            setTimeout(() => {
              syncNextCourse(index + 1);
            }, 60000); // 60000ms = 1 phút
            
            return;
          }
          
          // Định dạng dữ liệu để đồng bộ
          const courseToSync = {
            _id: currentCourse._id,
            kimvanId: currentCourse.kimvanId,
            name: currentCourse.name,
            description: currentCourse.description,
            price: currentCourse.price,
            status: currentCourse.status,
            originalData: kimvanData,
            updatedAt: new Date()
          };
          
          // Gọi API để đồng bộ với MongoDB
          const syncResponse = await fetch(`/api/admin/courses/${currentCourse._id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(courseToSync),
          });
          
          const syncData = await syncResponse.json();
          
          if (!syncResponse.ok) {
            throw new Error(syncData.message || 'Không thể đồng bộ dữ liệu');
          }
          
          console.log(`✅ Đồng bộ khóa học ${currentCourse.name} thành công`);
          
          // Đồng bộ song song với minicourses
          try {
            const miniCourse = {
              kimvanId: currentCourse.kimvanId,
              name: currentCourse.name,
              description: currentCourse.description,
              price: currentCourse.price,
              status: currentCourse.status,
              courseId: currentCourse._id,
              updatedAt: new Date()
            };
            
            const miniCourseResponse = await fetch('/api/minicourses/sync', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ 
                courses: [miniCourse] 
              }),
            });
            
            if (!miniCourseResponse.ok) {
              console.warn('⚠️ Đồng bộ minicourse không thành công');
            }
          } catch (miniErr) {
            console.error('❌ Lỗi khi đồng bộ minicourse:', miniErr);
          }
          
          // Thêm kết quả thành công
          setAutoSyncResults(prev => [...prev, { 
            courseId: currentCourse._id, 
            courseName: currentCourse.name,
            success: true,
            message: 'Đồng bộ thành công',
            analysis: analysis
          }]);
          
        } catch (err) {
          console.error(`❌ Lỗi khi đồng bộ khóa học ${currentCourse.name}:`, err);
          
          // Thêm kết quả lỗi
          setAutoSyncResults(prev => [...prev, { 
            courseId: currentCourse._id, 
            courseName: currentCourse.name,
            success: false,
            message: err.message || 'Đã xảy ra lỗi khi đồng bộ',
          }]);
        } finally {
          // Đánh dấu đã xong phân tích
          setAnalyzingCourses(prev => ({ ...prev, [currentCourse.kimvanId]: false }));
          
          // Đợi 1 phút trước khi xử lý khóa học tiếp theo
          console.log(`⏱️ Đợi 1 phút trước khi xử lý khóa học tiếp theo...`);
          setTimeout(() => {
            syncNextCourse(index + 1);
          }, 60000); // 60000ms = 1 phút
        }
      };
      
      // Bắt đầu quy trình đồng bộ với khóa học đầu tiên
      syncNextCourse(0);
      
    } catch (err) {
      console.error('Lỗi khi khởi tạo đồng bộ tự động:', err);
      setError(err.message || 'Đã xảy ra lỗi khi khởi tạo đồng bộ tự động');
      setAutoSyncInProgress(false);
    }
  };

  // Hàm dừng quá trình đồng bộ tự động
  const handleStopAutoSync = () => {
    if (window.confirm('Bạn có chắc chắn muốn dừng quá trình đồng bộ tự động?')) {
      setAutoSyncInProgress(false);
      setSyncResults({
        inProgress: false,
        success: true,
        message: `Đã dừng quá trình đồng bộ tự động sau ${autoSyncResults.length}/${autoSyncTotal} khóa học`,
        summary: {
          total: autoSyncTotal,
          created: 0,
          updated: autoSyncResults.filter(r => r.success).length,
          errors: autoSyncResults.filter(r => !r.success).length
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Quản lý khóa học</h1>
        <div className="flex space-x-4">
          <button
            onClick={handleInitDatabase}
            disabled={initializing}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
          >
            <DatabaseIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            {initializing ? 'Đang khởi tạo...' : 'Khởi tạo DB'}
          </button>
          
          <button
            onClick={handleShowSyncModal}
            disabled={syncing || autoSyncInProgress}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
          >
            <CloudArrowDownIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            {syncing ? 'Đang đồng bộ...' : 'Đồng bộ từ Kimvan'}
          </button>
          
          <button
            onClick={handleAutoSyncAllCourses}
            disabled={autoSyncInProgress || syncing}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <ArrowPathIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Đồng bộ tự động tất cả
          </button>
          
          {autoSyncInProgress && (
            <button
              onClick={handleStopAutoSync}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <XMarkIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
              Dừng đồng bộ
            </button>
          )}
          
          <button
            onClick={handleProcessAllPDFs}
            disabled={processingPDFs}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
          >
            <ArrowDownTrayIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            {processingPDFs ? 'Đang xử lý PDF...' : 'Xử lý tất cả PDF'}
          </button>
          <button
            onClick={() => setShowProcessModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
          >
            <AdjustmentsHorizontalIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Xử lý dữ liệu
          </button>
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

      {initResult && (
        <div className={`bg-${initResult.success ? 'purple' : 'red'}-50 p-4 rounded-md mb-4`}>
          <div className="flex">
            <div className="flex-shrink-0">
              <DatabaseIcon className={`h-5 w-5 text-${initResult.success ? 'purple' : 'red'}-400`} aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className={`text-sm font-medium text-${initResult.success ? 'purple' : 'red'}-800`}>
                {initResult.success ? 'Khởi tạo cơ sở dữ liệu thành công' : 'Lỗi khởi tạo cơ sở dữ liệu'}
              </h3>
              <div className={`mt-2 text-sm text-${initResult.success ? 'purple' : 'red'}-700`}>
                <p>{initResult.message}</p>
              </div>
              <div className="mt-4">
                <div className="-mx-2 -my-1.5 flex">
                  <button
                    type="button"
                    onClick={() => setInitResult(null)}
                    className={`bg-${initResult.success ? 'purple' : 'red'}-50 px-2 py-1.5 rounded-md text-sm font-medium text-${initResult.success ? 'purple' : 'red'}-800 hover:bg-${initResult.success ? 'purple' : 'red'}-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${initResult.success ? 'purple' : 'red'}-500`}
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {syncResults && (
        <div className={`bg-${syncResults.success ? 'green' : 'orange'}-50 p-4 rounded-md mb-4`}>
          <div className="flex">
            <div className="flex-shrink-0">
              {syncResults.inProgress ? (
                <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin" aria-hidden="true" />
              ) : (
                <CloudArrowDownIcon className={`h-5 w-5 text-${syncResults.success ? 'green' : 'orange'}-400`} aria-hidden="true" />
              )}
            </div>
            <div className="ml-3">
              <h3 className={`text-sm font-medium text-${syncResults.success ? 'green' : 'orange'}-800`}>
                {syncResults.inProgress ? 'Đang đồng bộ...' : (syncResults.success ? 'Đồng bộ thành công' : 'Đồng bộ không thành công')}
              </h3>
              <div className="mt-2 text-sm text-gray-700">
                <p>{syncResults.message}</p>
                {!syncResults.inProgress && (
                  <>
                    <p>Tổng số khóa học: {syncResults.summary.total}</p>
                    <p>Khóa học mới: {syncResults.summary.created}</p>
                    <p>Khóa học cập nhật: {syncResults.summary.updated}</p>
                    <p>Tổng số lỗi: {syncResults.summary.errors}</p>
                  </>
                )}
                
                {autoSyncInProgress && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full" 
                        style={{ width: `${(currentAutoSyncIndex + 1) / autoSyncTotal * 100}%` }}
                      ></div>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Tiến trình: {currentAutoSyncIndex + 1}/{autoSyncTotal} khóa học ({Math.round((currentAutoSyncIndex + 1) / autoSyncTotal * 100)}%)
                    </p>
                  </div>
                )}
                
                {autoSyncResults.length > 0 && (
                  <div className="mt-4">
                    <p className="font-medium mb-2">Chi tiết đồng bộ:</p>
                    <div className="max-h-60 overflow-y-auto">
                      {autoSyncResults.map((result, index) => (
                        <div 
                          key={index} 
                          className={`p-2 mb-1 rounded text-sm ${result.success ? 'bg-green-100' : 'bg-red-100'}`}
                        >
                          <p className="font-medium">{result.courseName}</p>
                          <p>{result.message}</p>
                          {result.analysis && (
                            <p className="text-xs text-gray-600">
                              Links: YouTube ({result.analysis.youtubeLinks}), 
                              Drive ({result.analysis.driveLinks}), 
                              PDF ({result.analysis.pdfLinks || 0})
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4">
                <div className="-mx-2 -my-1.5 flex">
                  <button   
                    type="button"
                    onClick={() => setSyncResults(null)}
                    className={`bg-${syncResults.success ? 'green' : 'orange'}-50 px-2 py-1.5 rounded-md text-sm font-medium text-${syncResults.success ? 'green' : 'orange'}-800 hover:bg-${syncResults.success ? 'green' : 'orange'}-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${syncResults.success ? 'green' : 'orange'}-500`}
                    disabled={syncResults.inProgress}
                  >
                    {syncResults.inProgress ? 'Đang xử lý...' : 'Đóng'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                Không thể kết nối với cơ sở dữ liệu MongoDB. Vui lòng kiểm tra kết nối hoặc khởi tạo cơ sở dữ liệu.
              </p>
              <button
                onClick={handleInitDatabase}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <DatabaseIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                Khởi tạo cơ sở dữ liệu
              </button>
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
                              <button
                                onClick={() => {
                                  console.log('🔄 Nút đồng bộ được nhấn cho khóa học:', course.name, 'ID:', course.kimvanId);
                                  handleSyncSingleCourse(course.kimvanId);
                                }}
                                disabled={analyzingCourses[course.kimvanId]}
                                className={`text-green-600 hover:text-green-900 mr-2 ${analyzingCourses[course.kimvanId] ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title="Đồng bộ khóa học này"
                              >
                                <ArrowPathIcon className={`h-5 w-5 ${analyzingCourses[course.kimvanId] ? 'animate-spin' : ''}`} />
                              </button>
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

      {/* Modal Xác nhận đồng bộ */}
      {showSyncModal && (
        <div>
          {/* Lớp phủ */}
          <div 
            className="fixed inset-0 bg-gray-500 bg-opacity-75 z-40 cursor-pointer" 
            onClick={handleCloseSyncModal}
          ></div>
          
          {/* Nội dung modal */}
          <div className="fixed z-50 inset-0 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                      <CloudArrowDownIcon className="h-6 w-6 text-yellow-600" aria-hidden="true" />
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Đồng bộ dữ liệu từ Kimvan
                      </h3>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500 mb-4">
                          Danh sách khóa học sẽ được đồng bộ từ Kimvan. Vui lòng kiểm tra và xác nhận để tiếp tục.
                        </p>
                        
                        {kimvanCourses.length > 0 ? (
                          <div className="mt-4 max-h-96 overflow-y-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Khóa học</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên khóa học</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {kimvanCourses.map((course, index) => (
                                  <tr key={index}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">{course.kimvanId.substring(0, 20)}...</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{course.name}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <p className="text-gray-500">Không có khóa học nào từ Kimvan</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={handleSync}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Đồng bộ ngay
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseSyncModal}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Modal Xử lý dữ liệu khóa học */}
      {showProcessModal && (
        <div>
          {/* Lớp phủ */}
          <div 
            className="fixed inset-0 bg-gray-500 bg-opacity-75 z-40 cursor-pointer" 
            onClick={() => setShowProcessModal(false)}
          ></div>
          
          {/* Nội dung modal */}
          <div className="fixed z-50 inset-0 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full" onClick={(e) => e.stopPropagation()}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-orange-100 sm:mx-0 sm:h-10 sm:w-10">
                      <AdjustmentsHorizontalIcon className="h-6 w-6 text-orange-600" aria-hidden="true" />
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Xử lý dữ liệu khóa học
                      </h3>
                      <div className="mt-4">
                        <p className="text-sm text-gray-500 mb-4">
                          Chọn phương thức xử lý và giá trị tương ứng để áp dụng cho các khóa học đã chọn.
                        </p>
                        
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Phương thức xử lý</label>
                            <select
                              value={processMethod}
                              onChange={(e) => setProcessMethod(e.target.value)}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            >
                              <option value="update_prices">Cập nhật giá</option>
                              <option value="update_status">Thay đổi trạng thái</option>
                              <option value="add_tag">Thêm thẻ</option>
                              <option value="remove_tag">Xóa thẻ</option>
                              <option value="add_category">Thêm danh mục</option>
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Giá trị</label>
                            {processMethod === 'update_status' ? (
                              <select
                                value={processValue}
                                onChange={(e) => setProcessValue(e.target.value)}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                              >
                                <option value="active">Hoạt động</option>
                                <option value="inactive">Không hoạt động</option>
                                <option value="draft">Nháp</option>
                              </select>
                            ) : (
                              <input
                                type={processMethod === 'update_prices' ? 'number' : 'text'}
                                value={processValue}
                                onChange={(e) => setProcessValue(e.target.value)}
                                placeholder={processMethod === 'update_prices' ? 'Nhập giá mới' : 'Nhập giá trị'}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                              />
                            )}
                          </div>
                          
                          <div className="bg-yellow-50 px-4 py-3 rounded-md">
                            <p className="text-sm text-yellow-700">
                              Đã chọn {selectedCourses.length} khóa học để xử lý. 
                              {selectedCourses.length === 0 && ' Vui lòng chọn ít nhất một khóa học để tiếp tục.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={handleProcessData}
                    disabled={processingData || selectedCourses.length === 0 || !processValue}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-orange-600 text-base font-medium text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {processingData ? 'Đang xử lý...' : 'Xử lý dữ liệu'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowProcessModal(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác nhận đồng bộ với phân tích dữ liệu */}
      {showSyncConfirmModal && (
        <div>
          {/* Lớp phủ */}
          <div 
            className="fixed inset-0 bg-gray-500 bg-opacity-75 z-40 cursor-pointer" 
            onClick={() => setShowSyncConfirmModal(false)}
          ></div>
          
          {/* Nội dung modal */}
          <div className="fixed z-50 inset-0 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                      <CloudArrowDownIcon className="h-6 w-6 text-blue-600" aria-hidden="true" />
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Xác nhận đồng bộ dữ liệu khóa học
                      </h3>
                      
                      {pendingSyncData && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-500 mb-1">
                            Bạn đang chuẩn bị đồng bộ dữ liệu cho khóa học sau:
                          </p>
                          <p className="text-base font-medium text-gray-900 mb-4">
                            {pendingSyncData.existingCourse.name}
                          </p>
                          
                          {/* Thẻ thống kê */}
                          {syncAnalysisData && (
                            <div className="grid grid-cols-3 gap-4 mb-6">
                              <div className="border rounded p-3 bg-red-50 shadow-sm hover:shadow-md transition-shadow">
                                <p className="text-sm text-gray-600 font-medium">Links YouTube</p>
                                <div className="flex items-center">
                                  <p className="text-2xl font-semibold text-red-600">{syncAnalysisData.youtubeLinks}</p>
                                  {syncAnalysisData.youtubeLinks > 0 && syncAnalysisData.totalLinks > 0 && (
                                    <span className="ml-2 px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                                      {Math.round((syncAnalysisData.youtubeLinks / syncAnalysisData.totalLinks) * 100)}%
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Video trực tuyến từ YouTube</p>
                              </div>
                              <div className="border rounded p-3 bg-blue-50 shadow-sm hover:shadow-md transition-shadow">
                                <p className="text-sm text-gray-600 font-medium">Links Google Drive</p>
                                <div className="flex items-center">
                                  <p className="text-2xl font-semibold text-blue-600">{syncAnalysisData.driveLinks}</p>
                                  {syncAnalysisData.driveLinks > 0 && syncAnalysisData.totalLinks > 0 && (
                                    <span className="ml-2 px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                                      {Math.round((syncAnalysisData.driveLinks / syncAnalysisData.totalLinks) * 100)}%
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Tài liệu từ Google Drive</p>
                              </div>
                              <div className="border rounded p-3 bg-green-50 shadow-sm hover:shadow-md transition-shadow">
                                <p className="text-sm text-gray-600 font-medium">Links PDF</p>
                                <div className="flex items-center">
                                  <p className="text-2xl font-semibold text-green-600">{syncAnalysisData.pdfLinks || 0}</p>
                                  {syncAnalysisData.pdfLinks > 0 && syncAnalysisData.totalLinks > 0 && (
                                    <span className="ml-2 px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                                      {Math.round((syncAnalysisData.pdfLinks / syncAnalysisData.totalLinks) * 100)}%
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Tài liệu định dạng PDF</p>
                              </div>
                            </div>
                          )}
                          
                          <div className="border rounded p-4 bg-gray-50 shadow-sm mb-4 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-medium text-gray-700">Tổng cộng tất cả liên kết</p>
                              <p className="text-xl font-bold text-gray-800">{syncAnalysisData.totalLinks}</p>
                            </div>
                            
                            <div className="flex flex-wrap gap-2 mb-3">
                              {syncAnalysisData.youtubeLinks > 0 && (
                                <span className="px-3 py-1 text-xs rounded-full bg-red-100 text-red-800 flex items-center">
                                  <span className="w-2 h-2 rounded-full bg-red-500 mr-1"></span>
                                  YouTube: {syncAnalysisData.youtubeLinks}
                                </span>
                              )}
                              {syncAnalysisData.driveLinks > 0 && (
                                <span className="px-3 py-1 text-xs rounded-full bg-blue-100 text-blue-800 flex items-center">
                                  <span className="w-2 h-2 rounded-full bg-blue-500 mr-1"></span>
                                  Drive: {syncAnalysisData.driveLinks}
                                </span>
                              )}
                              {(syncAnalysisData.pdfLinks > 0) && (
                                <span className="px-3 py-1 text-xs rounded-full bg-green-100 text-green-800 flex items-center">
                                  <span className="w-2 h-2 rounded-full bg-green-500 mr-1"></span>
                                  PDF: {syncAnalysisData.pdfLinks}
                                </span>
                              )}
                            </div>
                            
                            {/* Thanh tiến trình */}
                            <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                              {syncAnalysisData.totalLinks > 0 && (
                                <div className="flex h-full">
                                  {syncAnalysisData.youtubeLinks > 0 && (
                                    <div 
                                      className="h-full bg-red-500" 
                                      style={{width: `${(syncAnalysisData.youtubeLinks / syncAnalysisData.totalLinks) * 100}%`}}
                                    ></div>
                                  )}
                                  {syncAnalysisData.driveLinks > 0 && (
                                    <div 
                                      className="h-full bg-blue-500" 
                                      style={{width: `${(syncAnalysisData.driveLinks / syncAnalysisData.totalLinks) * 100}%`}}
                                    ></div>
                                  )}
                                  {syncAnalysisData.pdfLinks > 0 && (
                                    <div 
                                      className="h-full bg-green-500" 
                                      style={{width: `${(syncAnalysisData.pdfLinks / syncAnalysisData.totalLinks) * 100}%`}}
                                    ></div>
                                  )}
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-2">Phân tích các liên kết trong dữ liệu khóa học</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={handleConfirmSync}
                    disabled={syncing}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    {syncing ? 'Đang đồng bộ...' : 'Xác nhận đồng bộ'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSyncConfirmModal(false);
                      setPendingSyncData(null);
                    }}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 