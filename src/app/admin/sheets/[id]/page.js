'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, PlusIcon, PencilIcon, TrashIcon, ArrowPathIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { use } from 'react';

export default function SheetDetailPage({ params }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  
  const [sheet, setSheet] = useState(null);
  const [sheetData, setSheetData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddRelatedModal, setShowAddRelatedModal] = useState(false);
  const [showLinkCourseModal, setShowLinkCourseModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
  });
  const [relatedSheet, setRelatedSheet] = useState({
    name: '',
    description: '',
    sheetUrl: '',
  });
  const [addingRelated, setAddingRelated] = useState(false);
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [linkingCourse, setLinkingCourse] = useState(false);
  const [linkedCourses, setLinkedCourses] = useState([]);
  const [loadingLinkedCourses, setLoadingLinkedCourses] = useState(false);
  const [coursesError, setCoursesError] = useState(null);

  useEffect(() => {
    fetchSheetDetail();
    fetchLinkedCourses();
  }, [id]);

  // Tự động tải dữ liệu sheet khi có thông tin sheet
  useEffect(() => {
    if (sheet && sheet.sheetId) {
      console.log('Tự động tải dữ liệu sheet:', sheet.name);
      fetchSheetData();
    }
  }, [sheet]);

  const fetchSheetDetail = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/sheets/${id}`);
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Có lỗi xảy ra khi lấy dữ liệu');
      }
      
      setSheet(result.sheet);
      setEditForm({
        name: result.sheet.name,
        description: result.sheet.description || '',
      });
    } catch (error) {
      console.error('Lỗi khi lấy chi tiết sheet:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchLinkedCourses = async () => {
    setLoadingLinkedCourses(true);
    try {
      const response = await fetch(`/api/sheets/${id}/courses`);
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Có lỗi xảy ra khi lấy danh sách khóa học liên kết');
      }
      
      setLinkedCourses(result.courses || []);
    } catch (error) {
      console.error('Lỗi khi lấy danh sách khóa học liên kết:', error);
    } finally {
      setLoadingLinkedCourses(false);
    }
  };

  const fetchCourses = async () => {
    setLoadingCourses(true);
    setCoursesError(null);
    try {
      const response = await fetch('/api/courses');
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Có lỗi xảy ra khi lấy danh sách khóa học');
      }
      
      setCourses(result.courses || []);
    } catch (error) {
      console.error('Lỗi khi lấy danh sách khóa học:', error);
      setCoursesError(error.message);
    } finally {
      setLoadingCourses(false);
    }
  };

  const handleOpenLinkCourseModal = () => {
    fetchCourses();
    setShowLinkCourseModal(true);
  };

  const handleLinkCourse = async () => {
    if (!selectedCourse) {
      alert('Vui lòng chọn một khóa học');
      return;
    }

    setLinkingCourse(true);
    try {
      const response = await fetch(`/api/courses/${selectedCourse}/sheets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sheetId: id
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Không thể liên kết sheet với khóa học');
      }

      const result = await response.json();
      
      // Cập nhật danh sách khóa học liên kết
      fetchLinkedCourses();
      
      // Đóng modal và reset form
      setShowLinkCourseModal(false);
      setSelectedCourse('');
      
      alert('Đã liên kết sheet với khóa học thành công!');
    } catch (error) {
      console.error('Lỗi khi liên kết sheet với khóa học:', error);
      alert(`Lỗi: ${error.message}`);
    } finally {
      setLinkingCourse(false);
    }
  };

  const handleUnlinkCourse = async (courseId) => {
    if (!confirm('Bạn có chắc chắn muốn hủy liên kết sheet này với khóa học?')) {
      return;
    }

    try {
      const response = await fetch(`/api/courses/${courseId}/sheets/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Không thể hủy liên kết sheet với khóa học');
      }

      // Cập nhật danh sách khóa học liên kết
      fetchLinkedCourses();
      
      alert('Đã hủy liên kết sheet với khóa học thành công!');
    } catch (error) {
      console.error('Lỗi khi hủy liên kết sheet với khóa học:', error);
      alert(`Lỗi: ${error.message}`);
    }
  };

  const fetchSheetData = async (sheetId = null) => {
    if (!sheet && !sheetId) return;
    
    const targetId = sheetId || id;
    
    setLoadingData(true);
    try {
      const response = await fetch(`/api/sheets/${targetId}?fetchData=true`);
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Có lỗi xảy ra khi lấy dữ liệu');
      }
      
      setSheetData(result.sheet.data);
    } catch (error) {
      console.error('Lỗi khi lấy dữ liệu sheet:', error);
      setError(error.message);
    } finally {
      setLoadingData(false);
    }
  };

  const handleUpdateSheet = async () => {
    try {
      const response = await fetch(`/api/sheets/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Không thể cập nhật sheet');
      }

      const result = await response.json();
      setSheet(result.sheet);
      setShowEditModal(false);
      alert('Đã cập nhật sheet thành công!');
    } catch (error) {
      console.error('Lỗi khi cập nhật sheet:', error);
      alert(`Lỗi: ${error.message}`);
    }
  };

  const handleAddRelatedSheet = async () => {
    if (!relatedSheet.name || !relatedSheet.sheetUrl) {
      alert('Vui lòng nhập tên và URL của Google Sheet liên quan');
      return;
    }

    setAddingRelated(true);
    try {
      // Trích xuất ID từ URL
      const sheetId = extractSheetId(relatedSheet.sheetUrl);
      
      if (!sheetId) {
        throw new Error('Không thể trích xuất ID từ URL Google Sheet. Vui lòng kiểm tra lại URL.');
      }
      
      const response = await fetch(`/api/sheets/${id}/related`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: relatedSheet.name,
          description: relatedSheet.description,
          sheetId: sheetId,
          sheetUrl: relatedSheet.sheetUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Không thể thêm sheet liên quan');
      }

      const result = await response.json();
      setSheet(result.sheet);
      
      // Reset form và đóng modal
      setRelatedSheet({
        name: '',
        description: '',
        sheetUrl: '',
      });
      setShowAddRelatedModal(false);
      
      alert('Đã thêm sheet liên quan thành công!');
    } catch (error) {
      console.error('Lỗi khi thêm sheet liên quan:', error);
      alert(`Lỗi: ${error.message}`);
    } finally {
      setAddingRelated(false);
    }
  };

  const handleDeleteRelatedSheet = async (relatedId) => {
    if (!confirm('Bạn có chắc chắn muốn xóa sheet liên quan này?')) {
      return;
    }

    try {
      const response = await fetch(`/api/sheets/${id}/related?relatedId=${relatedId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Không thể xóa sheet liên quan');
      }

      const result = await response.json();
      setSheet(result.sheet);
      alert('Đã xóa sheet liên quan thành công!');
    } catch (error) {
      console.error('Lỗi khi xóa sheet liên quan:', error);
      alert(`Lỗi: ${error.message}`);
    }
  };

  const handleDeleteSheet = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa sheet này?')) {
      return;
    }

    try {
      const response = await fetch(`/api/sheets/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Không thể xóa sheet');
      }

      alert('Đã xóa sheet thành công!');
      router.push('/admin/sheets');
    } catch (error) {
      console.error('Lỗi khi xóa sheet:', error);
      alert(`Lỗi: ${error.message}`);
    }
  };

  const handleOpenGoogleSheet = (url = null) => {
    const sheetUrl = url || (sheet && sheet.sheetUrl);
    if (!sheetUrl) return;
    window.open(sheetUrl, '_blank');
  };

  const handleExportData = () => {
    if (!sheetData) return;
    
    try {
      // Tạo file JSON để tải xuống
      const blob = new Blob([JSON.stringify(sheetData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Tạo thẻ a và kích hoạt sự kiện click để tải xuống
      const a = document.createElement('a');
      a.href = url;
      a.download = `sheet-data-${sheet.name.replace(/\s+/g, '-').toLowerCase()}.json`;
      document.body.appendChild(a);
      a.click();
      
      // Dọn dẹp
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error('Lỗi khi xuất dữ liệu:', error);
      alert(`Lỗi: ${error.message}`);
    }
  };

  // Hàm xử lý nội dung cell để phát hiện và chuyển đổi URL thành liên kết
  const renderCellContent = (content) => {
    if (!content) return '';
    
    // Kiểm tra công thức HYPERLINK từ Google Sheets
    const hyperlinkRegex = /=HYPERLINK\("([^"]+)"(?:,\s*"([^"]+)")?\)/i;
    const hyperlinkMatch = typeof content === 'string' ? content.match(hyperlinkRegex) : null;
    
    if (hyperlinkMatch) {
      let url = hyperlinkMatch[1];
      const displayText = hyperlinkMatch[2] || url;
      
      // Kiểm tra loại link để hiển thị icon phù hợp
      let icon = null;
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        icon = <span className="text-red-500 mr-1" title="YouTube Video">🎬</span>;
      } else if (url.includes('drive.google.com')) {
        icon = <span className="text-blue-500 mr-1" title="Google Drive">📄</span>;
      } else if (url.includes('docs.google.com/document')) {
        icon = <span className="text-green-500 mr-1" title="Google Docs">📝</span>;
      }
      
      return (
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-blue-600 hover:underline"
        >
          {icon}{displayText}
        </a>
      );
    }
    
    // Kiểm tra xem nội dung có phải là URL không
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    // Nếu nội dung chỉ chứa URL
    if (typeof content === 'string' && urlRegex.test(content) && content.trim().match(urlRegex)[0] === content.trim()) {
      // Xác định loại URL để hiển thị icon phù hợp
      let icon = null;
      if (content.includes('youtube.com') || content.includes('youtu.be')) {
        icon = <span className="text-red-500 mr-1" title="YouTube Video">🎬</span>;
      } else if (content.includes('drive.google.com')) {
        icon = <span className="text-blue-500 mr-1" title="Google Drive">📄</span>;
      } else if (content.includes('docs.google.com/document')) {
        icon = <span className="text-green-500 mr-1" title="Google Docs">📝</span>;
      }
      
      return (
        <a 
          href={content} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-blue-600 hover:underline"
        >
          {icon}{content}
        </a>
      );
    }
    
    return content;
  };

  const renderTable = () => {
    if (!sheetData || !sheetData.values || sheetData.values.length === 0) {
      return (
        <div className="bg-gray-100 p-6 rounded-lg text-center">
          <p className="text-gray-600">Không có dữ liệu để hiển thị.</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto bg-white shadow-md rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {sheetData.values[0].map((header, index) => (
                <th 
                  key={index}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sheetData.values.slice(1).map((row, rowIndex) => {
              // Lấy dữ liệu HTML tương ứng nếu có
              const htmlRow = sheetData.htmlData?.[rowIndex + 1]?.values || [];
              
              return (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => {
                    // Kiểm tra xem có dữ liệu HTML không
                    const htmlCell = htmlRow[cellIndex];
                    const hyperlink = htmlCell?.hyperlink;
                    
                    // Nếu có hyperlink trong dữ liệu HTML
                    if (hyperlink) {
                      // Xác định loại liên kết để hiển thị icon phù hợp
                      let icon = null;
                      if (hyperlink.includes('youtube.com') || hyperlink.includes('youtu.be')) {
                        icon = <span className="text-red-500 mr-1" title="YouTube Video">🎬</span>;
                      } else if (hyperlink.includes('drive.google.com')) {
                        icon = <span className="text-blue-500 mr-1" title="Google Drive">📄</span>;
                      } else if (hyperlink.includes('docs.google.com/document')) {
                        icon = <span className="text-green-500 mr-1" title="Google Docs">📝</span>;
                      }
                      
                      return (
                        <td key={cellIndex} className="px-6 py-4 whitespace-nowrap">
                          <a 
                            href={hyperlink} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-blue-600 hover:underline"
                          >
                            {icon}{cell}
                          </a>
                        </td>
                      );
                    }
                    
                    return (
                      <td key={cellIndex} className="px-6 py-4 whitespace-nowrap">
                        {renderCellContent(cell)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4">
      <div className="flex items-center mb-6">
        <Link href="/admin/sheets" className="mr-4">
          <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
        </Link>
        <h1 className="text-2xl font-bold flex-grow">
          {loading ? 'Đang tải...' : sheet ? sheet.name : 'Chi tiết Sheet'}
        </h1>
        <div className="space-x-2">
          <button
            onClick={() => setShowEditModal(true)}
            className="bg-indigo-600 text-white px-3 py-1 rounded-md"
          >
            <PencilIcon className="h-5 w-5 inline-block" />
          </button>
          <button
            onClick={handleDeleteSheet}
            className="bg-red-600 text-white px-3 py-1 rounded-md"
          >
            <TrashIcon className="h-5 w-5 inline-block" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
        </div>
      ) : (
        <>
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-lg font-semibold mb-2">Thông tin Sheet</h2>
                <p><span className="font-medium">Tên:</span> {sheet.name}</p>
                <p><span className="font-medium">Mô tả:</span> {sheet.description || 'Không có mô tả'}</p>
                <p><span className="font-medium">ID Sheet:</span> {sheet.sheetId}</p>
                <p>
                  <span className="font-medium">Ngày tạo:</span> {new Date(sheet.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-2">Thao tác</h2>
                <div className="space-y-2">
                  <button
                    onClick={() => handleOpenGoogleSheet()}
                    className="bg-green-600 text-white px-4 py-2 rounded-md w-full"
                  >
                    Mở Google Sheet
                  </button>
                  <button
                    onClick={() => fetchSheetData()}
                    disabled={loadingData}
                    className={`bg-blue-600 text-white px-4 py-2 rounded-md w-full flex items-center justify-center ${
                      loadingData ? 'opacity-70 cursor-not-allowed' : ''
                    }`}
                  >
                    {loadingData ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                        Đang tải dữ liệu...
                      </>
                    ) : (
                      <>
                        <ArrowPathIcon className="h-5 w-5 mr-2" />
                        Tải dữ liệu Sheet
                      </>
                    )}
                  </button>
                  {sheetData && (
                    <button
                      onClick={handleExportData}
                      className="bg-purple-600 text-white px-4 py-2 rounded-md w-full flex items-center justify-center"
                    >
                      <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
                      Xuất dữ liệu (JSON)
                    </button>
                  )}
                  <button
                    onClick={handleOpenLinkCourseModal}
                    className="bg-yellow-600 text-white px-4 py-2 rounded-md w-full flex items-center justify-center"
                  >
                    <PlusIcon className="h-5 w-5 mr-2" />
                    Liên kết với khóa học
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Phần Khóa học liên kết */}
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Khóa học liên kết</h2>
              <button
                onClick={handleOpenLinkCourseModal}
                className="bg-blue-600 text-white px-3 py-1 rounded-md flex items-center"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Liên kết khóa học
              </button>
            </div>
            
            {loadingLinkedCourses ? (
              <div className="flex justify-center items-center h-20">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : !linkedCourses || linkedCourses.length === 0 ? (
              <div className="bg-gray-100 p-4 rounded-lg text-center">
                <p className="text-gray-600">Chưa có khóa học nào được liên kết với sheet này.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên khóa học</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mô tả</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {linkedCourses.map((course) => (
                      <tr key={course._id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap">
                          <Link href={`/admin/courses/${course._id}`} className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline">
                            {course.name}
                          </Link>
                        </td>
                        <td className="px-4 py-2">
                          <div className="text-sm text-gray-500">{course.description || 'Không có mô tả'}</div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            course.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {course.status === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                          </span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <Link
                              href={`/admin/courses/${course._id}`}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Xem chi tiết"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </Link>
                            <button
                              onClick={() => handleUnlinkCourse(course._id)}
                              className="text-red-600 hover:text-red-900"
                              title="Hủy liên kết"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Phần Sheet liên quan */}
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Sheet liên quan</h2>
              <button
                onClick={() => setShowAddRelatedModal(true)}
                className="bg-blue-600 text-white px-3 py-1 rounded-md flex items-center"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Thêm Sheet liên quan
              </button>
            </div>
            
            {!sheet.relatedSheets || sheet.relatedSheets.length === 0 ? (
              <div className="bg-gray-100 p-4 rounded-lg text-center">
                <p className="text-gray-600">Chưa có sheet liên quan nào.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mô tả</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Sheet</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sheet.relatedSheets.map((related) => (
                      <tr key={related._id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{related.name}</div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="text-sm text-gray-500">{related.description || 'Không có mô tả'}</div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{related.sheetId}</div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => handleOpenGoogleSheet(related.sheetUrl)}
                              className="text-green-600 hover:text-green-900"
                              title="Mở Google Sheet"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteRelatedSheet(related._id)}
                              className="text-red-600 hover:text-red-900"
                              title="Xóa"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {sheetData ? (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4">Dữ liệu Sheet</h2>
              {renderTable()}
            </div>
          ) : (
            <div className="bg-gray-100 p-6 rounded-lg text-center">
              <p className="text-gray-600">
                Nhấn "Tải dữ liệu Sheet" để xem nội dung của Google Sheet này.
              </p>
            </div>
          )}
        </>
      )}

      {/* Modal chỉnh sửa sheet */}
      {showEditModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Chỉnh sửa Sheet</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên Sheet</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nhập tên sheet"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả (tùy chọn)</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nhập mô tả cho sheet"
                    rows="3"
                  ></textarea>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleUpdateSheet}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal thêm sheet liên quan */}
      {showAddRelatedModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Thêm Sheet liên quan</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên Sheet</label>
                  <input
                    type="text"
                    value={relatedSheet.name}
                    onChange={(e) => setRelatedSheet({ ...relatedSheet, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nhập tên sheet liên quan"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả (tùy chọn)</label>
                  <textarea
                    value={relatedSheet.description}
                    onChange={(e) => setRelatedSheet({ ...relatedSheet, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nhập mô tả cho sheet liên quan"
                    rows="3"
                  ></textarea>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL Google Sheet</label>
                  <input
                    type="text"
                    value={relatedSheet.sheetUrl}
                    onChange={(e) => setRelatedSheet({ ...relatedSheet, sheetUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Dán liên kết đến Google Sheet. Đảm bảo sheet đã được chia sẻ công khai hoặc có quyền truy cập.
                  </p>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowAddRelatedModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleAddRelatedSheet}
                  disabled={addingRelated}
                  className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center ${
                    addingRelated ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {addingRelated ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      Đang xử lý...
                    </>
                  ) : (
                    'Thêm Sheet liên quan'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal liên kết với khóa học */}
      {showLinkCourseModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Liên kết với khóa học</h2>
              
              <div className="space-y-4">
                {loadingCourses ? (
                  <div className="flex justify-center items-center h-20">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : coursesError ? (
                  <div className="bg-red-100 p-4 rounded-lg text-center">
                    <p className="text-red-600">{coursesError}</p>
                    <button 
                      onClick={fetchCourses}
                      className="mt-2 px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      Thử lại
                    </button>
                  </div>
                ) : courses.length === 0 ? (
                  <div className="bg-gray-100 p-4 rounded-lg text-center">
                    <p className="text-gray-600">Không tìm thấy khóa học nào.</p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Chọn khóa học</label>
                    <select
                      value={selectedCourse}
                      onChange={(e) => setSelectedCourse(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Chọn khóa học --</option>
                      {courses.map((course) => (
                        <option key={course._id} value={course._id}>
                          {course.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowLinkCourseModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleLinkCourse}
                  disabled={linkingCourse || !selectedCourse || loadingCourses || coursesError}
                  className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center ${
                    (linkingCourse || !selectedCourse || loadingCourses || coursesError) ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {linkingCourse ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      Đang xử lý...
                    </>
                  ) : (
                    'Liên kết'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}