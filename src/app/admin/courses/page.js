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
        setCourses(retryData);
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        setHasMongoConnection(false);
        throw new Error(data.message || 'Không thể tải dữ liệu khóa học');
      }
      
      setHasMongoConnection(true);
      setCourses(data);
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
        throw new Error(data.message || 'Không thể lấy danh sách khóa học từ Kimvan');
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
      
      setKimvanCourses(kimvanCoursesOriginal || []);
      setShowSyncModal(true);
    } catch (err) {
      console.error('Lỗi khi lấy danh sách khóa học từ Kimvan:', err);
      setError(err.message || 'Đã xảy ra lỗi khi lấy danh sách khóa học từ Kimvan');
    } finally {
      setLoading(false);
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
            disabled={syncing}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
          >
            <CloudArrowDownIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            {syncing ? 'Đang đồng bộ...' : 'Đồng bộ từ Kimvan'}
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
                            <button
                              onClick={() => handleViewOriginalData(course.kimvanId)}
                              className="text-yellow-600 hover:text-yellow-900 mr-2"
                              title="Xem dữ liệu gốc"
                            >
                              <CloudArrowDownIcon className="h-5 w-5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(course._id)}
                            className="text-red-600 hover:text-red-900"
                            title="Xóa khóa học"
                          >
                            <TrashIcon className="h-5 w-5" />
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
        <>
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
        </>
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
        <>
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
        </>
      )}
    </div>
  );
} 