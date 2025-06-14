'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, PlusIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

export default function CreateCoursePage() {
  const router = useRouter();
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSheets, setSelectedSheets] = useState([]);
  const [courseForm, setCourseForm] = useState({
    name: '',
    description: '',
    price: 0,
    status: 'active',
    sheets: []
  });
  const [creatingCourse, setCreatingCourse] = useState(false);

  useEffect(() => {
    fetchSheets();
  }, []);

  const fetchSheets = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sheets');
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setSheets(data.sheets || []);
    } catch (error) {
      console.error('Lỗi khi lấy danh sách sheets:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSheetSelection = (sheet) => {
    const isSelected = selectedSheets.some(s => s._id === sheet._id);
    
    if (isSelected) {
      // Nếu đã chọn, bỏ chọn
      setSelectedSheets(selectedSheets.filter(s => s._id !== sheet._id));
    } else {
      // Nếu chưa chọn, thêm vào danh sách
      setSelectedSheets([...selectedSheets, sheet]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCourseForm({
      ...courseForm,
      [name]: name === 'price' ? parseFloat(value) || 0 : value
    });
  };

  const handleCreateCourse = async () => {
    if (!courseForm.name) {
      alert('Vui lòng nhập tên khóa học');
      return;
    }

    if (selectedSheets.length === 0) {
      alert('Vui lòng chọn ít nhất một Google Sheet');
      return;
    }

    setCreatingCourse(true);
    try {
      const courseData = {
        ...courseForm,
        sheets: selectedSheets.map(sheet => ({
          _id: sheet._id,
          name: sheet.name,
          sheetId: sheet.sheetId,
          sheetUrl: sheet.sheetUrl
        }))
      };

      const response = await fetch('/api/courses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(courseData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Không thể tạo khóa học');
      }

      const result = await response.json();
      alert('Đã tạo khóa học thành công!');
      router.push(`/admin/courses/${result.course._id}`);
    } catch (error) {
      console.error('Lỗi khi tạo khóa học:', error);
      alert(`Lỗi: ${error.message}`);
    } finally {
      setCreatingCourse(false);
    }
  };

  return (
    <div className="container mx-auto px-4">
      <div className="flex items-center mb-6">
        <Link href="/admin/courses" className="mr-4">
          <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
        </Link>
        <h1 className="text-2xl font-bold">Tạo khóa học mới</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Thông tin khóa học</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên khóa học</label>
                <input
                  type="text"
                  name="name"
                  value={courseForm.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nhập tên khóa học"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <textarea
                  name="description"
                  value={courseForm.description}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nhập mô tả khóa học"
                  rows="4"
                ></textarea>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giá (VND)</label>
                  <input
                    type="number"
                    name="price"
                    value={courseForm.price}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                  <select
                    name="status"
                    value={courseForm.status}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Hoạt động</option>
                    <option value="draft">Bản nháp</option>
                    <option value="inactive">Không hoạt động</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white shadow-md rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Chọn Google Sheets</h2>
              <Link href="/admin/sheets" className="text-blue-600 hover:underline text-sm flex items-center">
                <PlusIcon className="h-4 w-4 mr-1" />
                Thêm Sheet mới
              </Link>
            </div>
            
            {loading ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : error ? (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                <p>{error}</p>
              </div>
            ) : sheets.length === 0 ? (
              <div className="bg-gray-100 p-6 rounded-lg text-center">
                <p className="text-gray-600">Chưa có Google Sheet nào. Hãy thêm sheet mới để bắt đầu.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {sheets.map((sheet) => {
                  const isSelected = selectedSheets.some(s => s._id === sheet._id);
                  
                  return (
                    <div 
                      key={sheet._id}
                      className={`border rounded-md p-3 cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-blue-50 border-blue-400' 
                          : 'hover:bg-gray-50 border-gray-200'
                      }`}
                      onClick={() => handleSheetSelection(sheet)}
                    >
                      <div className="flex items-start">
                        <div className={`w-5 h-5 rounded-sm border flex-shrink-0 mr-3 mt-1 ${
                          isSelected 
                            ? 'bg-blue-500 border-blue-500 flex items-center justify-center' 
                            : 'border-gray-300'
                        }`}>
                          {isSelected && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-grow">
                          <div className="flex justify-between">
                            <h3 className="font-medium text-gray-900">{sheet.name}</h3>
                            <span className="text-xs text-gray-500">
                              {new Date(sheet.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{sheet.description || 'Không có mô tả'}</p>
                          <div className="mt-1 flex items-center">
                            <DocumentTextIcon className="h-4 w-4 text-gray-400 mr-1" />
                            <span className="text-xs text-gray-500">{sheet.sheetId}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        
        <div className="md:col-span-1">
          <div className="bg-white shadow-md rounded-lg p-6 sticky top-6">
            <h2 className="text-lg font-semibold mb-4">Tóm tắt</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700">Tên khóa học</h3>
                <p className="text-gray-900">{courseForm.name || 'Chưa có tên'}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-700">Sheets đã chọn</h3>
                {selectedSheets.length === 0 ? (
                  <p className="text-gray-500 italic">Chưa chọn sheet nào</p>
                ) : (
                  <ul className="list-disc list-inside text-gray-900">
                    {selectedSheets.map(sheet => (
                      <li key={sheet._id} className="text-sm">{sheet.name}</li>
                    ))}
                  </ul>
                )}
              </div>
              
              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={handleCreateCourse}
                  disabled={creatingCourse || !courseForm.name || selectedSheets.length === 0}
                  className={`w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center justify-center ${
                    (creatingCourse || !courseForm.name || selectedSheets.length === 0) 
                      ? 'opacity-70 cursor-not-allowed' 
                      : ''
                  }`}
                >
                  {creatingCourse ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      Đang tạo...
                    </>
                  ) : (
                    <>
                      <PlusIcon className="h-5 w-5 mr-2" />
                      Tạo khóa học
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 