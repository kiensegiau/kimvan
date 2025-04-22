'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, CloudArrowDownIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { ServerIcon as DatabaseIcon } from '@heroicons/react/24/outline';

export default function CoursesPage() {
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

  // Hàm để tải danh sách khóa học từ API
  const fetchCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/courses');
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
        const response = await fetch(`/api/courses/${id}`, {
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
        response = await fetch(`/api/courses/${currentCourse._id}`, {
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
        response = await fetch('/api/courses', {
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
  const handleShowSyncModal = () => {
    setShowSyncModal(true);
  };

  // Hàm đồng bộ dữ liệu từ Kimvan
  const handleSync = async () => {
    try {
      setSyncing(true);
      setSyncResults(null);
      setShowSyncModal(false);
      setError(null);
      
      const response = await fetch('/api/kimvan-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sync: true }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Không thể đồng bộ dữ liệu');
      }
      
      // Hiển thị kết quả đồng bộ
      setSyncResults(data);
      
      // Tải lại danh sách khóa học
      fetchCourses();
    } catch (err) {
      console.error('Lỗi khi đồng bộ dữ liệu:', err);
      setError(err.message || 'Đã xảy ra lỗi khi đồng bộ dữ liệu. Vui lòng kiểm tra kết nối MongoDB.');
    } finally {
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
        <div className="bg-green-50 p-4 rounded-md mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <CloudArrowDownIcon className="h-5 w-5 text-green-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Đồng bộ thành công</h3>
              <div className="mt-2 text-sm text-green-700">
                <p>Tổng số khóa học: {syncResults.summary.total}</p>
                <p>Khóa học mới: {syncResults.summary.created}</p>
                <p>Khóa học cập nhật: {syncResults.summary.updated}</p>
                <p>Tổng số lỗi: {syncResults.summary.errors}</p>
              </div>
              <div className="mt-4">
                <div className="-mx-2 -my-1.5 flex">
                  <button
                    type="button"
                    onClick={() => setSyncResults(null)}
                    className="bg-green-50 px-2 py-1.5 rounded-md text-sm font-medium text-green-800 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên khóa học</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mô tả</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Giá</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ngày tạo</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCourses.map((course) => (
                      <tr key={course._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{course.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{course.description}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {course.price.toLocaleString('vi-VN')}đ
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            course.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {course.status === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(course.createdAt).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleEdit(course)}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(course._id)}
                            className="text-red-600 hover:text-red-900"
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
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
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
                    onClick={() => setShowModal(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Hủy
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác nhận đồng bộ */}
      {showSyncModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                    <CloudArrowDownIcon className="h-6 w-6 text-yellow-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Đồng bộ dữ liệu từ Kimvan
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Bạn có chắc chắn muốn đồng bộ tất cả khóa học từ Kimvan về hệ thống? 
                        Điều này sẽ tạo mới hoặc cập nhật các khóa học hiện có.
                      </p>
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
                  onClick={() => setShowSyncModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 