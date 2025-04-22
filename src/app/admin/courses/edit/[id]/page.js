'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import { ArrowLeftIcon, PencilIcon, TrashIcon, CloudArrowDownIcon, ExclamationCircleIcon, XMarkIcon, ArrowPathIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

export default function CourseEditPage({ params }) {
  const router = useRouter();
  const courseId = use(params).id; // Sử dụng React.use() để unwrap params
  
  const [course, setCourse] = useState(null);
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveResult, setSaveResult] = useState(null);

  // Hàm lấy thông tin khóa học theo ID
  const fetchCourse = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/courses/${courseId}?type=_id`);
      
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      
      const courseData = await response.json();
      setCourse(courseData);
      setFormData({
        ...courseData,
        // Đảm bảo các trường cần thiết đều có giá trị
        name: courseData.name || '',
        description: courseData.description || '',
        price: courseData.price || 0,
        status: courseData.status || 'inactive',
      });
      
      setLoading(false);
    } catch (error) {
      console.error('Lỗi khi lấy thông tin khóa học:', error);
      setError(`Không thể lấy thông tin khóa học: ${error.message}`);
      setLoading(false);
    }
  };

  // Hàm lưu thông tin khóa học
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/courses/${courseId}?type=_id`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Lỗi ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Hiển thị thông báo thành công
      setSaveResult({
        success: true,
        message: 'Lưu thông tin khóa học thành công!',
      });
      
      // Tải lại thông tin khóa học
      await fetchCourse();
    } catch (error) {
      console.error('Lỗi khi lưu thông tin khóa học:', error);
      setSaveResult({
        success: false,
        message: `Lỗi: ${error.message}`,
      });
    } finally {
      setSaving(false);
      // Đặt hẹn giờ để ẩn thông báo sau vài giây
      setTimeout(() => {
        setSaveResult(null);
      }, 5000);
    }
  };

  // Tải thông tin khóa học khi component được tạo
  useEffect(() => {
    fetchCourse();
  }, [courseId]);

  // Hàm xử lý khi người dùng thay đổi trường input
  const handleChange = (e) => {
    const { name, value, type } = e.target;
    
    // Xử lý các trường khác nhau dựa vào loại
    if (type === 'number') {
      setFormData({
        ...formData,
        [name]: parseInt(value, 10) || 0,
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
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

  if (!formData) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-8 relative">
          <div className="text-center py-10">
            <p className="text-gray-500">Không tìm thấy thông tin khóa học</p>
            <button
              onClick={() => router.push('/admin/courses')}
              className="mt-4 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <ArrowLeftIcon className="-ml-0.5 mr-2 h-4 w-4" />
              Quay lại danh sách
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-8 relative">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <button
            onClick={() => router.push(`/admin/courses/${courseId}`)}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200"
          >
            <ArrowLeftIcon className="-ml-0.5 mr-2 h-4 w-4" />
            Quay lại trang chi tiết
          </button>
          
          <h1 className="text-xl font-semibold text-gray-900">Chỉnh sửa khóa học</h1>
        </div>
        
        {/* Thông báo kết quả lưu */}
        {saveResult && (
          <div className={`bg-${saveResult.success ? 'green' : 'red'}-50 p-4 rounded-md mb-6`}>
            <div className="flex">
              <div className="flex-shrink-0">
                {saveResult.success ? (
                  <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <ExclamationCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
                )}
              </div>
              <div className="ml-3">
                <p className={`text-sm font-medium text-${saveResult.success ? 'green' : 'red'}-800`}>
                  {saveResult.message}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Form chỉnh sửa */}
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6">
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-6">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Tên khóa học
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="name"
                  id="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  required
                />
              </div>
            </div>

            <div className="sm:col-span-6">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Mô tả
              </label>
              <div className="mt-1">
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  value={formData.description}
                  onChange={handleChange}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  required
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                Giá (VND)
              </label>
              <div className="mt-1">
                <input
                  type="number"
                  name="price"
                  id="price"
                  value={formData.price}
                  onChange={handleChange}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  required
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                Trạng thái
              </label>
              <div className="mt-1">
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                >
                  <option value="active">Đang hoạt động</option>
                  <option value="inactive">Ngừng hoạt động</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-5">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => router.push(`/admin/courses/${courseId}`)}
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mr-3"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
                    Đang lưu...
                  </>
                ) : (
                  'Lưu thay đổi'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
} 